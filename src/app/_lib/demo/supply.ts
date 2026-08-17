import {
  DEFAULT_LEAD_DAYS,
  DEFAULT_PACK_SIZE,
  DEFAULT_UNITS_PER_DOSE,
  buildSupplyView,
  logWindowStart,
  withLoggedDoses,
  type SupplyContact,
  type SupplyRow,
  type SupplyViewInput,
} from "@convex/tm/logicSupply";
import type { StackItem } from "@convex/tm/logicStack";
import type { DemoDb } from "../demo-db";
import type { SupplyData } from "../types";

/**
 * Demo mirror of convex/tm/supply.ts. Same gather, same shared logic, same
 * shape — the view type is derived from the Convex query, so any drift is a
 * build error.
 */

function gather(db: DemoDb, slug: string, date: string): SupplyViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const items: StackItem[] = db.protocolItems
    .filter((r) => r.userSlug === slug)
    .map(({ userSlug: _slug, ...row }) => row);

  const supplyBase: SupplyRow[] = db.supplyRows
    .filter((r) => r.userSlug === slug)
    .map(({ id: _id, userSlug: _slug, ...row }) => row);

  // Doses logged since each count, read over the same bounded window the
  // Convex gather scans: oldest count on file, floored by the projection
  // ceiling. The max() rule in logicSupply means a missing log can only let
  // the schedule win — the safe direction.
  const from = logWindowStart(supplyBase, date);
  const logs =
    supplyBase.length === 0
      ? []
      : db.doseLogs
          .filter((r) => r.userSlug === slug && r.date >= from && r.date <= date)
          .map((r) => ({ itemId: r.itemId, date: r.date, taken: r.taken }));

  const supply = withLoggedDoses(supplyBase, logs, date);

  const contacts: SupplyContact[] = db.contacts
    .filter((r) => r.userSlug === slug)
    .map((r) => ({ id: r.id, kind: r.kind, name: r.name, phone: r.phone, note: r.note ?? null }));

  return { mode: user.modeMut, date, userName: user.name, items, supply, contacts };
}

export function view(db: DemoDb, slug: string, date: string): SupplyData {
  return buildSupplyView(gather(db, slug, date));
}

export function setCount(
  db: DemoDb,
  slug: string,
  date: string,
  itemId: string,
  onHand: number,
): void {
  const item = db.protocolItems.find((r) => r.id === itemId && r.userSlug === slug);
  if (!item) throw new Error("not-your-item");
  if (!Number.isFinite(onHand) || onHand < 0) throw new Error("bad-count");
  const counted = Math.round(onHand * 100) / 100;

  const existing = db.supplyRows.find((r) => r.userSlug === slug && r.itemId === itemId);
  if (existing) {
    existing.onHand = counted;
    existing.lastCountedDate = date;
    return;
  }
  // First count for this item. Defaults describe the packet, not the dose.
  db.supplyRows.push({
    id: db.newId("sp"),
    userSlug: slug,
    itemId,
    onHand: counted,
    unitsPerDose: DEFAULT_UNITS_PER_DOSE,
    packSize: DEFAULT_PACK_SIZE,
    lastCountedDate: date,
    reorderLeadDays: DEFAULT_LEAD_DAYS,
  });
}

export function saveContact(
  db: DemoDb,
  slug: string,
  kind: "gp" | "pharmacy",
  name: string,
  phone: string,
): void {
  const trimmedName = name.trim().slice(0, 120);
  const trimmedPhone = phone.trim().slice(0, 40);
  if (trimmedName === "" || trimmedPhone === "") throw new Error("bad-contact");

  const existing = db.contacts.find((r) => r.userSlug === slug && r.kind === kind);
  if (existing) {
    existing.name = trimmedName;
    existing.phone = trimmedPhone;
    return;
  }
  db.contacts.push({ id: db.newId("ct"), userSlug: slug, kind, name: trimmedName, phone: trimmedPhone });
}

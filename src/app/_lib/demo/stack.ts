import { addDays } from "@convex/tm/lib";
import {
  ADHERENCE_WINDOW_DAYS,
  buildStackView,
  type DoseLog,
  type StackItem,
  type StackViewInput,
} from "@convex/tm/logicStack";
import type { DemoDb } from "../demo-db";
import type { StackData } from "../types";

/**
 * Demo mirror of convex/tm/stack.ts. Same gather, same shared logic, same shape —
 * the view type is derived from the Convex query, so any drift is a build error.
 */

function gather(db: DemoDb, slug: string, date: string): StackViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");
  const from = addDays(date, -(ADHERENCE_WINDOW_DAYS - 1));

  const items: StackItem[] = db.protocolItems
    .filter((r) => r.userSlug === slug)
    .map(({ userSlug: _slug, ...row }) => row);

  const logs: DoseLog[] = db.doseLogs
    .filter((r) => r.userSlug === slug && r.date >= from && r.date <= date)
    .map((r) => ({ itemId: r.itemId, date: r.date, timing: r.timing, taken: r.taken, site: r.site }));

  return { mode: user.modeMut, date, items, logs };
}

export function view(db: DemoDb, slug: string, date: string): StackData {
  return buildStackView(gather(db, slug, date));
}

export function logDose(
  db: DemoDb,
  slug: string,
  date: string,
  itemId: string,
  timing: string,
  taken: boolean,
  site?: string,
): void {
  const item = db.protocolItems.find((r) => r.id === itemId && r.userSlug === slug);
  if (!item) throw new Error("not-your-item");
  if (!item.timings.includes(timing)) throw new Error("unknown-timing");

  const existing = db.doseLogs.find(
    (r) => r.userSlug === slug && r.date === date && r.itemId === itemId && r.timing === timing,
  );
  if (existing) {
    // One row per (item, timing, date). A missing site leaves the old one alone.
    existing.taken = taken;
    if (site !== undefined) existing.site = site;
    return;
  }
  const row: DoseLog & { userSlug: string } = { userSlug: slug, date, itemId, timing, taken };
  if (site !== undefined) row.site = site;
  db.doseLogs.push(row);
}

export function setItemActive(db: DemoDb, itemId: string, active: boolean): void {
  const item = db.protocolItems.find((r) => r.id === itemId);
  if (!item) return;
  // Pausing an item stops the schedule; it never deletes the history behind it.
  item.active = active;
}

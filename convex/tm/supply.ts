import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireUser } from "./db";
import type { StackItem } from "./logic-stack";
import {
  DEFAULT_LEAD_DAYS,
  DEFAULT_PACK_SIZE,
  DEFAULT_UNITS_PER_DOSE,
  buildSupplyView,
  type SupplyContact,
  type SupplyRow,
  type SupplyView,
  type SupplyViewInput,
} from "./logic-supply";

/**
 * Supply — never run out.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and both mutations re-check that the row they touch is
 * the caller's. Nothing here reads another user's data.
 *
 * This module counts. It never prescribes: the refill message names only what
 * is already on the file, and no handler proposes a dose, a quantity or a
 * change to a prescription.
 */

const MAX_ITEMS = 200;
const MAX_SUPPLY = 200;
const MAX_CONTACTS = 16;

const contactKind = v.union(v.literal("gp"), v.literal("pharmacy"));

async function gather(
  ctx: QueryCtx,
  user: Doc<"tm_users">,
  date: string,
): Promise<SupplyViewInput> {
  const itemRows = await ctx.db
    .query("tm_protocolItems")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_ITEMS);

  const supplyRows = await ctx.db
    .query("tm_supply")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_SUPPLY);

  const contactRows = await ctx.db
    .query("tm_contacts")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_CONTACTS);

  const items: StackItem[] = itemRows.map((r) => ({
    id: r._id,
    name: r.name,
    kind: r.kind,
    dose: r.dose,
    unit: r.unit,
    route: r.route,
    timings: r.timings,
    scheduleType: r.scheduleType,
    weekdays: r.weekdays,
    intervalDays: r.intervalDays,
    cycleOnWeeks: r.cycleOnWeeks,
    cycleOffWeeks: r.cycleOffWeeks,
    startDate: r.startDate,
    endDate: r.endDate,
    withFood: r.withFood,
    evidence: r.evidence,
    cautions: r.cautions,
    note: r.note,
    recon: r.recon,
    active: r.active,
  }));

  const supply: SupplyRow[] = supplyRows.map((r) => ({
    itemId: r.itemId,
    onHand: r.onHand,
    unitsPerDose: r.unitsPerDose,
    packSize: r.packSize,
    lastCountedDate: r.lastCountedDate,
    reorderLeadDays: r.reorderLeadDays,
    scriptExpiryDate: r.scriptExpiryDate,
    repeatsRemaining: r.repeatsRemaining,
  }));

  const contacts: SupplyContact[] = contactRows.map((r) => ({
    id: r._id,
    kind: r.kind,
    name: r.name,
    phone: r.phone,
    note: r.note ?? null,
  }));

  return { mode: user.mode, date, userName: user.name, items, supply, contacts };
}

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }): Promise<SupplyView> => {
    const user = await requireUser(ctx, token);
    return buildSupplyView(await gather(ctx, user, date));
  },
});

/**
 * A fresh count. Stamped with the date it was taken, because a count is only
 * worth what its age says it is worth.
 */
export const setCount = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    itemId: v.id("tm_protocolItems"),
    onHand: v.number(),
  },
  handler: async (ctx, { token, date, itemId, onHand }) => {
    const user = await requireUser(ctx, token);
    const item = await ctx.db.get("tm_protocolItems", itemId);
    // An id is not authority — the row must be this caller's own.
    if (!item || item.userId !== user._id) throw new ConvexError("not-your-item");
    if (!Number.isFinite(onHand) || onHand < 0) throw new ConvexError("bad-count");
    const counted = Math.round(onHand * 100) / 100;

    const existing = await ctx.db
      .query("tm_supply")
      .withIndex("by_userId_and_itemId", (q) => q.eq("userId", user._id).eq("itemId", itemId))
      .unique();

    if (existing) {
      await ctx.db.patch("tm_supply", existing._id, { onHand: counted, lastCountedDate: date });
    } else {
      // First count for this item. Defaults describe the packet, not the dose —
      // nothing here decides what is taken or how much.
      await ctx.db.insert("tm_supply", {
        userId: user._id,
        itemId,
        onHand: counted,
        unitsPerDose: DEFAULT_UNITS_PER_DOSE,
        packSize: DEFAULT_PACK_SIZE,
        lastCountedDate: date,
        reorderLeadDays: DEFAULT_LEAD_DAYS,
      });
    }
    return null;
  },
});

/** One GP and one pharmacy per file, so a refill is a tap rather than a search. */
export const saveContact = mutation({
  args: { token: v.string(), kind: contactKind, name: v.string(), phone: v.string() },
  handler: async (ctx, { token, kind, name, phone }) => {
    const user = await requireUser(ctx, token);
    const trimmedName = name.trim().slice(0, 120);
    const trimmedPhone = phone.trim().slice(0, 40);
    if (trimmedName === "" || trimmedPhone === "") throw new ConvexError("bad-contact");

    const rows = await ctx.db
      .query("tm_contacts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_CONTACTS);
    const existing = rows.find((r) => r.kind === kind);

    if (existing) {
      await ctx.db.patch("tm_contacts", existing._id, { name: trimmedName, phone: trimmedPhone });
    } else {
      await ctx.db.insert("tm_contacts", {
        userId: user._id,
        kind,
        name: trimmedName,
        phone: trimmedPhone,
      });
    }
    return null;
  },
});

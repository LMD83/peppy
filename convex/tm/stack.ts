import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { addDays } from "./lib";
import { requireUser } from "./db";
import {
  ADHERENCE_WINDOW_DAYS,
  buildStackView,
  type DoseLog,
  type StackItem,
  type StackView,
  type StackViewInput,
} from "./logic-stack";

/**
 * Stack — meds, peptides and supplements.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and both mutations re-check that the row they are about
 * to touch is the caller's. Nothing here reads another user's data, so nothing
 * here can reach the crew projection.
 *
 * This module records. It never prescribes: no handler invents a compound, a
 * dose or a schedule the user did not configure.
 */

const dateArg = v.string();

const MAX_ITEMS = 200;
const MAX_LOGS = 2000;

async function gather(
  ctx: QueryCtx,
  user: Doc<"tm_users">,
  date: string,
): Promise<StackViewInput> {
  const from = addDays(date, -(ADHERENCE_WINDOW_DAYS - 1));

  const itemRows = await ctx.db
    .query("tm_protocolItems")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_ITEMS);

  const logRows = await ctx.db
    .query("tm_doseLogs")
    .withIndex("by_userId_and_date", (q) =>
      q.eq("userId", user._id).gte("date", from).lte("date", date),
    )
    .take(MAX_LOGS);

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

  const logs: DoseLog[] = logRows.map((r) => ({
    itemId: r.itemId,
    date: r.date,
    timing: r.timing,
    taken: r.taken,
    site: r.site,
  }));

  return { mode: user.mode, date, items, logs };
}

export const get = query({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }): Promise<StackView> => {
    const user = await requireUser(ctx, token);
    return buildStackView(await gather(ctx, user, date));
  },
});

export const logDose = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    itemId: v.id("tm_protocolItems"),
    timing: v.string(),
    taken: v.boolean(),
    site: v.optional(v.string()),
  },
  handler: async (ctx, { token, date, itemId, timing, taken, site }) => {
    const user = await requireUser(ctx, token);
    const item = await ctx.db.get("tm_protocolItems", itemId);
    // An id is not authority — the row must be this caller's own.
    if (!item || item.userId !== user._id) throw new ConvexError("not-your-item");
    // Only a timing the item actually carries can be logged against it.
    if (!item.timings.includes(timing)) throw new ConvexError("unknown-timing");

    const sameDay = await ctx.db
      .query("tm_doseLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(MAX_ITEMS);
    const existing = sameDay.find((r) => r.itemId === itemId && r.timing === timing);

    if (existing) {
      // One row per (item, timing, date). A missing site leaves the old one alone.
      const patch: { taken: boolean; site?: string } = { taken };
      if (site !== undefined) patch.site = site;
      await ctx.db.patch("tm_doseLogs", existing._id, patch);
    } else {
      await ctx.db.insert("tm_doseLogs", {
        userId: user._id,
        date,
        itemId,
        timing,
        taken,
        site,
      });
    }
    return null;
  },
});

export const setItemActive = mutation({
  args: { token: v.string(), itemId: v.id("tm_protocolItems"), active: v.boolean() },
  handler: async (ctx, { token, itemId, active }) => {
    const user = await requireUser(ctx, token);
    const item = await ctx.db.get("tm_protocolItems", itemId);
    if (!item || item.userId !== user._id) throw new ConvexError("not-your-item");
    // Pausing an item stops the schedule; it never deletes the history behind it.
    await ctx.db.patch("tm_protocolItems", itemId, { active });
    return null;
  },
});

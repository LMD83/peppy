import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { addDays } from "./lib";
import { requireUser } from "./db";
import { FOODS } from "./data/foods";
import {
  WINDOW_DAYS,
  buildFuelView,
  isKnownFood,
  planDay,
  resolveTargets,
  type FuelTargets,
  type FuelView,
  type FuelViewInput,
  type RawMealEntry,
  type WeighIn,
} from "./logic-fuel";

/**
 * Fuel — intake, adaptive expenditure, meal planning.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and the two id-bearing mutations re-check ownership
 * before they touch a row. Nothing here reads another user's data, so nothing
 * here can leak into the crew projection.
 */

const dateArg = v.string();
const slotArg = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("snack"),
);

const MAX_GRAMS = 3000;

/** Gather everything the view and the planner both need. One pass, bounded. */
async function gather(
  ctx: QueryCtx,
  user: Doc<"tm_users">,
  date: string,
): Promise<FuelViewInput> {
  const from = addDays(date, -(WINDOW_DAYS - 1));

  const mealRows = await ctx.db
    .query("tm_mealEntries")
    .withIndex("by_userId_and_date", (q) =>
      q.eq("userId", user._id).gte("date", from).lte("date", date),
    )
    .take(600);

  // Weigh-ins: 60 days back covers the 14-day fit and the latest mass.
  const dayRows = await ctx.db
    .query("tm_days")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(60);

  const targetRows = await ctx.db
    .query("tm_nutritionTargets")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(30);

  const estimateRows = await ctx.db
    .query("tm_energyEstimates")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(30);

  const windowEntries: RawMealEntry[] = mealRows.map((r) => ({
    id: r._id,
    date: r.date,
    slot: r.slot,
    foodKey: r.foodKey,
    grams: r.grams,
    planned: r.planned,
    eaten: r.eaten,
  }));

  const weighIns: WeighIn[] = [];
  for (const d of dayRows) if (d.weightKg !== undefined) weighIns.push({ date: d.date, weightKg: d.weightKg });
  const latestWeightKg = weighIns[0]?.weightKg ?? user.startKg;

  // A manual row pins the targets; an adaptive row is a record of a past
  // derivation, so the live fit stays authoritative.
  const manualRow = targetRows
    .filter((t) => t.basis === "manual" && t.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const manualTarget: FuelTargets | null = manualRow
    ? {
        kcal: manualRow.kcal,
        proteinG: manualRow.proteinG,
        carbsG: manualRow.carbsG,
        fatG: manualRow.fatG,
        fiberG: manualRow.fiberG,
        sodiumMgMax: manualRow.sodiumMgMax,
      }
    : null;

  const weekly = estimateRows.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

  return {
    mode: user.mode,
    date,
    windowEntries,
    weighIns,
    latestWeightKg,
    manualTarget,
    lastWeekly: weekly ? { weekStart: weekly.weekStart, tdeeKcal: weekly.tdeeKcal } : null,
    foods: FOODS,
  };
}

export const get = query({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }): Promise<FuelView> => {
    const user = await requireUser(ctx, token);
    return buildFuelView(await gather(ctx, user, date));
  },
});

export const logFood = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    slot: slotArg,
    foodKey: v.string(),
    grams: v.number(),
  },
  handler: async (ctx, { token, date, slot, foodKey, grams }) => {
    const user = await requireUser(ctx, token);
    if (!isKnownFood(foodKey)) throw new ConvexError("unknown-food");
    if (!Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS)
      throw new ConvexError("bad-portion");
    // Logging is the record of an eaten portion — plan rows arrive via generatePlan.
    await ctx.db.insert("tm_mealEntries", {
      userId: user._id,
      date,
      slot,
      foodKey,
      grams: Math.round(grams),
      planned: false,
      eaten: true,
    });
    return null;
  },
});

export const setFoodEaten = mutation({
  args: { token: v.string(), entryId: v.id("tm_mealEntries"), eaten: v.boolean() },
  handler: async (ctx, { token, entryId, eaten }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db.get("tm_mealEntries", entryId);
    // An id is not authority — the row must be this caller's own.
    if (!row || row.userId !== user._id) throw new ConvexError("not-your-entry");
    await ctx.db.patch("tm_mealEntries", entryId, { eaten });
    return null;
  },
});

export const removeFood = mutation({
  args: { token: v.string(), entryId: v.id("tm_mealEntries") },
  handler: async (ctx, { token, entryId }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db.get("tm_mealEntries", entryId);
    if (!row || row.userId !== user._id) throw new ConvexError("not-your-entry");
    await ctx.db.delete("tm_mealEntries", entryId);
    return null;
  },
});

export const generatePlan = mutation({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }) => {
    const user = await requireUser(ctx, token);
    // Survival is a floor, not a lite mode: no plan, no new obligations.
    if (user.mode === "survival") return null;

    const rows = await ctx.db
      .query("tm_mealEntries")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(200);
    for (const row of rows) {
      if (row.planned && !row.eaten) await ctx.db.delete("tm_mealEntries", row._id);
    }

    const input = await gather(ctx, user, date);
    const { targets } = resolveTargets(input);
    for (const item of planDay(targets, FOODS, date)) {
      await ctx.db.insert("tm_mealEntries", {
        userId: user._id,
        date,
        slot: item.slot,
        foodKey: item.foodKey,
        grams: item.grams,
        planned: true,
        eaten: false,
      });
    }
    return null;
  },
});

import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { addDays } from "./lib";
import { requireUser } from "./db";
import { FOODS, foodByKey } from "./data/foods";
import {
  DEFAULT_HORIZON_DAYS,
  buildShopView,
  type PantryRow,
  type PlannedEntry,
  type ShopView,
  type ShopViewInput,
} from "./logic-shop";

/**
 * Shop — the meal plan turned into a list that actually gets used.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and both mutations only ever touch rows they found under
 * that same key. Nothing here reads another user's data, and nothing here
 * leaves the file — the hand-off happens in the browser, from a link the user
 * taps, so no request is ever made to a retailer on their behalf.
 *
 * This module shops a plan. It never proposes a food, a quantity, or a change
 * to what anyone eats: the plan came from Fuel, the cupboard counts came from
 * the user, and the pack sizes describe a shelf.
 */

const MAX_MEAL_ROWS = 600;
const MAX_PANTRY_ROWS = 200;
const MAX_PANTRY_GRAMS = 20000;

async function gather(ctx: QueryCtx, user: Doc<"tm_users">, date: string): Promise<ShopViewInput> {
  // Survival narrows the window inside the logic; the read stays the same so
  // switching modes never changes what was fetched, only what is shown.
  const lastDate = addDays(date, DEFAULT_HORIZON_DAYS - 1);

  const mealRows = await ctx.db
    .query("tm_mealEntries")
    .withIndex("by_userId_and_date", (q) =>
      q.eq("userId", user._id).gte("date", date).lte("date", lastDate),
    )
    .take(MAX_MEAL_ROWS);

  const pantryRows = await ctx.db
    .query("tm_pantry")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_PANTRY_ROWS);

  // Planned and not yet eaten. An eaten row is already in the person; a
  // logged-but-unplanned row was bought without us.
  const entries: PlannedEntry[] = mealRows
    .filter((r) => r.planned && !r.eaten)
    .map((r) => ({ date: r.date, foodKey: r.foodKey, grams: r.grams }));

  const pantry: PantryRow[] = pantryRows.map((r) => ({ foodKey: r.foodKey, grams: r.grams }));

  return {
    mode: user.mode,
    date,
    entries,
    foods: FOODS,
    pantry,
    horizonDays: DEFAULT_HORIZON_DAYS,
  };
}

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }): Promise<ShopView> => {
    const user = await requireUser(ctx, token);
    return buildShopView(await gather(ctx, user, date));
  },
});

/**
 * "I already have it."
 *
 * One row per food, holding grams in the house. Zero clears the row rather than
 * storing a zero, so the cupboard never fills with things the user does not
 * have. The date is stamped because a cupboard count, like a pill count, is
 * only worth what its age says it is worth.
 */
export const setPantry = mutation({
  args: { token: v.string(), date: v.string(), foodKey: v.string(), grams: v.number() },
  handler: async (ctx, { token, date, foodKey, grams }) => {
    const user = await requireUser(ctx, token);
    // A food key is not free text — it has to be one the catalogue knows.
    if (!foodByKey(foodKey)) throw new ConvexError("unknown-food");
    if (!Number.isFinite(grams) || grams < 0) throw new ConvexError("bad-grams");
    const amount = Math.min(Math.round(grams), MAX_PANTRY_GRAMS);

    const rows = await ctx.db
      .query("tm_pantry")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_PANTRY_ROWS);
    const existing = rows.find((r) => r.foodKey === foodKey);

    if (amount === 0) {
      if (existing) await ctx.db.delete("tm_pantry", existing._id);
      return null;
    }
    if (existing) {
      await ctx.db.patch("tm_pantry", existing._id, { grams: amount, updatedDate: date });
    } else {
      await ctx.db.insert("tm_pantry", { userId: user._id, foodKey, grams: amount, updatedDate: date });
    }
    return null;
  },
});

/** Empty the cupboard in one tap — after a shop, the counts are all stale. */
export const clearPantry = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    const rows = await ctx.db
      .query("tm_pantry")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_PANTRY_ROWS);
    for (const row of rows) await ctx.db.delete("tm_pantry", row._id);
    return null;
  },
});

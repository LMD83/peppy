import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { addDays } from "./lib";
import { requireUser } from "./db";
import { ALLERGENS, FOODS, lesserEquipment, type Allergen, type FoodEquipment } from "./data/foods";
import { MENUS, type MenuDef } from "./data/menus";
import { kitchenProfileFor } from "./fixtures/fuel";
import {
  WINDOW_DAYS,
  buildFuelView,
  isKnownFood,
  planDay,
  planWeek,
  resolveTargets,
  swapGrams,
  type FuelTargets,
  type FuelView,
  type FuelViewInput,
  type KitchenProfile,
  type MealSlot,
  type RawMealEntry,
  type WeighIn,
} from "./logicFuel";

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
const MAX_PLAN_MINUTES = 240;
const MAX_MENU_ITEMS = 8;
const MAX_SAVED_MENUS = 20;

function asAllergens(keys: string[]): Allergen[] {
  return keys.filter((key): key is Allergen => (ALLERGENS as readonly string[]).includes(key));
}

function kitchenFromRow(row: Doc<"tm_kitchenProfiles">): KitchenProfile {
  return {
    minutes: row.minutes,
    equipment: row.equipment,
    hands: row.hands,
    canStand: row.canStand,
    excludeAllergens: asAllergens(row.excludeAllergens),
    safeFoodsOnly: row.safeFoodsOnly,
    pinnedBreakfast: row.pinnedBreakfast ?? null,
    safeFoods: row.safeFoods,
    neverAgain: row.neverAgain,
  };
}

function savedMenuDef(row: Doc<"tm_savedMenus">): MenuDef {
  return {
    key: `saved_${row._id}`,
    name: row.name,
    slot: row.slot,
    items: row.items.map((item) => ({ foodKey: item.foodKey, grams: item.grams })),
  };
}

function tightenKitchen(
  stored: KitchenProfile,
  today: {
    minutes?: number;
    equipment?: FoodEquipment;
    oneHanded?: boolean;
    canStand?: boolean;
  },
): KitchenProfile {
  return {
    ...stored,
    minutes:
      today.minutes === undefined || !Number.isFinite(today.minutes)
        ? stored.minutes
        : Math.min(stored.minutes, Math.max(0, Math.min(MAX_PLAN_MINUTES, today.minutes))),
    equipment: today.equipment === undefined ? stored.equipment : lesserEquipment(stored.equipment, today.equipment),
    hands: today.oneHanded === true ? 1 : stored.hands,
    canStand: today.canStand === false ? false : stored.canStand,
  };
}

function knownItems(items: { foodKey: string; grams: number }[]): { foodKey: string; grams: number }[] {
  const out: { foodKey: string; grams: number }[] = [];
  for (const item of items.slice(0, MAX_MENU_ITEMS)) {
    if (!isKnownFood(item.foodKey)) continue;
    if (!Number.isFinite(item.grams) || item.grams <= 0 || item.grams > MAX_GRAMS) continue;
    out.push({ foodKey: item.foodKey, grams: Math.round(item.grams) });
  }
  return out;
}

const equipmentArg = v.union(
  v.literal("none"),
  v.literal("kettle"),
  v.literal("microwave"),
  v.literal("one-pan"),
  v.literal("oven"),
);

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

  const kitchenRow = (
    await ctx.db
      .query("tm_kitchenProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(1)
  )[0];

  const savedRows = await ctx.db
    .query("tm_savedMenus")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_SAVED_MENUS);

  return {
    mode: user.mode,
    date,
    windowEntries,
    weighIns,
    latestWeightKg,
    manualTarget,
    lastWeekly: weekly ? { weekStart: weekly.weekStart, tdeeKcal: weekly.tdeeKcal } : null,
    foods: FOODS,
    kitchen: kitchenRow ? kitchenFromRow(kitchenRow) : kitchenProfileFor(user.slug),
    savedMenus: savedRows.map(savedMenuDef),
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

/**
 * Generate a day.
 *
 * The optional arguments say what today can actually take — five minutes, one
 * pan, one hand, no standing. They only ever *tighten* the stored profile: a
 * bad day can never widen what the kitchen has in it. Omit them and the stored
 * profile stands, so the existing caller keeps working unchanged.
 */
export const generatePlan = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    minutes: v.optional(v.number()),
    equipment: v.optional(equipmentArg),
    oneHanded: v.optional(v.boolean()),
    canStand: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, date, minutes, equipment, oneHanded, canStand }) => {
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
    const stored = input.kitchen ?? kitchenProfileFor(user.slug);
    const kitchen = tightenKitchen(stored, { minutes, equipment, oneHanded, canStand });
    const menus = [...MENUS, ...(input.savedMenus ?? [])];
    for (const item of planDay(targets, FOODS, date, kitchen, menus)) {
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

const menuItemArg = v.object({ foodKey: v.string(), grams: v.number() });

export const logMenu = mutation({
  args: { token: v.string(), date: dateArg, slot: slotArg, items: v.array(menuItemArg) },
  handler: async (ctx, { token, date, slot, items }) => {
    const user = await requireUser(ctx, token);
    for (const item of knownItems(items)) {
      await ctx.db.insert("tm_mealEntries", {
        userId: user._id,
        date,
        slot,
        foodKey: item.foodKey,
        grams: item.grams,
        planned: false,
        eaten: true,
      });
    }
    return null;
  },
});

export const saveMenu = mutation({
  args: { token: v.string(), name: v.string(), slot: slotArg, items: v.array(menuItemArg) },
  handler: async (ctx, { token, name, slot, items }) => {
    const user = await requireUser(ctx, token);
    const parts = knownItems(items);
    if (parts.length === 0) throw new ConvexError("empty-menu");
    const label = name.trim().slice(0, 48);
    if (label.length === 0) throw new ConvexError("empty-menu");
    const existing = await ctx.db
      .query("tm_savedMenus")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_SAVED_MENUS);
    if (existing.length >= MAX_SAVED_MENUS) throw new ConvexError("menu-limit");
    await ctx.db.insert("tm_savedMenus", { userId: user._id, name: label, slot, items: parts });
    return null;
  },
});

export const copyYesterday = mutation({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }) => {
    const user = await requireUser(ctx, token);
    if (user.mode === "survival") return null;
    const from = addDays(date, -1);
    const yesterday = await ctx.db
      .query("tm_mealEntries")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", from))
      .take(200);
    const todayRows = await ctx.db
      .query("tm_mealEntries")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(200);
    for (const row of todayRows) {
      if (row.planned && !row.eaten) await ctx.db.delete("tm_mealEntries", row._id);
    }
    for (const row of yesterday) {
      if (!isKnownFood(row.foodKey)) continue;
      await ctx.db.insert("tm_mealEntries", {
        userId: user._id,
        date,
        slot: row.slot,
        foodKey: row.foodKey,
        grams: row.grams,
        planned: true,
        eaten: false,
      });
    }
    return null;
  },
});

export const generateWeek = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    minutes: v.optional(v.number()),
    equipment: v.optional(equipmentArg),
    oneHanded: v.optional(v.boolean()),
    canStand: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, date, minutes, equipment, oneHanded, canStand }) => {
    const user = await requireUser(ctx, token);
    if (user.mode === "survival") return null;
    const input = await gather(ctx, user, date);
    const { targets } = resolveTargets(input);
    const kitchen = tightenKitchen(input.kitchen ?? kitchenProfileFor(user.slug), {
      minutes,
      equipment,
      oneHanded,
      canStand,
    });
    const menus = [...MENUS, ...(input.savedMenus ?? [])];
    for (const day of planWeek(targets, FOODS, date, kitchen, menus)) {
      const rows = await ctx.db
        .query("tm_mealEntries")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", day.date))
        .take(200);
      for (const row of rows) {
        if (row.planned && !row.eaten) await ctx.db.delete("tm_mealEntries", row._id);
      }
      for (const item of day.items) {
        await ctx.db.insert("tm_mealEntries", {
          userId: user._id,
          date: day.date,
          slot: item.slot,
          foodKey: item.foodKey,
          grams: item.grams,
          planned: true,
          eaten: false,
        });
      }
    }
    return null;
  },
});

export const setKitchen = mutation({
  args: {
    token: v.string(),
    minutes: v.optional(v.number()),
    equipment: v.optional(equipmentArg),
    oneHanded: v.optional(v.boolean()),
    canStand: v.optional(v.boolean()),
    pinnedBreakfast: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const existing = (
      await ctx.db
        .query("tm_kitchenProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(1)
    )[0];
    const stored = existing ? kitchenFromRow(existing) : kitchenProfileFor(user.slug);
    const next: KitchenProfile = {
      ...stored,
      minutes:
        args.minutes === undefined || !Number.isFinite(args.minutes)
          ? stored.minutes
          : Math.max(0, Math.min(MAX_PLAN_MINUTES, args.minutes)),
      equipment: args.equipment ?? stored.equipment,
      hands: args.oneHanded === undefined ? stored.hands : args.oneHanded ? 1 : 2,
      canStand: args.canStand ?? stored.canStand,
      pinnedBreakfast:
        args.pinnedBreakfast === undefined
          ? stored.pinnedBreakfast
          : args.pinnedBreakfast && isKnownFood(args.pinnedBreakfast)
            ? args.pinnedBreakfast
            : null,
    };
    const fields = {
      minutes: next.minutes,
      equipment: next.equipment,
      hands: next.hands,
      canStand: next.canStand,
      excludeAllergens: next.excludeAllergens,
      safeFoodsOnly: next.safeFoodsOnly,
      pinnedBreakfast: next.pinnedBreakfast ?? undefined,
      safeFoods: next.safeFoods,
      neverAgain: next.neverAgain,
    };
    if (existing) await ctx.db.patch("tm_kitchenProfiles", existing._id, fields);
    else await ctx.db.insert("tm_kitchenProfiles", { userId: user._id, ...fields });
    return null;
  },
});

export const swapFood = mutation({
  args: { token: v.string(), entryId: v.id("tm_mealEntries"), foodKey: v.string() },
  handler: async (ctx, { token, entryId, foodKey }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db.get("tm_mealEntries", entryId);
    if (!row || row.userId !== user._id) throw new ConvexError("not-your-entry");
    if (!isKnownFood(foodKey)) throw new ConvexError("unknown-food");
    const from = FOODS.find((f) => f.key === row.foodKey);
    const to = FOODS.find((f) => f.key === foodKey);
    if (!from || !to) throw new ConvexError("unknown-food");
    await ctx.db.patch("tm_mealEntries", entryId, {
      foodKey,
      grams: swapGrams(from, to, row.grams),
    });
    return null;
  },
});

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";

/**
 * Fuel fixtures — a fortnight of realistic intake for the two crew members.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows.ts,
 * which is the contract.
 */

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type NutritionTargetRow = {
  userSlug: string;
  effectiveFrom: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMgMax: number;
  basis: "adaptive" | "manual";
};

export type MealEntryRow = {
  id: string;
  userSlug: string;
  date: string;
  slot: MealSlot;
  foodKey: string;
  grams: number;
  planned: boolean;
  eaten: boolean;
};

export type EnergyEstimateRow = {
  userSlug: string;
  weekStart: string;
  tdeeKcal: number;
  avgIntakeKcal: number;
  weightSlopeKgPerWeek: number;
};

export type FuelFixtures = {
  nutritionTargets: NutritionTargetRow[];
  mealEntries: MealEntryRow[];
  energyEstimates: EnergyEstimateRow[];
};

type MenuItem = [MealSlot, string, number];

/** Three-day rotation — the way a real week of cooking actually repeats. */
const LIAM_MENUS: MenuItem[][] = [
  [
    ["breakfast", "oats", 80],
    ["breakfast", "skyr", 170],
    ["breakfast", "blueberries", 125],
    ["lunch", "chicken_breast", 180],
    ["lunch", "brown_rice", 80],
    ["lunch", "broccoli", 150],
    ["dinner", "salmon_fillet", 140],
    ["dinner", "potato", 300],
    ["dinner", "green_beans", 150],
    ["snack", "greek_yogurt_0", 170],
    ["snack", "almonds", 25],
    ["snack", "banana", 120],
  ],
  [
    ["breakfast", "eggs", 150],
    ["breakfast", "wholemeal_bread", 72],
    ["breakfast", "tomatoes", 120],
    ["lunch", "turkey_mince", 180],
    ["lunch", "pasta_wholewheat", 80],
    ["lunch", "peppers", 120],
    ["dinner", "beef_mince_5", 180],
    ["dinner", "sweet_potato", 250],
    ["dinner", "spinach", 100],
    ["snack", "cottage_cheese", 150],
    ["snack", "apple", 180],
    ["snack", "protein_shake_rtd", 330],
  ],
  [
    ["breakfast", "skyr", 170],
    ["breakfast", "oats", 70],
    ["breakfast", "strawberries", 150],
    ["lunch", "tuna_tin_brine", 160],
    ["lunch", "sourdough", 120],
    ["lunch", "mixed_leaves", 80],
    ["lunch", "olive_oil", 10],
    ["dinner", "chicken_thigh", 180],
    ["dinner", "quinoa", 80],
    ["dinner", "courgette", 150],
    ["snack", "peanut_butter", 20],
    ["snack", "banana", 120],
    ["snack", "semi_milk", 250],
  ],
];

/** Survival cadence: protein and a closed kitchen. Nothing optional. */
const CONOR_MENU: MenuItem[] = [
  ["breakfast", "skyr", 170],
  ["breakfast", "oats", 60],
  ["dinner", "chicken_breast", 160],
  ["dinner", "potato", 300],
];

export function buildFuelFixtures(today: string): FuelFixtures {
  const mealEntries: MealEntryRow[] = [];
  let seq = 0;
  const push = (
    userSlug: string,
    date: string,
    [slot, foodKey, grams]: MenuItem,
    planned: boolean,
    eaten: boolean,
  ) => {
    seq += 1;
    mealEntries.push({
      id: `me_${seq}`,
      userSlug,
      date,
      slot,
      foodKey,
      grams,
      planned,
      eaten,
    });
  };

  // Liam — thirteen complete days behind him, today still in play.
  for (let back = 13; back >= 1; back--) {
    const date = addDays(today, -back);
    const menu = LIAM_MENUS[back % LIAM_MENUS.length];
    // Some days were planned the night before, some were logged as they went.
    const fromPlan = back % 2 === 0;
    for (const item of menu) push("liam", date, item, fromPlan, true);
  }
  const liamToday = LIAM_MENUS[0];
  for (const item of liamToday) {
    const eaten = item[0] === "breakfast" || item[0] === "lunch";
    // Dinner and the snack are on the plan and not eaten yet — both states live.
    push("liam", today, item, !eaten, eaten);
  }

  // Conor — floor protocol, six days back, breakfast in today.
  for (let back = 6; back >= 1; back--) {
    const date = addDays(today, -back);
    for (const item of CONOR_MENU) push("conor", date, item, false, true);
  }
  for (const item of CONOR_MENU) {
    if (item[0] === "breakfast") push("conor", today, item, false, true);
  }

  const nutritionTargets: NutritionTargetRow[] = [
    {
      userSlug: "liam",
      effectiveFrom: addDays(today, -14),
      kcal: 2300,
      proteinG: 204,
      carbsG: 235,
      fatG: 64,
      fiberG: 32,
      sodiumMgMax: 2000,
      basis: "adaptive",
    },
    {
      userSlug: "conor",
      effectiveFrom: addDays(today, -12),
      kcal: 2600,
      proteinG: 152,
      carbsG: 320,
      fatG: 76,
      fiberG: 36,
      sodiumMgMax: 2000,
      basis: "adaptive",
    },
  ];

  const energyEstimates: EnergyEstimateRow[] = [
    {
      userSlug: "liam",
      weekStart: addDays(today, -14),
      tdeeKcal: 2810,
      avgIntakeKcal: 2140,
      weightSlopeKgPerWeek: -0.6,
    },
    {
      userSlug: "liam",
      weekStart: addDays(today, -7),
      tdeeKcal: 2760,
      avgIntakeKcal: 2100,
      weightSlopeKgPerWeek: -0.55,
    },
    {
      userSlug: "conor",
      weekStart: addDays(today, -7),
      tdeeKcal: 2650,
      avgIntakeKcal: 2580,
      weightSlopeKgPerWeek: -0.05,
    },
  ];

  return { nutritionTargets, mealEntries, energyEstimates };
}

/** Insert the fixtures, dropping the demo-only string ids. */
export async function seedFuel(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: FuelFixtures,
): Promise<void> {
  for (const row of fx.nutritionTargets) {
    await ctx.db.insert("tm_nutritionTargets", {
      userId: uid(row.userSlug),
      effectiveFrom: row.effectiveFrom,
      kcal: row.kcal,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      fiberG: row.fiberG,
      sodiumMgMax: row.sodiumMgMax,
      basis: row.basis,
    });
  }
  for (const row of fx.mealEntries) {
    await ctx.db.insert("tm_mealEntries", {
      userId: uid(row.userSlug),
      date: row.date,
      slot: row.slot,
      foodKey: row.foodKey,
      grams: row.grams,
      planned: row.planned,
      eaten: row.eaten,
    });
  }
  for (const row of fx.energyEstimates) {
    await ctx.db.insert("tm_energyEstimates", {
      userId: uid(row.userSlug),
      weekStart: row.weekStart,
      tdeeKcal: row.tdeeKcal,
      avgIntakeKcal: row.avgIntakeKcal,
      weightSlopeKgPerWeek: row.weightSlopeKgPerWeek,
    });
  }
}

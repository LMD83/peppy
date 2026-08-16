import { FOODS, lesserEquipment, type FoodEquipment } from "@convex/tm/data/foods";
import { kitchenProfileFor } from "@convex/tm/fixtures/fuel";
import { addDays } from "@convex/tm/lib";
import {
  WINDOW_DAYS,
  buildFuelView,
  isKnownFood,
  planDay,
  resolveTargets,
  type FuelTargets,
  type FuelViewInput,
  type KitchenProfile,
  type MealSlot,
  type RawMealEntry,
  type WeighIn,
} from "@convex/tm/logicFuel";
import type { DemoDb } from "../demo-db";
import type { FuelData } from "../types";

/**
 * Demo mirror of convex/tm/fuel.ts. Same gather, same shared logic, same shape —
 * the view type is derived from the Convex query, so any drift is a build error.
 */

const MAX_GRAMS = 3000;

function gather(db: DemoDb, slug: string, date: string): FuelViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");
  const from = addDays(date, -(WINDOW_DAYS - 1));

  const windowEntries: RawMealEntry[] = db.mealEntries
    .filter((e) => e.userSlug === slug && e.date >= from && e.date <= date)
    .map((e) => ({
      id: e.id,
      date: e.date,
      slot: e.slot,
      foodKey: e.foodKey,
      grams: e.grams,
      planned: e.planned,
      eaten: e.eaten,
    }));

  const weighIns: WeighIn[] = db.days
    .filter((d) => d.userSlug === slug && d.weightKg !== undefined)
    .map((d) => ({ date: d.date, weightKg: d.weightKg as number }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const manualRow = db.nutritionTargets
    .filter((t) => t.userSlug === slug && t.basis === "manual" && t.effectiveFrom <= date)
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

  const weekly = db.energyEstimates
    .filter((e) => e.userSlug === slug)
    .slice()
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

  return {
    mode: user.modeMut,
    date,
    windowEntries,
    weighIns,
    latestWeightKg: weighIns[0]?.weightKg ?? user.startKg,
    manualTarget,
    lastWeekly: weekly ? { weekStart: weekly.weekStart, tdeeKcal: weekly.tdeeKcal } : null,
    foods: FOODS,
    kitchen: kitchenProfileFor(slug),
  };
}

export function view(db: DemoDb, slug: string, date: string): FuelData {
  return buildFuelView(gather(db, slug, date));
}

export function logFood(
  db: DemoDb,
  slug: string,
  date: string,
  slot: MealSlot,
  foodKey: string,
  grams: number,
): void {
  if (!isKnownFood(foodKey)) throw new Error("unknown-food");
  if (!Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) throw new Error("bad-portion");
  db.mealEntries.push({
    id: db.newId("me"),
    userSlug: slug,
    date,
    slot,
    foodKey,
    grams: Math.round(grams),
    planned: false,
    eaten: true,
  });
}

export function setFoodEaten(db: DemoDb, entryId: string, eaten: boolean): void {
  const row = db.mealEntries.find((e) => e.id === entryId);
  if (!row) return;
  row.eaten = eaten;
}

export function removeFood(db: DemoDb, entryId: string): void {
  const i = db.mealEntries.findIndex((e) => e.id === entryId);
  if (i >= 0) db.mealEntries.splice(i, 1);
}

/**
 * Mirrors convex/tm/fuel.ts:generatePlan, including the rule that today's
 * stated limits may only tighten the stored kitchen, never widen it.
 */
export function generatePlan(
  db: DemoDb,
  slug: string,
  date: string,
  today: {
    minutes?: number;
    equipment?: FoodEquipment;
    oneHanded?: boolean;
    canStand?: boolean;
  } = {},
): void {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) return;
  // Survival is a floor, not a lite mode: no plan, no new obligations.
  if (user.modeMut === "survival") return;

  for (let i = db.mealEntries.length - 1; i >= 0; i--) {
    const row = db.mealEntries[i];
    if (row.userSlug === slug && row.date === date && row.planned && !row.eaten)
      db.mealEntries.splice(i, 1);
  }

  const input = gather(db, slug, date);
  const { targets } = resolveTargets(input);
  const stored = input.kitchen ?? kitchenProfileFor(slug);
  const kitchen: KitchenProfile = {
    ...stored,
    minutes:
      today.minutes === undefined || !Number.isFinite(today.minutes)
        ? stored.minutes
        : Math.min(stored.minutes, Math.max(0, today.minutes)),
    equipment:
      today.equipment === undefined
        ? stored.equipment
        : lesserEquipment(stored.equipment, today.equipment),
    hands: today.oneHanded === true ? 1 : stored.hands,
    canStand: today.canStand === false ? false : stored.canStand,
  };
  for (const item of planDay(targets, FOODS, date, kitchen)) {
    db.mealEntries.push({
      id: db.newId("me"),
      userSlug: slug,
      date,
      slot: item.slot,
      foodKey: item.foodKey,
      grams: item.grams,
      planned: true,
      eaten: false,
    });
  }
}

import { FOODS, lesserEquipment, type FoodEquipment } from "@convex/tm/data/foods";
import { MENUS, type MenuDef } from "@convex/tm/data/menus";
import { kitchenProfileFor, type KitchenProfileRow } from "@convex/tm/fixtures/fuel";
import { addDays } from "@convex/tm/lib";
import {
  WINDOW_DAYS,
  buildFuelView,
  isKnownFood,
  planDay,
  planWeek,
  resolveTargets,
  swapGrams,
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
const MAX_MENU_ITEMS = 8;
const MAX_SAVED_MENUS = 20;
const MAX_PLAN_MINUTES = 240;

export type SavedMenuRow = {
  id: string;
  userSlug: string;
  name: string;
  slot: MealSlot;
  items: { foodKey: string; grams: number }[];
};

function knownItems(items: { foodKey: string; grams: number }[]): { foodKey: string; grams: number }[] {
  const out: { foodKey: string; grams: number }[] = [];
  for (const item of items.slice(0, MAX_MENU_ITEMS)) {
    if (!isKnownFood(item.foodKey)) continue;
    if (!Number.isFinite(item.grams) || item.grams <= 0 || item.grams > MAX_GRAMS) continue;
    out.push({ foodKey: item.foodKey, grams: Math.round(item.grams) });
  }
  return out;
}

function kitchenFor(db: DemoDb, slug: string): KitchenProfile {
  const row = db.kitchenProfiles.find((p) => p.userSlug === slug);
  if (!row) return kitchenProfileFor(slug);
  const { userSlug: _slug, ...profile } = row;
  return profile;
}

function savedMenusFor(db: DemoDb, slug: string): MenuDef[] {
  return db.savedMenus
    .filter((m) => m.userSlug === slug)
    .slice(0, MAX_SAVED_MENUS)
    .map((m) => ({ key: `saved_${m.id}`, name: m.name, slot: m.slot, items: m.items }));
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
    equipment:
      today.equipment === undefined ? stored.equipment : lesserEquipment(stored.equipment, today.equipment),
    hands: today.oneHanded === true ? 1 : stored.hands,
    canStand: today.canStand === false ? false : stored.canStand,
  };
}

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
    kitchen: kitchenFor(db, slug),
    savedMenus: savedMenusFor(db, slug),
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
  const kitchen = tightenKitchen(stored, today);
  const menus = [...MENUS, ...(input.savedMenus ?? [])];
  for (const item of planDay(targets, FOODS, date, kitchen, menus)) {
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

export function logMenu(
  db: DemoDb,
  slug: string,
  date: string,
  slot: MealSlot,
  items: { foodKey: string; grams: number }[],
): void {
  for (const item of knownItems(items)) {
    db.mealEntries.push({
      id: db.newId("me"),
      userSlug: slug,
      date,
      slot,
      foodKey: item.foodKey,
      grams: item.grams,
      planned: false,
      eaten: true,
    });
  }
}

export function saveMenu(
  db: DemoDb,
  slug: string,
  name: string,
  slot: MealSlot,
  items: { foodKey: string; grams: number }[],
): void {
  const parts = knownItems(items);
  const label = name.trim().slice(0, 48);
  if (parts.length === 0 || label.length === 0) return;
  if (db.savedMenus.filter((m) => m.userSlug === slug).length >= MAX_SAVED_MENUS) return;
  db.savedMenus.push({ id: db.newId("mn"), userSlug: slug, name: label, slot, items: parts });
}

export function copyYesterday(db: DemoDb, slug: string, date: string): void {
  const user = db.users.find((u) => u.slug === slug);
  if (!user || user.modeMut === "survival") return;
  const from = addDays(date, -1);
  for (let i = db.mealEntries.length - 1; i >= 0; i--) {
    const row = db.mealEntries[i];
    if (row.userSlug === slug && row.date === date && row.planned && !row.eaten)
      db.mealEntries.splice(i, 1);
  }
  for (const row of db.mealEntries.filter((e) => e.userSlug === slug && e.date === from)) {
    if (!isKnownFood(row.foodKey)) continue;
    db.mealEntries.push({
      id: db.newId("me"),
      userSlug: slug,
      date,
      slot: row.slot,
      foodKey: row.foodKey,
      grams: row.grams,
      planned: true,
      eaten: false,
    });
  }
}

export function generateWeek(
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
  if (!user || user.modeMut === "survival") return;
  const input = gather(db, slug, date);
  const { targets } = resolveTargets(input);
  const kitchen = tightenKitchen(input.kitchen ?? kitchenProfileFor(slug), today);
  const menus = [...MENUS, ...(input.savedMenus ?? [])];
  for (const day of planWeek(targets, FOODS, date, kitchen, menus)) {
    for (let i = db.mealEntries.length - 1; i >= 0; i--) {
      const row = db.mealEntries[i];
      if (row.userSlug === slug && row.date === day.date && row.planned && !row.eaten)
        db.mealEntries.splice(i, 1);
    }
    for (const item of day.items) {
      db.mealEntries.push({
        id: db.newId("me"),
        userSlug: slug,
        date: day.date,
        slot: item.slot,
        foodKey: item.foodKey,
        grams: item.grams,
        planned: true,
        eaten: false,
      });
    }
  }
}

export function setKitchen(
  db: DemoDb,
  slug: string,
  patch: {
    minutes?: number;
    equipment?: FoodEquipment;
    oneHanded?: boolean;
    canStand?: boolean;
    pinnedBreakfast?: string | null;
  },
): void {
  const stored = kitchenFor(db, slug);
  const next: KitchenProfileRow = {
    userSlug: slug,
    ...stored,
    minutes:
      patch.minutes === undefined || !Number.isFinite(patch.minutes)
        ? stored.minutes
        : Math.max(0, Math.min(MAX_PLAN_MINUTES, patch.minutes)),
    equipment: patch.equipment ?? stored.equipment,
    hands: patch.oneHanded === undefined ? stored.hands : patch.oneHanded ? 1 : 2,
    canStand: patch.canStand ?? stored.canStand,
    pinnedBreakfast:
      patch.pinnedBreakfast === undefined
        ? stored.pinnedBreakfast
        : patch.pinnedBreakfast && isKnownFood(patch.pinnedBreakfast)
          ? patch.pinnedBreakfast
          : null,
  };
  const i = db.kitchenProfiles.findIndex((p) => p.userSlug === slug);
  if (i >= 0) db.kitchenProfiles[i] = next;
  else db.kitchenProfiles.push(next);
}

export function swapFood(db: DemoDb, entryId: string, foodKey: string): void {
  const row = db.mealEntries.find((e) => e.id === entryId);
  if (!row || !isKnownFood(foodKey)) return;
  const from = FOODS.find((f) => f.key === row.foodKey);
  const to = FOODS.find((f) => f.key === foodKey);
  if (!from || !to) return;
  row.foodKey = foodKey;
  row.grams = swapGrams(from, to, row.grams);
}

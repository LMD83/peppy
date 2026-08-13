import { addDays, daysBetween, type TmMode } from "./lib";
import { GROUP_ORDER, foodByKey, type FoodDef, type FoodGroup } from "./data/foods";

/**
 * Pure fuel logic — energy balance, macro targets, meal-plan generation.
 * Shared verbatim between the Convex handlers (convex/tm/fuel.ts) and the demo
 * backend (src/app/_lib/demo/fuel.ts) so both compute identical numbers.
 *
 * Deterministic by construction: no Date.now(), no Math.random(). Every date
 * comes in as an argument.
 *
 * Evidence note: the equations here are population-level estimates. Mifflin-St
 * Jeor predicts resting energy within roughly +/-10% for most people (moderate
 * evidence); the adaptive fit is your own intake-versus-mass data (strong for
 * you, once there is enough of it). Nothing here is a diagnosis or a
 * prescription — it is arithmetic on numbers you logged.
 */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** The salt ceiling the existing "salt under 2 g" check already tracks. */
export const SODIUM_MG_MAX = 2000;
/** Energy in 1 kg of body mass, the figure the adaptive fit converts with. */
export const KCAL_PER_KG = 7700;
/** Below these, a 14-day fit is noise — the estimate stays honest instead. */
export const MIN_INTAKE_DAYS = 10;
export const MIN_WEIGH_INS = 4;
/** Trailing window for both the intake average and the mass slope. */
export const WINDOW_DAYS = 14;

export type Sex = "male" | "female";
export type ActivityKey = "sedentary" | "light" | "moderate" | "high" | "athlete";

export const ACTIVITY_MULTIPLIERS: Record<ActivityKey, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

export type BodyProfile = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityKey;
};

/**
 * The file carries mass, not anthropometrics. Everything except weight is a
 * stated default — which is exactly why the fallback labels itself "estimated".
 */
export const DEFAULT_BODY: Omit<BodyProfile, "weightKg"> = {
  heightCm: 178,
  age: 38,
  sex: "male",
  activity: "moderate",
};

export type FuelTargets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMgMax: number;
};

export type FuelTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
};

export type SimpleEntry = { foodKey: string; grams: number };
export type WeighIn = { date: string; weightKg: number };

export type AdaptiveTdee = {
  tdeeKcal: number;
  basis: "adaptive" | "estimated";
  avgIntakeKcal: number;
  weightSlopeKgPerWeek: number;
  confidence: "low" | "medium" | "high";
  intakeDays: number;
  weighInCount: number;
  /** Most recent stored weekly estimate, if the file has one. */
  lastWeekly: { weekStart: string; tdeeKcal: number } | null;
};

const ZERO_TOTALS: FuelTotals = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sodiumMg: 0,
};

function r0(n: number): number {
  return Math.round(n);
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/* ===== energy ===== */

/** Mifflin-St Jeor resting energy, kcal/day. */
export function mifflinStJeor({
  weightKg,
  heightCm,
  age,
  sex,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return r0(base + (sex === "male" ? 5 : -161));
}

/** Resting energy scaled by the activity multiplier — the estimated basis. */
export function estimatedTdee(profile: BodyProfile): number {
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activity] ?? ACTIVITY_MULTIPLIERS.moderate;
  return r0(mifflinStJeor(profile) * multiplier);
}

/** Least-squares slope of mass over time, expressed in kg per week. */
export function weightSlopeKgPerWeek(points: WeighIn[]): number {
  if (points.length < 2) return 0;
  const origin = points[0].date;
  const xs = points.map((p) => daysBetween(origin, p.date));
  const ys = points.map((p) => p.weightKg);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return 0; // every weigh-in on the same day — no slope to fit
  return safe((num / den) * 7);
}

/**
 * MacroFactor-style adaptive expenditure: what you ate, corrected by what your
 * mass actually did. Falls back to the Mifflin-St Jeor estimate — and says so —
 * until there are enough logged days and weigh-ins to fit a line.
 */
export function adaptiveTdee(
  weighIns: WeighIn[],
  intakeByDate: Record<string, number>,
  today: string,
  profile: BodyProfile,
  lastWeekly: { weekStart: string; tdeeKcal: number } | null = null,
): AdaptiveTdee {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const window = weighIns
    .filter((p) => p.date >= from && p.date <= today && Number.isFinite(p.weightKg))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const intakeDates = Object.keys(intakeByDate)
    .filter((d) => d >= from && d <= today && intakeByDate[d] > 0)
    .sort();
  const intakeDays = intakeDates.length;
  const avgIntakeKcal =
    intakeDays === 0
      ? 0
      : r0(intakeDates.reduce((s, d) => s + intakeByDate[d], 0) / intakeDays);
  const slope = r2(weightSlopeKgPerWeek(window));
  const estimate = estimatedTdee(profile);

  if (intakeDays < MIN_INTAKE_DAYS || window.length < MIN_WEIGH_INS) {
    return {
      tdeeKcal: estimate,
      basis: "estimated",
      avgIntakeKcal,
      weightSlopeKgPerWeek: slope,
      confidence: "low",
      intakeDays,
      weighInCount: window.length,
      lastWeekly,
    };
  }

  const fitted = avgIntakeKcal - (slope * KCAL_PER_KG) / 7;
  // A fit that lands far outside the physiological estimate is measurement
  // noise, not metabolism — clamp it rather than report a number nobody has.
  const tdeeKcal = r0(Math.min(Math.max(fitted, estimate * 0.6), estimate * 1.6));
  const confidence: AdaptiveTdee["confidence"] =
    intakeDays >= 14 && window.length >= 6
      ? "high"
      : intakeDays >= 12 && window.length >= 5
        ? "medium"
        : "low";

  return {
    tdeeKcal,
    basis: "adaptive",
    avgIntakeKcal,
    weightSlopeKgPerWeek: slope,
    confidence,
    intakeDays,
    weighInCount: window.length,
    lastWeekly,
  };
}

/* ===== targets ===== */

const PROTEIN_G_PER_KG: Record<TmMode, number> = { cut: 2.2, maintain: 1.8, survival: 1.6 };
const KCAL_FACTOR: Record<TmMode, number> = { cut: 0.8, maintain: 1, survival: 0.95 };
const FAT_FLOOR_G_PER_KG = 0.8;

/**
 * Protein first, fat floored, carbs take the remainder. Survival trims 5% —
 * a floor never starves; it just stops the drift.
 */
export function macroTargets(mode: TmMode, weightKg: number, tdeeKcal: number): FuelTargets {
  const kg = Math.max(1, safe(weightKg));
  const kcal = Math.max(800, r0(safe(tdeeKcal) * KCAL_FACTOR[mode]));
  const proteinG = r1(kg * PROTEIN_G_PER_KG[mode]);
  const fatFloor = kg * FAT_FLOOR_G_PER_KG;
  let fatG = Math.max(fatFloor, (kcal * 0.25) / 9);
  let carbKcal = kcal - proteinG * 4 - fatG * 9;
  if (carbKcal < 0) {
    fatG = fatFloor;
    carbKcal = kcal - proteinG * 4 - fatG * 9;
  }
  return {
    kcal,
    proteinG,
    carbsG: r1(Math.max(0, carbKcal / 4)),
    fatG: r1(fatG),
    fiberG: r0((14 * kcal) / 1000),
    sodiumMgMax: SODIUM_MG_MAX,
  };
}

/* ===== totals ===== */

function accumulate(into: FuelTotals, food: FoodDef, grams: number): void {
  const f = grams / 100;
  into.kcal += food.per100.kcal * f;
  into.proteinG += food.per100.proteinG * f;
  into.carbsG += food.per100.carbsG * f;
  into.fatG += food.per100.fatG * f;
  into.fiberG += food.per100.fiberG * f;
  into.sodiumMg += food.per100.sodiumMg * f;
}

function round(totals: FuelTotals): FuelTotals {
  return {
    kcal: r0(totals.kcal),
    proteinG: r1(totals.proteinG),
    carbsG: r1(totals.carbsG),
    fatG: r1(totals.fatG),
    fiberG: r1(totals.fiberG),
    sodiumMg: r0(totals.sodiumMg),
  };
}

/** Nutrients in a weighed portion of one food. */
export function nutrientsFor(food: FoodDef, grams: number): FuelTotals {
  if (!(grams > 0)) return { ...ZERO_TOTALS };
  const acc = { ...ZERO_TOTALS };
  accumulate(acc, food, grams);
  return round(acc);
}

/** Summed nutrients across entries. Unknown food keys are skipped, not guessed. */
export function totalsFor(entries: SimpleEntry[], foods: FoodDef[]): FuelTotals {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const acc = { ...ZERO_TOTALS };
  for (const e of entries) {
    const food = byKey.get(e.foodKey);
    if (!food || !(e.grams > 0)) continue;
    accumulate(acc, food, e.grams);
  }
  return round(acc);
}

/* ===== plan generation ===== */

export type PlanItem = { slot: MealSlot; foodKey: string; grams: number };

const PROTEIN_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.3,
  snack: 0.15,
};
const CARB_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
/** Never overshoot the energy target by more than this. */
export const KCAL_OVERSHOOT = 1.03;

/** Stable index from a date string — rotation only, never randomness. */
function seedIndex(seed: string): number {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100003;
  return h;
}

function clampRound5(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value / 5) * 5));
}

/**
 * Deterministic greedy day plan: protein across all four slots first, then
 * volume, then energy from carbs and fat. Same date + same catalogue + same
 * targets always produce the same plan.
 */
export function planDay(targets: FuelTargets, foods: FoodDef[], seed: string): PlanItem[] {
  const sorted = [...foods].sort((a, b) => a.key.localeCompare(b.key));
  if (sorted.length === 0) return [];
  const rot = seedIndex(seed);
  const proteinPool = sorted.filter(
    (f) => f.tags.includes("high-protein") && f.per100.proteinG >= 10,
  );
  const carbPool = sorted.filter((f) => f.group === "carb");
  const vegPool = sorted.filter((f) => f.group === "veg");
  const fruitPool = sorted.filter((f) => f.group === "fruit");
  const fatPool = sorted.filter((f) => f.group === "fat");

  const items: PlanItem[] = [];
  let sodium = 0;

  const push = (slot: MealSlot, food: FoodDef, grams: number): boolean => {
    if (!(grams >= 5)) return false;
    const added = (food.per100.sodiumMg * grams) / 100;
    if (sodium + added > targets.sodiumMgMax) return false;
    sodium += added;
    items.push({ slot, foodKey: food.key, grams });
    return true;
  };

  /** Try each candidate in rotation until one fits under the salt ceiling. */
  const fill = (
    pool: FoodDef[],
    slot: MealSlot,
    spin: number,
    gramsFor: (food: FoodDef) => number,
  ): void => {
    for (let k = 0; k < pool.length; k++) {
      const food = pool[(rot + spin + k) % pool.length];
      if (push(slot, food, gramsFor(food))) return;
    }
  };

  // 1 — protein across every slot.
  MEAL_SLOTS.forEach((slot, i) => {
    const need = targets.proteinG * PROTEIN_SHARE[slot];
    fill(proteinPool, slot, i * 7, (food) => {
      const density = food.per100.proteinG / 100;
      return density > 0 ? clampRound5(need / density, 20, 350) : 0;
    });
  });

  // 2 — volume: veg with the two main meals, fruit either end of the day.
  fill(vegPool, "lunch", 0, (f) => f.portionG);
  fill(vegPool, "dinner", 3, (f) => f.portionG);
  fill(fruitPool, "breakfast", 0, (f) => f.portionG);
  fill(fruitPool, "snack", 2, (f) => f.portionG);

  // 3 — energy from carbs, split evenly across the three main slots.
  const afterProtein = targets.kcal - totalsFor(items, sorted).kcal;
  if (afterProtein > 0) {
    const share = afterProtein / CARB_SLOTS.length;
    CARB_SLOTS.forEach((slot, i) => {
      fill(carbPool, slot, i * 5, (food) => {
        const density = food.per100.kcal / 100;
        return density > 0 ? clampRound5(share / density, 20, 200) : 0;
      });
    });
  }

  // 4 — top up with fat if a real gap is left.
  const afterCarbs = targets.kcal - totalsFor(items, sorted).kcal;
  if (afterCarbs > 100) {
    fill(fatPool, "dinner", 1, (food) => {
      const density = food.per100.kcal / 100;
      return density > 0 ? clampRound5(afterCarbs / density, 5, 60) : 0;
    });
  }

  // 5 — trim energy back under the ceiling, protein untouched.
  const cap = targets.kcal * KCAL_OVERSHOOT;
  const byKey = new Map(sorted.map((f) => [f.key, f]));
  for (let guard = 0; guard < 500; guard++) {
    if (totalsFor(items, sorted).kcal <= cap) break;
    let worst = -1;
    let worstKcal = 0;
    items.forEach((item, i) => {
      const food = byKey.get(item.foodKey);
      if (!food || food.group === "protein" || food.group === "dairy") return;
      const kcal = (food.per100.kcal * item.grams) / 100;
      if (kcal > worstKcal) {
        worstKcal = kcal;
        worst = i;
      }
    });
    if (worst < 0) break;
    items[worst].grams -= 5;
    if (items[worst].grams < 5) items.splice(worst, 1);
  }

  const slotRank = (s: MealSlot) => MEAL_SLOTS.indexOf(s);
  return items.sort(
    (a, b) => slotRank(a.slot) - slotRank(b.slot) || a.foodKey.localeCompare(b.foodKey),
  );
}

/* ===== shopping ===== */

export type ShoppingItem = {
  foodKey: string;
  name: string;
  group: FoodGroup;
  grams: number;
  portionLabel: string;
};

/** Grams per food, aisle order. What is still to buy or prep, nothing more. */
export function shoppingList(entries: SimpleEntry[], foods: FoodDef[]): ShoppingItem[] {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const grams = new Map<string, number>();
  for (const e of entries) {
    if (!byKey.has(e.foodKey) || !(e.grams > 0)) continue;
    grams.set(e.foodKey, (grams.get(e.foodKey) ?? 0) + e.grams);
  }
  const items: ShoppingItem[] = [];
  for (const [key, g] of grams) {
    const food = byKey.get(key);
    if (!food) continue;
    items.push({
      foodKey: key,
      name: food.name,
      group: food.group,
      grams: r0(g),
      portionLabel: food.portionLabel,
    });
  }
  return items.sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name),
  );
}

/* ===== the view both backends build ===== */

export type RawMealEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  foodKey: string;
  grams: number;
  planned: boolean;
  eaten: boolean;
};

export type FuelEntryView = {
  id: string;
  slot: MealSlot;
  foodKey: string;
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  planned: boolean;
  eaten: boolean;
};

export type FuelSlotView = {
  slot: MealSlot;
  label: string;
  entries: FuelEntryView[];
  kcal: number;
  proteinG: number;
  eatenCount: number;
  total: number;
};

export type FoodOption = {
  key: string;
  name: string;
  group: FoodGroup;
  portionG: number;
  portionLabel: string;
  kcalPer100: number;
  proteinPer100G: number;
  sodiumPer100Mg: number;
  tags: string[];
};

export type FuelWeek = {
  avgKcal: number;
  avgProteinG: number;
  daysLogged: number;
  days: { date: string; kcal: number; proteinG: number }[];
};

export type FuelView = {
  targets: FuelTargets;
  totals: FuelTotals;
  remaining: FuelTotals;
  tdee: AdaptiveTdee;
  entries: FuelEntryView[];
  slots: FuelSlotView[];
  sodiumUsedMg: number;
  week: FuelWeek;
  shoppingList: ShoppingItem[];
  foods: FoodOption[];
  survival: boolean;
};

export type FuelViewInput = {
  mode: TmMode;
  date: string;
  /** Entries across the trailing 14 days, today included. */
  windowEntries: RawMealEntry[];
  weighIns: WeighIn[];
  latestWeightKg: number;
  /** A manually pinned target row overrides the derived one. */
  manualTarget: FuelTargets | null;
  lastWeekly: { weekStart: string; tdeeKcal: number } | null;
  foods: FoodDef[];
};

/** Per-date eaten totals across the window — the input to the adaptive fit. */
function intakeIndex(
  entries: RawMealEntry[],
  foods: FoodDef[],
): Map<string, { kcal: number; proteinG: number }> {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const byDate = new Map<string, { kcal: number; proteinG: number }>();
  for (const e of entries) {
    if (!e.eaten) continue;
    const food = byKey.get(e.foodKey);
    if (!food || !(e.grams > 0)) continue;
    const bucket = byDate.get(e.date) ?? { kcal: 0, proteinG: 0 };
    bucket.kcal += (food.per100.kcal * e.grams) / 100;
    bucket.proteinG += (food.per100.proteinG * e.grams) / 100;
    byDate.set(e.date, bucket);
  }
  return byDate;
}

/** Targets + expenditure, resolved the same way for the view and the planner. */
export function resolveTargets(input: FuelViewInput): { targets: FuelTargets; tdee: AdaptiveTdee } {
  const byDate = intakeIndex(input.windowEntries, input.foods);
  const intakeByDate: Record<string, number> = {};
  for (const [date, v] of byDate) intakeByDate[date] = r0(v.kcal);
  const profile: BodyProfile = { ...DEFAULT_BODY, weightKg: input.latestWeightKg };
  const tdee = adaptiveTdee(
    input.weighIns,
    intakeByDate,
    input.date,
    profile,
    input.lastWeekly,
  );
  const targets = input.manualTarget ?? macroTargets(input.mode, input.latestWeightKg, tdee.tdeeKcal);
  return { targets, tdee };
}

export function buildFuelView(input: FuelViewInput): FuelView {
  const { targets, tdee } = resolveTargets(input);
  const byKey = new Map(input.foods.map((f) => [f.key, f]));

  const today = input.windowEntries.filter((e) => e.date === input.date);
  const entries: FuelEntryView[] = [];
  for (const e of today) {
    const food = byKey.get(e.foodKey);
    if (!food) continue; // a key the catalogue no longer carries — skip, never invent
    const n = nutrientsFor(food, e.grams);
    entries.push({
      id: e.id,
      slot: e.slot,
      foodKey: e.foodKey,
      name: food.name,
      grams: e.grams,
      kcal: n.kcal,
      proteinG: n.proteinG,
      carbsG: n.carbsG,
      fatG: n.fatG,
      fiberG: n.fiberG,
      sodiumMg: n.sodiumMg,
      planned: e.planned,
      eaten: e.eaten,
    });
  }
  entries.sort(
    (a, b) =>
      MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot) || a.name.localeCompare(b.name),
  );

  const totals = totalsFor(
    today.filter((e) => e.eaten),
    input.foods,
  );
  const remaining: FuelTotals = {
    kcal: r0(targets.kcal - totals.kcal),
    proteinG: r1(targets.proteinG - totals.proteinG),
    carbsG: r1(targets.carbsG - totals.carbsG),
    fatG: r1(targets.fatG - totals.fatG),
    fiberG: r1(targets.fiberG - totals.fiberG),
    sodiumMg: r0(targets.sodiumMgMax - totals.sodiumMg),
  };

  const slots: FuelSlotView[] = MEAL_SLOTS.map((slot) => {
    const slotEntries = entries.filter((e) => e.slot === slot);
    return {
      slot,
      label: SLOT_LABELS[slot],
      entries: slotEntries,
      kcal: r0(slotEntries.reduce((s, e) => s + e.kcal, 0)),
      proteinG: r1(slotEntries.reduce((s, e) => s + e.proteinG, 0)),
      eatenCount: slotEntries.filter((e) => e.eaten).length,
      total: slotEntries.length,
    };
  });

  const byDate = intakeIndex(input.windowEntries, input.foods);
  const days: FuelWeek["days"] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(input.date, -i);
    const v = byDate.get(date);
    days.push({ date, kcal: r0(v?.kcal ?? 0), proteinG: r1(v?.proteinG ?? 0) });
  }
  const logged = days.filter((d) => d.kcal > 0);
  const week: FuelWeek = {
    avgKcal: logged.length === 0 ? 0 : r0(logged.reduce((s, d) => s + d.kcal, 0) / logged.length),
    avgProteinG:
      logged.length === 0 ? 0 : r1(logged.reduce((s, d) => s + d.proteinG, 0) / logged.length),
    daysLogged: logged.length,
    days,
  };

  const foods: FoodOption[] = [...input.foods]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({
      key: f.key,
      name: f.name,
      group: f.group,
      portionG: f.portionG,
      portionLabel: f.portionLabel,
      kcalPer100: f.per100.kcal,
      proteinPer100G: f.per100.proteinG,
      sodiumPer100Mg: f.per100.sodiumMg,
      tags: [...f.tags],
    }));

  return {
    targets,
    totals,
    remaining,
    tdee,
    entries,
    slots,
    sodiumUsedMg: totals.sodiumMg,
    week,
    shoppingList: shoppingList(
      today.filter((e) => e.planned && !e.eaten),
      input.foods,
    ),
    foods,
    survival: input.mode === "survival",
  };
}

/** Catalogue guard for the log mutation — never store a key the file cannot price. */
export function isKnownFood(key: string): boolean {
  return foodByKey(key) !== undefined;
}

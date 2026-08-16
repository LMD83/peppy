import { addDays, daysBetween, type TmMode } from "./lib";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_RANK,
  GROUP_ORDER,
  foodByKey,
  reachableWith,
  type Allergen,
  type FoodDef,
  type FoodEffort,
  type FoodEquipment,
  type FoodGroup,
  type FoodShelf,
} from "./data/foods";

/**
 * Pure fuel logic — energy balance, macro targets, meal-plan generation.
 * Shared verbatim between the Convex handlers (convex/tm/fuel.ts) and the demo
 * backend (src/app/_lib/demo/fuel.ts) so both compute identical numbers.
 *
 * Deterministic by construction: no Date.now(), no Math.random(). Every date
 * comes in as an argument.
 *
 * The arithmetic below (Mifflin-St Jeor, the adaptive fit, the macro split) is
 * unchanged from the day it shipped — it works. What changed is what the
 * planner optimises for. Macros against a salt ceiling quietly assume a capable
 * cook with a full kitchen and executive function to spare; on a bad day the
 * binding constraint is minutes, pans, hands and standing time. Those are
 * first-class inputs here (PlanConstraints), and repetition — the same
 * breakfast every day, a short list of safe foods — is treated as a working
 * system rather than a failure to rotate.
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

/* ===== effort: what a plan costs before you commit to it ===== */

/**
 * What you have today, not what a kitchen ideally contains.
 *
 * `minutes` is a budget of hands-on minutes, spent once per distinct food — the
 * wall clock an oven runs for is not yours. `equipment` is the most capable
 * appliance available, and a food is reachable when its requirement ranks at or
 * below it. `hands: 1` means one-handed only. `canStand: false` admits only
 * foods that cost no time on your feet.
 */
export type PlanConstraints = {
  minutes: number;
  equipment: FoodEquipment;
  hands: 1 | 2;
  canStand: boolean;
  excludeAllergens: Allergen[];
  safeFoodsOnly: boolean;
};

/**
 * Repetition as a feature. A pinned breakfast is a decision already made; safe
 * foods are the short list someone always tolerates; never-again is a hard
 * exclusion the generator may never argue with.
 */
export type FoodPrefs = {
  pinnedBreakfast: string | null;
  safeFoods: string[];
  neverAgain: string[];
};

export type KitchenProfile = PlanConstraints & FoodPrefs;

/** A full kitchen and a good day — the assumption the planner used to make. */
export const DEFAULT_KITCHEN: KitchenProfile = {
  minutes: 45,
  equipment: "oven",
  hands: 2,
  canStand: true,
  excludeAllergens: [],
  safeFoodsOnly: false,
  pinnedBreakfast: null,
  safeFoods: [],
  neverAgain: [],
};

/** The bad day, fixed: nothing to cook, nothing to stand for, one hand. */
export const FLOOR_CONSTRAINTS: PlanConstraints = {
  minutes: 5,
  equipment: "none",
  hands: 1,
  canStand: false,
  excludeAllergens: [],
  safeFoodsOnly: false,
};

export type EffortProfile = {
  /** Hands-on minutes for the whole plan, counted once per distinct food. */
  minutes: number;
  /** The most capable appliance the plan needs. */
  equipment: FoodEquipment;
  /** 2 if any item needs both hands. */
  hands: 1 | 2;
  /** The hardest thing the plan asks for. */
  effort: FoodEffort;
  /** "5 min · one pan · one-handed" — the cost, stated up front. */
  summary: string;
};

const EFFORT_RANK: Record<FoodEffort, number> = { none: 0, assemble: 1, heat: 2, cook: 3 };

/** Cost of a set of plan items. Distinct foods only — you boil a kettle once. */
export function effortFor(items: PlanItem[], foods: FoodDef[]): EffortProfile {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const seen = new Set<string>();
  let minutes = 0;
  let equipment: FoodEquipment = "none";
  let hands: 1 | 2 = 1;
  let effort: FoodEffort = "none";
  for (const item of items) {
    const food = byKey.get(item.foodKey);
    if (!food || seen.has(food.key)) continue;
    seen.add(food.key);
    minutes += food.standingMinutes;
    if (EQUIPMENT_RANK[food.equipment] > EQUIPMENT_RANK[equipment]) equipment = food.equipment;
    if (food.hands === 2) hands = 2;
    if (EFFORT_RANK[food.effort] > EFFORT_RANK[effort]) effort = food.effort;
  }
  return { minutes, equipment, hands, effort, summary: effortSummary(minutes, equipment, hands) };
}

/** The sentence a card leads with. Three facts, in the order people ask them. */
export function effortSummary(
  minutes: number,
  equipment: FoodEquipment,
  hands: 1 | 2,
): string {
  const time = minutes <= 0 ? "no prep" : `${minutes} min`;
  return `${time} · ${EQUIPMENT_LABELS[equipment]} · ${hands === 1 ? "one-handed" : "two hands"}`;
}

/**
 * Portion without scales: "1 palm", and "1 palm × 2" when the plan wants more.
 * Kitchen scales are a barrier, not a standard — grams stay available behind a
 * toggle, they just stop being the only way to read a plan.
 */
export function handPortionLabel(food: FoodDef, grams: number): string {
  const mult = food.portionG > 0 && grams > 0 ? grams / food.portionG : 1;
  const n = Math.max(0.5, Math.round(mult * 2) / 2);
  if (n === 1) return food.handPortion;
  const whole = Math.floor(n);
  const shown = n === whole ? String(whole) : `${whole === 0 ? "" : whole}½`;
  return `${food.handPortion} × ${shown}`;
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

/** Does today's kitchen admit this food at all? */
export function foodAllowed(food: FoodDef, kitchen: KitchenProfile): boolean {
  if (kitchen.neverAgain.includes(food.key)) return false;
  if (food.allergens.some((a) => kitchen.excludeAllergens.includes(a))) return false;
  if (!reachableWith(food, kitchen.equipment)) return false;
  if (food.hands > kitchen.hands) return false;
  if (!kitchen.canStand && food.standingMinutes > 0) return false;
  if (food.standingMinutes > kitchen.minutes) return false;
  if (
    kitchen.safeFoodsOnly &&
    !kitchen.safeFoods.includes(food.key) &&
    kitchen.pinnedBreakfast !== food.key
  )
    return false;
  return true;
}

/** The catalogue as today's kitchen sees it. */
export function allowedFoods(foods: FoodDef[], kitchen: KitchenProfile): FoodDef[] {
  return foods.filter((f) => foodAllowed(f, kitchen));
}

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
 * targets + same kitchen always produce the same plan.
 *
 * The kitchen is a filter and an ordering, never an apology. A five-minute,
 * one-pan, one-handed day yields a real plan built out of what that day can
 * actually reach — tinned, frozen and ready-made included — and protein is
 * still filled first. Pinned and safe foods are offered *before* the rotation,
 * so a working routine is reinforced rather than rotated away.
 */
export function planDay(
  targets: FuelTargets,
  foods: FoodDef[],
  seed: string,
  kitchen: KitchenProfile = DEFAULT_KITCHEN,
): PlanItem[] {
  const sorted = allowedFoods(foods, kitchen).sort((a, b) => a.key.localeCompare(b.key));
  if (sorted.length === 0) return [];
  const rot = seedIndex(seed);
  const safe = new Set(kitchen.safeFoods);
  const proteinPool = sorted.filter(
    (f) => f.tags.includes("high-protein") && f.per100.proteinG >= 10,
  );
  const carbPool = sorted.filter((f) => f.group === "carb");
  const vegPool = sorted.filter((f) => f.group === "veg");
  const fruitPool = sorted.filter((f) => f.group === "fruit");
  const fatPool = sorted.filter((f) => f.group === "fat");

  const items: PlanItem[] = [];
  let sodium = 0;
  let spentMinutes = 0;
  const used = new Set<string>();

  const push = (slot: MealSlot, food: FoodDef, grams: number): boolean => {
    if (!(grams >= 5)) return false;
    const added = (food.per100.sodiumMg * grams) / 100;
    if (sodium + added > targets.sodiumMgMax) return false;
    // Minutes are spent once per distinct food: a second helping of the same
    // thing costs nothing extra to make.
    const cost = used.has(food.key) ? 0 : food.standingMinutes;
    if (spentMinutes + cost > kitchen.minutes) return false;
    sodium += added;
    spentMinutes += cost;
    used.add(food.key);
    items.push({ slot, foodKey: food.key, grams });
    return true;
  };

  /**
   * Safe foods first, in a stable order — the same reliable thing again is the
   * point. Everything else rotates on the date seed as it always did.
   */
  const candidates = (pool: FoodDef[], spin: number): FoodDef[] => {
    const preferred = pool.filter((f) => safe.has(f.key));
    const rest = pool.filter((f) => !safe.has(f.key));
    const rotated =
      rest.length === 0 ? [] : rest.map((_, k) => rest[(rot + spin + k) % rest.length]);
    return [...preferred, ...rotated];
  };

  /** Try each candidate in turn until one fits the salt and minute budgets. */
  const fill = (
    pool: FoodDef[],
    slot: MealSlot,
    spin: number,
    gramsFor: (food: FoodDef) => number,
  ): void => {
    for (const food of candidates(pool, spin)) {
      if (push(slot, food, gramsFor(food))) return;
    }
  };

  // 0 — the pinned breakfast, if the day can reach it. A decision already made
  // is not re-litigated every morning.
  const pinned = kitchen.pinnedBreakfast
    ? sorted.find((f) => f.key === kitchen.pinnedBreakfast)
    : undefined;
  if (pinned) push("breakfast", pinned, pinned.portionG);

  // 1 — protein across every slot, net of anything the pin already put there.
  MEAL_SLOTS.forEach((slot, i) => {
    const placed = totalsFor(
      items.filter((it) => it.slot === slot),
      sorted,
    ).proteinG;
    const need = targets.proteinG * PROTEIN_SHARE[slot] - placed;
    if (need <= 0) return;
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
      // The pinned breakfast is not a variable to trim.
      if (food.key === kitchen.pinnedBreakfast) return;
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

/** How many items the floor plan is allowed to ask for. Three. Not four. */
export const FLOOR_ITEMS = 3;
const FLOOR_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

/**
 * The bad-day plan: three items, nothing to cook, nothing to stand for, one
 * hand, no decision left to make. It hits protein and nothing else — the floor
 * adds no obligation, it only stops the drift.
 *
 * Deliberately not seeded: the same three every day is the feature. Only the
 * user's own exclusions (allergens, never-again) and preferences (pinned, safe
 * foods) shape it; equipment, hands and standing are pinned to the worst day
 * rather than to today's profile, because that is what the floor is for.
 */
export function planFloor(
  targets: FuelTargets,
  foods: FoodDef[],
  kitchen: KitchenProfile = DEFAULT_KITCHEN,
): PlanItem[] {
  const floorKitchen: KitchenProfile = {
    ...FLOOR_CONSTRAINTS,
    excludeAllergens: kitchen.excludeAllergens,
    // A tolerance list is not a preference to be overridden on the worst day:
    // if someone only eats six things, the floor offers those six or nothing.
    safeFoodsOnly: kitchen.safeFoodsOnly,
    pinnedBreakfast: kitchen.pinnedBreakfast,
    safeFoods: kitchen.safeFoods,
    neverAgain: kitchen.neverAgain,
  };
  const safe = new Set(kitchen.safeFoods);
  const rank = (f: FoodDef): number =>
    (f.key === kitchen.pinnedBreakfast ? 0 : safe.has(f.key) ? 1 : 2);
  /**
   * Protein you can actually fit under the salt ceiling. Sorting on density
   * alone spends the whole salt allowance on the first two items and leaves the
   * third with nothing to give; this discounts a food by how much of the
   * ceiling it eats on the way.
   */
  const score = (f: FoodDef): number => f.per100.proteinG / (1 + f.per100.sodiumMg / 200);

  const pool = allowedFoods(foods, floorKitchen)
    // Nothing to do at all — not "assemble", not "drain the tin". And a normal
    // portion has to be a meal's worth of protein, so the floor never proposes
    // a spoon of seeds as one of somebody's three things.
    .filter((f) => f.effort === "none" && (f.per100.proteinG * f.portionG) / 100 >= 8)
    .sort((a, b) => rank(a) - rank(b) || score(b) - score(a) || a.key.localeCompare(b.key));
  if (pool.length === 0) return [];

  const items: PlanItem[] = [];
  let sodium = 0;
  let proteinLeft = targets.proteinG;

  for (const food of pool) {
    if (items.length >= FLOOR_ITEMS) break;
    const slot = FLOOR_SLOTS[items.length];
    const need = proteinLeft / (FLOOR_ITEMS - items.length);
    const density = food.per100.proteinG / 100;
    if (!(density > 0)) continue;
    // A realistic serving, never a heroic one: two normal portions at most.
    let grams = clampRound5(need / density, 20, Math.max(20, food.portionG * 2));
    // Salt is trimmed, not used as an excuse to drop the food. Under the
    // ceiling with less of it beats a floor that returns nothing.
    const perGram = food.per100.sodiumMg / 100;
    if (perGram > 0) {
      const affordable = Math.floor((targets.sodiumMgMax - sodium) / perGram / 5) * 5;
      grams = Math.min(grams, affordable);
    }
    if (!(grams >= 20)) continue;
    sodium += perGram * grams;
    proteinLeft = Math.max(0, proteinLeft - density * grams);
    items.push({ slot, foodKey: food.key, grams });
  }

  return items;
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
  /** Hand portion — what the row says before anyone asks for grams. */
  portion: string;
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
  handPortion: string;
  kcalPer100: number;
  proteinPer100G: number;
  sodiumPer100Mg: number;
  tags: string[];
  effort: FoodEffort;
  equipment: FoodEquipment;
  hands: 1 | 2;
  standingMinutes: number;
  shelf: FoodShelf;
  allergens: Allergen[];
  /** False when today's kitchen or the user's exclusions rule it out. */
  allowed: boolean;
};

export type FuelWeek = {
  avgKcal: number;
  avgProteinG: number;
  daysLogged: number;
  days: { date: string; kcal: number; proteinG: number }[];
};

export type PlanItemView = {
  slot: MealSlot;
  slotLabel: string;
  foodKey: string;
  name: string;
  grams: number;
  portion: string;
  kcal: number;
  proteinG: number;
  effort: FoodEffort;
  equipment: FoodEquipment;
  hands: 1 | 2;
  standingMinutes: number;
  shelf: FoodShelf;
};

export type PlanView = {
  items: PlanItemView[];
  effort: EffortProfile;
  /** "5 min · one pan · one-handed" — stated before anyone commits. */
  effortSummary: string;
  kcal: number;
  proteinG: number;
};

export type NamedFood = { key: string; name: string };

export type KitchenView = {
  minutes: number;
  equipment: FoodEquipment;
  hands: 1 | 2;
  canStand: boolean;
  excludeAllergens: Allergen[];
  safeFoodsOnly: boolean;
  pinnedBreakfast: NamedFood | null;
  safeFoods: NamedFood[];
  neverAgain: NamedFood[];
  /** The profile in one line, same grammar as a plan's cost. */
  summary: string;
  /** How much of the catalogue this profile can reach, out of how much there is. */
  reachableFoods: number;
  catalogueSize: number;
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
  kitchen: KitchenView;
  /** What "generate a day" would write, priced up front. Null on the floor. */
  proposal: PlanView | null;
  /** The bad-day plan. Always available, in every mode. */
  floor: PlanView;
  /** What today's rows actually cost to make. */
  todayEffort: EffortProfile;
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
  /** Minutes, pans, hands, standing, exclusions. Omitted means a full kitchen. */
  kitchen?: KitchenProfile;
};

/** Plan items, priced and named, with the effort line the UI leads with. */
export function buildPlanView(items: PlanItem[], foods: FoodDef[]): PlanView {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const rows: PlanItemView[] = [];
  for (const item of items) {
    const food = byKey.get(item.foodKey);
    if (!food) continue;
    const n = nutrientsFor(food, item.grams);
    rows.push({
      slot: item.slot,
      slotLabel: SLOT_LABELS[item.slot],
      foodKey: food.key,
      name: food.name,
      grams: item.grams,
      portion: handPortionLabel(food, item.grams),
      kcal: n.kcal,
      proteinG: n.proteinG,
      effort: food.effort,
      equipment: food.equipment,
      hands: food.hands,
      standingMinutes: food.standingMinutes,
      shelf: food.shelf,
    });
  }
  const effort = effortFor(items, foods);
  const totals = totalsFor(items, foods);
  return {
    items: rows,
    effort,
    effortSummary: effort.summary,
    kcal: totals.kcal,
    proteinG: totals.proteinG,
  };
}

function namedFoods(keys: string[], byKey: Map<string, FoodDef>): NamedFood[] {
  const out: NamedFood[] = [];
  for (const key of keys) {
    const food = byKey.get(key);
    if (food) out.push({ key: food.key, name: food.name });
  }
  return out;
}

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
  const kitchen = input.kitchen ?? DEFAULT_KITCHEN;
  const survival = input.mode === "survival";

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
      portion: handPortionLabel(food, e.grams),
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
      handPortion: f.handPortion,
      kcalPer100: f.per100.kcal,
      proteinPer100G: f.per100.proteinG,
      sodiumPer100Mg: f.per100.sodiumMg,
      tags: [...f.tags],
      effort: f.effort,
      equipment: f.equipment,
      hands: f.hands,
      standingMinutes: f.standingMinutes,
      shelf: f.shelf,
      allergens: [...f.allergens],
      allowed: foodAllowed(f, kitchen),
    }));

  const reachable = foods.filter((f) => f.allowed).length;
  const kitchenView: KitchenView = {
    minutes: kitchen.minutes,
    equipment: kitchen.equipment,
    hands: kitchen.hands,
    canStand: kitchen.canStand,
    excludeAllergens: [...kitchen.excludeAllergens],
    safeFoodsOnly: kitchen.safeFoodsOnly,
    pinnedBreakfast: kitchen.pinnedBreakfast
      ? (namedFoods([kitchen.pinnedBreakfast], byKey)[0] ?? null)
      : null,
    safeFoods: namedFoods(kitchen.safeFoods, byKey),
    neverAgain: namedFoods(kitchen.neverAgain, byKey),
    summary: effortSummary(kitchen.minutes, kitchen.equipment, kitchen.hands),
    reachableFoods: reachable,
    catalogueSize: foods.length,
  };

  // Survival is a floor, not a lite mode: the floor plan and nothing else. No
  // proposal to weigh up, no shopping list, no new obligation.
  const proposal = survival
    ? null
    : buildPlanView(planDay(targets, input.foods, input.date, kitchen), input.foods);

  return {
    targets,
    totals,
    remaining,
    tdee,
    entries,
    slots,
    sodiumUsedMg: totals.sodiumMg,
    week,
    shoppingList: survival
      ? []
      : shoppingList(
          today.filter((e) => e.planned && !e.eaten),
          input.foods,
        ),
    foods,
    survival,
    kitchen: kitchenView,
    proposal,
    floor: buildPlanView(planFloor(targets, input.foods, kitchen), input.foods),
    todayEffort: effortFor(
      today.map((e) => ({ slot: e.slot, foodKey: e.foodKey, grams: e.grams })),
      input.foods,
    ),
  };
}

/** Catalogue guard for the log mutation — never store a key the file cannot price. */
export function isKnownFood(key: string): boolean {
  return foodByKey(key) !== undefined;
}

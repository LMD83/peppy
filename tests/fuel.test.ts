import { describe, expect, it } from "vitest";
import {
  ALLERGENS,
  EQUIPMENT_RANK,
  FOODS,
  GROUP_ORDER,
  foodByKey,
  type FoodDef,
} from "../convex/tm/data/foods";
import { MENUS, menuByKey } from "../convex/tm/data/menus";
import {
  ACTIVITY_MULTIPLIERS,
  DEFAULT_KITCHEN,
  FLOOR_ITEMS,
  KCAL_OVERSHOOT,
  MEAL_SLOTS,
  SODIUM_MG_MAX,
  adaptiveTdee,
  allowedFoods,
  buildFuelView,
  effortFor,
  effortSummary,
  estimatedTdee,
  foodAllowed,
  frequentFoodKeys,
  handPortionLabel,
  macroTargets,
  menuAllowed,
  menuTotals,
  mifflinStJeor,
  nutrientsFor,
  planDay,
  planFloor,
  planWeek,
  recentFoodKeys,
  remainingAfter,
  shoppingList,
  swapGrams,
  totalsFor,
  weeklyLeftoverKcal,
  weightSlopeKgPerWeek,
  type BodyProfile,
  type KitchenProfile,
  type PlanItem,
  type RawMealEntry,
} from "../convex/tm/logicFuel";
import { addDays } from "../convex/tm/lib";
import { buildFuelFixtures, kitchenProfileFor } from "../convex/tm/fixtures/fuel";

const TODAY = "2026-08-13";
const PROFILE: BodyProfile = {
  weightKg: 92.8,
  heightCm: 178,
  age: 38,
  sex: "male",
  activity: "moderate",
};

describe("food catalogue", () => {
  it("carries at least 150 staples with unique keys", () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(FOODS.map((f) => f.key)).size).toBe(FOODS.length);
  });

  it("covers every group in the aisle order", () => {
    const groups = new Set(FOODS.map((f) => f.group));
    for (const g of GROUP_ORDER) expect(groups.has(g)).toBe(true);
  });

  it("holds plausible per-100 g values", () => {
    for (const f of FOODS) {
      expect(f.per100.kcal, f.key).toBeGreaterThan(0);
      expect(f.per100.kcal, f.key).toBeLessThanOrEqual(900);
      expect(f.per100.proteinG, f.key).toBeGreaterThanOrEqual(0);
      expect(f.per100.sodiumMg, f.key).toBeGreaterThanOrEqual(0);
      expect(f.portionG, f.key).toBeGreaterThan(0);
      expect(f.portionLabel.length, f.key).toBeGreaterThan(0);
    }
  });

  it("reconciles energy with the Atwater factors", () => {
    for (const f of FOODS) {
      const derived = 4 * f.per100.proteinG + 4 * f.per100.carbsG + 9 * f.per100.fatG;
      expect(Math.abs(derived - f.per100.kcal), f.key).toBeLessThanOrEqual(
        Math.max(30, f.per100.kcal * 0.25),
      );
    }
  });

  it("only tags what is true", () => {
    for (const f of FOODS) {
      if (f.tags.includes("low-sodium")) expect(f.per100.sodiumMg, f.key).toBeLessThanOrEqual(50);
      if (f.tags.includes("high-protein")) expect(f.per100.proteinG, f.key).toBeGreaterThanOrEqual(8);
      if (f.tags.includes("bulk")) expect(f.per100.kcal, f.key).toBeLessThanOrEqual(120);
    }
  });

  it("looks up by key and returns undefined for a stranger", () => {
    expect(foodByKey("skyr")?.name).toBe("Skyr, natural");
    expect(foodByKey("unicorn_steak")).toBeUndefined();
  });
});

describe("mifflin-st jeor", () => {
  it("matches the published equation", () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(mifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: "male" })).toBe(1780);
    // 10*65 + 6.25*165 - 5*30 - 161
    expect(mifflinStJeor({ weightKg: 65, heightCm: 165, age: 30, sex: "female" })).toBe(1370);
  });

  it("scales by activity, ascending", () => {
    const keys = ["sedentary", "light", "moderate", "high", "athlete"] as const;
    for (let i = 1; i < keys.length; i++) {
      expect(ACTIVITY_MULTIPLIERS[keys[i]]).toBeGreaterThan(ACTIVITY_MULTIPLIERS[keys[i - 1]]);
    }
    expect(estimatedTdee(PROFILE)).toBe(Math.round(mifflinStJeor(PROFILE) * 1.55));
  });
});

describe("macro targets", () => {
  it("puts protein per kg on the mode", () => {
    expect(macroTargets("cut", 90, 3000).proteinG).toBe(198);
    expect(macroTargets("maintain", 90, 3000).proteinG).toBe(162);
    expect(macroTargets("survival", 90, 3000).proteinG).toBe(144);
  });

  it("cuts 20%, maintains flat, and only trims 5% on the floor", () => {
    expect(macroTargets("cut", 90, 3000).kcal).toBe(2400);
    expect(macroTargets("maintain", 90, 3000).kcal).toBe(3000);
    expect(macroTargets("survival", 90, 3000).kcal).toBe(2850);
  });

  it("floors fat at 0.8 g/kg and lets carbs take the remainder", () => {
    for (const mode of ["cut", "maintain", "survival"] as const) {
      const t = macroTargets(mode, 92.8, 2900);
      expect(t.fatG).toBeGreaterThanOrEqual(92.8 * 0.8 - 0.05);
      expect(t.carbsG).toBeGreaterThanOrEqual(0);
      const reconstructed = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
      expect(Math.abs(reconstructed - t.kcal)).toBeLessThanOrEqual(t.kcal * 0.01 + 5);
    }
  });

  it("sets fibre at 14 g per 1000 kcal and the salt ceiling at 2 g", () => {
    const t = macroTargets("cut", 90, 3000);
    expect(t.fiberG).toBe(Math.round((14 * 2400) / 1000));
    expect(t.sodiumMgMax).toBe(SODIUM_MG_MAX);
  });

  it("never returns negative carbs for a very small allowance", () => {
    const t = macroTargets("cut", 140, 900);
    expect(t.carbsG).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(t.kcal)).toBe(true);
  });

  it("survives a zero weight without dividing by zero", () => {
    const t = macroTargets("maintain", 0, 2000);
    expect(Number.isFinite(t.proteinG)).toBe(true);
    expect(t.carbsG).toBeGreaterThanOrEqual(0);
  });
});

describe("adaptive tdee", () => {
  const intake = (days: number, kcal: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (let i = 0; i < days; i++) out[addDays(TODAY, -i)] = kcal;
    return out;
  };
  const weighIns = (count: number, startKg: number, kgPerWeek: number) =>
    Array.from({ length: count }, (_, i) => {
      const back = 13 - i * Math.floor(13 / Math.max(1, count - 1));
      return { date: addDays(TODAY, -back), weightKg: startKg + ((13 - back) / 7) * kgPerWeek };
    });

  it("stays estimated until there are enough days AND weigh-ins", () => {
    const thin = adaptiveTdee(weighIns(4, 93, -0.5), intake(9, 2200), TODAY, PROFILE);
    expect(thin.basis).toBe("estimated");
    expect(thin.tdeeKcal).toBe(estimatedTdee(PROFILE));

    const fewScales = adaptiveTdee(weighIns(2, 93, -0.5), intake(14, 2200), TODAY, PROFILE);
    expect(fewScales.basis).toBe("estimated");
    expect(fewScales.weighInCount).toBe(2);
  });

  it("fits intake against the mass slope once the data is there", () => {
    const res = adaptiveTdee(weighIns(6, 93, -0.5), intake(14, 2200), TODAY, PROFILE);
    expect(res.basis).toBe("adaptive");
    expect(res.avgIntakeKcal).toBe(2200);
    expect(res.weightSlopeKgPerWeek).toBeCloseTo(-0.5, 1);
    // 2200 - (-0.5 * 7700 / 7) = 2750
    expect(res.tdeeKcal).toBeGreaterThan(2600);
    expect(res.tdeeKcal).toBeLessThan(2900);
    expect(res.confidence).toBe("high");
  });

  it("reads a rising mass as a higher intake than expenditure", () => {
    const up = adaptiveTdee(weighIns(6, 93, 0.25), intake(14, 3000), TODAY, PROFILE);
    expect(up.basis).toBe("adaptive");
    expect(up.tdeeKcal).toBeLessThan(up.avgIntakeKcal);
  });

  it("ignores data outside the trailing 14 days", () => {
    const old: Record<string, number> = { [addDays(TODAY, -40)]: 2500 };
    const res = adaptiveTdee([{ date: addDays(TODAY, -40), weightKg: 99 }], old, TODAY, PROFILE);
    expect(res.intakeDays).toBe(0);
    expect(res.weighInCount).toBe(0);
    expect(res.avgIntakeKcal).toBe(0);
  });

  it("returns a zero slope rather than NaN for degenerate weigh-ins", () => {
    expect(weightSlopeKgPerWeek([])).toBe(0);
    expect(weightSlopeKgPerWeek([{ date: TODAY, weightKg: 90 }])).toBe(0);
    expect(
      weightSlopeKgPerWeek([
        { date: TODAY, weightKg: 90 },
        { date: TODAY, weightKg: 91 },
      ]),
    ).toBe(0);
  });

  it("carries the stored weekly estimate through untouched", () => {
    const res = adaptiveTdee([], {}, TODAY, PROFILE, { weekStart: "2026-08-03", tdeeKcal: 2810 });
    expect(res.lastWeekly).toEqual({ weekStart: "2026-08-03", tdeeKcal: 2810 });
  });
});

describe("totals", () => {
  it("sums a plate", () => {
    const t = totalsFor(
      [
        { foodKey: "chicken_breast", grams: 200 },
        { foodKey: "brown_rice", grams: 100 },
      ],
      FOODS,
    );
    expect(t.kcal).toBe(Math.round(165 * 2 + 367));
    expect(t.proteinG).toBeCloseTo(31 * 2 + 7.5, 1);
  });

  it("is zero for nothing and skips unknown keys", () => {
    expect(totalsFor([], FOODS).kcal).toBe(0);
    expect(totalsFor([{ foodKey: "unicorn_steak", grams: 300 }], FOODS).kcal).toBe(0);
    expect(totalsFor([{ foodKey: "skyr", grams: 0 }], FOODS).kcal).toBe(0);
  });

  it("prices a single portion", () => {
    const skyr = foodByKey("skyr") as FoodDef;
    expect(nutrientsFor(skyr, 170).kcal).toBe(Math.round(63 * 1.7));
    expect(nutrientsFor(skyr, -5).kcal).toBe(0);
  });
});

describe("plan generation", () => {
  const targets = macroTargets("cut", 92.8, 2876);

  it("is deterministic for a given date", () => {
    const a = planDay(targets, FOODS, TODAY);
    const b = planDay(targets, FOODS, TODAY);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(4);
  });

  it("rotates the menu across dates but stays stable per date", () => {
    const days = ["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"];
    const plans = days.map((d) => planDay(targets, FOODS, d));
    for (let i = 0; i < days.length; i++) {
      expect(planDay(targets, FOODS, days[i])).toEqual(plans[i]);
    }
    const signatures = new Set(plans.map((p) => p.map((i) => i.foodKey).join("|")));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("never overshoots energy by more than 3%", () => {
    for (const day of ["2026-01-05", "2026-04-17", "2026-08-13", "2026-12-30"]) {
      for (const mode of ["cut", "maintain", "survival"] as const) {
        const t = macroTargets(mode, 92.8, 2876);
        const plan = planDay(t, FOODS, day);
        expect(totalsFor(plan, FOODS).kcal, `${day}/${mode}`).toBeLessThanOrEqual(
          t.kcal * KCAL_OVERSHOOT,
        );
      }
    }
  });

  it("respects the salt ceiling", () => {
    for (const day of ["2026-02-02", "2026-06-06", "2026-11-11"]) {
      const plan = planDay(targets, FOODS, day);
      expect(totalsFor(plan, FOODS).sodiumMg).toBeLessThanOrEqual(targets.sodiumMgMax);
    }
  });

  it("fills protein first, across all four slots", () => {
    const plan = planDay(targets, FOODS, TODAY);
    for (const slot of MEAL_SLOTS) {
      expect(plan.some((i) => i.slot === slot), slot).toBe(true);
    }
    expect(totalsFor(plan, FOODS).proteinG).toBeGreaterThanOrEqual(targets.proteinG * 0.7);
  });

  it("gets most of the way to the energy target", () => {
    const plan = planDay(targets, FOODS, TODAY);
    expect(totalsFor(plan, FOODS).kcal).toBeGreaterThanOrEqual(targets.kcal * 0.75);
  });

  it("returns nothing rather than throwing on an empty catalogue", () => {
    expect(planDay(targets, [], TODAY)).toEqual([]);
  });
});

describe("shopping list", () => {
  it("aggregates grams per food in aisle order", () => {
    const list = shoppingList(
      [
        { foodKey: "broccoli", grams: 150 },
        { foodKey: "chicken_breast", grams: 150 },
        { foodKey: "chicken_breast", grams: 100 },
        { foodKey: "skyr", grams: 170 },
        { foodKey: "unicorn_steak", grams: 999 },
      ],
      FOODS,
    );
    expect(list.map((i) => i.foodKey)).toEqual(["chicken_breast", "skyr", "broccoli"]);
    expect(list[0].grams).toBe(250);
  });

  it("is empty when nothing is queued", () => {
    expect(shoppingList([], FOODS)).toEqual([]);
  });
});

describe("fuel view", () => {
  const entry = (
    id: string,
    date: string,
    slot: (typeof MEAL_SLOTS)[number],
    foodKey: string,
    grams: number,
    eaten: boolean,
    planned = false,
  ): RawMealEntry => ({ id, date, slot, foodKey, grams, planned, eaten });

  const base = {
    mode: "cut" as const,
    date: TODAY,
    weighIns: [{ date: addDays(TODAY, -1), weightKg: 92.8 }],
    latestWeightKg: 92.8,
    manualTarget: null,
    lastWeekly: null,
    foods: FOODS,
  };

  it("counts only what was eaten toward totals", () => {
    const view = buildFuelView({
      ...base,
      windowEntries: [
        entry("me_1", TODAY, "breakfast", "skyr", 170, true),
        entry("me_2", TODAY, "dinner", "chicken_breast", 200, false, true),
      ],
    });
    expect(view.totals.kcal).toBe(nutrientsFor(foodByKey("skyr") as FoodDef, 170).kcal);
    expect(view.entries).toHaveLength(2);
    expect(view.remaining.kcal).toBe(view.targets.kcal - view.totals.kcal);
    expect(view.sodiumUsedMg).toBe(view.totals.sodiumMg);
  });

  it("lists only planned-but-uneaten rows on the shopping list", () => {
    const view = buildFuelView({
      ...base,
      windowEntries: [
        entry("me_1", TODAY, "breakfast", "skyr", 170, true),
        entry("me_2", TODAY, "dinner", "chicken_breast", 200, false, true),
      ],
    });
    expect(view.shoppingList.map((i) => i.foodKey)).toEqual(["chicken_breast"]);
  });

  it("groups every slot, even the empty ones", () => {
    const view = buildFuelView({ ...base, windowEntries: [] });
    expect(view.slots.map((s) => s.slot)).toEqual([...MEAL_SLOTS]);
    expect(view.slots.every((s) => s.entries.length === 0)).toBe(true);
    expect(view.week.daysLogged).toBe(0);
    expect(view.week.days).toHaveLength(7);
    expect(view.totals.kcal).toBe(0);
  });

  it("averages the week over logged days only", () => {
    const windowEntries = [
      entry("me_1", addDays(TODAY, -1), "lunch", "chicken_breast", 200, true),
      entry("me_2", addDays(TODAY, -2), "lunch", "chicken_breast", 200, true),
    ];
    const view = buildFuelView({ ...base, windowEntries });
    expect(view.week.daysLogged).toBe(2);
    expect(view.week.avgKcal).toBe(330);
  });

  it("marks survival and still returns a complete shape", () => {
    const view = buildFuelView({ ...base, mode: "survival", windowEntries: [] });
    expect(view.survival).toBe(true);
    expect(view.targets.proteinG).toBe(Math.round(92.8 * 1.6 * 10) / 10);
    expect(view.foods.length).toBe(FOODS.length);
  });

  it("honours a manually pinned target over the derived one", () => {
    const manual = {
      kcal: 2100,
      proteinG: 190,
      carbsG: 200,
      fatG: 60,
      fiberG: 30,
      sodiumMgMax: 1800,
    };
    const view = buildFuelView({ ...base, manualTarget: manual, windowEntries: [] });
    expect(view.targets).toEqual(manual);
  });

  it("skips entries whose food key left the catalogue", () => {
    const view = buildFuelView({
      ...base,
      windowEntries: [entry("me_1", TODAY, "lunch", "unicorn_steak", 200, true)],
    });
    expect(view.entries).toEqual([]);
    expect(view.totals.kcal).toBe(0);
  });
});

describe("fixtures", () => {
  const fx = buildFuelFixtures(TODAY);

  it("prices every entry against the catalogue", () => {
    for (const row of fx.mealEntries) {
      expect(foodByKey(row.foodKey), row.foodKey).toBeDefined();
      expect(row.grams).toBeGreaterThan(0);
    }
  });

  it("gives every entry a stable unique id", () => {
    const ids = fx.mealEntries.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("me_1");
    expect(buildFuelFixtures(TODAY).mealEntries.map((r) => r.id)).toEqual(ids);
  });

  it("gives liam a full fortnight of intake and both of today's states", () => {
    const liam = fx.mealEntries.filter((r) => r.userSlug === "liam");
    const dates = new Set(liam.filter((r) => r.eaten).map((r) => r.date));
    expect(dates.size).toBeGreaterThanOrEqual(14);
    const todayRows = liam.filter((r) => r.date === TODAY);
    expect(todayRows.some((r) => r.eaten)).toBe(true);
    expect(todayRows.some((r) => r.planned && !r.eaten)).toBe(true);
  });

  it("keeps conor on the floor — no plan rows, protein-forward", () => {
    const conor = fx.mealEntries.filter((r) => r.userSlug === "conor");
    expect(conor.length).toBeGreaterThan(0);
    expect(conor.every((r) => !r.planned)).toBe(true);
    expect(conor.some((r) => r.date === TODAY && r.eaten)).toBe(true);
  });

  it("seeds targets and weekly estimates for both users", () => {
    expect(new Set(fx.nutritionTargets.map((t) => t.userSlug))).toEqual(new Set(["liam", "conor"]));
    expect(fx.energyEstimates.length).toBeGreaterThanOrEqual(2);
    for (const t of fx.nutritionTargets) expect(t.sodiumMgMax).toBe(SODIUM_MG_MAX);
  });

  it("builds a coherent day view out of the fixtures", () => {
    const liam = fx.mealEntries.filter((r) => r.userSlug === "liam");
    const from = addDays(TODAY, -13);
    const view = buildFuelView({
      mode: "cut",
      date: TODAY,
      windowEntries: liam
        .filter((r) => r.date >= from && r.date <= TODAY)
        .map((r) => ({
          id: r.id,
          date: r.date,
          slot: r.slot,
          foodKey: r.foodKey,
          grams: r.grams,
          planned: r.planned,
          eaten: r.eaten,
        })),
      weighIns: [
        { date: addDays(TODAY, -7), weightKg: 93.4 },
        { date: addDays(TODAY, -1), weightKg: 92.8 },
      ],
      latestWeightKg: 92.8,
      manualTarget: null,
      lastWeekly: null,
      foods: FOODS,
    });
    expect(view.survival).toBe(false);
    expect(view.totals.kcal).toBeGreaterThan(500);
    expect(view.week.daysLogged).toBe(7);
    expect(view.week.avgKcal).toBeGreaterThan(1500);
    expect(view.week.avgKcal).toBeLessThan(3000);
    expect(view.shoppingList.length).toBeGreaterThan(0);
    // Only two weigh-ins in the window: the fit stays honest instead of guessing.
    expect(view.tdee.basis).toBe("estimated");
    expect(view.tdee.intakeDays).toBeGreaterThanOrEqual(10);
  });
});

/* ===== effort, equipment, hands, standing — the bad-day inputs ===== */

const KITCHEN = (patch: Partial<KitchenProfile> = {}): KitchenProfile => ({
  ...DEFAULT_KITCHEN,
  ...patch,
});

/** The day the app is actually for: five minutes, one pan, one hand. */
const BAD_DAY = KITCHEN({ minutes: 5, equipment: "one-pan", hands: 1, canStand: true });

const TARGETS = macroTargets("cut", 92.8, 2800);

function keysOf(items: PlanItem[]): string[] {
  return items.map((i) => i.foodKey);
}

function food(key: string): FoodDef {
  const f = foodByKey(key);
  if (!f) throw new Error(`fixture expects ${key} in the catalogue`);
  return f;
}

describe("the catalogue carries what it costs to make", () => {
  it("gives every food an effort, a kitchen, hands, standing, a shelf and a hand portion", () => {
    for (const f of FOODS) {
      expect(["none", "assemble", "heat", "cook"], f.key).toContain(f.effort);
      expect(Object.keys(EQUIPMENT_RANK), f.key).toContain(f.equipment);
      expect([1, 2], f.key).toContain(f.hands);
      expect(f.standingMinutes, f.key).toBeGreaterThanOrEqual(0);
      expect(f.standingMinutes, f.key).toBeLessThanOrEqual(30);
      expect(["fresh", "fridge", "freezer", "cupboard"], f.key).toContain(f.shelf);
      // "1 palm", "2 eggs" — a count and a body part, never a weight.
      expect(f.handPortion, f.key).toMatch(/^\d+ \S/);
    }
  });

  it("only names allergens the EU actually lists, and never twice", () => {
    for (const f of FOODS) {
      for (const a of f.allergens) expect(ALLERGENS, `${f.key}: ${a}`).toContain(a);
      expect(new Set(f.allergens).size, f.key).toBe(f.allergens.length);
    }
    // The obvious ones are present, so an exclusion is not silently a no-op.
    expect(food("salmon_fillet").allergens).toContain("fish");
    expect(food("skyr").allergens).toContain("milk");
    expect(food("almonds").allergens).toContain("nuts");
    expect(food("hummus").allergens).toContain("sesame");
    expect(food("prawns_cooked").allergens).toContain("crustaceans");
  });

  it("keeps effort and equipment honest against each other", () => {
    for (const f of FOODS) {
      // Nothing to do means nothing to stand for and no appliance.
      if (f.effort === "none") {
        expect(f.equipment, f.key).toBe("none");
        expect(f.standingMinutes, f.key).toBe(0);
      }
      if (f.effort === "cook") expect(EQUIPMENT_RANK[f.equipment], f.key).toBeGreaterThanOrEqual(3);
      if (f.equipment === "none") expect(["none", "assemble"], f.key).toContain(f.effort);
    }
  });

  it("treats tinned, frozen and ready-made as first-class, not as a fallback", () => {
    const byShelf = (shelf: string) => FOODS.filter((f) => f.shelf === shelf);
    expect(byShelf("freezer").length).toBeGreaterThanOrEqual(5);
    expect(byShelf("cupboard").length).toBeGreaterThanOrEqual(20);
    // A week nobody planned for: protein that needs no fridge and no cooking.
    const survivesTheWeek = FOODS.filter(
      (f) => (f.shelf === "cupboard" || f.shelf === "freezer") && f.per100.proteinG >= 8,
    );
    expect(survivesTheWeek.length).toBeGreaterThanOrEqual(6);
  });

  it("offers enough one-handed, no-standing protein for a floor to exist", () => {
    const oneHanded = FOODS.filter(
      (f) => f.hands === 1 && f.standingMinutes === 0 && f.per100.proteinG >= 8,
    );
    expect(oneHanded.length).toBeGreaterThanOrEqual(FLOOR_ITEMS);
  });
});

describe("what today's kitchen can reach", () => {
  it("rules out anything above the equipment you have", () => {
    const kettleOnly = KITCHEN({ equipment: "kettle" });
    expect(foodAllowed(food("chicken_breast"), kettleOnly)).toBe(false);
    expect(foodAllowed(food("couscous"), kettleOnly)).toBe(true);
    expect(foodAllowed(food("skyr"), kettleOnly)).toBe(true);
  });

  it("rules out two-handed jobs when one hand is what there is", () => {
    const oneHand = KITCHEN({ hands: 1 });
    expect(foodAllowed(food("avocado"), oneHand)).toBe(false);
    expect(foodAllowed(food("banana"), oneHand)).toBe(true);
  });

  it("rules out standing when standing is not on offer", () => {
    const seated = KITCHEN({ canStand: false });
    expect(allowedFoods(FOODS, seated).every((f) => f.standingMinutes === 0)).toBe(true);
    expect(allowedFoods(FOODS, seated).length).toBeGreaterThan(10);
  });

  it("honours allergens, never-again and safe-foods-only", () => {
    expect(foodAllowed(food("salmon_fillet"), KITCHEN({ excludeAllergens: ["fish"] }))).toBe(false);
    expect(foodAllowed(food("banana"), KITCHEN({ neverAgain: ["banana"] }))).toBe(false);
    const onlySafe = KITCHEN({ safeFoodsOnly: true, safeFoods: ["skyr"], pinnedBreakfast: "oats" });
    expect(allowedFoods(FOODS, onlySafe).map((f) => f.key).sort()).toEqual(["oats", "skyr"]);
  });

  it("drops a food whose own prep already busts the whole minute budget", () => {
    expect(foodAllowed(food("chicken_breast"), KITCHEN({ minutes: 5 }))).toBe(false);
    expect(foodAllowed(food("frozen_peas"), KITCHEN({ minutes: 5 }))).toBe(true);
  });
});

describe("a five-minute, one-pan, one-handed day is a real plan", () => {
  const plan = planDay(TARGETS, FOODS, TODAY, BAD_DAY);

  it("produces a plan rather than an apology", () => {
    expect(plan.length).toBeGreaterThanOrEqual(4);
    expect(new Set(plan.map((i) => i.slot)).size).toBeGreaterThanOrEqual(3);
  });

  it("stays inside every constraint it was given", () => {
    const cost = effortFor(plan, FOODS);
    expect(cost.minutes).toBeLessThanOrEqual(BAD_DAY.minutes);
    expect(cost.hands).toBe(1);
    for (const item of plan) {
      const f = food(item.foodKey);
      expect(f.hands, f.key).toBe(1);
      expect(EQUIPMENT_RANK[f.equipment], f.key).toBeLessThanOrEqual(EQUIPMENT_RANK["one-pan"]);
    }
  });

  it("still puts protein first", () => {
    const got = totalsFor(plan, FOODS).proteinG;
    expect(got).toBeGreaterThan(TARGETS.proteinG * 0.6);
    expect(totalsFor(plan, FOODS).kcal).toBeLessThanOrEqual(TARGETS.kcal * KCAL_OVERSHOOT);
  });

  it("is deterministic for the same day and the same kitchen", () => {
    expect(planDay(TARGETS, FOODS, TODAY, BAD_DAY)).toEqual(plan);
  });

  it("keeps the salt ceiling it always kept", () => {
    expect(totalsFor(plan, FOODS).sodiumMg).toBeLessThanOrEqual(TARGETS.sodiumMgMax);
  });

  it("cannot stand, and still eats", () => {
    const seated = planDay(TARGETS, FOODS, TODAY, KITCHEN({ canStand: false, hands: 1 }));
    expect(seated.length).toBeGreaterThan(0);
    expect(seated.every((i) => food(i.foodKey).standingMinutes === 0)).toBe(true);
    expect(totalsFor(seated, FOODS).proteinG).toBeGreaterThan(TARGETS.proteinG * 0.5);
  });
});

describe("exclusions and repetition", () => {
  it("never plans an excluded allergen or a never-again food", () => {
    const kitchen = KITCHEN({ excludeAllergens: ["milk", "fish"], neverAgain: ["eggs"] });
    const plan = planDay(TARGETS, FOODS, TODAY, kitchen);
    expect(plan.length).toBeGreaterThan(0);
    for (const item of plan) {
      const f = food(item.foodKey);
      expect(f.allergens, f.key).not.toContain("milk");
      expect(f.allergens, f.key).not.toContain("fish");
      expect(f.key).not.toBe("eggs");
    }
  });

  it("puts the pinned breakfast on the plan, every day, at breakfast", () => {
    const kitchen = KITCHEN({ pinnedBreakfast: "skyr" });
    for (const date of [TODAY, addDays(TODAY, 1), addDays(TODAY, 2)]) {
      const plan = planDay(TARGETS, FOODS, date, kitchen);
      const pinned = plan.filter((i) => i.foodKey === "skyr");
      expect(pinned.length, date).toBe(1);
      expect(pinned[0].slot, date).toBe("breakfast");
    }
  });

  it("prefers safe foods instead of rotating away from them", () => {
    const kitchen = KITCHEN({ safeFoods: ["chicken_breast", "oats"] });
    for (const date of [TODAY, addDays(TODAY, 1), addDays(TODAY, 3)]) {
      const keys = keysOf(planDay(TARGETS, FOODS, date, kitchen));
      expect(keys, date).toContain("chicken_breast");
      expect(keys, date).toContain("oats");
    }
    // Without the preference, the rotation is free to wander off them.
    const plain = keysOf(planDay(TARGETS, FOODS, TODAY, DEFAULT_KITCHEN));
    expect(plain).not.toEqual(keysOf(planDay(TARGETS, FOODS, TODAY, kitchen)));
  });

  it("builds a plan out of the safe list alone when that is all there is", () => {
    const kitchen = KITCHEN({
      safeFoodsOnly: true,
      safeFoods: ["skyr", "oats", "chicken_slices", "banana"],
    });
    const plan = planDay(TARGETS, FOODS, TODAY, kitchen);
    expect(plan.length).toBeGreaterThan(0);
    for (const item of plan) expect(kitchen.safeFoods).toContain(item.foodKey);
  });

  it("returns nothing rather than inventing food when the rules exclude everything", () => {
    const kitchen = KITCHEN({ safeFoodsOnly: true, safeFoods: [] });
    expect(planDay(TARGETS, FOODS, TODAY, kitchen)).toEqual([]);
  });
});

describe("the floor plan — three things on the worst day", () => {
  const floor = planFloor(TARGETS, FOODS);

  it("is exactly three items, in three slots, with no repeats", () => {
    expect(floor).toHaveLength(FLOOR_ITEMS);
    expect(new Set(keysOf(floor)).size).toBe(FLOOR_ITEMS);
    expect(floor.map((i) => i.slot)).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("asks for no cooking, no standing and one hand", () => {
    for (const item of floor) {
      const f = food(item.foodKey);
      expect(f.effort, f.key).toBe("none");
      expect(f.equipment, f.key).toBe("none");
      expect(f.hands, f.key).toBe(1);
      expect(f.standingMinutes, f.key).toBe(0);
    }
    const cost = effortFor(floor, FOODS);
    expect(cost.minutes).toBe(0);
    expect(cost.summary).toBe("no prep · no equipment · one-handed");
  });

  it("hits protein and stays under the salt ceiling", () => {
    const totals = totalsFor(floor, FOODS);
    expect(totals.proteinG).toBeGreaterThan(TARGETS.proteinG * 0.6);
    expect(totals.sodiumMg).toBeLessThanOrEqual(TARGETS.sodiumMgMax);
  });

  it("is the same three every day — repetition is the point", () => {
    expect(planFloor(TARGETS, FOODS)).toEqual(floor);
  });

  it("still respects allergens and never-again", () => {
    const kitchen = KITCHEN({ excludeAllergens: ["milk"], neverAgain: ["chicken_slices"] });
    const items = planFloor(TARGETS, FOODS, kitchen);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(food(item.foodKey).allergens).not.toContain("milk");
      expect(item.foodKey).not.toBe("chicken_slices");
    }
  });

  it("will not override a tolerance list on the worst day", () => {
    const kitchen = KITCHEN({ safeFoodsOnly: true, safeFoods: ["skyr", "protein_bar"] });
    const items = planFloor(TARGETS, FOODS, kitchen);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(kitchen.safeFoods).toContain(item.foodKey);
    // Safe foods that all need cooking leave a floor with nothing honest to say.
    expect(planFloor(TARGETS, FOODS, KITCHEN({ safeFoodsOnly: true, safeFoods: ["potato"] })))
      .toEqual([]);
  });

  it("leads with the pinned breakfast when there is one", () => {
    const items = planFloor(TARGETS, FOODS, KITCHEN({ pinnedBreakfast: "skyr" }));
    expect(items[0].foodKey).toBe("skyr");
    expect(items[0].slot).toBe("breakfast");
  });
});

describe("effort, stated before anyone commits", () => {
  it("reads the way someone asks: time, kitchen, hands", () => {
    expect(effortSummary(5, "one-pan", 1)).toBe("5 min · one pan · one-handed");
    expect(effortSummary(0, "none", 1)).toBe("no prep · no equipment · one-handed");
    expect(effortSummary(25, "oven", 2)).toBe("25 min · oven · two hands");
  });

  it("counts a food's minutes once, however many times it is on the plan", () => {
    const twice: PlanItem[] = [
      { slot: "lunch", foodKey: "chicken_breast", grams: 150 },
      { slot: "dinner", foodKey: "chicken_breast", grams: 150 },
    ];
    expect(effortFor(twice, FOODS).minutes).toBe(food("chicken_breast").standingMinutes);
  });

  it("reports the hardest thing the plan asks for", () => {
    const mixed: PlanItem[] = [
      { slot: "breakfast", foodKey: "skyr", grams: 170 },
      { slot: "dinner", foodKey: "salmon_fillet", grams: 130 },
    ];
    const cost = effortFor(mixed, FOODS);
    expect(cost.equipment).toBe("oven");
    expect(cost.hands).toBe(2);
    expect(cost.effort).toBe("cook");
  });

  it("costs an empty plan at nothing", () => {
    expect(effortFor([], FOODS).minutes).toBe(0);
  });
});

describe("hand portions", () => {
  it("says the portion, not the weight", () => {
    expect(handPortionLabel(food("chicken_breast"), 150)).toBe("1 palm");
    expect(handPortionLabel(food("skyr"), 170)).toBe("1 pot");
  });

  it("scales in halves rather than pretending to be a scale", () => {
    expect(handPortionLabel(food("chicken_breast"), 300)).toBe("1 palm × 2");
    expect(handPortionLabel(food("chicken_breast"), 225)).toBe("1 palm × 1½");
    expect(handPortionLabel(food("chicken_breast"), 70)).toBe("1 palm × ½");
    // Never zero: a portion someone was told to eat is at least half of one.
    expect(handPortionLabel(food("chicken_breast"), 5)).toBe("1 palm × ½");
  });
});

describe("the fuel view, with a kitchen attached", () => {
  const base = {
    date: TODAY,
    windowEntries: [] as RawMealEntry[],
    weighIns: [{ date: addDays(TODAY, -1), weightKg: 92.8 }],
    latestWeightKg: 92.8,
    manualTarget: null,
    lastWeekly: null,
    foods: FOODS,
  };

  it("resolves the kitchen into names the UI can print", () => {
    const view = buildFuelView({
      ...base,
      mode: "cut",
      kitchen: KITCHEN({
        minutes: 25,
        equipment: "one-pan",
        pinnedBreakfast: "skyr",
        safeFoods: ["oats", "chicken_breast"],
        neverAgain: ["tempeh"],
        excludeAllergens: ["crustaceans"],
      }),
    });
    expect(view.kitchen.summary).toBe("25 min · one pan · two hands");
    expect(view.kitchen.pinnedBreakfast).toEqual({ key: "skyr", name: "Skyr, natural" });
    expect(view.kitchen.safeFoods.map((f) => f.key)).toEqual(["oats", "chicken_breast"]);
    expect(view.kitchen.neverAgain.map((f) => f.key)).toEqual(["tempeh"]);
    expect(view.kitchen.catalogueSize).toBe(FOODS.length);
    expect(view.kitchen.reachableFoods).toBeLessThan(FOODS.length);
    expect(view.foods.find((f) => f.key === "prawns_cooked")?.allowed).toBe(false);
    expect(view.foods.find((f) => f.key === "skyr")?.allowed).toBe(true);
  });

  it("prices the proposal before anyone taps generate", () => {
    const view = buildFuelView({ ...base, mode: "cut", kitchen: BAD_DAY });
    expect(view.proposal).not.toBeNull();
    expect(view.proposal?.effortSummary).toMatch(/^(no prep|\d+ min) · .+ · one-handed$/);
    expect(view.proposal?.effort.minutes).toBeLessThanOrEqual(BAD_DAY.minutes);
    expect(view.proposal?.proteinG).toBeGreaterThan(0);
    for (const item of view.proposal?.items ?? []) {
      expect(item.portion.length).toBeGreaterThan(0);
      expect(item.slotLabel.length).toBeGreaterThan(0);
    }
  });

  it("collapses to the floor in survival — no proposal, no shopping list", () => {
    const view = buildFuelView({
      ...base,
      mode: "survival",
      windowEntries: [
        {
          id: "me_1",
          date: TODAY,
          slot: "dinner",
          foodKey: "chicken_breast",
          grams: 200,
          planned: true,
          eaten: false,
        },
      ],
    });
    expect(view.survival).toBe(true);
    expect(view.proposal).toBeNull();
    expect(view.shoppingList).toEqual([]);
    expect(view.floor.items).toHaveLength(FLOOR_ITEMS);
    expect(view.floor.effort.minutes).toBe(0);
    expect(view.floor.proteinG).toBeGreaterThan(0);
  });

  it("keeps the floor available on a good day too", () => {
    const view = buildFuelView({ ...base, mode: "cut" });
    expect(view.floor.items).toHaveLength(FLOOR_ITEMS);
    expect(view.floor.effortSummary).toBe("no prep · no equipment · one-handed");
  });

  it("prices what today's rows actually cost, and names every portion by hand", () => {
    const view = buildFuelView({
      ...base,
      mode: "cut",
      windowEntries: [
        {
          id: "me_1",
          date: TODAY,
          slot: "breakfast",
          foodKey: "skyr",
          grams: 170,
          planned: false,
          eaten: true,
        },
        {
          id: "me_2",
          date: TODAY,
          slot: "dinner",
          foodKey: "chicken_breast",
          grams: 300,
          planned: true,
          eaten: false,
        },
      ],
    });
    expect(view.todayEffort.minutes).toBe(food("chicken_breast").standingMinutes);
    expect(view.todayEffort.hands).toBe(2);
    expect(view.entries.map((e) => e.portion)).toEqual(["1 pot", "1 palm × 2"]);
  });
});

describe("kitchen fixtures", () => {
  const fx = buildFuelFixtures(TODAY);

  it("gives liam a pinned breakfast, two safe foods and an allergen exclusion", () => {
    const liam = kitchenProfileFor("liam");
    expect(liam.pinnedBreakfast).toBe("skyr");
    expect(liam.safeFoods).toHaveLength(2);
    expect(liam.excludeAllergens).toHaveLength(1);
    expect(liam.neverAgain.length).toBeGreaterThan(0);
    // Every key a profile names has to exist, or the UI renders a blank.
    for (const key of [liam.pinnedBreakfast, ...liam.safeFoods, ...liam.neverAgain]) {
      expect(foodByKey(key as string), key as string).toBeDefined();
    }
  });

  it("keeps conor's kitchen to the one he can use on the floor", () => {
    const conor = kitchenProfileFor("conor");
    expect(conor.hands).toBe(1);
    expect(EQUIPMENT_RANK[conor.equipment]).toBeLessThanOrEqual(EQUIPMENT_RANK.microwave);
    expect(conor.minutes).toBeLessThanOrEqual(10);
  });

  it("hands anybody it does not know a full kitchen rather than a locked one", () => {
    expect(kitchenProfileFor("a-stranger")).toEqual(DEFAULT_KITCHEN);
  });

  it("ships the profiles with the rest of the fixtures", () => {
    expect(fx.kitchenProfiles.map((p) => p.userSlug).sort()).toEqual(["conor", "liam"]);
  });

  it("plans liam a day his own exclusions allow", () => {
    const plan = planDay(TARGETS, FOODS, TODAY, kitchenProfileFor("liam"));
    expect(plan.length).toBeGreaterThan(0);
    expect(keysOf(plan)).toContain("skyr");
    for (const item of plan) {
      expect(food(item.foodKey).allergens).not.toContain("crustaceans");
      expect(item.foodKey).not.toBe("tempeh");
    }
    expect(effortFor(plan, FOODS).minutes).toBeLessThanOrEqual(25);
  });
});

describe("menu catalogue", () => {
  it("ships at least 20 named slot menus with unique keys", () => {
    expect(MENUS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(MENUS.map((m) => m.key)).size).toBe(MENUS.length);
  });

  it("only names foods that are in the bank", () => {
    for (const menu of MENUS) {
      expect(MEAL_SLOTS.includes(menu.slot), menu.key).toBe(true);
      expect(menu.items.length, menu.key).toBeGreaterThanOrEqual(2);
      for (const item of menu.items) {
        expect(foodByKey(item.foodKey), `${menu.key}:${item.foodKey}`).toBeDefined();
        expect(item.grams, `${menu.key}:${item.foodKey}`).toBeGreaterThan(0);
      }
    }
  });

  it("prices a menu as the sum of its parts", () => {
    const menu = menuByKey("skyr_oats_berries");
    expect(menu).toBeDefined();
    const priced = menuTotals(menu!, FOODS);
    expect(priced.kcal).toBe(
      totalsFor(
        menu!.items.map((i) => ({ foodKey: i.foodKey, grams: i.grams })),
        FOODS,
      ).kcal,
    );
    expect(priced.proteinG).toBeGreaterThan(20);
  });

  it("rejects a menu the kitchen cannot reach", () => {
    const ovenKitchen: KitchenProfile = { ...DEFAULT_KITCHEN, equipment: "none", minutes: 5 };
    const salmon = menuByKey("salmon_potato_greens");
    expect(salmon).toBeDefined();
    expect(menuAllowed(salmon!, FOODS, DEFAULT_KITCHEN)).toBe(true);
    expect(menuAllowed(salmon!, FOODS, ovenKitchen)).toBe(false);
  });
});

describe("calorie control helpers", () => {
  it("subtracts a portion from what is left", () => {
    const left = remainingAfter(
      { kcal: 900, proteinG: 80, carbsG: 100, fatG: 30, fiberG: 20, sodiumMg: 1000 },
      { kcal: 340, proteinG: 32, carbsG: 20, fatG: 10, fiberG: 4, sodiumMg: 80 },
    );
    expect(left.kcal).toBe(560);
    expect(left.proteinG).toBe(48);
  });

  it("banks unused kcal from logged days only", () => {
    expect(
      weeklyLeftoverKcal(
        [
          { kcal: 2000 },
          { kcal: 0 },
          { kcal: 2400 },
        ],
        2300,
      ),
    ).toBe(300);
  });

  it("lists recent foods newest-first without repeats", () => {
    const rows: RawMealEntry[] = [
      { id: "1", date: "2026-08-11", slot: "lunch", foodKey: "oats", grams: 80, planned: false, eaten: true },
      { id: "2", date: "2026-08-13", slot: "lunch", foodKey: "skyr", grams: 170, planned: false, eaten: true },
      { id: "3", date: "2026-08-12", slot: "dinner", foodKey: "skyr", grams: 170, planned: false, eaten: true },
      { id: "4", date: "2026-08-13", slot: "dinner", foodKey: "chicken_breast", grams: 180, planned: false, eaten: true },
    ];
    expect(recentFoodKeys(rows, 8)).toEqual(["skyr", "chicken_breast", "oats"]);
    expect(frequentFoodKeys(rows, 2)).toEqual(["skyr", "chicken_breast"]);
  });

  it("keeps protein when swapping to a leaner cut", () => {
    const from = foodByKey("chicken_breast") as FoodDef;
    const to = foodByKey("turkey_steak") ?? foodByKey("turkey_mince");
    expect(to).toBeDefined();
    const grams = swapGrams(from, to as FoodDef, 180);
    expect(grams).toBeGreaterThanOrEqual(100);
    expect(grams).toBeLessThanOrEqual(400);
  });
});

describe("menu-aware planning", () => {
  const targets = macroTargets("cut", 92.8, 2876);

  it("places a named menu when the kitchen can reach it", () => {
    const plan = planDay(targets, FOODS, TODAY, DEFAULT_KITCHEN);
    const breakfastKeys = plan.filter((i) => i.slot === "breakfast").map((i) => i.foodKey);
    expect(breakfastKeys.length).toBeGreaterThanOrEqual(2);
  });

  it("will not place an oven menu on a microwave day", () => {
    const kitchen: KitchenProfile = {
      ...DEFAULT_KITCHEN,
      minutes: 15,
      equipment: "microwave",
      hands: 1,
    };
    const plan = planDay(targets, FOODS, TODAY, kitchen);
    for (const item of plan) {
      expect(foodAllowed(food(item.foodKey), kitchen), item.foodKey).toBe(true);
    }
    expect(plan.some((i) => i.foodKey === "salmon_fillet")).toBe(false);
  });

  it("builds seven deterministic days for a week", () => {
    const week = planWeek(targets, FOODS, TODAY, DEFAULT_KITCHEN);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe(TODAY);
    expect(week[0].items).toEqual(planDay(targets, FOODS, TODAY, DEFAULT_KITCHEN));
    expect(week.map((d) => d.items.map((i) => i.foodKey).join("|")).length).toBe(7);
  });
});

describe("fuel view — bank and leftover", () => {
  const entry = (
    id: string,
    date: string,
    slot: (typeof MEAL_SLOTS)[number],
    foodKey: string,
    grams: number,
    eaten: boolean,
    planned = false,
  ): RawMealEntry => ({ id, date, slot, foodKey, grams, planned, eaten });

  const base = {
    mode: "cut" as const,
    date: TODAY,
    weighIns: [{ date: addDays(TODAY, -1), weightKg: 92.8 }],
    latestWeightKg: 92.8,
    manualTarget: null,
    lastWeekly: null,
    foods: FOODS,
  };

  it("exposes menus, recents and a leftover bank", () => {
    const view = buildFuelView({
      ...base,
      windowEntries: [
        entry("me_1", addDays(TODAY, -1), "lunch", "skyr", 170, true),
        entry("me_2", TODAY, "breakfast", "oats", 80, true),
      ],
    });
    expect(view.menus.length).toBeGreaterThanOrEqual(20);
    expect(view.recentFoods.length).toBeGreaterThan(0);
    expect(view.leftoverKcal).toBeGreaterThanOrEqual(0);
    expect(view.survival).toBe(false);
  });

  it("hides leftover and menus on the floor", () => {
    const view = buildFuelView({ ...base, mode: "survival", windowEntries: [] });
    expect(view.survival).toBe(true);
    expect(view.leftoverKcal).toBe(0);
    expect(view.proposal).toBeNull();
  });
});

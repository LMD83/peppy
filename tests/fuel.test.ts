import { describe, expect, it } from "vitest";
import { FOODS, GROUP_ORDER, foodByKey, type FoodDef } from "../convex/tm/data/foods";
import {
  ACTIVITY_MULTIPLIERS,
  KCAL_OVERSHOOT,
  MEAL_SLOTS,
  SODIUM_MG_MAX,
  adaptiveTdee,
  buildFuelView,
  estimatedTdee,
  macroTargets,
  mifflinStJeor,
  nutrientsFor,
  planDay,
  shoppingList,
  totalsFor,
  weightSlopeKgPerWeek,
  type BodyProfile,
  type RawMealEntry,
} from "../convex/tm/logic-fuel";
import { addDays } from "../convex/tm/lib";
import { buildFuelFixtures } from "../convex/tm/fixtures/fuel";

const TODAY = "2026-08-13";
const PROFILE: BodyProfile = {
  weightKg: 92.8,
  heightCm: 178,
  age: 38,
  sex: "male",
  activity: "moderate",
};

describe("food catalogue", () => {
  it("carries at least 45 staples with unique keys", () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(45);
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

import { describe, expect, it } from "vitest";
import {
  AISLE_ORDER,
  DEFAULT_HORIZON_DAYS,
  FLOOR_HORIZON_DAYS,
  MAX_HORIZON_DAYS,
  MAX_SUBSTITUTIONS,
  aisleFor,
  buildShareText,
  buildShopView,
  byAisle,
  leftoverWords,
  neededFor,
  packMaths,
  packsFor,
  shoppingTotals,
  substitutionsFor,
  type PlannedEntry,
  type ShopViewInput,
} from "../convex/tm/logicShop";
import { FOODS, foodByKey, type FoodDef } from "../convex/tm/data/foods";
import {
  HANDOFF_NOTE,
  RETAILERS,
  handoffLabel,
  retailerDescriptors,
  retailerDriver,
  searchUrlFor,
} from "../convex/tm/data/retailers";
import { buildShopFixtures } from "../convex/tm/fixtures/shop";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13";

function food(key: string): FoodDef {
  const f = foodByKey(key);
  if (!f) throw new Error(`fixture drift: no food ${key}`);
  return f;
}

function entry(foodKey: string, grams: number, date = TODAY): PlannedEntry {
  return { date, foodKey, grams };
}

function input(over: Partial<ShopViewInput> = {}): ShopViewInput {
  return {
    mode: "cut",
    date: TODAY,
    entries: [entry("chicken_breast", 300), entry("broccoli", 200)],
    foods: FOODS,
    pantry: [],
    ...over,
  };
}

/* ===== aisles: the walk, not the schema ===== */

describe("aisleFor", () => {
  it("puts frozen anything in the freezer aisle, whatever its food group", () => {
    expect(aisleFor(food("frozen_peas"))).toBe("frozen");
    expect(aisleFor(food("frozen_white_fish"))).toBe("frozen");
    expect(aisleFor(food("frozen_berries"))).toBe("frozen");
  });

  it("shelves a tin in the cupboard, not at the fish counter", () => {
    expect(aisleFor(food("tuna_tin_brine"))).toBe("cupboard");
    expect(aisleFor(food("chickpeas_tin"))).toBe("cupboard");
  });

  it("keeps bagged and loose produce as one stop", () => {
    expect(aisleFor(food("broccoli"))).toBe("produce");
    expect(aisleFor(food("spinach"))).toBe("produce"); // fridge-shelf, produce aisle
    expect(aisleFor(food("potato"))).toBe("produce"); // a carb by group
    expect(aisleFor(food("avocado"))).toBe("produce"); // a fat by group
  });

  it("sends fresh and chilled protein to the counter run", () => {
    expect(aisleFor(food("chicken_breast"))).toBe("meat-fish");
    expect(aisleFor(food("tofu_firm"))).toBe("meat-fish");
  });

  it("sends dairy and chilled convenience to chilled", () => {
    expect(aisleFor(food("greek_yogurt_0"))).toBe("chilled");
    expect(aisleFor(food("hummus"))).toBe("chilled");
  });

  it("has an aisle for every food in the catalogue", () => {
    for (const f of FOODS) expect(AISLE_ORDER).toContain(aisleFor(f));
  });
});

describe("byAisle", () => {
  it("returns aisles in walking order, never in food-group order", () => {
    const items = [
      { aisle: "cupboard" as const, name: "Oats" },
      { aisle: "produce" as const, name: "Broccoli" },
      { aisle: "frozen" as const, name: "Peas" },
      { aisle: "chilled" as const, name: "Skyr" },
    ];
    expect(byAisle(items).map((g) => g.aisle)).toEqual(["produce", "chilled", "frozen", "cupboard"]);
  });

  it("never renders an empty aisle — a heading is a stop you had to make", () => {
    const groups = byAisle([{ aisle: "produce" as const, name: "Kale" }]);
    expect(groups).toHaveLength(1);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("sorts inside an aisle so the list never jitters between reloads", () => {
    const items = [
      { aisle: "produce" as const, name: "Kale" },
      { aisle: "produce" as const, name: "Apple" },
      { aisle: "produce" as const, name: "Broccoli" },
    ];
    expect(byAisle(items)[0].items.map((i) => i.name)).toEqual(["Apple", "Broccoli", "Kale"]);
  });
});

/* ===== pack maths: you cannot buy 137 g of mince ===== */

describe("packMaths", () => {
  it("rounds a part-pack need up to one whole pack and states the leftover", () => {
    const m = packMaths(137, food("beef_mince_5"));
    expect(m.packs).toBe(1);
    expect(m.pack.grams).toBe(400);
    expect(m.buyG).toBe(400);
    expect(m.leftover).toBe(263);
    expect(m.leftoverLabel).toBe("about 263 g left over");
  });

  it("never proposes buying less than the plan needs", () => {
    for (const f of FOODS) {
      for (const need of [1, 37, 250, 999, 2500]) {
        expect(packMaths(need, f).buyG).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it("climbs the ladder rather than stacking small packs", () => {
    const m = packMaths(450, food("chicken_breast")); // ladder 300, 600
    expect(m.packs).toBe(1);
    expect(m.pack.grams).toBe(600);
  });

  it("buys multiples of the biggest pack once nothing single covers it", () => {
    const m = packMaths(1400, food("chicken_breast"));
    expect(m.pack.grams).toBe(600);
    expect(m.packs).toBe(3);
    expect(m.buyG).toBe(1800);
    expect(m.packLabel).toBe("3 × 600 g");
  });

  it("says nothing about leftovers when it comes out exact", () => {
    const m = packMaths(400, food("beef_mince_5"));
    expect(m.leftover).toBe(0);
    expect(m.leftoverLabel).toBe("");
  });

  it("asks for nothing when nothing is needed", () => {
    const m = packMaths(0, food("oats"));
    expect(m.packs).toBe(0);
    expect(m.buyG).toBe(0);
    expect(m.packLabel).toBe("nothing to buy");
  });

  it("gives every food a pack ladder, ascending and positive", () => {
    for (const f of FOODS) {
      const ladder = packsFor(f);
      expect(ladder.length, f.key).toBeGreaterThan(0);
      for (const p of ladder) expect(p.grams, f.key).toBeGreaterThan(0);
      const grams = ladder.map((p) => p.grams);
      expect(grams, f.key).toEqual([...grams].sort((a, b) => a - b));
    }
  });

  it("reads pack sizes from the product catalogue when the food is stocked", () => {
    const ladder = packsFor(food("chicken_breast"));
    expect(ladder.map((p) => p.grams)).toEqual([300, 600]);
    expect(packsFor(food("beef_mince_5")).some((p) => p.grams === 400)).toBe(true);
  });

  it("switches to kilos once grams stop being words a person would use", () => {
    expect(leftoverWords(0)).toBe("");
    expect(leftoverWords(700)).toBe("about 700 g left over");
    expect(leftoverWords(1700)).toBe("about 1.7 kg left over");
  });
});

/* ===== the cupboard: the subtraction nobody else does ===== */

describe("neededFor", () => {
  it("subtracts what is already in the house", () => {
    const rows = neededFor([{ foodKey: "oats", grams: 120 }], FOODS, [
      { foodKey: "oats", grams: 50 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].plannedG).toBe(120);
    expect(rows[0].haveG).toBe(50);
    expect(rows[0].grams).toBe(70);
    expect(rows[0].have).toBe(false);
  });

  it("marks a fully covered food rather than making the row disappear", () => {
    const rows = neededFor([{ foodKey: "oats", grams: 60 }], FOODS, [
      { foodKey: "oats", grams: 900 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].have).toBe(true);
    expect(rows[0].grams).toBe(0);
    // A surplus is not a negative buy, and it is not credited elsewhere.
    expect(rows[0].haveG).toBe(60);
  });

  it("adds up repeat appearances of a food across the window", () => {
    const rows = neededFor(
      [
        { foodKey: "eggs", grams: 100 },
        { foodKey: "eggs", grams: 150 },
      ],
      FOODS,
      [],
    );
    expect(rows[0].grams).toBe(250);
  });

  it("ignores a pantry row for a food the catalogue does not know", () => {
    const rows = neededFor([{ foodKey: "oats", grams: 60 }], FOODS, [
      { foodKey: "unicorn_steak", grams: 5000 },
    ]);
    expect(rows[0].grams).toBe(60);
  });

  it("skips unknown foods instead of guessing at them", () => {
    expect(neededFor([{ foodKey: "unicorn_steak", grams: 200 }], FOODS, [])).toEqual([]);
  });
});

/* ===== substitutions: for when the shelf is empty ===== */

describe("substitutionsFor", () => {
  it("offers same-group alternatives with a stated reason", () => {
    const subs = substitutionsFor({ foodKey: "chicken_breast", grams: 300 }, FOODS);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.length).toBeLessThanOrEqual(MAX_SUBSTITUTIONS);
    for (const s of subs) {
      expect(s.foodKey).not.toBe("chicken_breast");
      expect(food(s.foodKey).group).toBe("protein");
      expect(s.reason.length).toBeGreaterThan(0);
      expect(s.grams).toBeGreaterThan(0);
    }
  });

  it("prefers something that keeps when the original is fresh", () => {
    const subs = substitutionsFor({ foodKey: "salmon_fillet", grams: 130 }, FOODS);
    expect(["cupboard", "freezer"]).toContain(food(subs[0].foodKey).shelf);
    expect(subs[0].reason).toMatch(/keeps/);
  });

  it("scales the quantity so the swap does the same job", () => {
    const subs = substitutionsFor({ foodKey: "chicken_breast", grams: 300 }, FOODS);
    for (const s of subs) {
      const from = food("chicken_breast").per100.proteinG * 3;
      const to = (food(s.foodKey).per100.proteinG * s.grams) / 100;
      expect(Math.abs(to - from) / from).toBeLessThan(0.06);
    }
  });

  it("never proposes a quantity nobody would eat", () => {
    for (const f of FOODS) {
      for (const s of substitutionsFor({ foodKey: f.key, grams: 200 }, FOODS)) {
        expect(s.grams, `${f.key} → ${s.foodKey}`).toBeLessThanOrEqual(400);
        expect(s.grams, `${f.key} → ${s.foodKey}`).toBeGreaterThanOrEqual(100);
      }
    }
  });

  it("claims nothing about price — there is no price data in this app", () => {
    for (const f of FOODS) {
      for (const s of substitutionsFor({ foodKey: f.key, grams: 200 }, FOODS)) {
        expect(s.reason, `${f.key} → ${s.foodKey}`).not.toMatch(
          /cheap|price|cost|€|value for money|save money/i,
        );
      }
    }
  });

  it("never prescribes — no reason tells anyone what they should eat", () => {
    for (const f of FOODS) {
      for (const s of substitutionsFor({ foodKey: f.key, grams: 200 }, FOODS)) {
        expect(s.reason).not.toMatch(/should|must|healthier|better for you|avoid|instead you/i);
      }
    }
  });

  it("returns nothing for an unknown food or a zero quantity", () => {
    expect(substitutionsFor({ foodKey: "unicorn_steak", grams: 200 }, FOODS)).toEqual([]);
    expect(substitutionsFor({ foodKey: "oats", grams: 0 }, FOODS)).toEqual([]);
  });

  it("is deterministic — the same call twice is the same list", () => {
    const a = substitutionsFor({ foodKey: "chicken_breast", grams: 300 }, FOODS);
    const b = substitutionsFor({ foodKey: "chicken_breast", grams: 300 }, FOODS);
    expect(a).toEqual(b);
  });
});

/* ===== totals: how much, how heavy, how many stops ===== */

describe("shoppingTotals", () => {
  const rows = [
    { aisle: "produce" as const, have: false, packs: 1, buyG: 350 },
    { aisle: "produce" as const, have: false, packs: 2, buyG: 2000 },
    { aisle: "cupboard" as const, have: false, packs: 1, buyG: 1000 },
    { aisle: "chilled" as const, have: true, packs: 0, buyG: 0 },
  ];

  it("counts rows, packs and stops", () => {
    const t = shoppingTotals(rows);
    expect(t.items).toBe(4);
    expect(t.toBuy).toBe(3);
    expect(t.covered).toBe(1);
    expect(t.packs).toBe(4);
    expect(t.aisles).toBe(2);
  });

  it("weighs only what you actually carry home", () => {
    const t = shoppingTotals(rows);
    expect(t.weightKg).toBe(3.4);
    expect(t.weightLabel).toBe("about 3.4 kg to carry");
  });

  it("says so plainly when there is nothing to carry", () => {
    const t = shoppingTotals([{ aisle: "produce", have: true, packs: 0, buyG: 0 }]);
    expect(t.weightKg).toBe(0);
    expect(t.weightLabel).toBe("nothing to carry");
    expect(t.aisles).toBe(0);
  });
});

/* ===== the retailers: an honest ceiling ===== */

describe("retailers", () => {
  it("fabricates no ordering API — nobody in Ireland publishes one", () => {
    for (const r of RETAILERS) expect(r.mode, r.key).not.toBe("api");
  });

  it("only claims a search hand-off where there is a search URL to hand off to", () => {
    for (const r of RETAILERS) {
      if (r.mode === "search-handoff") {
        expect(r.searchUrlTemplate, r.key).toContain("{q}");
      } else {
        expect(r.searchUrlTemplate, r.key).toBeNull();
      }
    }
  });

  it("fills the search term in and escapes it", () => {
    const url = searchUrlFor("tesco_ie", "chicken breast");
    expect(url).toBe("https://www.tesco.ie/groceries/en-IE/search?query=chicken%20breast");
  });

  it("still lands somewhere real for a retailer with no addressable search", () => {
    for (const r of RETAILERS) {
      const url = r.buildUrl("chicken breast");
      expect(url, r.key).toMatch(/^https:\/\//);
    }
  });

  it("says out loud where a retailer has no online grocery ordering at all", () => {
    const lidl = retailerDriver("lidl_ie");
    expect(lidl?.onlineOrdering).toBe(false);
    expect(lidl?.note).toMatch(/does not sell groceries online/i);
  });

  it("labels every hand-off as something the person completes", () => {
    for (const r of retailerDescriptors()) {
      expect(handoffLabel(r)).toMatch(/you complete the order/);
    }
  });

  it("never promises an order was placed", () => {
    for (const r of RETAILERS) {
      expect(r.note, r.key).not.toMatch(/we (will )?(place|submit|complete)|added to your basket/i);
    }
    expect(HANDOFF_NOTE).toMatch(/does not pretend/i);
  });

  it("survives serialisation — a Convex query cannot return a function", () => {
    const descriptors = retailerDescriptors();
    expect(JSON.parse(JSON.stringify(descriptors))).toEqual(descriptors);
    for (const d of descriptors) expect("buildUrl" in d).toBe(false);
  });

  it("resolves a driver back from the key the query returned", () => {
    for (const d of retailerDescriptors()) expect(retailerDriver(d.key)?.name).toBe(d.name);
    expect(retailerDriver("nope")).toBeUndefined();
  });
});

/* ===== the view ===== */

describe("buildShopView", () => {
  it("builds an aisle-ordered list with pack maths applied", () => {
    const view = buildShopView(input());
    expect(view.aisles.map((a) => a.aisle)).toEqual(["produce", "meat-fish"]);
    const chicken = view.aisles[1].items[0];
    expect(chicken.foodKey).toBe("chicken_breast");
    expect(chicken.grams).toBe(300);
    expect(chicken.packs).toBe(1);
    expect(chicken.buyG).toBe(300);
  });

  it("shops the whole plan window, not just today", () => {
    const view = buildShopView(
      input({
        entries: [entry("oats", 60), entry("oats", 60, addDays(TODAY, 3))],
      }),
    );
    expect(view.days).toBe(DEFAULT_HORIZON_DAYS);
    expect(view.aisles[0].items[0].grams).toBe(120);
  });

  it("ignores plan rows beyond the window", () => {
    const view = buildShopView(
      input({ entries: [entry("oats", 60), entry("oats", 60, addDays(TODAY, 30))] }),
    );
    expect(view.aisles[0].items[0].grams).toBe(60);
  });

  it("ignores yesterday — a list you cannot shop is noise", () => {
    const view = buildShopView(input({ entries: [entry("oats", 60, addDays(TODAY, -1))] }));
    expect(view.aisles).toEqual([]);
    expect(view.totals.toBuy).toBe(0);
  });

  it("clamps a silly horizon rather than trusting it", () => {
    expect(buildShopView(input({ horizonDays: 900 })).days).toBe(MAX_HORIZON_DAYS);
    expect(buildShopView(input({ horizonDays: 0 })).days).toBe(1);
    expect(buildShopView(input({ horizonDays: Number.NaN })).days).toBe(DEFAULT_HORIZON_DAYS);
  });

  it("counts the cupboard and keeps covered rows visible", () => {
    const view = buildShopView(
      input({ pantry: [{ foodKey: "broccoli", grams: 400 }, { foodKey: "oats", grams: 900 }] }),
    );
    const broccoli = view.aisles.flatMap((a) => a.items).find((i) => i.foodKey === "broccoli");
    expect(broccoli?.have).toBe(true);
    expect(broccoli?.packLabel).toBe("already have it");
    expect(broccoli?.substitutions).toEqual([]);
    // Two rows are in the cupboard, even though only one is on this plan.
    expect(view.pantryCount).toBe(2);
    expect(view.totals.covered).toBe(1);
  });

  it("is deterministic — no clock, no randomness", () => {
    expect(buildShopView(input())).toEqual(buildShopView(input()));
  });

  it("carries the honest hand-off note and the how-it-was-built note", () => {
    const view = buildShopView(input());
    expect(view.handoffNote).toBe(HANDOFF_NOTE);
    expect(view.note).toMatch(/shelf edge is always the authority/i);
  });

  it("returns an empty, non-broken view when there is no plan", () => {
    const view = buildShopView(input({ entries: [] }));
    expect(view.aisles).toEqual([]);
    expect(view.totals.toBuy).toBe(0);
    expect(view.shareText).toMatch(/Nothing to buy/);
  });
});

/* ===== survival: a floor, not a lite mode ===== */

describe("the floor", () => {
  const floor = () =>
    buildShopView(
      input({
        mode: "survival",
        entries: [entry("oats", 60), entry("skyr", 170), entry("banana", 120, addDays(TODAY, 2))],
      }),
    );

  it("shops today and nothing else", () => {
    const view = floor();
    expect(view.days).toBe(FLOOR_HORIZON_DAYS);
    const keys = view.aisles.flatMap((a) => a.items).map((i) => i.foodKey);
    expect(keys).toEqual(expect.arrayContaining(["oats", "skyr"]));
    expect(keys).not.toContain("banana");
  });

  it("offers no substitutions — the floor is a list, not a decision tree", () => {
    for (const item of floor().aisles.flatMap((a) => a.items)) {
      expect(item.substitutions).toEqual([]);
    }
  });

  it("offers no retailer chooser", () => {
    expect(floor().retailers).toEqual([]);
    expect(floor().survival).toBe(true);
  });

  it("still gives a real list — the floor is never an empty screen", () => {
    const view = floor();
    expect(view.totals.toBuy).toBeGreaterThan(0);
    expect(view.shareText).toMatch(/Shopping list/);
  });

  it("still says how heavy it is — the floor is where that matters most", () => {
    expect(floor().totals.weightLabel).toMatch(/kg to carry/);
  });
});

/* ===== the share text: readable down a phone ===== */

describe("buildShareText", () => {
  const view = () =>
    buildShopView(
      input({
        entries: [entry("chicken_breast", 300), entry("broccoli", 200), entry("oats", 60)],
        pantry: [{ foodKey: "oats", grams: 900 }],
      }),
    );

  it("groups by aisle in walking order, with quantity and pack", () => {
    const text = view().shareText;
    expect(text.indexOf("FRUIT & VEG")).toBeLessThan(text.indexOf("MEAT & FISH"));
    expect(text).toContain("- Chicken breast — 300 g, buy 300 g");
  });

  it("keeps the cupboard items at the end so nothing is bought twice", () => {
    const text = view().shareText;
    expect(text).toContain("ALREADY IN THE CUPBOARD");
    expect(text).toContain("- Porridge oats — already have it");
    expect(text.indexOf("ALREADY IN THE CUPBOARD")).toBeGreaterThan(text.indexOf("MEAT & FISH"));
  });

  it("closes with the numbers that decide whether you can carry it", () => {
    expect(view().shareText).toMatch(/2 items · 2 aisles · about [\d.]+ kg to carry/);
  });

  it("is plain text — no markdown a message app will mangle", () => {
    expect(view().shareText).not.toMatch(/[*_#|`]/);
  });

  it("says something rather than nothing when the list is empty", () => {
    const totals = shoppingTotals([]);
    expect(buildShareText([], totals, TODAY)).toContain("Nothing to buy");
  });
});

/* ===== fixtures ===== */

describe("fixtures", () => {
  const fx = buildShopFixtures(TODAY);

  it("only stocks foods the catalogue knows", () => {
    for (const row of fx.pantry) expect(foodByKey(row.foodKey), row.foodKey).toBeDefined();
  });

  it("holds positive, dated counts", () => {
    for (const row of fx.pantry) {
      expect(row.grams).toBeGreaterThan(0);
      expect(row.updatedDate <= TODAY, row.id).toBe(true);
    }
  });

  it("leaves the floor's cupboard empty — the floor is a short list, not a store", () => {
    expect(fx.pantry.filter((p) => p.userSlug === "artur")).toEqual([]);
  });

  it("carries the partial-coverage case a naive list gets wrong", () => {
    const beans = fx.pantry.find((p) => p.foodKey === "green_beans");
    expect(beans).toBeDefined();
    const view = buildShopView(
      input({
        entries: [entry("green_beans", 150)],
        pantry: [{ foodKey: "green_beans", grams: beans?.grams ?? 0 }],
      }),
    );
    const row = view.aisles[0].items[0];
    expect(row.have).toBe(false);
    expect(row.grams).toBe(60);
    expect(row.packs).toBe(1);
  });

  it("is deterministic for a given day", () => {
    expect(buildShopFixtures(TODAY)).toEqual(buildShopFixtures(TODAY));
  });
});

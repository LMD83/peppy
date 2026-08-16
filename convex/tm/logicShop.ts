import {
  EFFORT_LABELS,
  SHELF_LABELS,
  type FoodDef,
  type FoodEffort,
  type FoodGroup,
  type FoodShelf,
} from "./data/foods";
import { HANDOFF_NOTE, retailerDescriptors, type RetailerDescriptor } from "./data/retailers";
import { addDays, type TmMode } from "./lib";
import { shoppingList, type SimpleEntry } from "./logicFuel";

/**
 * Pure shopping logic — the part of "order my groceries" that nobody needs
 * permission to build.
 *
 * The ceiling is documented in ./data/retailers.ts: no Irish supermarket
 * publishes an ordering API, so the last step is always a person. That makes
 * everything *before* the last step the whole product, and this module is it:
 *
 *   neededFor      — the plan minus what is already in the cupboard.
 *   packMaths      — you cannot buy 137 g of mince; round up, say what is left.
 *   byAisle        — one lap of the shop instead of four.
 *   substitutionsFor — what to reach for when the shelf is empty, and why.
 *   shoppingTotals — how many things, how heavy, how many aisles.
 *
 * Deterministic by construction: no Date.now(), no Math.random(), no I/O. Every
 * date is an argument, so both backends compute the same list byte for byte.
 *
 * Nothing here prescribes. It shops the plan the user already has: it never
 * proposes a food, a quantity or a change to what they eat, and every claim it
 * makes about a substitute is one the food catalogue already carries.
 */

/* ===== the row shapes the logic works on ===== */

/** A planned meal-plan row. Dated, because the floor only shops for today. */
export type PlannedEntry = { date: string; foodKey: string; grams: number };

/** What is already in the house, in grams, as the user counted it. */
export type PantryRow = { foodKey: string; grams: number };

/* ===== aisles ===== */

/**
 * How a shop is walked, not how a database is grouped. Chilled and frozen are
 * separate stops; meat and fish are their own counter run; the cupboard is
 * everything ambient. `household` never fills from the food catalogue — it is
 * the seam for non-food rows, and an empty aisle is never rendered.
 */
export type Aisle = "produce" | "chilled" | "meat-fish" | "frozen" | "cupboard" | "household";

export const AISLE_ORDER: Aisle[] = [
  "produce",
  "chilled",
  "meat-fish",
  "frozen",
  "cupboard",
  "household",
];

export const AISLE_LABELS: Record<Aisle, string> = {
  produce: "Fruit & veg",
  chilled: "Chilled",
  "meat-fish": "Meat & fish",
  frozen: "Frozen",
  cupboard: "Cupboard",
  household: "Household",
};

/**
 * Where the thing actually sits. Shelf beats group: frozen peas are frozen, not
 * veg; tinned tuna is cupboard, not the fish counter. Fresh and bagged produce
 * both live in the produce chiller, so they stay one stop.
 */
export function aisleFor(food: FoodDef): Aisle {
  if (food.shelf === "freezer") return "frozen";
  if (food.shelf === "cupboard") return "cupboard";
  if (food.group === "veg" || food.group === "fruit") return "produce";
  // Spuds and avocados are produce wherever the catalogue files them.
  if (food.shelf === "fresh" && (food.group === "carb" || food.group === "fat")) return "produce";
  if (food.group === "protein") return "meat-fish";
  return "chilled";
}

/* ===== pack maths ===== */

export type PackSize = { grams: number; label: string };

/**
 * Typical Irish pack sizes, ascending. These are what a normal shelf offers,
 * not a claim about the pack in your hand — the shelf edge always wins, and the
 * UI says so. Wrong by one pack size costs a person nothing; being told to buy
 * 137 g of mince costs them the whole feature.
 */
export const FOOD_PACKS: Record<string, PackSize[]> = {
  /* meat & fish — counter and pre-pack */
  chicken_breast: [{ grams: 300, label: "300 g" }, { grams: 600, label: "600 g" }],
  chicken_thigh: [{ grams: 400, label: "400 g" }, { grams: 800, label: "800 g" }],
  turkey_mince: [{ grams: 500, label: "500 g" }],
  beef_mince_5: [{ grams: 400, label: "400 g" }, { grams: 750, label: "750 g" }],
  pork_loin: [{ grams: 350, label: "350 g" }],
  salmon_fillet: [{ grams: 240, label: "2 fillets" }],
  cod_fillet: [{ grams: 260, label: "2 fillets" }],
  prawns_cooked: [{ grams: 150, label: "150 g" }],
  roast_chicken_cooked: [{ grams: 400, label: "1 cooked chicken" }],
  eggs: [{ grams: 300, label: "6 eggs" }, { grams: 600, label: "12 eggs" }],
  eggs_boiled_pack: [{ grams: 200, label: "4-pack" }],
  egg_whites: [{ grams: 500, label: "500 ml carton" }],
  tofu_firm: [{ grams: 280, label: "1 block" }],
  tempeh: [{ grams: 200, label: "1 block" }],
  /* frozen */
  frozen_white_fish: [{ grams: 400, label: "400 g bag" }, { grams: 800, label: "800 g bag" }],
  frozen_chicken_pieces: [{ grams: 500, label: "500 g bag" }, { grams: 1000, label: "1 kg bag" }],
  frozen_peas: [{ grams: 500, label: "500 g bag" }, { grams: 1000, label: "1 kg bag" }],
  frozen_mixed_veg: [{ grams: 500, label: "500 g bag" }, { grams: 1000, label: "1 kg bag" }],
  frozen_spinach: [{ grams: 500, label: "500 g bag" }],
  frozen_berries: [{ grams: 350, label: "350 g bag" }, { grams: 500, label: "500 g bag" }],
  /* tins — the sizes are the same in every shop in the country */
  tuna_tin_brine: [{ grams: 145, label: "1 tin" }, { grams: 435, label: "3-pack of tins" }],
  mackerel_tinned: [{ grams: 125, label: "1 tin" }],
  sardines_tinned: [{ grams: 120, label: "1 tin" }],
  chickpeas_tin: [{ grams: 240, label: "1 tin" }],
  black_beans_tin: [{ grams: 240, label: "1 tin" }],
  baked_beans: [{ grams: 400, label: "1 tin" }],
  tinned_tomatoes: [{ grams: 400, label: "1 tin" }],
  tinned_sweetcorn: [{ grams: 195, label: "1 tin" }],
  tinned_peaches: [{ grams: 240, label: "1 tin" }],
  /* cupboard staples */
  oats: [{ grams: 1000, label: "1 kg bag" }],
  white_rice: [{ grams: 1000, label: "1 kg bag" }],
  brown_rice: [{ grams: 1000, label: "1 kg bag" }],
  pasta_wholewheat: [{ grams: 500, label: "500 g bag" }],
  couscous: [{ grams: 500, label: "500 g box" }],
  quinoa: [{ grams: 500, label: "500 g bag" }],
  lentils_cooked: [{ grams: 390, label: "1 tin" }],
  instant_mash: [{ grams: 400, label: "1 box" }],
  wholemeal_bread: [{ grams: 800, label: "1 loaf" }],
  sourdough: [{ grams: 500, label: "1 loaf" }],
  wholemeal_wrap: [{ grams: 360, label: "6 wraps" }],
  rice_cakes: [{ grams: 130, label: "1 pack" }],
  oatcakes: [{ grams: 200, label: "1 pack" }],
  whey_protein: [{ grams: 900, label: "900 g tub" }],
  protein_bar: [{ grams: 60, label: "1 bar" }, { grams: 240, label: "4-pack" }],
  microwave_rice: [{ grams: 250, label: "1 pouch" }],
  porridge_pot: [{ grams: 57, label: "1 pot" }],
  ready_soup: [{ grams: 600, label: "1 carton" }],
  oat_drink: [{ grams: 1000, label: "1 litre" }],
  soya_drink: [{ grams: 1000, label: "1 litre" }],
  /* chilled */
  skyr: [{ grams: 170, label: "1 pot" }, { grams: 450, label: "450 g tub" }],
  greek_yogurt_0: [{ grams: 500, label: "500 g tub" }, { grams: 1000, label: "1 kg tub" }],
  cottage_cheese: [{ grams: 300, label: "1 tub" }],
  semi_milk: [{ grams: 1000, label: "1 litre" }, { grams: 2000, label: "2 litre" }],
  cheddar: [{ grams: 200, label: "200 g block" }, { grams: 400, label: "400 g block" }],
  mozzarella_light: [{ grams: 125, label: "1 ball" }],
  hummus: [{ grams: 200, label: "1 tub" }],
  chicken_slices: [{ grams: 120, label: "1 pack" }],
  protein_shake_rtd: [{ grams: 330, label: "1 bottle" }],
  ready_meal_chilli: [{ grams: 400, label: "1 tray" }],
  /* produce */
  potato: [{ grams: 2000, label: "2 kg bag" }],
  sweet_potato: [{ grams: 1000, label: "1 kg bag" }],
  broccoli: [{ grams: 350, label: "1 head" }],
  kale: [{ grams: 200, label: "1 bag" }],
  carrots: [{ grams: 1000, label: "1 kg bag" }],
  peppers: [{ grams: 400, label: "3-pack" }],
  courgette: [{ grams: 300, label: "2 courgettes" }],
  green_beans: [{ grams: 220, label: "1 pack" }],
  mushrooms: [{ grams: 250, label: "1 punnet" }],
  tomatoes: [{ grams: 400, label: "1 pack" }],
  spinach: [{ grams: 240, label: "1 bag" }],
  mixed_leaves: [{ grams: 130, label: "1 bag" }],
  banana: [{ grams: 750, label: "1 bunch" }],
  apple: [{ grams: 1000, label: "1 bag" }],
  orange: [{ grams: 1000, label: "1 net" }],
  kiwi: [{ grams: 450, label: "1 pack" }],
  blueberries: [{ grams: 200, label: "1 punnet" }],
  strawberries: [{ grams: 400, label: "1 punnet" }],
  avocado: [{ grams: 400, label: "2-pack" }],
  /* fats */
  olive_oil: [{ grams: 500, label: "500 ml bottle" }],
  rapeseed_oil: [{ grams: 1000, label: "1 litre bottle" }],
  almonds: [{ grams: 200, label: "200 g bag" }],
  walnuts: [{ grams: 200, label: "200 g bag" }],
  peanut_butter: [{ grams: 340, label: "1 jar" }],
  chia_seeds: [{ grams: 250, label: "1 bag" }],
};

/** Fallback when a food is not in the table above. Coarse, and admitted to be. */
export const GROUP_PACKS: Record<FoodGroup, PackSize[]> = {
  protein: [{ grams: 400, label: "400 g" }],
  dairy: [{ grams: 500, label: "500 g" }],
  carb: [{ grams: 500, label: "500 g" }],
  veg: [{ grams: 300, label: "300 g" }],
  fruit: [{ grams: 400, label: "400 g" }],
  fat: [{ grams: 250, label: "250 g" }],
  convenience: [{ grams: 300, label: "300 g" }],
};

export function packsFor(food: FoodDef): PackSize[] {
  const packs = FOOD_PACKS[food.key] ?? GROUP_PACKS[food.group];
  return [...packs].sort((a, b) => a.grams - b.grams);
}

export type PackMaths = {
  /** How many of `pack` to buy. Never zero for a positive need. */
  packs: number;
  pack: PackSize;
  /** What ends up in the trolley. */
  buyG: number;
  /** buyG minus what the plan needs. The bit that goes in the fridge. */
  leftover: number;
  /** "2 × 500 g bag" — what you say at the shelf. */
  packLabel: string;
  /** "about 110 g left over" — empty when it comes out exact. */
  leftoverLabel: string;
};

function round0(n: number): number {
  return Math.round(n);
}

/**
 * You cannot buy 137 g of mince.
 *
 * The rule is the one people actually use: take the smallest pack that covers
 * the need; if nothing covers it, take the biggest pack and buy several. It
 * never proposes a smaller-than-needed buy, and it always states the leftover
 * rather than quietly inflating the plan to match the pack.
 */
export function packMaths(grams: number, food: FoodDef): PackMaths {
  const ladder = packsFor(food);
  const need = Number.isFinite(grams) && grams > 0 ? grams : 0;
  const fallback: PackSize = ladder[0] ?? { grams: 100, label: "100 g" };

  if (need <= 0) {
    return {
      packs: 0,
      pack: fallback,
      buyG: 0,
      leftover: 0,
      packLabel: "nothing to buy",
      leftoverLabel: "",
    };
  }

  const covering = ladder.find((p) => p.grams >= need);
  const pack = covering ?? ladder[ladder.length - 1] ?? fallback;
  const packs = covering ? 1 : Math.max(1, Math.ceil(need / pack.grams));
  const buyG = round0(pack.grams * packs);
  const leftover = Math.max(0, round0(buyG - need));

  return {
    packs,
    pack,
    buyG,
    leftover,
    packLabel: packs === 1 ? pack.label : `${packs} × ${pack.label}`,
    leftoverLabel: leftoverWords(leftover),
  };
}

/** Grams up to a kilo, kilos after that — nobody says "1700 g of potatoes". */
export function leftoverWords(leftover: number): string {
  if (!(leftover > 0)) return "";
  if (leftover < 1000) return `about ${leftover} g left over`;
  return `about ${(Math.round(leftover / 100) / 10).toFixed(1)} kg left over`;
}

/* ===== what the plan still needs ===== */

export type NeededItem = {
  foodKey: string;
  name: string;
  group: FoodGroup;
  shelf: FoodShelf;
  aisle: Aisle;
  /** Grams the plan asks for across the window. */
  plannedG: number;
  /** Grams of it already in the cupboard. */
  haveG: number;
  /** Grams still to buy. Zero when the cupboard covers it. */
  grams: number;
  /** True when the cupboard covers the whole thing. */
  have: boolean;
  portionLabel: string;
  handPortion: string;
};

/**
 * The plan, minus the cupboard.
 *
 * Aggregation and the food lookup are `shoppingList` from logicFuel — the fuel
 * tab's list and this one are the same arithmetic on purpose, so the two
 * screens can never disagree about what the plan needs. What this adds is the
 * subtraction nobody else does: a pantry count knocks grams off the buy, and a
 * food the cupboard fully covers stays on the list marked `have` rather than
 * silently vanishing, because a disappearing row reads as a bug.
 */
export function neededFor(
  entries: SimpleEntry[],
  foods: FoodDef[],
  pantry: PantryRow[],
): NeededItem[] {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const haveByKey = new Map<string, number>();
  for (const p of pantry) {
    if (!byKey.has(p.foodKey) || !(p.grams > 0)) continue;
    haveByKey.set(p.foodKey, (haveByKey.get(p.foodKey) ?? 0) + p.grams);
  }

  const rows: NeededItem[] = [];
  for (const line of shoppingList(entries, foods)) {
    const food = byKey.get(line.foodKey);
    if (!food) continue;
    const haveG = round0(Math.min(haveByKey.get(line.foodKey) ?? 0, line.grams));
    const grams = Math.max(0, round0(line.grams - haveG));
    rows.push({
      foodKey: line.foodKey,
      name: line.name,
      group: line.group,
      shelf: food.shelf,
      aisle: aisleFor(food),
      plannedG: round0(line.grams),
      haveG,
      grams,
      have: grams === 0,
      portionLabel: line.portionLabel,
      handPortion: food.handPortion,
    });
  }
  return rows;
}

/* ===== the walk ===== */

export type AisleGroup<T> = { aisle: Aisle; label: string; items: T[] };

/**
 * A list ordered by aisle is the difference between one lap of the shop and
 * four. Aisles come back in walking order; empty ones are not rendered at all,
 * because an empty heading is a stop you did not need to make.
 */
export function byAisle<T extends { aisle: Aisle; name: string }>(items: T[]): AisleGroup<T>[] {
  const groups: AisleGroup<T>[] = [];
  for (const aisle of AISLE_ORDER) {
    const inAisle = items
      .filter((i) => i.aisle === aisle)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (inAisle.length === 0) continue;
    groups.push({ aisle, label: AISLE_LABELS[aisle], items: inAisle });
  }
  return groups;
}

/* ===== substitutions ===== */

export type Substitution = {
  foodKey: string;
  name: string;
  /** Grams of the substitute that do the same job as the grams you needed. */
  grams: number;
  aisle: Aisle;
  /** Why this one, in words, from what the catalogue already knows. */
  reason: string;
};

/** Which number has to match for the swap to be a swap. */
type MacroKey = "proteinG" | "carbsG" | "fatG" | "kcal" | "bulk";

const EFFORT_RANK: Record<FoodEffort, number> = { none: 0, assemble: 1, heat: 2, cook: 3 };
const KEEPS: FoodShelf[] = ["cupboard", "freezer"];

const MACRO_WORD: Record<MacroKey, string> = {
  proteinG: "protein",
  carbsG: "carbs",
  fatG: "fat",
  kcal: "calories",
  bulk: "job",
};

function primaryMacro(food: FoodDef): MacroKey {
  switch (food.group) {
    case "protein":
    case "dairy":
      return "proteinG";
    case "carb":
      return "carbsG";
    case "fat":
      return "fatG";
    case "veg":
    case "fruit":
      return "bulk";
    default:
      return food.per100.proteinG >= 5 ? "proteinG" : "kcal";
  }
}

function density(food: FoodDef, macro: MacroKey): number {
  return macro === "bulk" ? 1 : food.per100[macro];
}

export const MAX_SUBSTITUTIONS = 3;

/**
 * What to reach for when the shelf is empty.
 *
 * Same group, same primary macro, within half-to-double the density so the
 * swapped quantity is one a person would actually eat. Ranked by what makes a
 * bad week survivable: something that keeps beats something fresh, less work
 * beats more work, and a closer match breaks the tie.
 *
 * There is deliberately no "cheaper" here. Timento holds no price data, and a
 * price claim it cannot stand over is exactly the kind of confident nonsense
 * this app exists not to print. Every reason below is a fact the food
 * catalogue already carries.
 */
export function substitutionsFor(
  item: { foodKey: string; grams: number },
  foods: FoodDef[],
): Substitution[] {
  const source = foods.find((f) => f.key === item.foodKey);
  if (!source || !(item.grams > 0)) return [];

  const macro = primaryMacro(source);
  const sourceDensity = density(source, macro);
  if (!(sourceDensity > 0)) return [];

  const sourceKeeps = KEEPS.includes(source.shelf);

  const scored = foods
    .filter((f) => f.key !== source.key && f.group === source.group)
    .map((f) => {
      const d = density(f, macro);
      const ratio = d > 0 ? sourceDensity / d : 0;
      return { food: f, ratio };
    })
    .filter((c) => c.ratio >= 0.5 && c.ratio <= 2)
    .map((c) => {
      const keeps = KEEPS.includes(c.food.shelf) && !sourceKeeps;
      const easier = EFFORT_RANK[c.food.effort] < EFFORT_RANK[source.effort];
      const score =
        (keeps ? -100 : 0) +
        (easier ? -10 * (EFFORT_RANK[source.effort] - EFFORT_RANK[c.food.effort]) : 0) +
        Math.abs(1 - c.ratio);
      return { ...c, keeps, easier, score };
    })
    .sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name))
    .slice(0, MAX_SUBSTITUTIONS);

  return scored.map((c) => {
    const grams = macro === "bulk" ? round0(item.grams) : round0(item.grams * c.ratio);
    const reason = c.keeps
      ? c.food.shelf === "freezer"
        ? "frozen instead of fresh — keeps, and matches fresh on most nutrients"
        : `${SHELF_LABELS[c.food.shelf]} instead of ${SHELF_LABELS[source.shelf]} — keeps`
      : c.easier
        ? `less to make — ${EFFORT_LABELS[c.food.effort]}`
        : macro === "bulk"
          ? "same job in the trolley"
          : `about the same ${MACRO_WORD[macro]}`;
    return { foodKey: c.food.key, name: c.food.name, grams, aisle: aisleFor(c.food), reason };
  });
}

/* ===== totals ===== */

export type ShoppingTotals = {
  /** Rows on the list, covered ones included. */
  items: number;
  /** Rows you actually have to buy. */
  toBuy: number;
  /** Rows the cupboard already covers. */
  covered: number;
  /** Packs to lift into the trolley. */
  packs: number;
  /** Estimated weight to carry home — a real constraint without a car. */
  weightKg: number;
  weightLabel: string;
  /** Stops on the walk. */
  aisles: number;
};

export function shoppingTotals(
  items: { aisle: Aisle; have: boolean; packs: number; buyG: number }[],
): ShoppingTotals {
  const toBuyRows = items.filter((i) => !i.have);
  const grams = toBuyRows.reduce((s, i) => s + i.buyG, 0);
  const weightKg = Math.round(grams / 100) / 10;
  return {
    items: items.length,
    toBuy: toBuyRows.length,
    covered: items.length - toBuyRows.length,
    packs: toBuyRows.reduce((s, i) => s + i.packs, 0),
    weightKg,
    weightLabel: weightKg === 0 ? "nothing to carry" : `about ${weightKg.toFixed(1)} kg to carry`,
    aisles: new Set(toBuyRows.map((i) => i.aisle)).size,
  };
}

/* ===== the view both backends build ===== */

export type ShopItem = NeededItem & {
  packs: number;
  packSizeG: number;
  packLabel: string;
  buyG: number;
  leftover: number;
  leftoverLabel: string;
  substitutions: Substitution[];
};

export type ShopAisle = AisleGroup<ShopItem>;

export type ShopView = {
  date: string;
  /** Days of plan this list covers. The floor covers today and nothing else. */
  days: number;
  aisles: ShopAisle[];
  totals: ShoppingTotals;
  retailers: RetailerDescriptor[];
  /** A plain-text list to paste into any app, or read down a phone. */
  shareText: string;
  survival: boolean;
  /** How many foods the user has told us are already in the house. */
  pantryCount: number;
  note: string;
  handoffNote: string;
};

export type ShopViewInput = {
  mode: TmMode;
  date: string;
  /** Planned, not-yet-eaten rows from `date` forward. */
  entries: PlannedEntry[];
  foods: FoodDef[];
  pantry: PantryRow[];
  /** Days of plan to shop for. Clamped; the floor ignores it and uses 1. */
  horizonDays?: number;
};

/** Plan windows past a week stop being a shop and start being a warehouse. */
export const DEFAULT_HORIZON_DAYS = 7;
export const MAX_HORIZON_DAYS = 14;
export const FLOOR_HORIZON_DAYS = 1;

export const SHOP_NOTE =
  "Built from the meal plan you already have, minus what you told us is in the cupboard, rounded up to packs a shop actually sells. Pack sizes are the usual ones — the shelf edge is always the authority. Nothing here decides what you eat.";

function clampHorizon(days: number | undefined): number {
  if (days === undefined || !Number.isFinite(days)) return DEFAULT_HORIZON_DAYS;
  return Math.max(1, Math.min(Math.round(days), MAX_HORIZON_DAYS));
}

/**
 * The list as a person would write it: aisle by aisle, quantity then pack, with
 * the cupboard items at the end so nothing is bought twice. No markdown, no
 * table, no characters that turn into mojibake in a text message.
 */
export function buildShareText(aisles: ShopAisle[], totals: ShoppingTotals, date: string): string {
  const out: string[] = [`Shopping list — plan from ${date}`];
  const covered: string[] = [];

  for (const aisle of aisles) {
    const toBuy = aisle.items.filter((i) => !i.have);
    for (const item of aisle.items) {
      if (item.have) covered.push(`- ${item.name} — already have it`);
    }
    if (toBuy.length === 0) continue;
    out.push("", aisle.label.toUpperCase());
    for (const item of toBuy) {
      const leftover = item.leftover > 0 ? ` (${item.leftoverLabel})` : "";
      out.push(`- ${item.name} — ${item.grams} g, buy ${item.packLabel}${leftover}`);
    }
  }

  if (out.length === 1) {
    out.push("", "Nothing to buy — the cupboard covers the plan.");
  } else {
    out.push(
      "",
      `${totals.toBuy} item${totals.toBuy === 1 ? "" : "s"} · ${totals.aisles} aisle${totals.aisles === 1 ? "" : "s"} · ${totals.weightLabel}`,
    );
  }
  if (covered.length > 0) out.push("", "ALREADY IN THE CUPBOARD", ...covered);
  return out.join("\n");
}

export function buildShopView(input: ShopViewInput): ShopView {
  const survival = input.mode === "survival";
  const days = survival ? FLOOR_HORIZON_DAYS : clampHorizon(input.horizonDays);
  const lastDate = addDays(input.date, days - 1);

  const entries: SimpleEntry[] = input.entries
    .filter((e) => e.date >= input.date && e.date <= lastDate)
    .map((e) => ({ foodKey: e.foodKey, grams: e.grams }));

  const needed = neededFor(entries, input.foods, input.pantry);
  const byKey = new Map(input.foods.map((f) => [f.key, f]));

  const items: ShopItem[] = needed.map((row) => {
    const food = byKey.get(row.foodKey);
    const maths = food
      ? packMaths(row.grams, food)
      : { packs: 0, pack: { grams: 0, label: "" }, buyG: 0, leftover: 0, packLabel: "", leftoverLabel: "" };
    return {
      ...row,
      packs: row.have ? 0 : maths.packs,
      packSizeG: maths.pack.grams,
      packLabel: row.have ? "already have it" : maths.packLabel,
      buyG: row.have ? 0 : maths.buyG,
      leftover: row.have ? 0 : maths.leftover,
      leftoverLabel: row.have ? "" : maths.leftoverLabel,
      // The floor is a list, not a decision tree: no alternatives to weigh up.
      substitutions:
        survival || row.have || !food ? [] : substitutionsFor({ foodKey: row.foodKey, grams: row.grams }, input.foods),
    };
  });

  const aisles = byAisle(items);
  const totals = shoppingTotals(items);

  return {
    date: input.date,
    days,
    aisles,
    totals,
    // No retailer chooser at the floor. One list, one shop, no comparison.
    retailers: survival ? [] : retailerDescriptors(),
    shareText: buildShareText(aisles, totals, input.date),
    survival,
    pantryCount: input.pantry.filter((p) => p.grams > 0).length,
    note: SHOP_NOTE,
    handoffNote: HANDOFF_NOTE,
  };
}

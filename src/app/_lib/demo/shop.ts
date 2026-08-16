import { FOODS, foodByKey } from "@convex/tm/data/foods";
import { addDays } from "@convex/tm/lib";
import {
  DEFAULT_HORIZON_DAYS,
  buildShopView,
  type PantryRow,
  type PlannedEntry,
  type ShopViewInput,
} from "@convex/tm/logicShop";
import type { DemoDb } from "../demo-db";
import type { ShopData } from "../types";

/**
 * Demo mirror of convex/tm/shop.ts. Same gather, same shared logic, same shape —
 * the view type is derived from the Convex query, so any drift is a build error.
 */

const MAX_PANTRY_GRAMS = 20000;

function gather(db: DemoDb, slug: string, date: string): ShopViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");
  const lastDate = addDays(date, DEFAULT_HORIZON_DAYS - 1);

  const entries: PlannedEntry[] = db.mealEntries
    .filter((e) => e.userSlug === slug && e.date >= date && e.date <= lastDate)
    .filter((e) => e.planned && !e.eaten)
    .map((e) => ({ date: e.date, foodKey: e.foodKey, grams: e.grams }));

  const pantry: PantryRow[] = db.pantry
    .filter((p) => p.userSlug === slug)
    .map((p) => ({ foodKey: p.foodKey, grams: p.grams }));

  return {
    mode: user.modeMut,
    date,
    entries,
    foods: FOODS,
    pantry,
    horizonDays: DEFAULT_HORIZON_DAYS,
  };
}

export function view(db: DemoDb, slug: string, date: string): ShopData {
  return buildShopView(gather(db, slug, date));
}

export function setPantry(
  db: DemoDb,
  slug: string,
  date: string,
  foodKey: string,
  grams: number,
): void {
  if (!foodByKey(foodKey)) throw new Error("unknown-food");
  if (!Number.isFinite(grams) || grams < 0) throw new Error("bad-grams");
  const amount = Math.min(Math.round(grams), MAX_PANTRY_GRAMS);

  const existing = db.pantry.find((p) => p.userSlug === slug && p.foodKey === foodKey);
  if (amount === 0) {
    if (existing) db.pantry = db.pantry.filter((p) => p !== existing);
    return;
  }
  if (existing) {
    existing.grams = amount;
    existing.updatedDate = date;
    return;
  }
  db.pantry.push({ id: db.newId("pt"), userSlug: slug, foodKey, grams: amount, updatedDate: date });
}

export function clearPantry(db: DemoDb, slug: string): void {
  db.pantry = db.pantry.filter((p) => p.userSlug !== slug);
}

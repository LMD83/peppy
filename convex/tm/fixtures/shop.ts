import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";

/**
 * Pantry fixtures — what is already in the house before anyone goes shopping.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to the `pantry` rows the demo store
 * holds, which is the contract.
 *
 * The spread is deliberate. Liam has cupboard staples in quantity (the oats and
 * the rice are never the reason for a trip), one part-used chilled tub that
 * covers today but not the week, and nothing fresh — so the list he sees is
 * mostly produce and protein, which is what a real list looks like. Artur is at
 * his floor: his cupboard is empty here on purpose, because the floor's job is
 * a short list, not an inventory.
 */

export type PantryFixtureRow = {
  id: string;
  userSlug: string;
  foodKey: string;
  grams: number;
  updatedDate: string;
};

export type ShopFixtures = { pantry: PantryFixtureRow[] };

export function buildShopFixtures(today: string): ShopFixtures {
  const pantry: PantryFixtureRow[] = [
    // A kilo bag opened last week. Breakfast is not a shopping problem.
    { id: "pt_liam_oats", userSlug: "liam", foodKey: "oats", grams: 700, updatedDate: addDays(today, -6) },
    // Most of a 1 kg bag of rice.
    { id: "pt_liam_rice", userSlug: "liam", foodKey: "brown_rice", grams: 850, updatedDate: addDays(today, -6) },
    // Three tins in the press.
    { id: "pt_liam_tuna", userSlug: "liam", foodKey: "tuna_tin_brine", grams: 435, updatedDate: addDays(today, -13) },
    // Half a tub of yoghurt — covers today, not the week. The interesting case:
    // it is neither "have it" nor "buy the full amount".
    { id: "pt_liam_yog", userSlug: "liam", foodKey: "greek_yogurt_0", grams: 240, updatedDate: addDays(today, -2) },
    // A handful of beans left in the bag — the case that is neither "have it"
    // nor "buy the whole amount", and the one a naive list gets wrong.
    { id: "pt_liam_beans", userSlug: "liam", foodKey: "green_beans", grams: 90, updatedDate: addDays(today, -3) },
    // Olive oil is a once-a-quarter purchase and should never reach a list.
    { id: "pt_liam_oil", userSlug: "liam", foodKey: "olive_oil", grams: 400, updatedDate: addDays(today, -20) },
  ];
  return { pantry };
}

/** Straight insert — pantry rows point at static food keys, not at documents. */
export async function seedShop(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: ShopFixtures,
): Promise<void> {
  for (const { id: _id, userSlug, ...row } of fx.pantry) {
    await ctx.db.insert("tm_pantry", { userId: uid(userSlug), ...row });
  }
}

/**
 * Named slot menus — composed meals, not loose items.
 *
 * Every item is a key in the food bank. The planner may place a whole menu
 * when today's kitchen can reach every part; it never invents a food to fill
 * a gap. User-saved menus use the same shape.
 */

export type MenuItemDef = { foodKey: string; grams: number };

export type MenuDef = {
  key: string;
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  items: MenuItemDef[];
};

export const MENUS: MenuDef[] = [
  /* breakfast */
  {
    key: "skyr_oats_berries",
    name: "Skyr, oats, berries",
    slot: "breakfast",
    items: [
      { foodKey: "skyr", grams: 170 },
      { foodKey: "oats", grams: 70 },
      { foodKey: "frozen_berries", grams: 100 },
    ],
  },
  {
    key: "eggs_toast_tomato",
    name: "Eggs on toast",
    slot: "breakfast",
    items: [
      { foodKey: "eggs", grams: 150 },
      { foodKey: "wholemeal_bread", grams: 72 },
      { foodKey: "tomatoes", grams: 120 },
    ],
  },
  {
    key: "weetabix_milk_skyr",
    name: "Weetabix and skyr",
    slot: "breakfast",
    items: [
      { foodKey: "weetabix", grams: 38 },
      { foodKey: "semi_milk", grams: 200 },
      { foodKey: "skyr", grams: 170 },
    ],
  },
  {
    key: "overnight_oats_banana",
    name: "Overnight oats and banana",
    slot: "breakfast",
    items: [
      { foodKey: "overnight_oats_pot", grams: 170 },
      { foodKey: "banana", grams: 120 },
    ],
  },
  {
    key: "porridge_pot_protein",
    name: "Porridge pot and protein yogurt",
    slot: "breakfast",
    items: [
      { foodKey: "porridge_pot", grams: 57 },
      { foodKey: "protein_yogurt", grams: 200 },
    ],
  },
  {
    key: "bagel_cottage_cucumber",
    name: "Bagel, cottage cheese, cucumber",
    slot: "breakfast",
    items: [
      { foodKey: "bagel_wholemeal", grams: 85 },
      { foodKey: "cottage_cheese", grams: 150 },
      { foodKey: "cucumber", grams: 80 },
    ],
  },

  /* lunch */
  {
    key: "chicken_rice_broccoli",
    name: "Chicken, rice, broccoli",
    slot: "lunch",
    items: [
      { foodKey: "chicken_breast", grams: 180 },
      { foodKey: "brown_rice", grams: 80 },
      { foodKey: "broccoli", grams: 150 },
    ],
  },
  {
    key: "tuna_sourdough_leaves",
    name: "Tuna on sourdough",
    slot: "lunch",
    items: [
      { foodKey: "tuna_tin_brine", grams: 145 },
      { foodKey: "sourdough", grams: 80 },
      { foodKey: "mixed_leaves", grams: 80 },
      { foodKey: "olive_oil", grams: 8 },
    ],
  },
  {
    key: "turkey_wrap",
    name: "Turkey wrap",
    slot: "lunch",
    items: [
      { foodKey: "turkey_slices", grams: 70 },
      { foodKey: "wholemeal_wrap", grams: 60 },
      { foodKey: "salad_bag", grams: 60 },
      { foodKey: "hummus", grams: 40 },
    ],
  },
  {
    key: "chickpea_salad",
    name: "Chickpea salad",
    slot: "lunch",
    items: [
      { foodKey: "chickpeas_tin", grams: 200 },
      { foodKey: "mixed_leaves", grams: 80 },
      { foodKey: "cherry_tomatoes", grams: 100 },
      { foodKey: "feta", grams: 40 },
    ],
  },
  {
    key: "ready_tikka",
    name: "Tikka tray",
    slot: "lunch",
    items: [
      { foodKey: "ready_meal_tikka", grams: 400 },
      { foodKey: "salad_bag", grams: 60 },
    ],
  },
  {
    key: "cottage_oatcakes",
    name: "Cottage cheese and oatcakes",
    slot: "lunch",
    items: [
      { foodKey: "cottage_cheese", grams: 200 },
      { foodKey: "oatcakes", grams: 26 },
      { foodKey: "apple", grams: 180 },
    ],
  },
  {
    key: "tuna_pasta_pot_side",
    name: "Tuna pasta pot",
    slot: "lunch",
    items: [
      { foodKey: "tuna_pasta_pot", grams: 280 },
      { foodKey: "cucumber", grams: 80 },
    ],
  },

  /* dinner */
  {
    key: "salmon_potato_greens",
    name: "Salmon, potato, greens",
    slot: "dinner",
    items: [
      { foodKey: "salmon_fillet", grams: 140 },
      { foodKey: "potato", grams: 280 },
      { foodKey: "green_beans", grams: 150 },
    ],
  },
  {
    key: "mince_pasta_peppers",
    name: "Mince and pasta",
    slot: "dinner",
    items: [
      { foodKey: "beef_mince_5", grams: 180 },
      { foodKey: "pasta_wholewheat", grams: 80 },
      { foodKey: "peppers", grams: 120 },
    ],
  },
  {
    key: "chicken_thigh_quinoa",
    name: "Chicken thigh and quinoa",
    slot: "dinner",
    items: [
      { foodKey: "chicken_thigh", grams: 180 },
      { foodKey: "quinoa", grams: 70 },
      { foodKey: "courgette", grams: 150 },
    ],
  },
  {
    key: "tofu_rice_veg",
    name: "Tofu, rice, mixed veg",
    slot: "dinner",
    items: [
      { foodKey: "tofu_firm", grams: 180 },
      { foodKey: "microwave_rice", grams: 250 },
      { foodKey: "frozen_mixed_veg", grams: 160 },
    ],
  },
  {
    key: "white_fish_mash_peas",
    name: "White fish, mash, peas",
    slot: "dinner",
    items: [
      { foodKey: "frozen_white_fish", grams: 160 },
      { foodKey: "instant_mash", grams: 50 },
      { foodKey: "frozen_peas", grams: 120 },
    ],
  },
  {
    key: "ready_chilli",
    name: "Chilli tray and rice",
    slot: "dinner",
    items: [
      { foodKey: "ready_meal_chilli", grams: 400 },
      { foodKey: "microwave_rice", grams: 125 },
    ],
  },
  {
    key: "turkey_steak_sweet_potato",
    name: "Turkey steak and sweet potato",
    slot: "dinner",
    items: [
      { foodKey: "turkey_steak", grams: 150 },
      { foodKey: "sweet_potato", grams: 220 },
      { foodKey: "frozen_broccoli", grams: 160 },
    ],
  },

  /* snack */
  {
    key: "yogurt_almonds",
    name: "Yogurt and almonds",
    slot: "snack",
    items: [
      { foodKey: "greek_yogurt_0", grams: 170 },
      { foodKey: "almonds", grams: 20 },
    ],
  },
  {
    key: "cottage_apple",
    name: "Cottage cheese and apple",
    slot: "snack",
    items: [
      { foodKey: "cottage_cheese", grams: 150 },
      { foodKey: "apple", grams: 180 },
    ],
  },
  {
    key: "shake_banana",
    name: "Shake and banana",
    slot: "snack",
    items: [
      { foodKey: "protein_shake_rtd", grams: 330 },
      { foodKey: "banana", grams: 120 },
    ],
  },
  {
    key: "rice_cakes_pb",
    name: "Rice cakes and peanut butter",
    slot: "snack",
    items: [
      { foodKey: "rice_cakes", grams: 18 },
      { foodKey: "peanut_butter", grams: 20 },
    ],
  },
  {
    key: "skyr_berries",
    name: "Skyr and berries",
    slot: "snack",
    items: [
      { foodKey: "skyr", grams: 170 },
      { foodKey: "frozen_berries", grams: 80 },
    ],
  },
  {
    key: "kefir_grapes",
    name: "Kefir and grapes",
    slot: "snack",
    items: [
      { foodKey: "kefir", grams: 250 },
      { foodKey: "grapes", grams: 100 },
    ],
  },
];

const BY_KEY = new Map(MENUS.map((m) => [m.key, m]));

export function menuByKey(key: string): MenuDef | undefined {
  return BY_KEY.get(key);
}

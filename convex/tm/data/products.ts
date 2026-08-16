/**
 * Branded packs that sit on an Irish/UK shelf, pointed at the staple they
 * price. Nutrients stay on the food; a product is a name, a brand, and a pack
 * size you can actually buy.
 *
 * Typical Tesco / Aldi / Lidl trolley — own-brand plus a few named lines.
 * Pack sizes are what the shelf usually offers, not a claim about the pack in
 * your hand. The label always wins.
 *
 * Static config, not user data — no row here belongs to anybody.
 */

export const RETAILERS = ["tesco", "aldi", "lidl", "supervalu", "dunnes", "any"] as const;
export type ProductRetailer = (typeof RETAILERS)[number];

export const RETAILER_LABELS: Record<ProductRetailer, string> = {
  tesco: "Tesco",
  aldi: "Aldi",
  lidl: "Lidl",
  supervalu: "SuperValu",
  dunnes: "Dunnes",
  any: "Any shop",
};

export type ProductDef = {
  key: string;
  foodKey: string;
  name: string;
  brand: string;
  packG: number;
  packLabel: string;
  retailer: ProductRetailer;
};

type Pack = [grams: number, label: string];

type Spec = {
  foodKey: string;
  name: string;
  packs: Pack[];
  alt: { brand: string; retailer: ProductRetailer; name?: string };
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function mint(spec: Spec): ProductDef[] {
  const out: ProductDef[] = [];
  for (const [packG, packLabel] of spec.packs) {
    out.push({
      key: `tesco_${spec.foodKey}_${packG}`,
      foodKey: spec.foodKey,
      name: spec.name,
      brand: "Tesco",
      packG,
      packLabel,
      retailer: "tesco",
    });
  }
  const [packG, packLabel] = spec.packs[spec.packs.length - 1];
  out.push({
    key: `${spec.alt.retailer}_${slug(spec.alt.brand)}_${spec.foodKey}_${packG}`,
    foodKey: spec.foodKey,
    name: spec.alt.name ?? spec.name,
    brand: spec.alt.brand,
    packG,
    packLabel,
    retailer: spec.alt.retailer,
  });
  return out;
}

/**
 * One Tesco line per pack size (so the shop ladder stays honest) plus one
 * other shop's own-brand or a named line on the largest pack.
 */
const SHELF: Spec[] = [
  /* meat & fish */
  {
    foodKey: "chicken_breast",
    name: "Chicken breast fillets",
    packs: [[300, "300 g"], [600, "600 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "chicken_thigh",
    name: "Chicken thigh fillets",
    packs: [[400, "400 g"], [800, "800 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "turkey_mince",
    name: "Turkey mince 5%",
    packs: [[500, "500 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "beef_mince_5",
    name: "Beef mince 5%",
    packs: [[400, "400 g"], [750, "750 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "pork_loin",
    name: "Pork loin steaks",
    packs: [[350, "350 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "salmon_fillet",
    name: "Salmon fillets",
    packs: [[240, "2 fillets"]],
    alt: { brand: "The Fishmonger", retailer: "aldi" },
  },
  {
    foodKey: "cod_fillet",
    name: "Cod fillets",
    packs: [[260, "2 fillets"]],
    alt: { brand: "The Fishmonger", retailer: "aldi" },
  },
  {
    foodKey: "prawns_cooked",
    name: "Cooked king prawns",
    packs: [[150, "150 g"]],
    alt: { brand: "The Fishmonger", retailer: "aldi" },
  },
  {
    foodKey: "roast_chicken_cooked",
    name: "Ready-cooked roast chicken",
    packs: [[400, "1 cooked chicken"]],
    alt: { brand: "Ashfield Farm", retailer: "aldi" },
  },
  {
    foodKey: "turkey_steak",
    name: "Turkey breast steaks",
    packs: [[300, "300 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "lean_beef_steak",
    name: "Lean beef frying steak",
    packs: [[300, "300 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "lamb_mince",
    name: "Lamb mince",
    packs: [[400, "400 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "pork_mince",
    name: "Pork mince",
    packs: [[400, "400 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "turkey_slices",
    name: "Turkey slices",
    packs: [[120, "120 g"]],
    alt: { brand: "Ashfield Farm", retailer: "aldi" },
  },
  {
    foodKey: "ham_slices",
    name: "Cooked ham slices",
    packs: [[120, "120 g"]],
    alt: { brand: "Ashfield Farm", retailer: "aldi" },
  },
  {
    foodKey: "bacon_medallions",
    name: "Smoked bacon medallions",
    packs: [[200, "200 g"]],
    alt: { brand: "Ashfield Farm", retailer: "aldi" },
  },
  {
    foodKey: "smoked_salmon",
    name: "Smoked salmon",
    packs: [[100, "100 g"]],
    alt: { brand: "The Fishmonger", retailer: "aldi" },
  },
  {
    foodKey: "tinned_salmon",
    name: "Pink salmon, tinned",
    packs: [[170, "1 tin"]],
    alt: { brand: "John West", retailer: "any" },
  },
  {
    foodKey: "chicken_drumstick",
    name: "Chicken drumsticks",
    packs: [[600, "600 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "stew_beef",
    name: "Diced stewing beef",
    packs: [[400, "400 g"]],
    alt: { brand: "Butcher's Selection", retailer: "aldi" },
  },
  {
    foodKey: "chicken_slices",
    name: "Cooked chicken slices",
    packs: [[120, "120 g"]],
    alt: { brand: "Ashfield Farm", retailer: "aldi" },
  },
  {
    foodKey: "jerky",
    name: "Beef jerky",
    packs: [[50, "50 g"]],
    alt: { brand: "Jack Link's", retailer: "any" },
  },

  /* eggs & alt protein */
  {
    foodKey: "eggs",
    name: "Free-range eggs",
    packs: [[300, "6 eggs"], [600, "12 eggs"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "eggs_boiled_pack",
    name: "Ready-boiled eggs",
    packs: [[200, "4-pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "egg_whites",
    name: "Liquid egg whites",
    packs: [[500, "500 ml carton"]],
    alt: { brand: "Two Chicks", retailer: "any" },
  },
  {
    foodKey: "tofu_firm",
    name: "Firm tofu",
    packs: [[280, "1 block"]],
    alt: { brand: "Cauldron", retailer: "any" },
  },
  {
    foodKey: "tempeh",
    name: "Tempeh",
    packs: [[200, "1 block"]],
    alt: { brand: "Tofoo", retailer: "any" },
  },
  {
    foodKey: "edamame",
    name: "Frozen edamame",
    packs: [[300, "300 g"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "falafel",
    name: "Falafel",
    packs: [[200, "200 g"]],
    alt: { brand: "The Deli", retailer: "aldi" },
  },
  {
    foodKey: "quorn_pieces",
    name: "Chicken-style pieces",
    packs: [[300, "300 g"]],
    alt: { brand: "Quorn", retailer: "any" },
  },
  {
    foodKey: "seitan",
    name: "Seitan",
    packs: [[200, "200 g"]],
    alt: { brand: "VBites", retailer: "any" },
  },

  /* frozen */
  {
    foodKey: "frozen_white_fish",
    name: "Frozen white fish fillets",
    packs: [[400, "400 g bag"], [800, "800 g bag"]],
    alt: { brand: "The Fishmonger", retailer: "aldi" },
  },
  {
    foodKey: "frozen_chicken_pieces",
    name: "Frozen chicken breast pieces",
    packs: [[500, "500 g bag"], [1000, "1 kg bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "frozen_peas",
    name: "Garden peas",
    packs: [[500, "500 g bag"], [1000, "1 kg bag"]],
    alt: { brand: "Birds Eye", retailer: "any" },
  },
  {
    foodKey: "frozen_mixed_veg",
    name: "Mixed vegetables",
    packs: [[500, "500 g bag"], [1000, "1 kg bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "frozen_spinach",
    name: "Frozen chopped spinach",
    packs: [[500, "500 g bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "frozen_berries",
    name: "Frozen mixed berries",
    packs: [[350, "350 g bag"], [500, "500 g bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "frozen_broccoli",
    name: "Frozen broccoli florets",
    packs: [[900, "900 g bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "sweetcorn_frozen",
    name: "Frozen sweetcorn",
    packs: [[750, "750 g bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "frozen_mango",
    name: "Frozen mango chunks",
    packs: [[400, "400 g bag"]],
    alt: { brand: "Four Seasons", retailer: "aldi" },
  },
  {
    foodKey: "frozen_salmon",
    name: "Frozen salmon fillets",
    packs: [[400, "400 g"]],
    alt: { brand: "The Fishmonger", retailer: "aldi" },
  },
  {
    foodKey: "fish_fingers",
    name: "Fish fingers",
    packs: [[300, "10-pack"]],
    alt: { brand: "Birds Eye", retailer: "any" },
  },

  /* tins */
  {
    foodKey: "tuna_tin_brine",
    name: "Tuna chunks in brine",
    packs: [[145, "1 tin"], [435, "3-pack of tins"]],
    alt: { brand: "John West", retailer: "any" },
  },
  {
    foodKey: "mackerel_tinned",
    name: "Mackerel in brine",
    packs: [[125, "1 tin"]],
    alt: { brand: "John West", retailer: "any" },
  },
  {
    foodKey: "sardines_tinned",
    name: "Sardines in brine",
    packs: [[120, "1 tin"]],
    alt: { brand: "John West", retailer: "any" },
  },
  {
    foodKey: "chickpeas_tin",
    name: "Chickpeas in water",
    packs: [[240, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },
  {
    foodKey: "black_beans_tin",
    name: "Black beans in water",
    packs: [[240, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },
  {
    foodKey: "baked_beans",
    name: "Baked beans in tomato sauce",
    packs: [[400, "1 tin"]],
    alt: { brand: "Heinz", retailer: "any" },
  },
  {
    foodKey: "tinned_tomatoes",
    name: "Chopped tomatoes",
    packs: [[400, "1 tin"]],
    alt: { brand: "Cirio", retailer: "any" },
  },
  {
    foodKey: "tinned_sweetcorn",
    name: "Sweetcorn in water",
    packs: [[195, "1 tin"]],
    alt: { brand: "Green Giant", retailer: "any" },
  },
  {
    foodKey: "tinned_peaches",
    name: "Peach slices in juice",
    packs: [[240, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },
  {
    foodKey: "kidney_beans_tin",
    name: "Kidney beans in water",
    packs: [[240, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },
  {
    foodKey: "cannellini_tin",
    name: "Cannellini beans in water",
    packs: [[240, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },
  {
    foodKey: "pineapple_tinned",
    name: "Pineapple in juice",
    packs: [[227, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },
  {
    foodKey: "lentils_cooked",
    name: "Green lentils in water",
    packs: [[390, "1 tin"]],
    alt: { brand: "Sweet Harvest", retailer: "aldi" },
  },

  /* cupboard carbs */
  {
    foodKey: "oats",
    name: "Porridge oats",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "Flahavan's", retailer: "any" },
  },
  {
    foodKey: "white_rice",
    name: "Long grain rice",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "brown_rice",
    name: "Brown rice",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "pasta_wholewheat",
    name: "Wholewheat pasta",
    packs: [[500, "500 g bag"]],
    alt: { brand: "Baresa", retailer: "aldi" },
  },
  {
    foodKey: "couscous",
    name: "Couscous",
    packs: [[500, "500 g box"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "quinoa",
    name: "Quinoa",
    packs: [[500, "500 g bag"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "instant_mash",
    name: "Instant mashed potato",
    packs: [[400, "1 box"]],
    alt: { brand: "Smash", retailer: "any" },
  },
  {
    foodKey: "basmati",
    name: "Basmati rice",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "Tilda", retailer: "any" },
  },
  {
    foodKey: "noodles_egg",
    name: "Egg noodles",
    packs: [[250, "250 g"]],
    alt: { brand: "Sharwood's", retailer: "any" },
  },
  {
    foodKey: "bulgur",
    name: "Bulgur wheat",
    packs: [[500, "500 g"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "weetabix",
    name: "Wholewheat biscuits",
    packs: [[430, "24 biscuits"]],
    alt: { brand: "Weetabix", retailer: "any" },
  },
  {
    foodKey: "shredded_wheat",
    name: "Shredded wheat",
    packs: [[375, "375 g"]],
    alt: { brand: "Nestlé", retailer: "any" },
  },
  {
    foodKey: "muesli",
    name: "No-added-sugar muesli",
    packs: [[750, "750 g"]],
    alt: { brand: "Harvest Morn", retailer: "aldi" },
  },
  {
    foodKey: "granola",
    name: "Plain granola",
    packs: [[500, "500 g"]],
    alt: { brand: "Harvest Morn", retailer: "aldi" },
  },
  {
    foodKey: "protein_cereal",
    name: "High-protein cereal",
    packs: [[350, "350 g"]],
    alt: { brand: "Harvest Morn", retailer: "aldi" },
  },
  {
    foodKey: "crispbread",
    name: "Rye crispbread",
    packs: [[200, "200 g"]],
    alt: { brand: "Ryvita", retailer: "any" },
  },
  {
    foodKey: "rice_cakes",
    name: "Plain rice cakes",
    packs: [[130, "1 pack"]],
    alt: { brand: "Kallo", retailer: "any" },
  },
  {
    foodKey: "oatcakes",
    name: "Oatcakes",
    packs: [[200, "1 pack"]],
    alt: { brand: "Nairn's", retailer: "any" },
  },
  {
    foodKey: "popcorn_plain",
    name: "Plain popcorn",
    packs: [[100, "100 g"]],
    alt: { brand: "Propercorn", retailer: "any" },
  },
  {
    foodKey: "raisins",
    name: "Raisins",
    packs: [[250, "250 g"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },

  /* bakery */
  {
    foodKey: "wholemeal_bread",
    name: "Wholemeal bread",
    packs: [[800, "1 loaf"]],
    alt: { brand: "Brennans", retailer: "any" },
  },
  {
    foodKey: "sourdough",
    name: "Sourdough loaf",
    packs: [[500, "1 loaf"]],
    alt: { brand: "Specially Selected", retailer: "aldi" },
  },
  {
    foodKey: "wholemeal_wrap",
    name: "Wholemeal wraps",
    packs: [[360, "6 wraps"]],
    alt: { brand: "Mission", retailer: "any" },
  },
  {
    foodKey: "pitta",
    name: "Wholemeal pittas",
    packs: [[360, "6 pittas"]],
    alt: { brand: "The Bakery", retailer: "aldi" },
  },
  {
    foodKey: "bagel_wholemeal",
    name: "Wholemeal bagels",
    packs: [[300, "4-pack"]],
    alt: { brand: "The Bakery", retailer: "aldi" },
  },
  {
    foodKey: "soda_bread",
    name: "Brown soda bread",
    packs: [[400, "1 loaf"]],
    alt: { brand: "Brennans", retailer: "any" },
  },
  {
    foodKey: "potato_farls",
    name: "Potato farls",
    packs: [[200, "4-pack"]],
    alt: { brand: "The Bakery", retailer: "aldi" },
  },

  /* chilled dairy */
  {
    foodKey: "skyr",
    name: "Natural skyr",
    packs: [[170, "1 pot"], [450, "450 g tub"]],
    alt: { brand: "Arla", retailer: "any" },
  },
  {
    foodKey: "greek_yogurt_0",
    name: "0% Greek yogurt",
    packs: [[500, "500 g tub"], [1000, "1 kg tub"]],
    alt: { brand: "Fage", retailer: "any" },
  },
  {
    foodKey: "cottage_cheese",
    name: "Cottage cheese",
    packs: [[300, "1 tub"]],
    alt: { brand: "Avonmore", retailer: "any" },
  },
  {
    foodKey: "semi_milk",
    name: "Semi-skimmed milk",
    packs: [[1000, "1 litre"], [2000, "2 litre"]],
    alt: { brand: "Avonmore", retailer: "any" },
  },
  {
    foodKey: "cheddar",
    name: "Mature cheddar",
    packs: [[200, "200 g block"], [400, "400 g block"]],
    alt: { brand: "Pilgrims Choice", retailer: "any" },
  },
  {
    foodKey: "mozzarella_light",
    name: "Light mozzarella",
    packs: [[125, "1 ball"]],
    alt: { brand: "Galbani", retailer: "any" },
  },
  {
    foodKey: "protein_yogurt",
    name: "High-protein yogurt",
    packs: [[200, "200 g pot"]],
    alt: { brand: "Arla", retailer: "any" },
  },
  {
    foodKey: "kefir",
    name: "Natural kefir",
    packs: [[500, "500 ml"]],
    alt: { brand: "Glenisk", retailer: "any" },
  },
  {
    foodKey: "greek_yogurt_full",
    name: "Full-fat Greek yogurt",
    packs: [[500, "500 g tub"]],
    alt: { brand: "Brooklea", retailer: "aldi" },
  },
  {
    foodKey: "skim_milk",
    name: "Skimmed milk",
    packs: [[1000, "1 litre"]],
    alt: { brand: "Avonmore", retailer: "any" },
  },
  {
    foodKey: "almond_drink",
    name: "Unsweetened almond drink",
    packs: [[1000, "1 litre"]],
    alt: { brand: "Alpro", retailer: "any" },
  },
  {
    foodKey: "oat_drink",
    name: "Fortified oat drink",
    packs: [[1000, "1 litre"]],
    alt: { brand: "Oatly", retailer: "any" },
  },
  {
    foodKey: "soya_drink",
    name: "Fortified soya drink",
    packs: [[1000, "1 litre"]],
    alt: { brand: "Alpro", retailer: "any" },
  },
  {
    foodKey: "halloumi",
    name: "Halloumi",
    packs: [[225, "225 g"]],
    alt: { brand: "Emporium", retailer: "aldi" },
  },
  {
    foodKey: "feta",
    name: "Feta",
    packs: [[200, "200 g"]],
    alt: { brand: "Emporium", retailer: "aldi" },
  },
  {
    foodKey: "quark",
    name: "Quark",
    packs: [[250, "250 g"]],
    alt: { brand: "Brooklea", retailer: "aldi" },
  },
  {
    foodKey: "cheese_slices",
    name: "Light cheese slices",
    packs: [[150, "150 g"]],
    alt: { brand: "Dairyfine", retailer: "aldi" },
  },
  {
    foodKey: "babybel",
    name: "Mini Babybel Light",
    packs: [[120, "6-pack"]],
    alt: { brand: "Babybel", retailer: "any" },
  },
  {
    foodKey: "hummus",
    name: "Reduced-fat hummus",
    packs: [[200, "1 tub"]],
    alt: { brand: "The Deli", retailer: "aldi" },
  },
  {
    foodKey: "tzatziki",
    name: "Tzatziki",
    packs: [[200, "1 tub"]],
    alt: { brand: "The Deli", retailer: "aldi" },
  },
  {
    foodKey: "salsa",
    name: "Tomato salsa",
    packs: [[230, "1 jar"]],
    alt: { brand: "Old El Paso", retailer: "any" },
  },

  /* produce */
  {
    foodKey: "potato",
    name: "Rooster potatoes",
    packs: [[2000, "2 kg bag"]],
    alt: { brand: "Greenvale", retailer: "aldi" },
  },
  {
    foodKey: "sweet_potato",
    name: "Sweet potatoes",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "broccoli",
    name: "Broccoli",
    packs: [[350, "1 head"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "kale",
    name: "Curly kale",
    packs: [[200, "1 bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "carrots",
    name: "Carrots",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "peppers",
    name: "Mixed peppers",
    packs: [[400, "3-pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "courgette",
    name: "Courgettes",
    packs: [[300, "2 courgettes"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "green_beans",
    name: "Fine green beans",
    packs: [[220, "1 pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "mushrooms",
    name: "Closed-cup mushrooms",
    packs: [[250, "1 punnet"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "tomatoes",
    name: "Vine tomatoes",
    packs: [[400, "1 pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "spinach",
    name: "Baby spinach",
    packs: [[240, "1 bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "mixed_leaves",
    name: "Mixed salad leaves",
    packs: [[130, "1 bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "cauliflower",
    name: "Cauliflower",
    packs: [[750, "1 head"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "cabbage",
    name: "Green cabbage",
    packs: [[800, "1 head"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "onion",
    name: "Brown onions",
    packs: [[1000, "1 kg bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "cucumber",
    name: "Cucumber",
    packs: [[400, "1 cucumber"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "salad_bag",
    name: "Salad bag",
    packs: [[200, "1 bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "beetroot_cooked",
    name: "Cooked beetroot",
    packs: [[300, "300 g"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "asparagus",
    name: "Asparagus",
    packs: [[250, "1 bunch"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "cherry_tomatoes",
    name: "Cherry tomatoes",
    packs: [[250, "1 punnet"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "celery",
    name: "Celery",
    packs: [[350, "1 head"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "tenderstem",
    name: "Tenderstem broccoli",
    packs: [[200, "1 pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "banana",
    name: "Bananas",
    packs: [[750, "1 bunch"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "apple",
    name: "Apples",
    packs: [[1000, "1 bag"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "orange",
    name: "Oranges",
    packs: [[1000, "1 net"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "kiwi",
    name: "Kiwi fruit",
    packs: [[450, "1 pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "blueberries",
    name: "Blueberries",
    packs: [[200, "1 punnet"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "strawberries",
    name: "Strawberries",
    packs: [[400, "1 punnet"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "avocado",
    name: "Ripe avocados",
    packs: [[400, "2-pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "grapes",
    name: "Seedless grapes",
    packs: [[400, "1 punnet"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "pear",
    name: "Pears",
    packs: [[600, "1 pack"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "melon",
    name: "Melon",
    packs: [[800, "1 melon"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "mango",
    name: "Mango",
    packs: [[400, "1 mango"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },
  {
    foodKey: "clementine",
    name: "Clementines",
    packs: [[600, "1 net"]],
    alt: { brand: "Nature's Pick", retailer: "aldi" },
  },

  /* fats */
  {
    foodKey: "olive_oil",
    name: "Extra virgin olive oil",
    packs: [[500, "500 ml bottle"]],
    alt: { brand: "Filippo Berio", retailer: "any" },
  },
  {
    foodKey: "rapeseed_oil",
    name: "Rapeseed oil",
    packs: [[1000, "1 litre bottle"]],
    alt: { brand: "Baresa", retailer: "aldi" },
  },
  {
    foodKey: "almonds",
    name: "Whole almonds",
    packs: [[200, "200 g bag"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "walnuts",
    name: "Walnut halves",
    packs: [[200, "200 g bag"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "peanut_butter",
    name: "Smooth peanut butter",
    packs: [[340, "1 jar"]],
    alt: { brand: "Whole Earth", retailer: "any" },
  },
  {
    foodKey: "chia_seeds",
    name: "Chia seeds",
    packs: [[250, "1 bag"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "butter",
    name: "Irish butter",
    packs: [[250, "250 g"]],
    alt: { brand: "Connacht Gold", retailer: "any" },
  },
  {
    foodKey: "olive_spread",
    name: "Olive spread",
    packs: [[500, "500 g"]],
    alt: { brand: "Flora", retailer: "any" },
  },
  {
    foodKey: "cashews",
    name: "Cashew nuts",
    packs: [[200, "200 g"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "pumpkin_seeds",
    name: "Pumpkin seeds",
    packs: [[200, "200 g"]],
    alt: { brand: "The Pantry", retailer: "aldi" },
  },
  {
    foodKey: "dark_chocolate",
    name: "70% dark chocolate",
    packs: [[100, "100 g"]],
    alt: { brand: "Lindt", retailer: "any" },
  },
  {
    foodKey: "tahini",
    name: "Tahini",
    packs: [[300, "1 jar"]],
    alt: { brand: "Meridian", retailer: "any" },
  },
  {
    foodKey: "mayo_light",
    name: "Light mayonnaise",
    packs: [[400, "1 jar"]],
    alt: { brand: "Hellmann's", retailer: "any" },
  },

  /* convenience */
  {
    foodKey: "whey_protein",
    name: "Whey protein isolate",
    packs: [[900, "900 g tub"]],
    alt: { brand: "Myprotein", retailer: "any" },
  },
  {
    foodKey: "protein_bar",
    name: "Protein bar",
    packs: [[60, "1 bar"], [240, "4-pack"]],
    alt: { brand: "Grenade", retailer: "any" },
  },
  {
    foodKey: "protein_shake_rtd",
    name: "Ready-to-drink protein shake",
    packs: [[330, "1 bottle"]],
    alt: { brand: "Barebells", retailer: "any" },
  },
  {
    foodKey: "microwave_rice",
    name: "Microwave brown rice",
    packs: [[250, "1 pouch"]],
    alt: { brand: "Uncle Ben's", retailer: "any" },
  },
  {
    foodKey: "porridge_pot",
    name: "Porridge pot",
    packs: [[57, "1 pot"]],
    alt: { brand: "Flahavan's", retailer: "any" },
  },
  {
    foodKey: "ready_soup",
    name: "Lentil soup",
    packs: [[600, "1 carton"]],
    alt: { brand: "Batchelors", retailer: "any" },
  },
  {
    foodKey: "ready_meal_chilli",
    name: "Chilli con carne",
    packs: [[400, "1 tray"]],
    alt: { brand: "Chef Select", retailer: "lidl" },
  },
  {
    foodKey: "ready_meal_tikka",
    name: "Chicken tikka masala",
    packs: [[400, "1 tray"]],
    alt: { brand: "Chef Select", retailer: "lidl" },
  },
  {
    foodKey: "ready_meal_cottage_pie",
    name: "Cottage pie",
    packs: [[400, "1 tray"]],
    alt: { brand: "Chef Select", retailer: "lidl" },
  },
  {
    foodKey: "soup_lentil",
    name: "Lentil soup",
    packs: [[600, "1 carton"]],
    alt: { brand: "Batchelors", retailer: "any" },
  },
  {
    foodKey: "tuna_pasta_pot",
    name: "Tuna pasta pot",
    packs: [[300, "1 pot"]],
    alt: { brand: "Chef Select", retailer: "lidl" },
  },
  {
    foodKey: "oat_bar",
    name: "Oat flapjack",
    packs: [[160, "4-pack"]],
    alt: { brand: "Nature Valley", retailer: "any" },
  },
  {
    foodKey: "rice_pudding_pot",
    name: "Rice pudding pot",
    packs: [[150, "1 pot"]],
    alt: { brand: "Müller", retailer: "any" },
  },
  {
    foodKey: "overnight_oats_pot",
    name: "Overnight oats",
    packs: [[170, "1 pot"]],
    alt: { brand: "Brooklea", retailer: "aldi" },
  },
  {
    foodKey: "greek_salad_pot",
    name: "Greek salad pot",
    packs: [[250, "1 pot"]],
    alt: { brand: "The Deli", retailer: "aldi" },
  },
];

export const PRODUCTS: ProductDef[] = SHELF.flatMap(mint);

const BY_KEY = new Map(PRODUCTS.map((p) => [p.key, p]));

export function productByKey(key: string): ProductDef | undefined {
  return BY_KEY.get(key);
}

export function productsFor(foodKey: string): ProductDef[] {
  return PRODUCTS.filter((p) => p.foodKey === foodKey);
}

/** Unique pack sizes for a food, ascending — what the shop ladder reads. */
export function packsFromProducts(foodKey: string): { grams: number; label: string }[] {
  const seen = new Map<number, string>();
  for (const p of PRODUCTS) {
    if (p.foodKey !== foodKey) continue;
    if (!seen.has(p.packG)) seen.set(p.packG, p.packLabel);
  }
  return [...seen.entries()]
    .map(([grams, label]) => ({ grams, label }))
    .sort((a, b) => a.grams - b.grams);
}

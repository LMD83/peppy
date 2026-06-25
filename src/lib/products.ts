// Single source of truth for the Peppy catalogue.
// Sample data — real products/pricing come from the commerce backend later.

export type CollectionSlug =
  | "protein"
  | "creatine"
  | "pre-workout"
  | "recovery"
  | "bundles";

export interface Collection {
  slug: CollectionSlug;
  name: string;
  /** SEO H1 — usually includes the Ireland modifier */
  heading: string;
  /** Short, compliant intro copy that ranks on the PLP */
  intro: string;
  /** oklch gradient stops for the placeholder hero (no image assets yet) */
  accent: [string, string];
}

export interface Product {
  handle: string;
  name: string;
  collection: CollectionSlug;
  /** One-line, compliance-safe descriptor */
  tagline: string;
  /** Price in EUR */
  price: number;
  /** Servings per tub — drives price-per-serving */
  servings: number;
  size: string;
  flavours: string[];
  informedSport: boolean;
  vegan: boolean;
  bestseller?: boolean;
  /** Compliance-safe benefit bullets (no unauthorised health claims) */
  benefits: string[];
  /** Per-serving nutritional highlights for the supplement-facts panel */
  facts: { label: string; value: string }[];
  howToUse: string;
  /** oklch gradient stops for the placeholder product image */
  accent: [string, string];
}

export const collections: Collection[] = [
  {
    slug: "protein",
    name: "Protein",
    heading: "Protein Powder Ireland",
    intro:
      "Whey and plant protein to support your training, made in the EU and Informed-Sport tested. Every tub shows its price per serving so you can compare honestly. Shipped next-day across Ireland with no customs charges.",
    accent: ["oklch(0.83 0.19 134)", "oklch(0.55 0.16 150)"],
  },
  {
    slug: "creatine",
    name: "Creatine",
    heading: "Creatine Monohydrate Ireland",
    intro:
      "Pure creatine monohydrate — one of the most researched supplements in sport. Informed-Sport tested for banned substances and priced fairly per serving. Fast, tracked delivery across Ireland.",
    accent: ["oklch(0.78 0.16 220)", "oklch(0.55 0.14 250)"],
  },
  {
    slug: "pre-workout",
    name: "Pre-Workout",
    heading: "Pre-Workout Ireland",
    intro:
      "Pre-workout formulas with transparent labels — you see exactly what's in every scoop. Stimulant and caffeine-free options available, all Informed-Sport tested. Delivered next-day in Ireland.",
    accent: ["oklch(0.8 0.18 40)", "oklch(0.62 0.2 25)"],
  },
  {
    slug: "recovery",
    name: "Recovery & Hydration",
    heading: "Muscle Recovery & Hydration Supplements Ireland",
    intro:
      "Electrolytes, EAAs and recovery essentials to support your training routine. Clean, tested ingredients with full transparency. Shipped quickly from Ireland, no waiting on UK deliveries.",
    accent: ["oklch(0.82 0.15 190)", "oklch(0.6 0.13 200)"],
  },
  {
    slug: "bundles",
    name: "Bundles",
    heading: "Sports Nutrition Bundles Ireland",
    intro:
      "Pre-built stacks that bring your essentials together at a better price per serving than buying separately. Built for beginners through to athletes, all Informed-Sport tested.",
    accent: ["oklch(0.7 0.18 300)", "oklch(0.55 0.16 330)"],
  },
];

export const products: Product[] = [
  {
    handle: "whey-protein",
    name: "Whey Protein",
    collection: "protein",
    tagline: "24g protein per serving",
    price: 34.99,
    servings: 40,
    size: "1kg",
    flavours: ["Chocolate", "Vanilla", "Strawberry", "Unflavoured"],
    informedSport: true,
    vegan: false,
    bestseller: true,
    benefits: [
      "24g of high-quality whey protein per serving",
      "Protein contributes to the growth and maintenance of muscle mass",
      "Informed-Sport tested for banned substances",
      "Mixes smoothly with water or milk",
    ],
    facts: [
      { label: "Protein", value: "24g" },
      { label: "BCAAs", value: "5.5g" },
      { label: "Calories", value: "120 kcal" },
      { label: "Sugar", value: "1.5g" },
    ],
    howToUse:
      "Add one 30g scoop to 250–300ml of water or milk and shake. Enjoy within 30 minutes of training or any time you need to top up your daily protein.",
    accent: ["oklch(0.83 0.19 134)", "oklch(0.5 0.15 150)"],
  },
  {
    handle: "vegan-protein",
    name: "Vegan Protein",
    collection: "protein",
    tagline: "22g plant protein per serving",
    price: 36.99,
    servings: 33,
    size: "1kg",
    flavours: ["Chocolate", "Vanilla", "Salted Caramel"],
    informedSport: true,
    vegan: true,
    bestseller: true,
    benefits: [
      "22g of pea and rice protein per serving",
      "100% plant-based and dairy-free",
      "Protein contributes to the maintenance of muscle mass",
      "Smooth texture, no chalky aftertaste",
    ],
    facts: [
      { label: "Protein", value: "22g" },
      { label: "Calories", value: "115 kcal" },
      { label: "Sugar", value: "0.9g" },
      { label: "Iron", value: "6mg" },
    ],
    howToUse:
      "Blend one 30g scoop with 300ml of your favourite plant milk or water. Ideal post-training or as a high-protein snack.",
    accent: ["oklch(0.78 0.16 150)", "oklch(0.5 0.13 165)"],
  },
  {
    handle: "creatine-monohydrate",
    name: "Creatine Monohydrate",
    collection: "creatine",
    tagline: "5g pure creatine per serving",
    price: 19.99,
    servings: 50,
    size: "250g",
    flavours: ["Unflavoured"],
    informedSport: true,
    vegan: true,
    bestseller: true,
    benefits: [
      "5g of pure creatine monohydrate per serving",
      "Creatine increases physical performance in successive bursts of short-term, high-intensity exercise",
      "Informed-Sport tested",
      "Micronised for easy mixing",
    ],
    facts: [
      { label: "Creatine", value: "5g" },
      { label: "Calories", value: "0 kcal" },
      { label: "Servings", value: "50" },
      { label: "Additives", value: "None" },
    ],
    howToUse:
      "Mix one 5g scoop into water, juice or your protein shake daily. A consistent daily dose is what matters most — take it any time that suits you.",
    accent: ["oklch(0.78 0.16 220)", "oklch(0.5 0.13 250)"],
  },
  {
    handle: "pre-workout",
    name: "Pre-Workout",
    collection: "pre-workout",
    tagline: "Transparent label, real doses",
    price: 27.99,
    servings: 30,
    size: "300g",
    flavours: ["Blue Raspberry", "Fruit Punch", "Citrus"],
    informedSport: true,
    vegan: true,
    benefits: [
      "Fully transparent label — no proprietary blends",
      "Caffeine, citrulline and beta-alanine in real doses",
      "Informed-Sport tested",
      "Crisp flavours that mix clear",
    ],
    facts: [
      { label: "Caffeine", value: "200mg" },
      { label: "Citrulline", value: "6g" },
      { label: "Beta-alanine", value: "3.2g" },
      { label: "Calories", value: "5 kcal" },
    ],
    howToUse:
      "Mix one scoop with 250ml of water 20–30 minutes before training. Start with half a scoop to assess tolerance. Not suitable for those sensitive to caffeine.",
    accent: ["oklch(0.8 0.18 40)", "oklch(0.58 0.2 25)"],
  },
  {
    handle: "caffeine-free-pre-workout",
    name: "Caffeine-Free Pre-Workout",
    collection: "pre-workout",
    tagline: "All the pump, none of the stim",
    price: 27.99,
    servings: 30,
    size: "300g",
    flavours: ["Watermelon", "Mojito"],
    informedSport: true,
    vegan: true,
    benefits: [
      "Stimulant-free — train any time of day",
      "Citrulline and beta-alanine for the pump",
      "Informed-Sport tested",
      "No jitters, no crash",
    ],
    facts: [
      { label: "Caffeine", value: "0mg" },
      { label: "Citrulline", value: "6g" },
      { label: "Beta-alanine", value: "3.2g" },
      { label: "Calories", value: "5 kcal" },
    ],
    howToUse:
      "Mix one scoop with 250ml of water 20–30 minutes before training. Perfect for evening sessions when you want focus without caffeine.",
    accent: ["oklch(0.82 0.15 160)", "oklch(0.58 0.14 175)"],
  },
  {
    handle: "electrolyte-hydration",
    name: "Electrolyte Hydration",
    collection: "recovery",
    tagline: "Replace what you sweat out",
    price: 21.99,
    servings: 30,
    size: "Tub of 30",
    flavours: ["Lemon & Lime", "Orange", "Berry"],
    informedSport: true,
    vegan: true,
    benefits: [
      "Sodium, potassium and magnesium in balanced amounts",
      "Supports hydration during longer or hotter sessions",
      "Light, refreshing flavours",
      "Low sugar",
    ],
    facts: [
      { label: "Sodium", value: "500mg" },
      { label: "Potassium", value: "300mg" },
      { label: "Magnesium", value: "60mg" },
      { label: "Sugar", value: "1g" },
    ],
    howToUse:
      "Stir one serving into 500ml of water before, during or after training, or any time you need to rehydrate.",
    accent: ["oklch(0.82 0.15 190)", "oklch(0.58 0.13 205)"],
  },
  {
    handle: "eaa-recovery",
    name: "EAA Recovery",
    collection: "recovery",
    tagline: "All nine essential amino acids",
    price: 29.99,
    servings: 30,
    size: "390g",
    flavours: ["Peach", "Apple", "Unflavoured"],
    informedSport: true,
    vegan: true,
    benefits: [
      "Full spectrum of essential amino acids",
      "Sip intra-workout or through the day",
      "Informed-Sport tested",
      "Refreshing, easy to drink",
    ],
    facts: [
      { label: "EAAs", value: "9g" },
      { label: "Leucine", value: "3g" },
      { label: "Calories", value: "10 kcal" },
      { label: "Sugar", value: "0g" },
    ],
    howToUse:
      "Mix one scoop with 400ml of water and sip during or between training sessions.",
    accent: ["oklch(0.8 0.13 210)", "oklch(0.56 0.12 225)"],
  },
  {
    handle: "starter-stack",
    name: "Starter Stack",
    collection: "bundles",
    tagline: "Whey + creatine, better together",
    price: 49.99,
    servings: 40,
    size: "Bundle",
    flavours: ["Mix & match"],
    informedSport: true,
    vegan: false,
    bestseller: true,
    benefits: [
      "Whey Protein (1kg) + Creatine Monohydrate (250g)",
      "The two essentials most lifters actually need",
      "Better price per serving than buying separately",
      "Both Informed-Sport tested",
    ],
    facts: [
      { label: "Protein", value: "24g/serving" },
      { label: "Creatine", value: "5g/serving" },
      { label: "Saving", value: "~€5" },
      { label: "Items", value: "2" },
    ],
    howToUse:
      "Use the whey post-training and take 5g of creatine daily. A simple, proven base for any training plan.",
    accent: ["oklch(0.7 0.18 300)", "oklch(0.52 0.16 330)"],
  },
];

const EURO = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

/** Subscribe & Save discount multiplier (15% off). */
export const SUBSCRIBE_DISCOUNT = 0.85;

export function formatPrice(value: number): string {
  return EURO.format(value);
}

/** Price per serving, formatted — the metric customers actually compare. */
export function pricePerServing(product: Product): string {
  return EURO.format(product.price / product.servings);
}

export function getCollection(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}

export function getProduct(handle: string): Product | undefined {
  return products.find((p) => p.handle === handle);
}

export function productsInCollection(slug: CollectionSlug): Product[] {
  return products.filter((p) => p.collection === slug);
}

export function bestsellers(): Product[] {
  return products.filter((p) => p.bestseller);
}

/** Suggested cross-sell: other products, prioritising a different collection. */
export function relatedProducts(product: Product, limit = 3): Product[] {
  return products
    .filter((p) => p.handle !== product.handle)
    .sort((a, b) => Number(b.bestseller ?? false) - Number(a.bestseller ?? false))
    .slice(0, limit);
}

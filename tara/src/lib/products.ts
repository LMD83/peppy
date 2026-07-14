// Seed catalogue — ported from the design handoff's
// `design-reference/Pricing Model.csv` (50 SKUs, undercutting the named
// competitor by ~17% on VAT-inclusive pricing). Matches the `products` table
// shape in the handoff's convex/schema.ts.
//
// Multi-strength products only had a single "from" price in the CSV (no
// real per-variant pricing) — larger variants below are priced by scaling
// the base price by the mg ratio, rounded to a .99 ending. This is a
// placeholder, not a quoted price; confirm real per-variant prices before
// going live.

export type Stock = "in" | "low" | "out";

export interface ProductVariant {
  label: string;
  priceCents: number;
}

export interface Product {
  slug: string;
  name: string;
  category: string;
  stock: Stock;
  /** Plain-English one-liner. */
  plain: string;
  /** CSS gradient for the placeholder card art. */
  accent: string;
  variants: ProductVariant[];
}

export const products: Product[] = [
  {
    slug: "3ml-acetic-acid-0-6",
    name: "3ml Acetic Acid (0.6%)",
    category: "Solvents & Lab Supplies",
    stock: "in",
    plain: "Reconstitution solvent",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [
      { label: "3ml", priceCents: 399 },
    ],
  },
  {
    slug: "5-amino-1mq",
    name: "5-Amino-1MQ",
    category: "Metabolic",
    stock: "in",
    plain: "NNMT inhibitor; from-price = 10mg",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 3299 },
      { label: "50mg", priceCents: 16499 },
    ],
  },
  {
    slug: "aod-9604",
    name: "AOD-9604",
    category: "Metabolic",
    stock: "in",
    plain: "Fat-metabolism fragment",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "5mg", priceCents: 3199 },
      { label: "10mg", priceCents: 6399 },
    ],
  },
  {
    slug: "ara-290",
    name: "ARA-290",
    category: "Regenerative / Neuro",
    stock: "out",
    plain: "Cibinetide; neuropathy research",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "10mg", priceCents: 4999 },
    ],
  },
  {
    slug: "bacteriostatic-water",
    name: "Bacteriostatic Water",
    category: "Solvents & Lab Supplies",
    stock: "in",
    plain: "Core consumable",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [
      { label: "varies", priceCents: 399 },
    ],
  },
  {
    slug: "bpc-157-tb-500-pre-mixed-cartridge",
    name: "BPC-157 + TB-500 Pre-Mixed Cartridge",
    category: "Blends & Cartridges",
    stock: "in",
    plain: "Convenience cartridge",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "10mg+10mg", priceCents: 7399 },
    ],
  },
  {
    slug: "bpc-157",
    name: "BPC-157",
    category: "Regenerative",
    stock: "in",
    plain: "Hero SKU; entry price",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "5mg", priceCents: 1999 },
      { label: "10mg", priceCents: 3999 },
    ],
  },
  {
    slug: "cagrilintide",
    name: "Cagrilintide",
    category: "Metabolic",
    stock: "in",
    plain: "Amylin analogue",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 7499 },
    ],
  },
  {
    slug: "cjc-1295-dac",
    name: "CJC-1295 DAC",
    category: "Growth / GHRH",
    stock: "out",
    plain: "Long-acting",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 4199 },
    ],
  },
  {
    slug: "cjc-1295-no-dac",
    name: "CJC-1295 no DAC",
    category: "Growth / GHRH",
    stock: "out",
    plain: "Mod GRF(1-29)",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 2499 },
    ],
  },
  {
    slug: "dsip",
    name: "DSIP",
    category: "Cognitive / Sleep",
    stock: "in",
    plain: "Delta sleep peptide",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "5mg", priceCents: 2399 },
      { label: "10mg", priceCents: 4799 },
    ],
  },
  {
    slug: "epitalon",
    name: "Epitalon",
    category: "Longevity",
    stock: "in",
    plain: "Telomerase research",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "10mg", priceCents: 2199 },
      { label: "50mg", priceCents: 10999 },
    ],
  },
  {
    slug: "follistatin-344",
    name: "Follistatin 344",
    category: "Regenerative",
    stock: "out",
    plain: "Premium; myostatin",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "1mg", priceCents: 9099 },
    ],
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    category: "Regenerative / Cosmetic",
    stock: "in",
    plain: "Copper tripeptide",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "50mg", priceCents: 2899 },
      { label: "100mg", priceCents: 5799 },
    ],
  },
  {
    slug: "glow-pre-filled-cartridge",
    name: "GLOW Pre-Filled Cartridge",
    category: "Blends & Cartridges",
    stock: "out",
    plain: "GHK+BPC+TB500 cartridge",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "70mg", priceCents: 8199 },
    ],
  },
  {
    slug: "glow-blend",
    name: "GLOW Blend",
    category: "Blends & Cartridges",
    stock: "out",
    plain: "Skin/recovery stack",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "70mg", priceCents: 7499 },
    ],
  },
  {
    slug: "glutathione",
    name: "Glutathione",
    category: "Antioxidant",
    stock: "out",
    plain: "Master antioxidant",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "1500mg", priceCents: 3299 },
    ],
  },
  {
    slug: "igf-1-lr3",
    name: "IGF-1 LR3",
    category: "Growth",
    stock: "out",
    plain: "Growth factor",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "1mg", priceCents: 6599 },
    ],
  },
  {
    slug: "ipamorelin-cjc-1295-no-dac-blend",
    name: "Ipamorelin + CJC-1295 no DAC Blend",
    category: "Growth / GHRH",
    stock: "out",
    plain: "Popular GH stack",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "10mg", priceCents: 4699 },
    ],
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    category: "Growth / GHRH",
    stock: "in",
    plain: "Selective secretagogue",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 2199 },
      { label: "10mg", priceCents: 4399 },
    ],
  },
  {
    slug: "kisspeptin-10",
    name: "Kisspeptin-10",
    category: "Hormone",
    stock: "out",
    plain: "Reproductive axis",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 4799 },
    ],
  },
  {
    slug: "klow-pre-mixed-cartridge",
    name: "KLOW Pre-Mixed Cartridge",
    category: "Blends & Cartridges",
    stock: "out",
    plain: "Out of stock",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "80mg", priceCents: 10599 },
    ],
  },
  {
    slug: "klow-blend",
    name: "KLOW Blend",
    category: "Blends & Cartridges",
    stock: "out",
    plain: "GHK+KPV+BPC+TB500",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "80mg", priceCents: 9899 },
    ],
  },
  {
    slug: "klow-reusable-pen",
    name: "KLOW Reusable Pen",
    category: "Blends & Cartridges",
    stock: "out",
    plain: "Pen device incl.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "80mg", priceCents: 12799 },
    ],
  },
  {
    slug: "kpv",
    name: "KPV",
    category: "Anti-inflammatory",
    stock: "out",
    plain: "Alpha-MSH fragment",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "10mg", priceCents: 3299 },
    ],
  },
  {
    slug: "l-carnitine",
    name: "L-Carnitine",
    category: "Metabolic",
    stock: "out",
    plain: "Fat-transport",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "6000mg", priceCents: 2899 },
    ],
  },
  {
    slug: "ll-37",
    name: "LL-37",
    category: "Antimicrobial",
    stock: "out",
    plain: "Cathelicidin",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "5mg", priceCents: 3899 },
    ],
  },
  {
    slug: "mots-c",
    name: "MOTS-c",
    category: "Metabolic",
    stock: "in",
    plain: "Mitochondrial peptide",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 2999 },
      { label: "40mg", priceCents: 11999 },
    ],
  },
  {
    slug: "melanotan-1-mt-1",
    name: "Melanotan 1 (MT-1)",
    category: "Melanocortin",
    stock: "out",
    plain: "Tanning research",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "10mg", priceCents: 2699 },
    ],
  },
  {
    slug: "melanotan-2-mt-2",
    name: "Melanotan 2 (MT-2)",
    category: "Melanocortin",
    stock: "out",
    plain: "Tanning research",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "10mg", priceCents: 2399 },
    ],
  },
  {
    slug: "nad",
    name: "NAD+",
    category: "Longevity",
    stock: "in",
    plain: "Cellular energy",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "500mg", priceCents: 5799 },
      { label: "1000mg", priceCents: 11599 },
    ],
  },
  {
    slug: "peg-mgf",
    name: "PEG-MGF",
    category: "Growth",
    stock: "out",
    plain: "Mechano growth factor",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "2mg", priceCents: 2799 },
    ],
  },
  {
    slug: "pt-141-bremelanotide",
    name: "PT-141 (Bremelanotide)",
    category: "Sexual Health",
    stock: "out",
    plain: "Libido research",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 2299 },
    ],
  },
  {
    slug: "retatrutide",
    name: "Retatrutide",
    category: "Metabolic / GLP",
    stock: "in",
    plain: "Triple agonist; top demand",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10", priceCents: 9099 },
      { label: "20", priceCents: 9099 },
      { label: "30", priceCents: 9099 },
      { label: "40", priceCents: 9099 },
      { label: "60mg", priceCents: 9099 },
    ],
  },
  {
    slug: "retatrutide-pre-mixed-cartridge",
    name: "Retatrutide Pre-Mixed Cartridge",
    category: "Metabolic / GLP",
    stock: "in",
    plain: "Cartridge format",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10", priceCents: 9699 },
      { label: "20", priceCents: 9699 },
      { label: "30", priceCents: 9699 },
      { label: "60mg", priceCents: 9699 },
    ],
  },
  {
    slug: "retatrutide-reusable-pen",
    name: "Retatrutide Reusable Pen",
    category: "Metabolic / GLP",
    stock: "in",
    plain: "Pen device incl.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "varies", priceCents: 15499 },
    ],
  },
  {
    slug: "selank",
    name: "Selank",
    category: "Cognitive",
    stock: "out",
    plain: "Anxiolytic research",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "10mg", priceCents: 2799 },
    ],
  },
  {
    slug: "semax",
    name: "Semax",
    category: "Cognitive",
    stock: "out",
    plain: "Nootropic",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "10mg", priceCents: 3099 },
    ],
  },
  {
    slug: "sermorelin",
    name: "Sermorelin",
    category: "Growth / GHRH",
    stock: "out",
    plain: "GRF(1-29)",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 3299 },
    ],
  },
  {
    slug: "slu-pp-322",
    name: "SLU-PP-322",
    category: "Metabolic",
    stock: "out",
    plain: "Exercise-mimetic",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "60x250mcg", priceCents: 6999 },
    ],
  },
  {
    slug: "slu-pp-332",
    name: "SLU-PP-332",
    category: "Metabolic",
    stock: "out",
    plain: "Exercise-mimetic",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "-", priceCents: 6199 },
    ],
  },
  {
    slug: "ss-31-elamipretide",
    name: "SS-31 (Elamipretide)",
    category: "Antioxidant / Mito",
    stock: "out",
    plain: "Mitochondrial",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "10mg", priceCents: 3299 },
      { label: "50mg", priceCents: 11599 },
    ],
  },
  {
    slug: "syringes-20-pack",
    name: "Syringes 20-pack",
    category: "Solvents & Lab Supplies",
    stock: "out",
    plain: "Consumable",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [
      { label: "20pk", priceCents: 899 },
    ],
  },
  {
    slug: "syringes-40-pack",
    name: "Syringes 40-pack",
    category: "Solvents & Lab Supplies",
    stock: "out",
    plain: "Consumable",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [
      { label: "40pk", priceCents: 1599 },
    ],
  },
  {
    slug: "tb-500",
    name: "TB-500",
    category: "Regenerative",
    stock: "out",
    plain: "Thymosin b4",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "10mg", priceCents: 3299 },
    ],
  },
  {
    slug: "tesamorelin-reusable-pen",
    name: "Tesamorelin Reusable Pen",
    category: "Growth / GHRH",
    stock: "in",
    plain: "Pen device incl.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "20mg", priceCents: 14899 },
      { label: "30mg", priceCents: 22299 },
    ],
  },
  {
    slug: "tesamorelin",
    name: "Tesamorelin",
    category: "Growth / GHRH",
    stock: "in",
    plain: "GHRH analogue",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 3199 },
      { label: "10mg", priceCents: 6399 },
    ],
  },
  {
    slug: "tirzepatide",
    name: "Tirzepatide",
    category: "Metabolic / GLP",
    stock: "in",
    plain: "Dual agonist; top demand",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "20", priceCents: 11199 },
      { label: "40", priceCents: 11199 },
      { label: "50", priceCents: 11199 },
      { label: "60mg", priceCents: 11199 },
    ],
  },
  {
    slug: "vip",
    name: "VIP",
    category: "Neuro",
    stock: "out",
    plain: "Vasoactive intestinal peptide",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "5mg", priceCents: 3599 },
    ],
  },
  {
    slug: "wolverine-blend-bpc-tb-500",
    name: "Wolverine Blend (BPC+TB-500)",
    category: "Blends & Cartridges",
    stock: "in",
    plain: "Recovery stack",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "10mg", priceCents: 3999 },
      { label: "20mg", priceCents: 7999 },
    ],
  },
];

export const categories: string[] = Array.from(new Set(products.map((p) => p.category))).sort();

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function fromPriceCents(p: Product): number {
  return Math.min(...p.variants.map((v) => v.priceCents));
}

export function searchProducts(query: string, limit = 8): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit);
}

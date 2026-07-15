// Seed catalogue — ported from the design handoff's
// `design-reference/Pricing Model.csv` (50 SKUs, undercutting the named
// competitor by ~17% on VAT-inclusive pricing). Matches the `products` table
// shape in the handoff's convex/schema.ts.
//
// `category` groups compounds by research topic in plain English (see
// docs/CATEGORIES.md for how each group was chosen) rather than by
// mechanism-of-action jargon — e.g. "Weight & Metabolism" instead of
// "Metabolic / GLP". `kind` separates the 4 lab-consumable SKUs (diluent,
// syringes) from the 46 actual research compounds; the catalogue renders
// them as a distinct section, never mixed into a compound group. `plain`
// is a single research-framed sentence per docs/COMPLIANCE.md — "studied
// for X," never "does X for you."
//
// Multi-strength products only had a single "from" price in the CSV (no
// real per-variant pricing) — larger variants below are priced by scaling
// the base price by the mg ratio, rounded to a .99 ending. This is a
// placeholder, not a quoted price; confirm real per-variant prices before
// going live.

export type Stock = "in" | "low" | "out";
export type ProductKind = "compound" | "supply";

export interface ProductVariant {
  label: string;
  priceCents: number;
}

export interface Product {
  slug: string;
  name: string;
  category: string;
  kind: ProductKind;
  stock: Stock;
  /** Plain-English one-liner — what it's studied for, not what it does for you. */
  plain: string;
  /** CSS gradient for the placeholder card art. */
  accent: string;
  variants: ProductVariant[];
}

// Compound research groups, in the order they render on the catalogue.
// "Supplies" isn't in this list — it's a separate section, not a group a
// compound can belong to.
export const CATEGORY_ORDER: string[] = [
  "Weight & Metabolism",
  "Recovery & Tissue Repair",
  "Growth Hormone Peptides",
  "Longevity & Cellular Health",
  "Mind & Sleep",
  "Skin & Hair",
  "Hormone & Sexual Health",
  "Immune & Gut Health",
];

export const SUPPLIES_CATEGORY = "Lab Supplies";

export const products: Product[] = [
  {
    slug: "3ml-acetic-acid-0-6",
    name: "3ml Acetic Acid (0.6%)",
    category: SUPPLIES_CATEGORY,
    kind: "supply",
    stock: "in",
    plain: "A mild acidic diluent for peptides that dissolve poorly in bacteriostatic water.",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [{ label: "3ml", priceCents: 399 }],
  },
  {
    slug: "5-amino-1mq",
    name: "5-Amino-1MQ",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A small molecule (NNMT inhibitor) studied for its effect on cellular energy metabolism and fat-cell activity.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 3299 },
      { label: "50mg", priceCents: 16499 },
    ],
  },
  {
    slug: "aod-9604",
    name: "AOD-9604",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A modified growth-hormone fragment studied for fat metabolism without affecting blood sugar.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "5mg", priceCents: 3199 },
      { label: "10mg", priceCents: 6399 },
    ],
  },
  {
    slug: "ara-290",
    name: "ARA-290",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "out",
    plain: "An EPO-derived peptide studied for nerve repair and neuropathic-pain research.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [{ label: "10mg", priceCents: 4999 }],
  },
  {
    slug: "bacteriostatic-water",
    name: "Bacteriostatic Water",
    category: SUPPLIES_CATEGORY,
    kind: "supply",
    stock: "in",
    plain: "Sterile water with benzyl alcohol — the standard diluent for reconstituting lyophilised peptides.",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [{ label: "varies", priceCents: 399 }],
  },
  {
    slug: "bpc-157-tb-500-pre-mixed-cartridge",
    name: "BPC-157 + TB-500 Pre-Mixed Cartridge",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "in",
    plain: "BPC-157 and TB-500 co-formulated in one cartridge for tendon, gut and soft-tissue repair research.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "10mg+10mg", priceCents: 7399 }],
  },
  {
    slug: "bpc-157",
    name: "BPC-157",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "in",
    plain: "A stable gastric peptide widely studied for tendon, gut and soft-tissue healing.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "5mg", priceCents: 1999 },
      { label: "10mg", priceCents: 3999 },
    ],
  },
  {
    slug: "cagrilintide",
    name: "Cagrilintide",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A long-acting amylin analogue studied for appetite regulation and satiety.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "10mg", priceCents: 7499 }],
  },
  {
    slug: "cjc-1295-dac",
    name: "CJC-1295 DAC",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "out",
    plain: "A long-acting GHRH analogue whose DAC tail extends growth-hormone elevation for days per dose.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [{ label: "5mg", priceCents: 4199 }],
  },
  {
    slug: "cjc-1295-no-dac",
    name: "CJC-1295 no DAC",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "out",
    plain: "A short-acting GHRH analogue (Mod GRF 1-29) studied for a clean, fast growth-hormone pulse.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [{ label: "5mg", priceCents: 2499 }],
  },
  {
    slug: "dsip",
    name: "DSIP",
    category: "Mind & Sleep",
    kind: "compound",
    stock: "in",
    plain: "Delta-sleep-inducing peptide, studied for its relationship to sleep architecture and stress-hormone balance.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "5mg", priceCents: 2399 },
      { label: "10mg", priceCents: 4799 },
    ],
  },
  {
    slug: "epitalon",
    name: "Epitalon",
    category: "Longevity & Cellular Health",
    kind: "compound",
    stock: "in",
    plain: "A tetrapeptide studied for its relationship to telomerase activity and cellular-ageing research.",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "10mg", priceCents: 2199 },
      { label: "50mg", priceCents: 10999 },
    ],
  },
  {
    slug: "follistatin-344",
    name: "Follistatin 344",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "out",
    plain: "A protein that binds myostatin, studied for its role in muscle-mass regulation.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [{ label: "1mg", priceCents: 9099 }],
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    category: "Skin & Hair",
    kind: "compound",
    stock: "in",
    plain: "A copper-binding tripeptide studied in skin and connective-tissue research.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [
      { label: "50mg", priceCents: 2899 },
      { label: "100mg", priceCents: 5799 },
    ],
  },
  {
    slug: "glow-pre-filled-cartridge",
    name: "GLOW Pre-Filled Cartridge",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "GHK-Cu, BPC-157 and TB-500 combined in a pre-filled cartridge — a skin and tissue-recovery research blend.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "70mg", priceCents: 8199 }],
  },
  {
    slug: "glow-blend",
    name: "GLOW Blend",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "GHK-Cu, BPC-157 and TB-500 combined — a skin and tissue-recovery research blend.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "70mg", priceCents: 7499 }],
  },
  {
    slug: "glutathione",
    name: "Glutathione",
    category: "Longevity & Cellular Health",
    kind: "compound",
    stock: "out",
    plain: "The body's principal antioxidant, studied for its role in cellular detoxification pathways.",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [{ label: "1500mg", priceCents: 3299 }],
  },
  {
    slug: "igf-1-lr3",
    name: "IGF-1 LR3",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "out",
    plain: "A long-acting form of insulin-like growth factor-1 studied for muscle-cell growth and repair.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [{ label: "1mg", priceCents: 6599 }],
  },
  {
    slug: "ipamorelin-cjc-1295-no-dac-blend",
    name: "Ipamorelin + CJC-1295 no DAC Blend",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "out",
    plain: "CJC-1295 (no DAC) and Ipamorelin pre-mixed — the definitive GHRH + GHRP growth-hormone research pairing.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [{ label: "10mg", priceCents: 4699 }],
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "in",
    plain: "A selective growth-hormone secretagogue studied for prompting a GH pulse with minimal effect on hunger or cortisol.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 2199 },
      { label: "10mg", priceCents: 4399 },
    ],
  },
  {
    slug: "kisspeptin-10",
    name: "Kisspeptin-10",
    category: "Hormone & Sexual Health",
    kind: "compound",
    stock: "out",
    plain: "A signalling peptide studied for its role in reproductive-hormone release.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "10mg", priceCents: 4799 }],
  },
  {
    slug: "klow-pre-mixed-cartridge",
    name: "KLOW Pre-Mixed Cartridge",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "GHK-Cu, KPV, BPC-157 and TB-500 combined in a pre-mixed cartridge — a four-peptide skin and gut-recovery research blend.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "80mg", priceCents: 10599 }],
  },
  {
    slug: "klow-blend",
    name: "KLOW Blend",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "GHK-Cu, KPV, BPC-157 and TB-500 combined — a four-peptide skin and gut-recovery research blend.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "80mg", priceCents: 9899 }],
  },
  {
    slug: "klow-reusable-pen",
    name: "KLOW Reusable Pen",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "GHK-Cu, KPV, BPC-157 and TB-500 combined, supplied with a reusable pen device.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "80mg", priceCents: 12799 }],
  },
  {
    slug: "kpv",
    name: "KPV",
    category: "Immune & Gut Health",
    kind: "compound",
    stock: "out",
    plain: "A short alpha-MSH fragment studied for its role in gut-inflammation research.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [{ label: "10mg", priceCents: 3299 }],
  },
  {
    slug: "l-carnitine",
    name: "L-Carnitine",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "out",
    plain: "An amino-acid derivative studied for its role transporting fatty acids into cellular energy pathways.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "6000mg", priceCents: 2899 }],
  },
  {
    slug: "ll-37",
    name: "LL-37",
    category: "Immune & Gut Health",
    kind: "compound",
    stock: "out",
    plain: "A naturally occurring antimicrobial peptide studied for wound defence and immune-response research.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [{ label: "5mg", priceCents: 3899 }],
  },
  {
    slug: "mots-c",
    name: "MOTS-c",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A mitochondrial-derived peptide studied for exercise capacity and insulin sensitivity.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [
      { label: "10mg", priceCents: 2999 },
      { label: "40mg", priceCents: 11999 },
    ],
  },
  {
    slug: "melanotan-1-mt-1",
    name: "Melanotan 1 (MT-1)",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "A melanocortin peptide studied for skin-pigmentation research, with a milder profile than MT-2.",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [{ label: "10mg", priceCents: 2699 }],
  },
  {
    slug: "melanotan-2-mt-2",
    name: "Melanotan 2 (MT-2)",
    category: "Skin & Hair",
    kind: "compound",
    stock: "out",
    plain: "A melanocortin receptor agonist studied for skin-pigmentation and libido research.",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [{ label: "10mg", priceCents: 2399 }],
  },
  {
    slug: "nad",
    name: "NAD+",
    category: "Longevity & Cellular Health",
    kind: "compound",
    stock: "in",
    plain: "A coenzyme central to cellular energy production, studied in cellular-repair and ageing research.",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "500mg", priceCents: 5799 },
      { label: "1000mg", priceCents: 11599 },
    ],
  },
  {
    slug: "peg-mgf",
    name: "PEG-MGF",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "out",
    plain: "A pegylated mechano-growth factor studied for muscle repair following mechanical stress.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [{ label: "2mg", priceCents: 2799 }],
  },
  {
    slug: "pt-141-bremelanotide",
    name: "PT-141 (Bremelanotide)",
    category: "Hormone & Sexual Health",
    kind: "compound",
    stock: "out",
    plain: "A melanocortin peptide studied in sexual-arousal research.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "10mg", priceCents: 2299 }],
  },
  {
    slug: "retatrutide",
    name: "Retatrutide",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A triple GLP-1/GIP/glucagon receptor agonist studied for weight and metabolic outcomes — the most in-demand metabolic research compound.",
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
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A triple GLP-1/GIP/glucagon receptor agonist studied for weight and metabolic outcomes, supplied in a pre-mixed cartridge.",
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
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A triple GLP-1/GIP/glucagon receptor agonist studied for weight and metabolic outcomes, supplied with a reusable pen device.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "varies", priceCents: 15499 }],
  },
  {
    slug: "selank",
    name: "Selank",
    category: "Mind & Sleep",
    kind: "compound",
    stock: "out",
    plain: "A peptide studied in anxiolytic and cognitive-clarity research.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "10mg", priceCents: 2799 }],
  },
  {
    slug: "semax",
    name: "Semax",
    category: "Mind & Sleep",
    kind: "compound",
    stock: "out",
    plain: "A peptide studied for its relationship to focus, memory and neuroprotection research.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "10mg", priceCents: 3099 }],
  },
  {
    slug: "sermorelin",
    name: "Sermorelin",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "out",
    plain: "A shorter GHRH fragment studied for natural growth-hormone release and sleep-quality research.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [{ label: "5mg", priceCents: 3299 }],
  },
  {
    slug: "slu-pp-322",
    name: "SLU-PP-322",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "out",
    plain: "An experimental PPAR-delta/ERR agonist studied as an exercise-mimetic for metabolic research.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "60x250mcg", priceCents: 6999 }],
  },
  {
    slug: "slu-pp-332",
    name: "SLU-PP-332",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "out",
    plain: "A next-generation exercise-mimetic compound studied alongside SLU-PP-322 for metabolic research.",
    accent: "linear-gradient(145deg,#1565C0,#0d3f73)",
    variants: [{ label: "-", priceCents: 6199 }],
  },
  {
    slug: "ss-31-elamipretide",
    name: "SS-31 (Elamipretide)",
    category: "Longevity & Cellular Health",
    kind: "compound",
    stock: "out",
    plain: "A mitochondria-targeted peptide studied for its role in protecting cellular energy production.",
    accent: "linear-gradient(145deg,#B87333,#6b4319)",
    variants: [
      { label: "10mg", priceCents: 3299 },
      { label: "50mg", priceCents: 11599 },
    ],
  },
  {
    slug: "syringes-20-pack",
    name: "Syringes 20-pack",
    category: SUPPLIES_CATEGORY,
    kind: "supply",
    stock: "out",
    plain: "U-100 insulin syringes for accurately measuring reconstituted material.",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [{ label: "20pk", priceCents: 899 }],
  },
  {
    slug: "syringes-40-pack",
    name: "Syringes 40-pack",
    category: SUPPLIES_CATEGORY,
    kind: "supply",
    stock: "out",
    plain: "U-100 insulin syringes for accurately measuring reconstituted material.",
    accent: "linear-gradient(145deg,#55606E,#2e343b)",
    variants: [{ label: "40pk", priceCents: 1599 }],
  },
  {
    slug: "tb-500",
    name: "TB-500",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "out",
    plain: "A thymosin β4 fragment studied for cell migration, flexibility and wound-repair research.",
    accent: "linear-gradient(145deg,#1B5E20,#0f3512)",
    variants: [{ label: "10mg", priceCents: 3299 }],
  },
  {
    slug: "tesamorelin-reusable-pen",
    name: "Tesamorelin Reusable Pen",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "in",
    plain: "A GHRH analogue studied in relation to visceral fat and body-composition research, supplied with a reusable pen device.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "20mg", priceCents: 14899 },
      { label: "30mg", priceCents: 22299 },
    ],
  },
  {
    slug: "tesamorelin",
    name: "Tesamorelin",
    category: "Growth Hormone Peptides",
    kind: "compound",
    stock: "in",
    plain: "A growth-hormone-releasing hormone (GHRH) analogue studied in relation to visceral fat and body-composition research.",
    accent: "linear-gradient(145deg,#009B72,#065c43)",
    variants: [
      { label: "5mg", priceCents: 3199 },
      { label: "10mg", priceCents: 6399 },
    ],
  },
  {
    slug: "tirzepatide",
    name: "Tirzepatide",
    category: "Weight & Metabolism",
    kind: "compound",
    stock: "in",
    plain: "A dual GLP-1/GIP receptor agonist studied for blood-sugar regulation and weight-related outcomes.",
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
    category: "Immune & Gut Health",
    kind: "compound",
    stock: "out",
    plain: "Vasoactive intestinal peptide, studied for its role in immune balance and airway-inflammation research.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [{ label: "5mg", priceCents: 3599 }],
  },
  {
    slug: "wolverine-blend-bpc-tb-500",
    name: "Wolverine Blend (BPC+TB-500)",
    category: "Recovery & Tissue Repair",
    kind: "compound",
    stock: "in",
    plain: "BPC-157 and TB-500 co-formulated in one vial — the most-studied recovery pairing in peptide research.",
    accent: "linear-gradient(145deg,#6A1B9A,#3d0f59)",
    variants: [
      { label: "10mg", priceCents: 3999 },
      { label: "20mg", priceCents: 7999 },
    ],
  },
];

/** Compound research groups actually present in the catalogue, in display order. */
export const categories: string[] = CATEGORY_ORDER.filter((c) =>
  products.some((p) => p.category === c && p.kind === "compound")
);

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function fromPriceCents(p: Product): number {
  return Math.min(...p.variants.map((v) => v.priceCents));
}

// Compound-only — its one caller is the reconstitution calculator's search,
// where a diluent or syringe pack has no vial size to load.
export function searchProducts(query: string, limit = 8): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products
    .filter((p) => p.kind === "compound" && p.name.toLowerCase().includes(q))
    .slice(0, limit);
}

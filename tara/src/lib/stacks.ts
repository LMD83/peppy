import { getProductById, fromPriceCents, type Product } from "@/lib/products";

export interface StackDef {
  key: string;
  name: string;
  tag: string;
  note: string;
  accent: string;
  ids: string[];
}

// Bundle definitions — the "Stack library." Bundle price is ~8% off the sum
// of each item's cheapest variant (ported from the design reference).
export const stackDefs: StackDef[] = [
  {
    key: "recovery",
    name: "The Recovery Stack",
    tag: "MOST POPULAR",
    note: "BPC-157 for local repair, TB-500 for systemic recovery — the definitive injury-research pair.",
    accent: "linear-gradient(90deg,#1565C0,#009B72)",
    ids: ["bpc157", "tb500"],
  },
  {
    key: "growth",
    name: "The Growth Stack",
    tag: "GH AXIS",
    note: "A GHRH sets the level while the GHRP adds the pulse — the most-studied growth combination.",
    accent: "linear-gradient(90deg,#1B5E20,#1565C0)",
    ids: ["cjc1295nodac", "ipamorelin"],
  },
  {
    key: "gutskin",
    name: "The Gut & Skin Stack",
    tag: "WELLNESS",
    note: "Gut-calming and antioxidant peptides researched together for skin and digestive work.",
    accent: "linear-gradient(90deg,#B87333,#6A1B9A)",
    ids: ["bpc157", "kpv", "glutathione"],
  },
  {
    key: "longevity",
    name: "The Longevity Stack",
    tag: "CELLULAR",
    note: "Telomere and cellular-energy research combined in one protocol.",
    accent: "linear-gradient(90deg,#6A1B9A,#1565C0)",
    ids: ["epithalon", "nadplus"],
  },
  {
    key: "focus",
    name: "The Focus Stack",
    tag: "COGNITION",
    note: "Clear thinking plus calm — the classic nootropic pairing.",
    accent: "linear-gradient(90deg,#1565C0,#6A1B9A)",
    ids: ["semax", "selank"],
  },
  {
    key: "metabolic",
    name: "The Metabolic Stack",
    tag: "ADVANCED",
    note: "A triple-agonist GLP-1 with an amylin analogue for appetite-regulation research.",
    accent: "linear-gradient(90deg,#1B5E20,#009B72)",
    ids: ["retatrutide", "cagrilintide"],
  },
];

export interface Stack extends StackDef {
  items: Product[];
  rawCents: number;
  bundleCents: number;
  saveCents: number;
}

export function getStacks(): Stack[] {
  return stackDefs.map((def) => {
    const items = def.ids.map(getProductById).filter((p): p is Product => Boolean(p));
    const rawCents = items.reduce((n, p) => n + fromPriceCents(p), 0);
    const bundleCents = Math.round(rawCents * 0.92);
    return { ...def, items, rawCents, bundleCents, saveCents: rawCents - bundleCents };
  });
}

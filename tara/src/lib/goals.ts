// Goal-based discovery data — the July 2026 update's "Guided finder." Slugs
// map into src/lib/products.ts; a couple of design-reference ids (e.g.
// "ghrhstack") don't have an exact match here and are mapped to the closest
// existing blend.

export interface Goal {
  key: string;
  label: string;
  blurb: string;
  slugs: string[];
}

export const goals: Goal[] = [
  {
    key: "recovery",
    label: "Recovery & repair",
    blurb: "Tendon, gut and soft-tissue research.",
    slugs: ["bpc-157", "tb-500", "wolverine-blend-bpc-tb-500", "kpv"],
  },
  {
    key: "fatloss",
    label: "Fat loss & metabolic",
    blurb: "GLP-1 and metabolic compounds.",
    slugs: ["retatrutide", "tirzepatide", "cagrilintide", "aod-9604"],
  },
  {
    key: "growth",
    label: "Growth & performance",
    blurb: "GHRH + secretagogue research.",
    slugs: ["cjc-1295-no-dac", "ipamorelin", "ipamorelin-cjc-1295-no-dac-blend", "tesamorelin"],
  },
  {
    key: "longevity",
    label: "Longevity & cellular",
    blurb: "Telomere, NAD+ and mitochondrial work.",
    slugs: ["epitalon", "nad", "mots-c", "ss-31-elamipretide"],
  },
  {
    key: "cognition",
    label: "Focus & mood",
    blurb: "Nootropic and sleep peptides.",
    slugs: ["semax", "selank", "dsip"],
  },
  {
    key: "skin",
    label: "Skin & hair",
    blurb: "Cosmetic and cellular-repair peptides.",
    slugs: ["glow-blend", "klow-blend", "glutathione", "melanotan-1-mt-1"],
  },
];

export function getGoal(key: string): Goal | undefined {
  return goals.find((g) => g.key === key);
}

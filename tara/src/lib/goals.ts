// Goal-based discovery — the "Guided finder." References products by their
// design-reference id (resolve with getProductById).

export interface Goal {
  key: string;
  label: string;
  blurb: string;
  ids: string[];
}

export const goals: Goal[] = [
  {
    key: "recovery",
    label: "Recovery & repair",
    blurb: "Tendon, gut and soft-tissue research.",
    ids: ["bpc157", "tb500", "wolverine", "kpv"],
  },
  {
    key: "fatloss",
    label: "Fat loss & metabolic",
    blurb: "GLP-1 and metabolic compounds.",
    ids: ["retatrutide", "tirzepatide", "cagrilintide", "aod9604"],
  },
  {
    key: "growth",
    label: "Growth & performance",
    blurb: "GHRH + secretagogue research.",
    ids: ["cjc1295nodac", "ipamorelin", "ghrhstack", "tesamorelin"],
  },
  {
    key: "longevity",
    label: "Longevity & cellular",
    blurb: "Telomere, NAD+ and mitochondrial work.",
    ids: ["epithalon", "nadplus", "motsc", "ss31"],
  },
  {
    key: "cognition",
    label: "Focus & mood",
    blurb: "Nootropic and sleep peptides.",
    ids: ["semax", "selank", "dsip"],
  },
  {
    key: "skin",
    label: "Skin & hair",
    blurb: "Cosmetic and cellular-repair peptides.",
    ids: ["glowblend", "klowblend", "glutathione", "mt1"],
  },
];

export function getGoal(key: string): Goal | undefined {
  return goals.find((g) => g.key === key);
}

// Reference data for the reconstitution calculator. Descriptions are
// intentionally neutral, solution-preparation language — "for laboratory
// research use," never dosing or self-administration instructions. See
// docs/COMPLIANCE.md for why that framing matters.

export type PeptideCategory =
  | "Healing & Recovery"
  | "Growth Hormone Secretagogue"
  | "Metabolic"
  | "Cognitive"
  | "Longevity"
  | "Skin & Tissue"
  | "Immune"
  | "Growth Factor"
  | "Reproductive Research";

export interface Peptide {
  id: string;
  name: string;
  aliases: string[];
  category: PeptideCategory;
  /** Typical vial strength sold, in mg. */
  vialMg: number;
  /** One-line, research-framed description — no usage/dosing claims. */
  summary: string;
  storage: string;
  /** Mock catalogue price in EUR, for the pricing demo. */
  price: number;
}

export const peptides: Peptide[] = [
  {
    id: "bpc-157",
    name: "BPC-157",
    aliases: ["Body Protection Compound-157", "PL 14736"],
    category: "Healing & Recovery",
    vialMg: 5,
    summary: "A pentadecapeptide studied for its role in tissue-repair research models.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–3 weeks.",
    price: 34.99,
  },
  {
    id: "tb-500",
    name: "TB-500",
    aliases: ["Thymosin Beta-4", "TB4"],
    category: "Healing & Recovery",
    vialMg: 5,
    summary: "A synthetic fragment of Thymosin Beta-4, studied in soft-tissue research models.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–3 weeks.",
    price: 39.99,
  },
  {
    id: "cjc-1295-no-dac",
    name: "CJC-1295 (no DAC)",
    aliases: ["Mod GRF 1-29"],
    category: "Growth Hormone Secretagogue",
    vialMg: 5,
    summary: "A GHRH analogue studied for pulsatile growth-hormone secretion research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 32.99,
  },
  {
    id: "ipamorelin",
    name: "Ipamorelin",
    aliases: [],
    category: "Growth Hormone Secretagogue",
    vialMg: 5,
    summary: "A selective GH secretagogue studied for its low impact on cortisol and prolactin.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 29.99,
  },
  {
    id: "cjc-ipa-blend",
    name: "CJC-1295 / Ipamorelin Blend",
    aliases: ["CJC/IPA"],
    category: "Growth Hormone Secretagogue",
    vialMg: 10,
    summary: "A combined GHRH/GHRP research blend, dosed together in stacked protocols.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 44.99,
  },
  {
    id: "sermorelin",
    name: "Sermorelin",
    aliases: ["GRF 1-29"],
    category: "Growth Hormone Secretagogue",
    vialMg: 5,
    summary: "A GHRH fragment, one of the earliest-studied growth-hormone secretagogues.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 27.99,
  },
  {
    id: "tesamorelin",
    name: "Tesamorelin",
    aliases: [],
    category: "Growth Hormone Secretagogue",
    vialMg: 5,
    summary: "A stabilized GHRH analogue studied in visceral-fat and metabolic research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2 weeks.",
    price: 46.99,
  },
  {
    id: "ghk-cu",
    name: "GHK-Cu",
    aliases: ["Copper Peptide"],
    category: "Skin & Tissue",
    vialMg: 50,
    summary: "A copper-binding tripeptide studied for tissue-remodeling and dermal research.",
    storage: "Lyophilized: refrigerate 2–8°C, protect from light. Reconstituted: refrigerate, use within 2 weeks.",
    price: 28.99,
  },
  {
    id: "melanotan-2",
    name: "Melanotan II",
    aliases: ["MT-2"],
    category: "Skin & Tissue",
    vialMg: 10,
    summary: "A melanocortin analogue studied in pigmentation-pathway research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 24.99,
  },
  {
    id: "pt-141",
    name: "PT-141",
    aliases: ["Bremelanotide"],
    category: "Reproductive Research",
    vialMg: 10,
    summary: "A melanocortin-receptor agonist studied in central nervous system research models.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 33.99,
  },
  {
    id: "semaglutide",
    name: "Semaglutide",
    aliases: [],
    category: "Metabolic",
    vialMg: 5,
    summary: "A GLP-1 receptor agonist, widely studied in metabolic and appetite-regulation research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 4 weeks.",
    price: 54.99,
  },
  {
    id: "tirzepatide",
    name: "Tirzepatide",
    aliases: [],
    category: "Metabolic",
    vialMg: 10,
    summary: "A dual GIP/GLP-1 receptor agonist studied in metabolic research models.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 4 weeks.",
    price: 69.99,
  },
  {
    id: "retatrutide",
    name: "Retatrutide",
    aliases: [],
    category: "Metabolic",
    vialMg: 10,
    summary: "A triple GIP/GLP-1/glucagon receptor agonist studied in metabolic research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 4 weeks.",
    price: 74.99,
  },
  {
    id: "aod-9604",
    name: "AOD-9604",
    aliases: [],
    category: "Metabolic",
    vialMg: 5,
    summary: "A modified fragment of human growth hormone studied in lipid-metabolism research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 31.99,
  },
  {
    id: "epithalon",
    name: "Epithalon",
    aliases: ["Epitalon"],
    category: "Longevity",
    vialMg: 10,
    summary: "A synthetic tetrapeptide studied for its effect on telomerase activity in cell models.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 36.99,
  },
  {
    id: "dsip",
    name: "DSIP",
    aliases: ["Delta Sleep-Inducing Peptide"],
    category: "Cognitive",
    vialMg: 5,
    summary: "A neuropeptide studied in sleep-architecture and stress-response research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 26.99,
  },
  {
    id: "selank",
    name: "Selank",
    aliases: [],
    category: "Cognitive",
    vialMg: 5,
    summary: "A synthetic analogue of tuftsin, studied for anxiolytic and cognitive research endpoints.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 29.99,
  },
  {
    id: "semax",
    name: "Semax",
    aliases: [],
    category: "Cognitive",
    vialMg: 5,
    summary: "A synthetic ACTH(4-10) analogue, studied in neuroprotection and cognition research.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 29.99,
  },
  {
    id: "thymosin-alpha-1",
    name: "Thymosin Alpha-1",
    aliases: ["Tα1"],
    category: "Immune",
    vialMg: 5,
    summary: "A thymic peptide studied in immune-modulation research models.",
    storage: "Lyophilized: refrigerate 2–8°C. Reconstituted: refrigerate, use within 2–4 weeks.",
    price: 42.99,
  },
  {
    id: "igf-1-lr3",
    name: "IGF-1 LR3",
    aliases: [],
    category: "Growth Factor",
    vialMg: 1,
    summary: "A long-acting analogue of insulin-like growth factor 1, studied in cell-proliferation research.",
    storage: "Lyophilized: freeze -20°C. Reconstituted: refrigerate, use within 1 week.",
    price: 49.99,
  },
];

export function searchPeptides(query: string, limit = 8): Peptide[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return peptides
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.aliases.some((a) => a.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

export function getPeptide(id: string): Peptide | undefined {
  return peptides.find((p) => p.id === id);
}

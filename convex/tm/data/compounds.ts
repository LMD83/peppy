/**
 * Static compound catalogue — the meds, peptides and supplements this file's
 * users plausibly track.
 *
 * Reference material, not advice. Nothing here recommends starting, stopping or
 * changing anything, and no row carries a dose: doses live on the user's own
 * protocol rows because the user configured them. Evidence tiers describe the
 * published human evidence for the common use, not how well it works for you.
 *
 * Static config, not user data — no row here belongs to anybody.
 */

export type CompoundKind = "med" | "peptide" | "supplement";
export type EvidenceTier = "strong" | "moderate" | "limited" | "anecdotal";
export type CompoundRoute = "oral" | "subcut" | "intramuscular" | "topical" | "nasal";

export type CompoundDef = {
  key: string;
  name: string;
  kind: CompoundKind;
  /** The unit the field offers first — never a dose. */
  defaultUnit: string;
  typicalRoute: CompoundRoute;
  evidence: EvidenceTier;
  /** One clause: how it is understood to act. */
  mechanism: string;
  cautions: string[];
  /** Lab markers worth watching — labels shared with the labs slice. */
  monitor: string[];
};

export const EVIDENCE_ORDER: EvidenceTier[] = ["strong", "moderate", "limited", "anecdotal"];

/** What each tier actually claims. Printed in the legend, not paraphrased. */
export const EVIDENCE_NOTES: Record<EvidenceTier, string> = {
  strong: "Repeated randomised human trials, or regulatory approval for this use.",
  moderate: "Consistent human trials, smaller effect or narrower populations.",
  limited: "Mostly animal work, or small and uncontrolled human data.",
  anecdotal: "Mechanism and user reports only — no controlled human data for this use.",
};

export const KIND_LABELS: Record<CompoundKind, string> = {
  med: "Meds",
  peptide: "Peptides",
  supplement: "Supplements",
};

export const COMPOUNDS: CompoundDef[] = [
  /* ===== supplements ===== */
  {
    key: "creatine_monohydrate",
    name: "Creatine monohydrate",
    kind: "supplement",
    defaultUnit: "g",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "saturates muscle phosphocreatine, buffering ATP resynthesis in short hard efforts",
    cautions: [
      "Loading doses bloat; a steady small daily dose reaches the same saturation.",
      "Raises serum creatinine without indicating kidney injury — tell the lab you take it.",
    ],
    monitor: ["creatinine", "eGFR"],
  },
  {
    key: "vitamin_d3",
    name: "Vitamin D3",
    kind: "supplement",
    defaultUnit: "IU",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "raises serum 25-OH vitamin D, the substrate for calcium handling and immune signalling",
    cautions: [
      "Strong evidence applies to correcting a low level — topping up a replete one adds nothing.",
      "Fat-soluble: sustained high daily doses accumulate.",
    ],
    monitor: ["vitamin D (25-OH)", "calcium"],
  },
  {
    key: "magnesium_glycinate",
    name: "Magnesium glycinate",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "restores magnesium available to neuromuscular and sleep-related signalling",
    cautions: [
      "Loose stools are the usual first sign of too much.",
      "Space four hours from levothyroxine and from zinc.",
    ],
    monitor: ["magnesium"],
  },
  {
    key: "omega_3",
    name: "Omega-3 (EPA/DHA)",
    kind: "supplement",
    defaultUnit: "g",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "supplies EPA and DHA, shifting membrane composition and lowering triglycerides",
    cautions: [
      "Triglyceride lowering is consistent; the hard-outcome picture is not.",
      "High doses lengthen bleeding time.",
    ],
    monitor: ["triglycerides", "LDL-C"],
  },
  {
    key: "caffeine",
    name: "Caffeine",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "blocks adenosine receptors, deferring the perception of fatigue",
    cautions: [
      "Half-life around five hours — a 16:00 dose is still working at 21:00.",
      "Raises resting heart rate, and blood pressure in some people.",
    ],
    monitor: ["BP (home avg)", "resting HR"],
  },
  {
    key: "l_theanine",
    name: "L-theanine",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "raises alpha-band cortical activity, taking the edge off stimulant arousal",
    cautions: [
      "Effect is small and subjective — the trigger map will tell you more than the label does.",
      "Usually taken with caffeine; on its own the evidence thins out.",
    ],
    monitor: [],
  },
  {
    key: "zinc",
    name: "Zinc",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "supplies a cofactor for immune and hormone-related enzymes",
    cautions: [
      "Long high-dose use depletes copper.",
      "Nausea on an empty stomach; space from magnesium and levothyroxine.",
    ],
    monitor: ["zinc", "copper"],
  },
  {
    key: "psyllium",
    name: "Psyllium husk",
    kind: "supplement",
    defaultUnit: "g",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "forms a viscous gel that slows absorption and binds bile acids",
    cautions: [
      "Take with a full glass of water.",
      "Binds other oral drugs — space two to four hours.",
    ],
    monitor: ["LDL-C"],
  },
  {
    key: "electrolytes",
    name: "Electrolytes",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "replaces sodium, potassium and magnesium lost in sweat, holding plasma volume",
    cautions: [
      "Counts against the salt ceiling the daily checks already track.",
      "Useful around long or hot sessions; on a normal day it is just salt.",
    ],
    monitor: ["sodium", "potassium", "BP (home avg)"],
  },
  {
    key: "vitamin_b12",
    name: "Vitamin B12",
    kind: "supplement",
    defaultUnit: "mcg",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "supplies cobalamin for methylation and red-cell production",
    cautions: [
      "Strong evidence applies to correcting a low level, not to topping up a normal one.",
      "Worth checking if you are on metformin or a PPI long term.",
    ],
    monitor: ["B12", "homocysteine"],
  },
  {
    key: "melatonin",
    name: "Melatonin",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "moderate",
    mechanism: "shifts circadian phase by mimicking the evening rise in endogenous melatonin",
    cautions: [
      "Timing moves the clock; dose mostly moves the grogginess.",
      "Prescription-only in some countries — check what you actually hold.",
    ],
    monitor: [],
  },
  {
    key: "ashwagandha",
    name: "Ashwagandha",
    kind: "supplement",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "limited",
    mechanism: "withanolides appear to blunt the cortisol response to stress",
    cautions: [
      "Rare reports of liver injury.",
      "Thyroid hormone shifts reported — relevant if you take levothyroxine.",
    ],
    monitor: ["ALT", "TSH"],
  },

  /* ===== meds — prescription only, recorded here, never suggested ===== */
  {
    key: "semaglutide",
    name: "Semaglutide",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "subcut",
    evidence: "strong",
    mechanism: "GLP-1 receptor agonism slowing gastric emptying and lowering appetite signalling",
    cautions: [
      "Prescription medicine — the schedule here records what you were prescribed.",
      "Nausea and constipation are common early; dehydration follows if intake drops.",
      "Lean mass goes with the fat unless protein and resistance training hold it.",
    ],
    monitor: ["HbA1c", "eGFR", "lipase"],
  },
  {
    key: "tirzepatide",
    name: "Tirzepatide",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "subcut",
    evidence: "strong",
    mechanism: "dual GIP and GLP-1 receptor agonism lowering appetite and improving glycaemia",
    cautions: [
      "Prescription medicine — this row is a record, not a plan.",
      "GI effects track dose escalation; report severe or persistent pain.",
      "Protein intake and lifting are what protect lean mass on the way down.",
    ],
    monitor: ["HbA1c", "eGFR", "lipase"],
  },
  {
    key: "metformin",
    name: "Metformin",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "reduces hepatic glucose output and improves peripheral insulin sensitivity",
    cautions: [
      "GI upset is the common early cost; extended-release is the usual answer.",
      "Long-term use lowers B12.",
    ],
    monitor: ["HbA1c", "eGFR", "B12"],
  },
  {
    key: "atorvastatin",
    name: "Atorvastatin (statin)",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "HMG-CoA reductase inhibition lowering hepatic LDL particle production",
    cautions: [
      "Grapefruit juice raises levels of some statins through CYP3A4 — check the label for yours.",
      "Muscle ache is worth a CK draw before you blame the training block.",
    ],
    monitor: ["LDL-C", "ApoB", "ALT", "creatine kinase"],
  },
  {
    key: "omeprazole",
    name: "Omeprazole (PPI)",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "irreversibly blocks gastric proton pumps, cutting acid output",
    cautions: [
      "Long courses are associated with low magnesium and low B12.",
      "Raised gastric pH changes how other oral drugs are absorbed.",
    ],
    monitor: ["magnesium", "B12", "ferritin"],
  },
  {
    key: "sertraline",
    name: "Sertraline (SSRI)",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "blocks serotonin reuptake, raising synaptic availability over weeks",
    cautions: [
      "Never stop abruptly — discontinuation effects are real and avoidable.",
      "Sleep, appetite and libido shift in the first weeks; log them rather than guess.",
    ],
    monitor: ["sodium"],
  },
  {
    key: "bisoprolol",
    name: "Bisoprolol (beta blocker)",
    kind: "med",
    defaultUnit: "mg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "blocks β1 adrenergic receptors, lowering heart rate and cardiac output",
    cautions: [
      "Caps training heart rate — rate of perceived exertion is the honest gauge on this.",
      "Never stop abruptly.",
    ],
    monitor: ["BP (home avg)", "resting HR"],
  },
  {
    key: "levothyroxine",
    name: "Levothyroxine",
    kind: "med",
    defaultUnit: "mcg",
    typicalRoute: "oral",
    evidence: "strong",
    mechanism: "replaces T4, restoring the thyroid hormone the gland is not producing",
    cautions: [
      "Take fasted, 30–60 minutes before food or coffee.",
      "Minerals, PPIs and fibre all cut absorption — space them by four hours.",
    ],
    monitor: ["TSH", "free T4"],
  },

  /* ===== peptides — research compounds, evidence stated honestly ===== */
  {
    key: "bpc_157",
    name: "BPC-157",
    kind: "peptide",
    defaultUnit: "mcg",
    typicalRoute: "subcut",
    evidence: "limited",
    mechanism: "a gastric peptide fragment reported to promote angiogenesis in injured tissue",
    cautions: [
      "Rodent data, essentially no controlled human trials.",
      "Not an approved medicine — purity and actual content are unverified.",
      "Prohibited in sport.",
    ],
    monitor: [],
  },
  {
    key: "tb_500",
    name: "TB-500",
    kind: "peptide",
    defaultUnit: "mcg",
    typicalRoute: "subcut",
    evidence: "anecdotal",
    mechanism: "a thymosin β4 fragment reported to support actin remodelling and cell migration",
    cautions: [
      "No controlled human data for this use — the case is mechanism and user reports.",
      "Prohibited in sport.",
    ],
    monitor: [],
  },
  {
    key: "cjc_1295",
    name: "CJC-1295",
    kind: "peptide",
    defaultUnit: "mcg",
    typicalRoute: "subcut",
    evidence: "limited",
    mechanism: "a GHRH analogue that raises pulsatile growth-hormone release",
    cautions: [
      "Raising IGF-1 is the point and the risk — it is not a free lever.",
      "Water retention and carpal-tunnel-type symptoms are the common complaints.",
      "Prohibited in sport.",
    ],
    monitor: ["IGF-1", "fasting glucose", "HbA1c"],
  },
  {
    key: "ipamorelin",
    name: "Ipamorelin",
    kind: "peptide",
    defaultUnit: "mcg",
    typicalRoute: "subcut",
    evidence: "limited",
    mechanism: "a selective ghrelin-receptor agonist prompting growth-hormone release",
    cautions: [
      "Human data is short-term and small.",
      "Appetite rises — that fights a cut rather than helping it.",
      "Prohibited in sport.",
    ],
    monitor: ["IGF-1", "fasting glucose"],
  },
  {
    key: "glutathione",
    name: "Glutathione",
    kind: "peptide",
    defaultUnit: "mg",
    typicalRoute: "subcut",
    evidence: "limited",
    mechanism: "supplies the main intracellular antioxidant tripeptide directly",
    cautions: [
      "Oral absorption is poor; injected use is off-label.",
      "Skin-lightening claims are not supported by controlled data.",
    ],
    monitor: ["ALT"],
  },
  {
    key: "nad_plus",
    name: "NAD+",
    kind: "peptide",
    defaultUnit: "mg",
    typicalRoute: "subcut",
    evidence: "limited",
    mechanism: "supplies a redox cofactor used by sirtuins and mitochondrial metabolism",
    cautions: [
      "Human evidence is biomarker-level; outcome data is thin.",
      "Flushing and chest tightness are common if an infusion is pushed fast.",
    ],
    monitor: [],
  },
];

export type InteractionSeverity = "info" | "caution";

export type InteractionDef = {
  a: string;
  b: string;
  severity: InteractionSeverity;
  note: string;
};

/**
 * Pairs worth knowing when both are on the same file. Factual and non-alarmist:
 * "caution" means space or monitor them, not stop. Food interactions (grapefruit
 * with some statins, coffee with levothyroxine) live in each compound's
 * `cautions` — there is no protocol row to match them against.
 */
export const INTERACTIONS: InteractionDef[] = [
  {
    a: "levothyroxine",
    b: "magnesium_glycinate",
    severity: "caution",
    note: "Magnesium binds levothyroxine in the gut. Four hours apart keeps the dose you were prescribed the dose you absorb.",
  },
  {
    a: "levothyroxine",
    b: "zinc",
    severity: "caution",
    note: "Same absorption story as magnesium — separate them by four hours.",
  },
  {
    a: "levothyroxine",
    b: "omeprazole",
    severity: "caution",
    note: "Raised gastric pH lowers levothyroxine absorption; TSH is the marker that shows it.",
  },
  {
    a: "levothyroxine",
    b: "psyllium",
    severity: "caution",
    note: "Soluble fibre binds levothyroxine. Take the husk at the other end of the day.",
  },
  {
    a: "omeprazole",
    b: "magnesium_glycinate",
    severity: "info",
    note: "Long PPI courses are associated with low magnesium — the supplement is often the response, not the problem.",
  },
  {
    a: "omeprazole",
    b: "vitamin_b12",
    severity: "info",
    note: "Acid suppression lowers B12 absorption from food; a B12 draw settles whether it matters here.",
  },
  {
    a: "metformin",
    b: "vitamin_b12",
    severity: "info",
    note: "Long-term metformin lowers B12. Worth a level rather than an assumption.",
  },
  {
    a: "atorvastatin",
    b: "creatine_monohydrate",
    severity: "info",
    note: "Creatine and hard training both raise CK, which is the marker used to check statin muscle effects. Note both before reading a result.",
  },
  {
    a: "atorvastatin",
    b: "omega_3",
    severity: "info",
    note: "Both move the lipid panel. Change one at a time or the next draw cannot tell you which did what.",
  },
  {
    a: "sertraline",
    b: "omega_3",
    severity: "info",
    note: "High-dose fish oil lengthens bleeding time; SSRIs affect platelet function. Relevant around surgery, not day to day.",
  },
  {
    a: "caffeine",
    b: "melatonin",
    severity: "caution",
    note: "Caffeine's half-life runs straight through the melatonin window — an afternoon dose blunts the evening one.",
  },
  {
    a: "caffeine",
    b: "bisoprolol",
    severity: "info",
    note: "Caffeine pushes heart rate up, the beta blocker holds it down. Heart-rate zones read badly on both.",
  },
  {
    a: "caffeine",
    b: "l_theanine",
    severity: "info",
    note: "The standard pairing — theanine takes the edge off the arousal without touching the alertness.",
  },
  {
    a: "zinc",
    b: "magnesium_glycinate",
    severity: "info",
    note: "High doses compete for absorption. Splitting them across the day is enough.",
  },
  {
    a: "semaglutide",
    b: "psyllium",
    severity: "info",
    note: "Both slow gastric emptying. Space other oral medicines away from the husk.",
  },
  {
    a: "semaglutide",
    b: "metformin",
    severity: "info",
    note: "Commonly prescribed together; the GI effects stack early in an escalation.",
  },
  {
    a: "tirzepatide",
    b: "metformin",
    severity: "info",
    note: "Commonly prescribed together; the GI effects stack early in an escalation.",
  },
];

const BY_KEY = new Map(COMPOUNDS.map((c) => [c.key, c]));

export function compoundByKey(key: string): CompoundDef | undefined {
  return BY_KEY.get(key);
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

const BY_NAME = new Map<string, CompoundDef>();
for (const c of COMPOUNDS) {
  BY_NAME.set(normalise(c.name), c);
  BY_NAME.set(normalise(c.key.replace(/_/g, " ")), c);
  // "Atorvastatin (statin)" is also findable as "atorvastatin".
  const bare = c.name.replace(/\s*\(.*\)\s*$/, "");
  BY_NAME.set(normalise(bare), c);
}

/** Resolve a user-entered protocol name back to the catalogue, or undefined. */
export function compoundByName(name: string): CompoundDef | undefined {
  return BY_NAME.get(normalise(name));
}

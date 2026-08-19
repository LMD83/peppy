/**
 * Static blood-marker catalogue — SI units as reported by Irish and UK labs.
 *
 * Reference intervals are the standard adult ranges most labs print beside a
 * result (male ranges where a marker is sex-specific — this file has two male
 * users). They are population intervals, not verdicts: a value outside one is
 * a prompt to look, never a diagnosis.
 *
 * `optimalLow`/`optimalHigh` appear ONLY where a narrower band has real
 * outcome evidence behind it (ApoB, LDL, hs-CRP, HbA1c, vitamin D, ferritin,
 * TSH, homocysteine, triglycerides, HDL). Where the "optimal" talk is
 * marketing rather than evidence — testosterone, free T3, B12 — the band is
 * omitted rather than invented.
 *
 * Static config, not user data — no row here belongs to anybody.
 */

export type MarkerGroup =
  | "lipids"
  | "metabolic"
  | "inflammation"
  | "liver"
  | "kidney"
  | "cbc"
  | "hormones"
  | "thyroid"
  | "vitamins";

export type MarkerDef = {
  key: string;
  name: string;
  unit: string;
  group: MarkerGroup;
  refLow: number;
  refHigh: number;
  /** Narrower band, only where outcome evidence supports one. */
  optimalLow?: number;
  optimalHigh?: number;
  /** True when a higher number is the better direction (HDL, eGFR). */
  higherIsBetter?: boolean;
  /** One plain sentence: what the marker is. No advice, no diagnosis. */
  blurb: string;
  /** Honest levers — what actually moves this number, including the boring ones. */
  movedBy: string[];
};

/** Display order — how a printed panel usually runs. */
export const GROUP_ORDER: MarkerGroup[] = [
  "lipids",
  "metabolic",
  "inflammation",
  "liver",
  "kidney",
  "cbc",
  "hormones",
  "thyroid",
  "vitamins",
];

export const GROUP_LABELS: Record<MarkerGroup, string> = {
  lipids: "Lipids",
  metabolic: "Metabolic",
  inflammation: "Inflammation",
  liver: "Liver",
  kidney: "Kidney & electrolytes",
  cbc: "Full blood count & iron",
  hormones: "Hormones",
  thyroid: "Thyroid",
  vitamins: "Vitamins & minerals",
};

export const MARKERS: MarkerDef[] = [
  /* ===== lipids ===== */
  {
    key: "total_cholesterol",
    name: "Total cholesterol",
    unit: "mmol/L",
    group: "lipids",
    refLow: 3.0,
    refHigh: 5.0,
    blurb: "All cholesterol carried in the blood, the crude headline number the finer lipid markers break apart.",
    movedBy: ["saturated fat intake", "body fat loss", "fibre", "genetics", "thyroid function"],
  },
  {
    key: "ldl_c",
    name: "LDL cholesterol",
    unit: "mmol/L",
    group: "lipids",
    refLow: 1.2,
    refHigh: 3.0,
    optimalLow: 1.2,
    optimalHigh: 2.0,
    blurb: "Cholesterol carried on the particles that deposit in artery walls; lower tracks with lower cardiovascular risk.",
    movedBy: ["saturated fat intake", "soluble fibre", "weight loss", "statins or ezetimibe", "genetics"],
  },
  {
    key: "hdl_c",
    name: "HDL cholesterol",
    unit: "mmol/L",
    group: "lipids",
    refLow: 1.0,
    refHigh: 2.2,
    optimalLow: 1.3,
    optimalHigh: 2.2,
    higherIsBetter: true,
    blurb: "Cholesterol on the particles that return it to the liver — a risk marker, not a lever you raise directly.",
    movedBy: ["aerobic training", "body fat loss", "alcohol (raises it, at a cost)", "smoking (lowers it)", "genetics"],
  },
  {
    key: "non_hdl_c",
    name: "Non-HDL cholesterol",
    unit: "mmol/L",
    group: "lipids",
    refLow: 1.8,
    refHigh: 4.0,
    optimalLow: 1.8,
    optimalHigh: 2.6,
    blurb: "Total minus HDL — every atherogenic particle in one number, and it does not need a fasted sample.",
    movedBy: ["saturated fat intake", "weight loss", "triglyceride control", "lipid-lowering medication"],
  },
  {
    key: "triglycerides",
    name: "Triglycerides",
    unit: "mmol/L",
    group: "lipids",
    refLow: 0.5,
    refHigh: 1.7,
    optimalLow: 0.5,
    optimalHigh: 1.1,
    blurb: "Circulating fat, strongly tied to recent carbohydrate and alcohol intake and to how fasted the sample was.",
    movedBy: ["alcohol", "refined carbohydrate", "fasting state at the draw", "weight loss", "omega-3 intake"],
  },
  {
    key: "apob",
    name: "ApoB",
    unit: "g/L",
    group: "lipids",
    refLow: 0.6,
    refHigh: 1.2,
    optimalLow: 0.6,
    optimalHigh: 0.8,
    blurb: "A direct count of atherogenic particles — the single best-evidenced lipid marker when it disagrees with LDL.",
    movedBy: ["saturated fat intake", "weight loss", "lipid-lowering medication", "genetics"],
  },
  {
    key: "lp_a",
    name: "Lp(a)",
    unit: "nmol/L",
    group: "lipids",
    refLow: 0,
    refHigh: 75,
    blurb: "A largely inherited particle measured once in a lifetime; diet and training barely move it.",
    movedBy: ["genetics (dominant)", "very little else"],
  },
  {
    key: "chol_hdl_ratio",
    name: "Total : HDL ratio",
    unit: "ratio",
    group: "lipids",
    refLow: 0,
    refHigh: 4.5,
    optimalLow: 0,
    optimalHigh: 3.5,
    blurb: "Total cholesterol divided by HDL — an old risk shorthand that still tracks outcomes reasonably well.",
    movedBy: ["anything moving total cholesterol", "anything moving HDL"],
  },

  /* ===== metabolic ===== */
  {
    key: "glucose_fasting",
    name: "Fasting glucose",
    unit: "mmol/L",
    group: "metabolic",
    refLow: 3.9,
    refHigh: 5.5,
    optimalLow: 4.2,
    optimalHigh: 5.0,
    blurb: "Blood sugar after an overnight fast — one snapshot, easily moved by a poor night's sleep or a late meal.",
    movedBy: ["hours fasted", "sleep the night before", "body fat", "training", "acute stress"],
  },
  {
    key: "hba1c",
    name: "HbA1c",
    unit: "mmol/mol",
    group: "metabolic",
    refLow: 20,
    refHigh: 41,
    optimalLow: 20,
    optimalHigh: 36,
    blurb: "Average glucose written into red cells over roughly three months, so it moves slowly and lies less than one draw.",
    movedBy: ["average carbohydrate load", "body fat loss", "training", "red-cell lifespan (anaemia skews it)"],
  },
  {
    key: "insulin_fasting",
    name: "Fasting insulin",
    unit: "mIU/L",
    group: "metabolic",
    refLow: 2.0,
    refHigh: 20.0,
    optimalLow: 2.0,
    optimalHigh: 8.0,
    blurb: "How much insulin it takes to hold glucose steady while fasted — it drifts up before glucose does.",
    movedBy: ["body fat", "recent carbohydrate intake", "sleep", "training", "hours fasted"],
  },
  {
    key: "homa_ir",
    name: "HOMA-IR",
    unit: "index",
    group: "metabolic",
    refLow: 0,
    refHigh: 2.5,
    optimalLow: 0,
    optimalHigh: 1.5,
    blurb: "Fasting glucose and insulin combined into an insulin-resistance index — a research estimate, not a clinical test.",
    movedBy: ["everything moving fasting insulin", "everything moving fasting glucose"],
  },
  {
    key: "uric_acid",
    name: "Uric acid",
    unit: "umol/L",
    group: "metabolic",
    refLow: 200,
    refHigh: 430,
    blurb: "A purine breakdown product that rises with alcohol, fructose and rapid weight loss, and can precipitate gout.",
    movedBy: ["alcohol (beer especially)", "fructose", "rapid weight loss", "dehydration", "kidney function"],
  },

  /* ===== inflammation ===== */
  {
    key: "hs_crp",
    name: "hs-CRP",
    unit: "mg/L",
    group: "inflammation",
    refLow: 0,
    refHigh: 3.0,
    optimalLow: 0,
    optimalHigh: 1.0,
    blurb: "A sensitive general inflammation marker — any infection, injury or hard session in the days before the draw lifts it.",
    movedBy: ["recent infection or injury", "hard training in the last 72 h", "body fat", "sleep debt", "smoking"],
  },
  {
    key: "homocysteine",
    name: "Homocysteine",
    unit: "umol/L",
    group: "inflammation",
    refLow: 5,
    refHigh: 15,
    optimalLow: 5,
    optimalHigh: 9,
    blurb: "An amino acid that accumulates when B-vitamin methylation runs short; it is the functional read on MTHFR talk.",
    movedBy: ["folate intake", "B12 status", "B6 status", "kidney function", "genetics (MTHFR)"],
  },
  {
    key: "esr",
    name: "ESR",
    unit: "mm/hr",
    group: "inflammation",
    refLow: 0,
    refHigh: 15,
    blurb: "How fast red cells settle in a tube — a slow, non-specific inflammation signal that lags hs-CRP.",
    movedBy: ["infection", "chronic inflammation", "anaemia", "age"],
  },
  {
    key: "fibrinogen",
    name: "Fibrinogen",
    unit: "g/L",
    group: "inflammation",
    refLow: 2.0,
    refHigh: 4.0,
    blurb: "A clotting protein that doubles as an acute-phase reactant, so it rises with the same things that raise CRP.",
    movedBy: ["infection or injury", "smoking", "body fat", "oestrogen"],
  },

  /* ===== liver ===== */
  {
    key: "alt",
    name: "ALT",
    unit: "U/L",
    group: "liver",
    refLow: 10,
    refHigh: 50,
    optimalLow: 10,
    optimalHigh: 30,
    blurb: "A liver-specific enzyme that leaks into blood when liver cells are stressed, most commonly by fatty liver.",
    movedBy: ["liver fat", "alcohol", "some medications", "hard eccentric training", "weight loss (lowers it)"],
  },
  {
    key: "ast",
    name: "AST",
    unit: "U/L",
    group: "liver",
    refLow: 10,
    refHigh: 40,
    blurb: "An enzyme found in liver and muscle, so a heavy leg session can raise it without the liver being involved.",
    movedBy: ["training in the last 72 h", "alcohol", "liver fat", "muscle damage"],
  },
  {
    key: "ggt",
    name: "GGT",
    unit: "U/L",
    group: "liver",
    refLow: 10,
    refHigh: 71,
    optimalLow: 10,
    optimalHigh: 30,
    blurb: "The liver enzyme most sensitive to alcohol and to bile-flow problems.",
    movedBy: ["alcohol", "liver fat", "some medications", "weight loss (lowers it)"],
  },
  {
    key: "alp",
    name: "ALP",
    unit: "U/L",
    group: "liver",
    refLow: 30,
    refHigh: 130,
    blurb: "An enzyme from liver, bile ducts and bone — a raised value needs the other liver markers to be interpretable.",
    movedBy: ["bile flow", "bone turnover", "healing fractures", "vitamin D deficiency"],
  },
  {
    key: "bilirubin_total",
    name: "Total bilirubin",
    unit: "umol/L",
    group: "liver",
    refLow: 3,
    refHigh: 21,
    blurb: "A haem breakdown product; a mildly high value is often benign Gilbert's syndrome, especially after fasting.",
    movedBy: ["fasting", "Gilbert's syndrome", "dehydration", "haemolysis", "bile flow"],
  },
  {
    key: "albumin",
    name: "Albumin",
    unit: "g/L",
    group: "liver",
    refLow: 35,
    refHigh: 50,
    blurb: "The main blood protein the liver makes — a slow marker of nutrition, inflammation and liver capacity.",
    movedBy: ["hydration at the draw", "inflammation", "protein intake", "liver and kidney function"],
  },

  /* ===== kidney & electrolytes ===== */
  {
    key: "creatinine",
    name: "Creatinine",
    unit: "umol/L",
    group: "kidney",
    refLow: 59,
    refHigh: 104,
    blurb: "A muscle breakdown product cleared by the kidneys; more muscle and creatine use both raise it without kidney harm.",
    movedBy: ["muscle mass", "creatine supplementation", "hydration", "protein intake", "kidney function"],
  },
  {
    key: "egfr",
    name: "eGFR",
    unit: "mL/min/1.73m²",
    group: "kidney",
    refLow: 90,
    refHigh: 120,
    higherIsBetter: true,
    blurb: "Estimated filtration rate calculated from creatinine, so anything inflating creatinine deflates this estimate.",
    movedBy: ["creatinine (inverse)", "muscle mass", "hydration", "age", "kidney function"],
  },
  {
    key: "urea",
    name: "Urea",
    unit: "mmol/L",
    group: "kidney",
    refLow: 2.5,
    refHigh: 7.8,
    blurb: "Nitrogen waste from protein metabolism, sensitive to how much protein you eat and how hydrated you are.",
    movedBy: ["protein intake", "hydration", "kidney function", "catabolic stress"],
  },
  {
    key: "cystatin_c",
    name: "Cystatin C",
    unit: "mg/L",
    group: "kidney",
    refLow: 0.55,
    refHigh: 1.15,
    blurb: "A second filtration marker independent of muscle mass — the tiebreak when creatinine looks high in a lifter.",
    movedBy: ["kidney function", "thyroid function", "corticosteroids", "inflammation"],
  },
  {
    key: "sodium",
    name: "Sodium",
    unit: "mmol/L",
    group: "kidney",
    refLow: 135,
    refHigh: 145,
    blurb: "Tightly regulated blood sodium — it reflects water balance far more than salt on the plate.",
    movedBy: ["hydration", "sweat losses", "diuretics", "kidney and adrenal function"],
  },
  {
    key: "potassium",
    name: "Potassium",
    unit: "mmol/L",
    group: "kidney",
    refLow: 3.5,
    refHigh: 5.3,
    blurb: "An electrolyte with a narrow safe window; a squeezed or delayed sample often reads falsely high.",
    movedBy: ["sample handling", "kidney function", "diuretics", "ACE inhibitors", "fruit and vegetable intake"],
  },
  {
    key: "calcium_adjusted",
    name: "Adjusted calcium",
    unit: "mmol/L",
    group: "kidney",
    refLow: 2.2,
    refHigh: 2.6,
    blurb: "Blood calcium corrected for albumin — held steady by parathyroid hormone rather than by yesterday's dairy.",
    movedBy: ["parathyroid function", "vitamin D status", "albumin", "kidney function"],
  },

  /* ===== full blood count & iron ===== */
  {
    key: "haemoglobin",
    name: "Haemoglobin",
    unit: "g/L",
    group: "cbc",
    refLow: 130,
    refHigh: 170,
    blurb: "Oxygen-carrying protein in red cells — the number that defines anaemia when it falls.",
    movedBy: ["iron status", "B12 and folate", "blood loss", "hydration at the draw", "altitude"],
  },
  {
    key: "haematocrit",
    name: "Haematocrit",
    unit: "L/L",
    group: "cbc",
    refLow: 0.4,
    refHigh: 0.5,
    blurb: "The fraction of blood volume made of red cells; it moves with haemoglobin and with plain dehydration.",
    movedBy: ["hydration", "iron status", "testosterone therapy", "altitude", "sleep apnoea"],
  },
  {
    key: "mcv",
    name: "MCV",
    unit: "fL",
    group: "cbc",
    refLow: 80,
    refHigh: 100,
    blurb: "Average red-cell size — small points toward iron, large toward B12, folate or alcohol.",
    movedBy: ["iron status", "B12 and folate", "alcohol", "thyroid function"],
  },
  {
    key: "platelets",
    name: "Platelets",
    unit: "×10⁹/L",
    group: "cbc",
    refLow: 150,
    refHigh: 400,
    blurb: "Clotting cells; they rise as an acute-phase response and with iron deficiency.",
    movedBy: ["inflammation", "iron deficiency", "infection", "spleen function"],
  },
  {
    key: "wbc",
    name: "White cells",
    unit: "×10⁹/L",
    group: "cbc",
    refLow: 4.0,
    refHigh: 11.0,
    blurb: "Total immune cells in circulation — a snapshot that a cold or a hard session shifts for days.",
    movedBy: ["infection", "training load", "stress", "smoking", "steroids"],
  },
  {
    key: "neutrophils",
    name: "Neutrophils",
    unit: "×10⁹/L",
    group: "cbc",
    refLow: 2.0,
    refHigh: 7.5,
    blurb: "The first-response white cells, which is why they lead the rise in a bacterial infection.",
    movedBy: ["infection", "acute stress", "training", "steroids"],
  },
  {
    key: "lymphocytes",
    name: "Lymphocytes",
    unit: "×10⁹/L",
    group: "cbc",
    refLow: 1.0,
    refHigh: 4.0,
    blurb: "The adaptive immune cells; they dip transiently after heavy training and during acute stress.",
    movedBy: ["viral infection", "training load", "cortisol", "sleep debt"],
  },
  {
    key: "rdw",
    name: "RDW",
    unit: "%",
    group: "cbc",
    refLow: 11.5,
    refHigh: 14.5,
    blurb: "How variable red-cell size is — it widens early when iron or B12 supply is failing.",
    movedBy: ["iron status", "B12 and folate", "recent blood loss", "chronic inflammation"],
  },
  {
    key: "ferritin",
    name: "Ferritin",
    unit: "ug/L",
    group: "cbc",
    refLow: 30,
    refHigh: 400,
    optimalLow: 50,
    optimalHigh: 150,
    blurb: "Stored iron, and also an acute-phase protein — inflammation can hold it up while stores are actually empty.",
    movedBy: ["iron intake", "blood loss", "inflammation", "coeliac or gut absorption", "blood donation"],
  },
  {
    key: "transferrin_sat",
    name: "Transferrin saturation",
    unit: "%",
    group: "cbc",
    refLow: 20,
    refHigh: 50,
    blurb: "How much of the iron transport protein is actually carrying iron — the read that inflammation cannot mask.",
    movedBy: ["iron intake", "blood loss", "time of day of the draw", "haemochromatosis genetics"],
  },

  /* ===== hormones ===== */
  {
    key: "testosterone_total",
    name: "Total testosterone",
    unit: "nmol/L",
    group: "hormones",
    refLow: 8.6,
    refHigh: 29.0,
    blurb: "Total circulating testosterone, most of it bound to SHBG; it must be drawn before 10:00 to mean anything.",
    movedBy: ["time of the draw", "sleep", "body fat", "energy deficit", "alcohol", "illness"],
  },
  {
    key: "shbg",
    name: "SHBG",
    unit: "nmol/L",
    group: "hormones",
    refLow: 18,
    refHigh: 54,
    blurb: "The protein that binds testosterone; when it shifts, total testosterone moves without free testosterone changing.",
    movedBy: ["insulin resistance (lowers it)", "energy deficit (raises it)", "thyroid hormone", "liver fat", "oestrogen"],
  },
  {
    key: "testosterone_free",
    name: "Free testosterone",
    unit: "pmol/L",
    group: "hormones",
    refLow: 200,
    refHigh: 620,
    blurb: "The unbound fraction, usually calculated from total testosterone, SHBG and albumin rather than measured.",
    movedBy: ["total testosterone", "SHBG", "albumin", "time of the draw"],
  },
  {
    key: "oestradiol",
    name: "Oestradiol",
    unit: "pmol/L",
    group: "hormones",
    refLow: 40,
    refHigh: 160,
    blurb: "The main oestrogen, made in men by aromatising testosterone in fat tissue; it is needed, not something to floor.",
    movedBy: ["body fat", "testosterone level", "alcohol", "aromatase inhibitors"],
  },
  {
    key: "lh",
    name: "LH",
    unit: "IU/L",
    group: "hormones",
    refLow: 1.7,
    refHigh: 8.6,
    blurb: "The pituitary signal that tells the testes to make testosterone — it separates a testicular cause from a central one.",
    movedBy: ["exogenous testosterone (suppresses it)", "energy deficit", "sleep", "pituitary function"],
  },
  {
    key: "fsh",
    name: "FSH",
    unit: "IU/L",
    group: "hormones",
    refLow: 1.5,
    refHigh: 12.4,
    blurb: "The pituitary signal driving sperm production, read alongside LH when testosterone is low.",
    movedBy: ["exogenous hormones", "testicular function", "pituitary function"],
  },
  {
    key: "prolactin",
    name: "Prolactin",
    unit: "mIU/L",
    group: "hormones",
    refLow: 86,
    refHigh: 324,
    blurb: "A pituitary hormone that suppresses testosterone when persistently high; stress and a difficult draw raise it briefly.",
    movedBy: ["stress at the draw", "sleep", "some medications", "pituitary adenoma"],
  },
  {
    key: "cortisol_am",
    name: "Cortisol (morning)",
    unit: "nmol/L",
    group: "hormones",
    refLow: 166,
    refHigh: 507,
    blurb: "The morning peak of the daily cortisol rhythm — one draw describes the clock, not your stress levels.",
    movedBy: ["time of the draw", "sleep", "acute illness", "steroids", "shift work"],
  },
  {
    key: "dhea_s",
    name: "DHEA-S",
    unit: "umol/L",
    group: "hormones",
    refLow: 2.4,
    refHigh: 11.6,
    blurb: "An adrenal androgen precursor that falls steadily with age, which makes age-matched context essential.",
    movedBy: ["age", "adrenal function", "chronic illness", "supplementation"],
  },

  /* ===== thyroid ===== */
  {
    key: "tsh",
    name: "TSH",
    unit: "mIU/L",
    group: "thyroid",
    refLow: 0.4,
    refHigh: 4.0,
    optimalLow: 0.5,
    optimalHigh: 2.5,
    blurb: "The pituitary's instruction to the thyroid — it rises when thyroid output is falling, so it moves inversely.",
    movedBy: ["thyroid function", "time of day", "energy deficit", "biotin supplements (assay interference)", "illness"],
  },
  {
    key: "free_t4",
    name: "Free T4",
    unit: "pmol/L",
    group: "thyroid",
    refLow: 12,
    refHigh: 22,
    blurb: "The storage thyroid hormone, converted in tissues to the active form; it is the steadier of the two.",
    movedBy: ["thyroid function", "thyroid medication", "acute illness", "biotin (assay interference)"],
  },
  {
    key: "free_t3",
    name: "Free T3",
    unit: "pmol/L",
    group: "thyroid",
    refLow: 3.1,
    refHigh: 6.8,
    blurb: "The active thyroid hormone; it drops during a sustained energy deficit as a normal adaptation, not a disease.",
    movedBy: ["energy deficit", "carbohydrate intake", "conversion from T4", "acute illness", "selenium status"],
  },
  {
    key: "tpo_antibodies",
    name: "TPO antibodies",
    unit: "kIU/L",
    group: "thyroid",
    refLow: 0,
    refHigh: 34,
    blurb: "Antibodies against thyroid tissue — present, they explain a drifting TSH; they are checked once, not tracked.",
    movedBy: ["autoimmune thyroid disease", "little else"],
  },

  /* ===== vitamins & minerals ===== */
  {
    key: "vitamin_d",
    name: "Vitamin D (25-OH)",
    unit: "nmol/L",
    group: "vitamins",
    refLow: 50,
    refHigh: 125,
    optimalLow: 75,
    optimalHigh: 125,
    blurb: "The storage form of vitamin D, which at this latitude falls every winter regardless of what you do outdoors.",
    movedBy: ["sunlight exposure", "season", "supplementation", "body fat", "gut absorption"],
  },
  {
    key: "vitamin_b12",
    name: "Vitamin B12",
    unit: "ng/L",
    group: "vitamins",
    refLow: 200,
    refHigh: 900,
    blurb: "Serum B12, a rough measure of status — active B12 or methylmalonic acid settles a borderline result.",
    movedBy: ["animal food intake", "metformin", "acid-suppressing drugs", "gut absorption", "supplementation"],
  },
  {
    key: "folate_serum",
    name: "Folate (serum)",
    unit: "ug/L",
    group: "vitamins",
    refLow: 3.9,
    refHigh: 26.8,
    blurb: "Recent folate intake rather than long-term stores, so a green week before the draw flatters it.",
    movedBy: ["leafy greens and legumes", "fortified foods", "supplementation", "alcohol"],
  },
  {
    key: "magnesium",
    name: "Magnesium",
    unit: "mmol/L",
    group: "vitamins",
    refLow: 0.7,
    refHigh: 1.0,
    blurb: "Serum magnesium, which the body defends tightly — it stays normal long after tissue stores run low.",
    movedBy: ["intake", "gut absorption", "alcohol", "diuretics", "kidney handling"],
  },
  {
    key: "zinc",
    name: "Zinc",
    unit: "umol/L",
    group: "vitamins",
    refLow: 11,
    refHigh: 18,
    blurb: "Serum zinc, which falls during any inflammatory episode independently of intake.",
    movedBy: ["intake", "inflammation (lowers it)", "gut absorption", "high-dose iron or copper"],
  },
];

const BY_KEY: Map<string, MarkerDef> = new Map(MARKERS.map((m) => [m.key, m]));

/** Display name, normalised, → key. A CSV export prints "LDL cholesterol", not "ldl_c". */
const BY_NAME: Map<string, MarkerDef> = new Map(
  MARKERS.map((m) => [normaliseMarkerText(m.name), m]),
);

function normaliseMarkerText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Safe lookup — an unknown key returns null instead of throwing in a render path. */
export function markerByKey(key: string): MarkerDef | null {
  return BY_KEY.get(key) ?? null;
}

export function isKnownMarker(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * A human or an export file identifies a marker by its printed name at least
 * as often as by our internal key — an imported CSV column reads "LDL
 * cholesterol", not "ldl_c". This tries the exact key first (cheap, and what
 * every other caller already passes), then a case/whitespace-insensitive name
 * match. Anything neither matches returns null rather than a guess: an
 * unrecognised marker in an import is a row to reject, never one to invent a
 * catalogue entry for.
 */
export function markerByNameOrKey(text: string): MarkerDef | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return BY_KEY.get(trimmed) ?? BY_NAME.get(normaliseMarkerText(trimmed)) ?? null;
}

export type PanelTemplate = {
  key: string;
  name: string;
  /** Marker keys, in the order a lab prints them. */
  markers: string[];
};

/** What a lab actually sells as a panel — the add-panel form is driven by these. */
export const PANEL_TEMPLATES: PanelTemplate[] = [
  {
    key: "lipid",
    name: "Lipid panel",
    markers: ["total_cholesterol", "ldl_c", "hdl_c", "non_hdl_c", "triglycerides", "apob", "chol_hdl_ratio"],
  },
  {
    key: "metabolic",
    name: "Metabolic panel",
    markers: ["glucose_fasting", "hba1c", "insulin_fasting", "homa_ir", "uric_acid"],
  },
  {
    key: "liver",
    name: "Liver panel",
    markers: ["alt", "ast", "ggt", "alp", "bilirubin_total", "albumin"],
  },
  {
    key: "kidney",
    name: "Kidney & electrolytes",
    markers: ["creatinine", "egfr", "urea", "cystatin_c", "sodium", "potassium", "calcium_adjusted"],
  },
  {
    key: "fbc",
    name: "Full blood count",
    markers: ["haemoglobin", "haematocrit", "mcv", "rdw", "platelets", "wbc", "neutrophils", "lymphocytes"],
  },
  {
    key: "iron",
    name: "Iron studies",
    markers: ["ferritin", "transferrin_sat", "haemoglobin", "mcv"],
  },
  {
    key: "thyroid",
    name: "Thyroid panel",
    markers: ["tsh", "free_t4", "free_t3", "tpo_antibodies"],
  },
  {
    key: "male_hormones",
    name: "Male hormones",
    markers: ["testosterone_total", "testosterone_free", "shbg", "oestradiol", "lh", "fsh", "prolactin", "cortisol_am", "dhea_s"],
  },
  {
    key: "inflammation",
    name: "Inflammation",
    markers: ["hs_crp", "homocysteine", "esr", "fibrinogen"],
  },
  {
    key: "vitamins",
    name: "Vitamins & minerals",
    markers: ["vitamin_d", "vitamin_b12", "folate_serum", "magnesium", "zinc"],
  },
];

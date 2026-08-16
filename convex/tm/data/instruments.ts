/**
 * Validated self-report instruments, reproduced item-for-item.
 *
 * These are screening and tracking instruments, not diagnostic tests. A score
 * here is a self-report total on a given day. It is evidence of how the last
 * fortnight felt; it is never a diagnosis, and nothing in this file or anything
 * built on it may present it as one. Every instrument carries its source and a
 * note stating what its evidence actually supports.
 *
 * Static config, not user data — safe to ship to the client for form rendering.
 */

export type BandTone = "green" | "blue" | "amber" | "red";

export type InstrumentBand = {
  /** Inclusive lower bound of the band, on the instrument's final score scale. */
  min: number;
  /** Inclusive upper bound. */
  max: number;
  label: string;
  tone: BandTone;
};

export type InstrumentKey = "phq9" | "gad7" | "pss10" | "who5" | "isi" | "auditc" | "pacs";

export type Instrument = {
  key: InstrumentKey;
  name: string;
  source: string;
  /** Re-take interval. Shorter than this and you are measuring noise. */
  cadenceDays: number;
  /** Answer anchors, index 0..n. The answer value IS the index. */
  scaleLabels: string[];
  items: string[];
  bands: InstrumentBand[];
  /** 0-indexed items scored in reverse (max − answer) before totalling. */
  reverseItems?: number[];
  /** 0-indexed item whose non-zero answer surfaces the support notice. */
  safetyItemIndex?: number;
  /** Per-item anchors where the instrument does not use one shared scale. */
  itemScaleLabels?: string[][];
  note: string;
};

const ZERO_TO_THREE = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
];

const PSS_SCALE = ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"];

const WHO5_SCALE = [
  "At no time",
  "Some of the time",
  "Less than half the time",
  "More than half the time",
  "Most of the time",
  "All of the time",
];

const ISI_SCALE = ["None", "Mild", "Moderate", "Severe", "Very severe"];

const PACS_SCALE = [
  "Never",
  "Almost never",
  "Rarely",
  "Sometimes",
  "Often",
  "Most of the time",
  "Nearly all the time",
];

export const PHQ9: Instrument = {
  key: "phq9",
  name: "PHQ-9",
  source: "Kroenke, Spitzer & Williams (2001), J Gen Intern Med. Public domain.",
  cadenceDays: 14,
  scaleLabels: ZERO_TO_THREE,
  items: [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself — or that you are a failure, or have let yourself or your family down",
    "Trouble concentrating on things, such as reading the newspaper or watching television",
    "Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
    "Thoughts that you would be better off dead, or of hurting yourself in some way",
  ],
  bands: [
    { min: 0, max: 4, label: "minimal", tone: "green" },
    { min: 5, max: 9, label: "mild", tone: "blue" },
    { min: 10, max: 14, label: "moderate", tone: "amber" },
    { min: 15, max: 19, label: "moderately severe", tone: "amber" },
    { min: 20, max: 27, label: "severe", tone: "red" },
  ],
  safetyItemIndex: 8,
  note: "Strong evidence as a screening and severity-tracking instrument for depressive symptoms. It does not diagnose. Bands describe symptom load over the last two weeks, nothing else.",
};

export const GAD7: Instrument = {
  key: "gad7",
  name: "GAD-7",
  source: "Spitzer, Kroenke, Williams & Löwe (2006), Arch Intern Med.",
  cadenceDays: 14,
  scaleLabels: ZERO_TO_THREE,
  items: [
    "Feeling nervous, anxious, or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing",
    "Being so restless that it is hard to sit still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid, as if something awful might happen",
  ],
  bands: [
    { min: 0, max: 4, label: "minimal", tone: "green" },
    { min: 5, max: 9, label: "mild", tone: "blue" },
    { min: 10, max: 14, label: "moderate", tone: "amber" },
    { min: 15, max: 21, label: "severe", tone: "red" },
  ],
  note: "Strong evidence for tracking generalised anxiety symptoms over two-week windows. A screening total, not a diagnosis.",
};

export const PSS10: Instrument = {
  key: "pss10",
  name: "PSS-10",
  source: "Cohen, Kamarck & Mermelstein (1983), J Health Soc Behav.",
  cadenceDays: 28,
  scaleLabels: PSS_SCALE,
  items: [
    "In the last month, how often have you been upset because of something that happened unexpectedly?",
    "In the last month, how often have you felt that you were unable to control the important things in your life?",
    "In the last month, how often have you felt nervous and stressed?",
    "In the last month, how often have you felt confident about your ability to handle your personal problems?",
    "In the last month, how often have you felt that things were going your way?",
    "In the last month, how often have you found that you could not cope with all the things that you had to do?",
    "In the last month, how often have you been able to control irritations in your life?",
    "In the last month, how often have you felt that you were on top of things?",
    "In the last month, how often have you been angered because of things that were outside of your control?",
    "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",
  ],
  bands: [
    { min: 0, max: 13, label: "low perceived stress", tone: "green" },
    { min: 14, max: 26, label: "moderate perceived stress", tone: "blue" },
    { min: 27, max: 40, label: "high perceived stress", tone: "amber" },
  ],
  reverseItems: [3, 4, 6, 7],
  note: "Measures how unpredictable and overloaded life has felt in the last month. Moderate evidence: widely validated, but the bands are population descriptions, not clinical cut-offs.",
};

export const WHO5: Instrument = {
  key: "who5",
  name: "WHO-5",
  source: "WHO Regional Office for Europe (1998), Psychiatric Research Unit, Frederiksborg.",
  cadenceDays: 14,
  scaleLabels: WHO5_SCALE,
  items: [
    "Over the last two weeks, I have felt cheerful and in good spirits",
    "Over the last two weeks, I have felt calm and relaxed",
    "Over the last two weeks, I have felt active and vigorous",
    "Over the last two weeks, I woke up feeling fresh and rested",
    "Over the last two weeks, my daily life has been filled with things that interest me",
  ],
  bands: [
    { min: 0, max: 50, label: "low wellbeing — worth a conversation", tone: "amber" },
    { min: 51, max: 100, label: "adequate", tone: "green" },
  ],
  note: "Five items, raw 0–25, multiplied by 4 for a 0–100 percentage. Strong evidence as a wellbeing measure; the 50 mark is a screening prompt to talk to someone, never a verdict.",
};

export const ISI: Instrument = {
  key: "isi",
  name: "ISI",
  source: "Morin (1993); Bastien, Vallières & Morin (2001), Sleep Med.",
  cadenceDays: 28,
  scaleLabels: ISI_SCALE,
  items: [
    "Severity of difficulty falling asleep, over the last two weeks",
    "Severity of difficulty staying asleep, over the last two weeks",
    "Severity of the problem of waking up too early, over the last two weeks",
    "How satisfied or dissatisfied are you with your current sleep pattern?",
    "How noticeable to others do you think your sleep problem is, in terms of impairing your quality of life?",
    "How worried or distressed are you about your current sleep problem?",
    "To what extent do you consider your sleep problem to interfere with your daily functioning?",
  ],
  bands: [
    { min: 0, max: 7, label: "no clinically significant insomnia", tone: "green" },
    { min: 8, max: 14, label: "subthreshold insomnia", tone: "blue" },
    { min: 15, max: 21, label: "moderate insomnia", tone: "amber" },
    { min: 22, max: 28, label: "severe insomnia", tone: "red" },
  ],
  itemScaleLabels: [
    ISI_SCALE,
    ISI_SCALE,
    ISI_SCALE,
    ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very dissatisfied"],
    ["Not at all", "A little", "Somewhat", "Much", "Very much"],
    ["Not at all", "A little", "Somewhat", "Much", "Very much"],
    ["Not at all", "A little", "Somewhat", "Much", "Very much"],
  ],
  note: "Strong evidence for tracking insomnia severity and treatment response. Anchors differ per item; the score is the sum either way. It screens — it does not diagnose a sleep disorder.",
};

export const AUDITC: Instrument = {
  key: "auditc",
  name: "AUDIT-C",
  source: "Bush et al. (1998), Arch Intern Med — the three-item short form of the WHO AUDIT.",
  cadenceDays: 90,
  scaleLabels: ["0", "1", "2", "3", "4"],
  items: [
    "How often do you have a drink containing alcohol?",
    "How many standard drinks containing alcohol do you have on a typical day when you are drinking?",
    "How often do you have six or more standard drinks on one occasion?",
  ],
  itemScaleLabels: [
    ["Never", "Monthly or less", "2–4 times a month", "2–3 times a week", "4+ times a week"],
    ["1 or 2", "3 or 4", "5 or 6", "7 to 9", "10 or more"],
    ["Never", "Less than monthly", "Monthly", "Weekly", "Daily or almost daily"],
  ],
  bands: [
    { min: 0, max: 3, label: "below the screening threshold", tone: "green" },
    { min: 4, max: 12, label: "at or above the screening threshold", tone: "amber" },
  ],
  note: "Strong evidence as a brief screen for heavy drinking. Thresholds differ by sex: 4 or more (men), 3 or more (women). Above the threshold means 'worth a conversation with a GP', not 'you have a disorder'.",
};

/** AUDIT-C screening thresholds. Sex-specific by design — see Bush et al. (1998). */
export const AUDITC_THRESHOLDS: { male: number; female: number } = { male: 4, female: 3 };

export const PACS: Instrument = {
  key: "pacs",
  name: "PACS",
  source: "Flannery, Volpicelli & Pettinati (1999), Alcohol Clin Exp Res.",
  cadenceDays: 7,
  scaleLabels: PACS_SCALE,
  items: [
    "During the past week, how often have you thought about drinking, or about how good a drink would make you feel?",
    "During the past week, at its most severe point, how strong was your craving?",
    "During the past week, how much time did you spend thinking about drinking, or about how good a drink would make you feel?",
    "During the past week, how difficult would it have been to resist drinking if you had known alcohol was in your home?",
    "Rate your average craving over the past week.",
  ],
  bands: [
    { min: 0, max: 5, label: "minimal craving", tone: "green" },
    { min: 6, max: 14, label: "mild craving", tone: "blue" },
    { min: 15, max: 23, label: "moderate craving", tone: "amber" },
    { min: 24, max: 30, label: "strong craving", tone: "red" },
  ],
  note: "Validated for alcohol craving only. Applied to any other craving it is unvalidated — read it as your own trend line, not a validated measure. The bands here are descriptive: PACS has no official clinical cut-offs.",
};

export const INSTRUMENTS: Instrument[] = [PHQ9, GAD7, PSS10, WHO5, ISI, AUDITC, PACS];

/**
 * Survival mode's floor: the two shortest instruments. Five items and five
 * items. Everything else is an obligation the floor does not carry.
 */
export const SURVIVAL_INSTRUMENT_KEYS: InstrumentKey[] = ["who5", "pacs"];

export function instrumentByKey(key: string): Instrument | null {
  return INSTRUMENTS.find((i) => i.key === key) ?? null;
}

/** Highest possible total, after reverse scoring and any multiplier. */
export function maxScoreOf(instrument: Instrument): number {
  const perItem = instrument.scaleLabels.length - 1;
  const raw = perItem * instrument.items.length;
  return instrument.key === "who5" ? raw * 4 : raw;
}

/* ===== Prompts and templates ===== */

/**
 * Reflection prompts. Stoic in shape — examine the day, name the lever, keep
 * the scope to what you actually control. None of them ask you to feel better.
 */
export const MINDSET_PROMPTS: string[] = [
  "What was in your control today, and what was not? Name one of each.",
  "Which decision today would you make the same way tomorrow?",
  "What did the boring version of you do well today?",
  "Where did you spend effort on something you could not move?",
  "What is the smallest thing that made today easier?",
  "If today repeated twenty times, what would it build?",
  "What did you avoid, and what did avoiding it cost?",
  "Name one thing you did today that a person who keeps this up would do.",
];

/**
 * Reframes for a missed day. Self-compassion, no shame, no penance. The
 * abstinence violation effect is the failure mode — one lapse read as proof the
 * plan is over. Every line here refuses that reading.
 */
export const REFRAMES: string[] = [
  "A missed day is one data point, not a verdict. The loop continues.",
  "You did not fail a plan — a plan absorbed a bad day. That is what it is for.",
  "The streak is a measurement, not your character. Start the next one now.",
  "Nobody logs a perfect fortnight. Repair is a decision available right now.",
  "Missing yesterday changes nothing about what today can be. Same three checks.",
  "The lapse is logged. That is the whole penalty. Carry on.",
];

/** Weekly review prompts — one surfaces per day, rotating deterministically. */
export const WEEKLY_REVIEW_PROMPTS: string[] = [
  "What is one thing the last week's data says that you would not have guessed?",
  "Which check was hardest to hold, and what made it hard?",
  "What did you do this week that you want to still be doing in six months?",
  "Where did the plan meet reality and lose? What would a smaller plan look like?",
  "What did you learn about the hour before the craving, not the craving itself?",
  "Who noticed something about you this week? What did they see?",
  "What would you tell a friend running this exact week?",
];

export type CravingSignal = "tired" | "emotion" | "cue" | "bored" | "hungry";

export const CRAVING_SIGNALS: CravingSignal[] = ["tired", "emotion", "cue", "bored", "hungry"];

export type IntentionTemplate = { trigger: string; action: string };

/**
 * Implementation intentions — "if <situation> then <behaviour>". Moderate-to-
 * strong evidence: pre-deciding the response beats deciding in the moment,
 * because the moment is exactly when the deciding machinery is worst.
 * Keyed by the craving signal the trigger map says you actually get.
 */
export const INTENTION_TEMPLATES: Record<CravingSignal, IntentionTemplate[]> = {
  tired: [
    { trigger: "I'm tired and the evening craving arrives", action: "run the close-out ritual — skyr, two squares of dark, decaf — then go up" },
    { trigger: "I notice I'm too tired to decide well", action: "stop deciding: brush teeth, lights down, phone on the landing" },
    { trigger: "I want something sweet after a short night", action: "drink a full glass of water first and re-check in ten minutes" },
  ],
  emotion: [
    { trigger: "I want to eat because of how the day went", action: "name the feeling in one word, log it, then two minutes of breathing" },
    { trigger: "something lands badly and I head for the press", action: "message the crew one line before I open anything" },
    { trigger: "I feel flat and food looks like the fix", action: "step outside for five minutes, then decide" },
  ],
  cue: [
    { trigger: "I walk past the press with nothing in mind", action: "keep walking to the kettle and make the decaf instead" },
    { trigger: "the tin is on the counter", action: "put it out of sight before I sit down for the evening" },
    { trigger: "the ad or the smell lands", action: "say 'that's a cue, not a decision' out loud and carry on" },
  ],
  bored: [
    { trigger: "I'm bored and the kitchen is the plan", action: "ten press-ups, then sit back down with the glass of water" },
    { trigger: "I'm scrolling and grazing at the same time", action: "put the phone on the shelf and start the thing I said I'd do" },
    { trigger: "the evening has nothing in it", action: "start the ten-minute job I've been leaving — timer on" },
  ],
  hungry: [
    { trigger: "I'm genuinely hungry before the kitchen closes", action: "eat the planned protein portion, sitting down, no screen" },
    { trigger: "I under-ate at lunch and it shows by 20:00", action: "front-load protein at lunch tomorrow and log it" },
    { trigger: "I'm hungry after the kitchen has closed", action: "drink water, note the time, and fix the earlier meal tomorrow" },
  ],
};

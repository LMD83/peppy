import {
  INSTRUMENTS,
  INTENTION_TEMPLATES,
  MINDSET_PROMPTS,
  REFRAMES,
  SURVIVAL_INSTRUMENT_KEYS,
  WEEKLY_REVIEW_PROMPTS,
  instrumentByKey,
  maxScoreOf,
  type BandTone,
  type CravingSignal,
  type Instrument,
  type IntentionTemplate,
} from "./data/instruments";
import { daysBetween, type TmMode } from "./lib";
import type { WallDay } from "./logic";

/**
 * Pure Mind logic — scoring, cadence, trend framing, encouragement and
 * implementation intentions. Shared verbatim between the Convex handlers
 * (convex/tm/mind.ts) and the demo backend (src/app/_lib/demo/mind.ts) so both
 * produce identical numbers and identical words.
 *
 * Deterministic by construction: no Date.now(), no Math.random(). Every date
 * arrives as an argument, and every "random-feeling" pick is an index derived
 * from the date string.
 *
 * Non-negotiable boundary: nothing in this module produces a diagnosis, a
 * clinical claim, or an instruction to start, stop or change a medication. It
 * totals self-report answers, states which band the total falls in, and says
 * what changed since last time. That is the whole remit.
 */

/* ===== errors ===== */

export type MindErrorCode =
  | "unknown-instrument"
  | "wrong-answer-count"
  | "answer-out-of-range"
  | "answer-not-integer";

/** Typed so callers can map to a ConvexError code instead of leaking a stack. */
export class InstrumentInputError extends Error {
  readonly code: MindErrorCode;
  constructor(code: MindErrorCode, message: string) {
    super(message);
    this.name = "InstrumentInputError";
    this.code = code;
  }
}

/* ===== deterministic picking ===== */

/** Stable index from a date string — same day, same pick, on every device. */
export function dateIndex(date: string, length: number): number {
  if (length <= 0) return 0;
  let h = 7;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) % 100003;
  return h % length;
}

/* ===== scoring ===== */

export type InstrumentScore = {
  score: number;
  band: string;
  tone: BandTone;
  /** True only when the instrument declares a safety item and it was answered above zero. */
  safetyFlag: boolean;
};

export function bandFor(instrument: Instrument, score: number): { label: string; tone: BandTone } {
  const hit = instrument.bands.find((b) => score >= b.min && score <= b.max);
  // Bands cover the full range by construction; fall back rather than crash a render.
  const band = hit ?? instrument.bands[instrument.bands.length - 1];
  return { label: band.label, tone: band.tone };
}

/**
 * Total a set of answers. Answers are the raw anchor indices as tapped; reverse
 * scoring and the WHO-5 multiplier are applied here and only here, so a client
 * can never pre-compute a score we would trust.
 */
export function scoreInstrument(
  instrument: Instrument,
  answers: readonly number[],
): InstrumentScore {
  if (answers.length !== instrument.items.length) {
    throw new InstrumentInputError(
      "wrong-answer-count",
      `${instrument.key} expects ${instrument.items.length} answers, got ${answers.length}`,
    );
  }
  const max = instrument.scaleLabels.length - 1;
  const reverse = new Set(instrument.reverseItems ?? []);
  let raw = 0;
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    if (!Number.isInteger(a)) {
      throw new InstrumentInputError("answer-not-integer", `${instrument.key} item ${i + 1} is not an integer`);
    }
    if (a < 0 || a > max) {
      throw new InstrumentInputError(
        "answer-out-of-range",
        `${instrument.key} item ${i + 1} must be 0–${max}`,
      );
    }
    raw += reverse.has(i) ? max - a : a;
  }
  // WHO-5 reports a 0–100 percentage of maximum wellbeing, not the raw 0–25.
  const score = instrument.key === "who5" ? raw * 4 : raw;
  const band = bandFor(instrument, score);
  const safetyIndex = instrument.safetyItemIndex;
  const safetyFlag = safetyIndex !== undefined && answers[safetyIndex] > 0;
  return { score, band: band.label, tone: band.tone, safetyFlag };
}

/* ===== cadence ===== */

export type AssessmentPoint = { instrument: string; date: string };

export type DueAssessment = {
  key: string;
  name: string;
  /** Null when the instrument has never been taken. */
  daysSince: number | null;
  cadenceDays: number;
};

/**
 * Never taken, or last taken longer ago than its cadence. Ordered most-overdue
 * first, with never-taken instruments ahead of merely-late ones.
 */
export function dueAssessments(
  instruments: readonly Instrument[],
  history: readonly AssessmentPoint[],
  today: string,
): DueAssessment[] {
  const latest = new Map<string, string>();
  for (const row of history) {
    const seen = latest.get(row.instrument);
    if (!seen || row.date > seen) latest.set(row.instrument, row.date);
  }
  const due: DueAssessment[] = [];
  for (const inst of instruments) {
    const last = latest.get(inst.key);
    if (last === undefined) {
      due.push({ key: inst.key, name: inst.name, daysSince: null, cadenceDays: inst.cadenceDays });
      continue;
    }
    const daysSince = daysBetween(last, today);
    if (daysSince >= inst.cadenceDays) {
      due.push({ key: inst.key, name: inst.name, daysSince, cadenceDays: inst.cadenceDays });
    }
  }
  return due.sort((a, b) => {
    if (a.daysSince === null && b.daysSince === null) return a.key.localeCompare(b.key);
    if (a.daysSince === null) return -1;
    if (b.daysSince === null) return 1;
    const overdueA = a.daysSince - a.cadenceDays;
    const overdueB = b.daysSince - b.cadenceDays;
    return overdueB - overdueA || a.key.localeCompare(b.key);
  });
}

/* ===== trend ===== */

export type ScorePoint = { date: string; score: number };

export type Trend = {
  previous: ScorePoint | null;
  latest: ScorePoint | null;
  change: number | null;
  direction: "up" | "down" | "flat" | "none";
  /** Always states the epistemic status of the number. Never omitted. */
  framing: string;
};

export const TREND_FRAMING = "tracked, correlated — never diagnosed";

/**
 * Latest versus the one before it. Two self-reports a fortnight apart are a
 * pair of self-reports, so the framing says exactly that and nothing more.
 */
export function trendFor(history: readonly ScorePoint[]): Trend {
  const ascending = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ascending.length > 0 ? ascending[ascending.length - 1] : null;
  const previous = ascending.length > 1 ? ascending[ascending.length - 2] : null;
  if (!latest) {
    return {
      previous: null,
      latest: null,
      change: null,
      direction: "none",
      framing: `No entries yet — ${TREND_FRAMING}.`,
    };
  }
  if (!previous) {
    return {
      previous: null,
      latest,
      change: null,
      direction: "none",
      framing: `One entry is a reading, not a trend — ${TREND_FRAMING}.`,
    };
  }
  const change = latest.score - previous.score;
  const direction = change === 0 ? "flat" : change > 0 ? "up" : "down";
  const span = daysBetween(previous.date, latest.date);
  const moved =
    direction === "flat"
      ? "unchanged"
      : `${direction === "up" ? "+" : "−"}${Math.abs(change)} vs the previous entry`;
  return {
    previous,
    latest,
    change,
    direction,
    framing: `${moved} over ${span} day${span === 1 ? "" : "s"} — ${TREND_FRAMING}.`,
  };
}

/* ===== encouragement ===== */

export type EncouragementInput = {
  mode: TmMode;
  streak: number;
  adherence7: number;
  missedYesterday: boolean;
  date: string;
};

export type Encouragement = { headline: string; body: string; tone: BandTone };

/** Identity, not exhortation. "You are someone who…", never "you should…". */
export const IDENTITY_HEADLINES: string[] = [
  "You are someone who logs the boring days",
  "You are someone who measures before deciding",
  "You are someone who keeps the floor",
  "You are someone who shows up on a flat day",
  "You are someone who writes the response in advance",
];

export function encouragementFor(input: EncouragementInput): Encouragement {
  const { mode, streak, adherence7, missedYesterday, date } = input;
  const survival = mode === "survival";

  if (missedYesterday) {
    const reframe = REFRAMES[dateIndex(date, REFRAMES.length)];
    return {
      headline: survival ? "The floor is still the floor" : "Repair is a decision, not a penance",
      body: `${reframe} Nothing is owed and nothing is made up — the next full day is available today.`,
      tone: "amber",
    };
  }

  if (survival) {
    return {
      headline: "Three checks. That is the whole job.",
      body:
        streak > 0
          ? `${streak} day${streak === 1 ? "" : "s"} of holding the floor. Holding it is the win this season — there is no bonus round.`
          : "No streak needed. Hold the three checks today and the season is being executed as designed.",
      tone: "amber",
    };
  }

  const headline = IDENTITY_HEADLINES[dateIndex(date, IDENTITY_HEADLINES.length)];
  if (streak >= 7) {
    return {
      headline,
      body: `${streak} full days running, ${adherence7}% across the last complete week. That is what the identity looks like from the outside.`,
      tone: "green",
    };
  }
  if (streak > 0) {
    return {
      headline,
      body: `${streak} full day${streak === 1 ? "" : "s"} running, ${adherence7}% across the last complete week. Boring and repeatable beats good and occasional.`,
      tone: "green",
    };
  }
  return {
    headline,
    body: `${adherence7}% across the last complete week. No streak running — the next one starts with today's checks, and nothing has to be made up first.`,
    tone: "blue",
  };
}

/** One prompt per day, rotating deterministically through the weekly set. */
export function promptForDate(date: string): string {
  return WEEKLY_REVIEW_PROMPTS[dateIndex(date, WEEKLY_REVIEW_PROMPTS.length)];
}

/** The reflection line shown under an encouragement card. */
export function mindsetPromptForDate(date: string): string {
  return MINDSET_PROMPTS[dateIndex(date, MINDSET_PROMPTS.length)];
}

/* ===== the quiet check ===== */

export const QUIET_THRESHOLD_DAYS = 3;

export type QuietCheck = {
  days: number;
  heading: string;
  body: string;
  support: string;
};

/**
 * Consecutive days before today with nothing logged, read off the same 14-day
 * check wall the streak uses. Today is still in play and cannot be quiet yet —
 * the same rule the streak follows. A single logged check ends the run.
 */
export function quietStreak(wall: readonly WallDay[], today: string): number {
  let run = 0;
  for (let i = wall.length - 1; i >= 0; i--) {
    const day = wall[i];
    if (day.date >= today) continue; // today is still in play — it cannot be quiet yet
    if (day.done > 0) break;
    run++;
  }
  return run;
}

/**
 * Three-plus quiet days surface a question, not a verdict. The file cannot be
 * quieter than it is old — a brand-new file has not gone quiet, it has just
 * started — so the run is capped at the file's age. This card is support in
 * the REFRAMES voice: no streak arithmetic, no penance, one question.
 */
export function quietCheckFor(input: {
  wall: readonly WallDay[];
  startDate: string;
  date: string;
}): QuietCheck | null {
  const age = Math.max(0, daysBetween(input.startDate, input.date));
  const days = Math.min(quietStreak(input.wall, input.date), age);
  if (days < QUIET_THRESHOLD_DAYS) return null;
  return {
    days,
    heading: "You've gone quiet.",
    body: `Nothing logged in ${days} days. No streak guilt — the file is a tool, not a judge. Are you ok?`,
    support: SUPPORT_LINES,
  };
}

/* ===== implementation intentions ===== */

export type TriggerBucket = { hour: number; counts: Record<string, number> };

export type MindSuggestion = { signal: string; trigger: string; action: string };

const SIGNAL_ORDER: CravingSignal[] = ["tired", "emotion", "cue", "bored", "hungry"];

/** Signal totals across the whole trigger map, highest first, ties by fixed order. */
export function topSignals(triggerMap: readonly TriggerBucket[]): { signal: CravingSignal; count: number }[] {
  const totals = new Map<CravingSignal, number>();
  for (const bucket of triggerMap) {
    for (const signal of SIGNAL_ORDER) {
      const n = bucket.counts[signal] ?? 0;
      if (n > 0) totals.set(signal, (totals.get(signal) ?? 0) + n);
    }
  }
  return SIGNAL_ORDER.filter((s) => (totals.get(s) ?? 0) > 0)
    .map((signal) => ({ signal, count: totals.get(signal) ?? 0 }))
    .sort((a, b) => b.count - a.count || SIGNAL_ORDER.indexOf(a.signal) - SIGNAL_ORDER.indexOf(b.signal));
}

export const MAX_SUGGESTIONS = 4;

/**
 * If-then plans built from the signals this person actually logs. No craving
 * logs means no suggestions — the app does not invent a pattern it has not seen.
 */
export function intentionSuggestions(
  triggerMap: readonly TriggerBucket[],
  templates: Record<CravingSignal, IntentionTemplate[]> = INTENTION_TEMPLATES,
): MindSuggestion[] {
  const out: MindSuggestion[] = [];
  for (const { signal } of topSignals(triggerMap).slice(0, 2)) {
    for (const t of (templates[signal] ?? []).slice(0, 2)) {
      out.push({ signal, trigger: t.trigger, action: t.action });
    }
  }
  return out.slice(0, MAX_SUGGESTIONS);
}

/* ===== the view ===== */

export type RawAssessment = {
  date: string;
  instrument: string;
  answers: number[];
  score: number;
  band: string;
};

export type RawIntention = {
  id: string;
  trigger: string;
  action: string;
  active: boolean;
  createdDate: string;
  wins: number;
};

export type RawReflection = {
  date: string;
  prompt: string;
  response: string;
  win: string | null;
};

export type MindViewInput = {
  mode: TmMode;
  date: string;
  /** The day the file started — the quiet check cannot predate it. */
  startDate: string;
  assessments: RawAssessment[];
  intentions: RawIntention[];
  reflections: RawReflection[];
  triggerMap: TriggerBucket[];
  /** The same 14-day check wall the streak and adherence numbers come from. */
  wall: WallDay[];
  streak: number;
  adherence7: number;
  missedYesterday: boolean;
};

/** Instrument definition flattened for the wire — no optional fields, no undefined. */
export type InstrumentView = {
  key: string;
  name: string;
  source: string;
  cadenceDays: number;
  scaleLabels: string[];
  items: string[];
  itemScaleLabels: string[][] | null;
  bands: { min: number; max: number; label: string; tone: BandTone }[];
  reverseItems: number[];
  safetyItemIndex: number | null;
  maxScore: number;
  note: string;
};

export type HistoryEntry = {
  key: string;
  name: string;
  latest: { date: string; score: number; band: string; tone: BandTone } | null;
  previous: { date: string; score: number; band: string; tone: BandTone } | null;
  trend: Trend;
  points: ScorePoint[];
  maxScore: number;
};

export type IntentionView = {
  id: string;
  trigger: string;
  action: string;
  wins: number;
  active: boolean;
};

export type ReflectionView = { date: string; prompt: string; response: string; win: string | null };

export type SafetyNotice = { active: boolean; text: string };

export type MindView = {
  due: DueAssessment[];
  instruments: InstrumentView[];
  history: HistoryEntry[];
  safetyNotice: SafetyNotice;
  /** Null until three-plus consecutive quiet days. Support, never assessment. */
  quietCheck: QuietCheck | null;
  intentions: IntentionView[];
  suggestions: MindSuggestion[];
  reflections: ReflectionView[];
  encouragement: Encouragement;
  weeklyPrompt: string;
  survival: boolean;
};

/**
 * The support lines every support card shares — real numbers a person in
 * Ireland can actually ring, and a task small enough to be done tonight.
 */
export const SUPPORT_LINES =
  "If you are in immediate danger, contact emergency services (999 or 112). Samaritans are free, 24/7, on 116 123. Telling one person tonight — your GP, the crew, anyone — counts as the whole task.";

/**
 * Support surfaced by a self-report answer. It is not a risk assessment, and it
 * must not read like one: no severity language, no "you are", real numbers that
 * a person in Ireland can actually ring. It stays up while the flag stands.
 */
export const SAFETY_TEXT = `You answered above zero on the last PHQ-9 item, about thoughts of being better off dead or of hurting yourself. That answer surfaces this card — it is support, not an assessment of you. ${SUPPORT_LINES}`;

export const MAX_TREND_POINTS = 12;

function pointsFor(rows: readonly RawAssessment[]): ScorePoint[] {
  return rows
    .map((r) => ({ date: r.date, score: r.score }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_TREND_POINTS);
}

/** Whether the most recent PHQ-9 flagged its safety item. Only the latest counts. */
export function safetyFlagged(assessments: readonly RawAssessment[]): boolean {
  const phq9 = instrumentByKey("phq9");
  if (!phq9 || phq9.safetyItemIndex === undefined) return false;
  const rows = assessments
    .filter((a) => a.instrument === "phq9")
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = rows[rows.length - 1];
  if (!latest) return false;
  const answer = latest.answers[phq9.safetyItemIndex];
  return typeof answer === "number" && answer > 0;
}

export function buildMindView(input: MindViewInput): MindView {
  const survival = input.mode === "survival";

  // Survival caps the instrument set at the two shortest. The floor removes
  // obligations; it does not offer a longer questionnaire on a worse week.
  const offered = survival
    ? INSTRUMENTS.filter((i) => SURVIVAL_INSTRUMENT_KEYS.includes(i.key))
    : INSTRUMENTS;

  const due = dueAssessments(offered, input.assessments, input.date);

  const history: HistoryEntry[] = [];
  for (const inst of offered) {
    const rows = input.assessments.filter((a) => a.instrument === inst.key);
    if (rows.length === 0) continue;
    const points = pointsFor(rows);
    const trend = trendFor(points);
    const decorate = (p: ScorePoint | null) => {
      if (!p) return null;
      const band = bandFor(inst, p.score);
      return { date: p.date, score: p.score, band: band.label, tone: band.tone };
    };
    history.push({
      key: inst.key,
      name: inst.name,
      latest: decorate(trend.latest),
      previous: decorate(trend.previous),
      trend,
      points,
      maxScore: maxScoreOf(inst),
    });
  }

  const intentions: IntentionView[] = [...input.intentions]
    .sort((a, b) => b.wins - a.wins || a.createdDate.localeCompare(b.createdDate) || a.id.localeCompare(b.id))
    .map((i) => ({ id: i.id, trigger: i.trigger, action: i.action, wins: i.wins, active: i.active }));

  const taken = new Set(intentions.map((i) => i.action));
  const suggestions = survival
    ? []
    : intentionSuggestions(input.triggerMap).filter((s) => !taken.has(s.action));

  const reflections = [...input.reflections]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((r) => ({ date: r.date, prompt: r.prompt, response: r.response, win: r.win }));

  return {
    due,
    instruments: offered.map(toInstrumentView),
    history,
    safetyNotice: { active: safetyFlagged(input.assessments), text: SAFETY_TEXT },
    quietCheck: quietCheckFor({ wall: input.wall, startDate: input.startDate, date: input.date }),
    intentions,
    suggestions,
    reflections,
    encouragement: encouragementFor({
      mode: input.mode,
      streak: input.streak,
      adherence7: input.adherence7,
      missedYesterday: input.missedYesterday,
      date: input.date,
    }),
    weeklyPrompt: promptForDate(input.date),
    survival,
  };
}

export function toInstrumentView(inst: Instrument): InstrumentView {
  return {
    key: inst.key,
    name: inst.name,
    source: inst.source,
    cadenceDays: inst.cadenceDays,
    scaleLabels: [...inst.scaleLabels],
    items: [...inst.items],
    itemScaleLabels: inst.itemScaleLabels ? inst.itemScaleLabels.map((s) => [...s]) : null,
    bands: inst.bands.map((b) => ({ min: b.min, max: b.max, label: b.label, tone: b.tone })),
    reverseItems: [...(inst.reverseItems ?? [])],
    safetyItemIndex: inst.safetyItemIndex ?? null,
    maxScore: maxScoreOf(inst),
    note: inst.note,
  };
}

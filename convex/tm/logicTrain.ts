import { daysBetween } from "./lib";
import {
  DEFAULT_TRAIN_PROFILE,
  EXERCISE_BY_KEY,
  EXERCISES,
  MUSCLES,
  exerciseName,
  type AgeBand,
  type Constraint,
  type Exercise,
  type Experience,
  type Kit,
  type Landmark,
  type Muscle,
  type Setting,
  type TrainVoice,
  type TrainingProfile,
} from "./data/exercises";

export type { TrainingProfile, TrainVoice };

/**
 * Pure training logic — autoregulation, double progression, volume accounting.
 * Shared verbatim by convex/tm/train.ts and the demo store so both compute the
 * same numbers. Every function is total: empty history, missing state and zero
 * reps all return something sane rather than throwing.
 *
 * Everything here estimates. e1RM is Epley arithmetic, not a tested max;
 * landmarks and RIR targets are planning heuristics (moderate evidence).
 * Nothing here diagnoses, and no load is prescribed that the block did not ask
 * for.
 */

/** Round to the nearest half kilo — the smallest plate change worth writing. */
export function roundHalf(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  return Math.round(kg * 2) / 2;
}

export type SetPerf = { weightKg: number; reps: number; rir: number };
export type DatedSet = SetPerf & { date: string; exercise: string };

/** Epley on reps-to-failure: reps + RIR is what the set was actually worth. */
export function e1rm(weightKg: number, reps: number, rir: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(reps) || reps <= 0) return 0;
  const toFailure = reps + Math.max(0, Number.isFinite(rir) ? rir : 0);
  return roundHalf(weightKg * (1 + toFailure / 30));
}

/* ===== Double progression ===== */

export type ProgressionBlock = {
  repLow: number;
  repHigh: number;
  rirTarget: number;
  loadStepKg: number;
};

export type ProgressionAction = "start" | "add-load" | "add-rep" | "back-off";

export type Progression = {
  action: ProgressionAction;
  deltaKg: number;
  suggestionKg: number;
  why: string;
};

/**
 * All sets at/above repHigh with RIR at/below target → the load goes up.
 * Any set under repLow → the load was too heavy; take 5% off.
 * Anything between → hold the load and buy one more rep.
 */
export function progressionFor(lastSessionSets: SetPerf[], block: ProgressionBlock): Progression {
  const sets = lastSessionSets.filter(
    (s) => Number.isFinite(s.weightKg) && Number.isFinite(s.reps) && s.reps > 0,
  );
  const step = Number.isFinite(block.loadStepKg) && block.loadStepKg > 0 ? block.loadStepKg : 2.5;
  if (sets.length === 0) {
    return {
      action: "start",
      deltaKg: 0,
      suggestionKg: 0,
      why: "No history on this lift — pick a load you could stop two reps short of, then log it.",
    };
  }

  const load = Math.max(...sets.map((s) => s.weightKg));
  const allTopped = sets.every((s) => s.reps >= block.repHigh && s.rir <= block.rirTarget);
  const anyShort = sets.some((s) => s.reps < block.repLow);

  if (allTopped) {
    const suggestionKg = roundHalf(load + step);
    return {
      action: "add-load",
      deltaKg: step,
      suggestionKg,
      why: `Every set hit ${block.repHigh}+ at ${block.rirTarget} RIR or harder — load goes up ${step} kg.`,
    };
  }
  if (anyShort) {
    const suggestionKg = roundHalf(load * 0.95);
    return {
      action: "back-off",
      deltaKg: roundHalf(suggestionKg - load),
      suggestionKg,
      why: `A set fell under ${block.repLow} reps — take 5% off and rebuild the range.`,
    };
  }
  return {
    action: "add-rep",
    deltaKg: 0,
    suggestionKg: roundHalf(load),
    why: `Reps still inside ${block.repLow}–${block.repHigh} — hold ${roundHalf(load)} kg and add one rep.`,
  };
}

/* ===== Mesocycle position ===== */

export type MesoPhase = "accumulation" | "deload" | "complete";

export type MesoWeek = { week: number; isDeload: boolean; phase: MesoPhase };

export function mesoWeekFor(
  startDate: string,
  date: string,
  weeks: number,
  deloadWeek: number,
): MesoWeek {
  const total = Number.isFinite(weeks) && weeks > 0 ? Math.floor(weeks) : 1;
  const elapsed = daysBetween(startDate, date);
  if (!Number.isFinite(elapsed)) return { week: 1, isDeload: false, phase: "accumulation" };
  const raw = Math.floor(elapsed / 7) + 1;
  if (raw > total) return { week: total, isDeload: false, phase: "complete" };
  const week = Math.max(1, raw);
  const isDeload = week === deloadWeek;
  return { week, isDeload, phase: isDeload ? "deload" : "accumulation" };
}

/* ===== Volume ===== */

/** Hard sets per muscle inside [fromDate, toDate]. Unknown lifts are skipped. */
export function volumeSetsByMuscle(
  setLogs: { date: string; exercise: string }[],
  exerciseByKey: Record<string, { muscle: Muscle }>,
  fromDate: string,
  toDate: string,
): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const m of MUSCLES) out[m] = 0;
  for (const row of setLogs) {
    if (row.date < fromDate || row.date > toDate) continue;
    const ex = exerciseByKey[row.exercise];
    if (!ex) continue;
    out[ex.muscle] += 1;
  }
  return out;
}

export type VolumeVerdict = "below MEV" | "productive" | "at MRV" | "over MRV";

export function volumeVerdict(
  sets: number,
  landmark: Landmark,
): { verdict: VolumeVerdict; note: string } {
  const n = Number.isFinite(sets) ? Math.max(0, sets) : 0;
  if (n < landmark.mev)
    return {
      verdict: "below MEV",
      note: `${plural(landmark.mev - n, "set")} short of the minimum that grows anything.`,
    };
  if (n > landmark.mrv)
    return {
      verdict: "over MRV",
      note: "Past what you can recover from — cut sets before the next week.",
    };
  if (n >= landmark.mrv)
    return { verdict: "at MRV", note: "Ceiling week. Hold here, then deload." };
  if (n < landmark.mav)
    return {
      verdict: "productive",
      note: `${plural(landmark.mav - n, "set")} under MAV — room to add.`,
    };
  return { verdict: "productive", note: "Between MAV and MRV — let it accumulate." };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/* ===== Readiness ===== */

export type Readiness = { multiplier: number; note: string; dropSet: boolean };

const MIN_MULTIPLIER = 0.85;

/**
 * Stress and energy are 1–5 (stress high = bad, energy high = good). Missing
 * state means no adjustment — we never invent a number you did not log.
 */
export function readinessAdjust(
  stress: number | null | undefined,
  energy: number | null | undefined,
  isDeload = false,
): Readiness {
  if (isDeload)
    return {
      multiplier: MIN_MULTIPLIER,
      note: "deload week — 15% off the bar and one set fewer per block",
      dropSet: true,
    };
  const s = clamp1to5(stress);
  const e = clamp1to5(energy);
  if (s === null || e === null)
    return { multiplier: 1, note: "no state logged", dropSet: false };

  // 1 (wrecked) → 5 (green). Midpoint of energy and inverted stress.
  const score = (e + (6 - s)) / 2;
  const multiplier =
    Math.round((MIN_MULTIPLIER + ((score - 1) / 4) * (1 - MIN_MULTIPLIER)) * 100) / 100;
  const note =
    multiplier >= 0.98
      ? "stress low, energy high — run the programmed load"
      : multiplier >= 0.93
        ? "middling state — keep the sets, trim the top load"
        : "stress high, energy low — take the load down and keep the sets";
  return { multiplier, note, dropSet: false };
}

function clamp1to5(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.min(5, Math.max(1, value));
}

/* ===== History ===== */

export type LastSession = { date: string; sets: SetPerf[] };

/** Sets from the most recent day this lift was trained. */
export function lastSessionFor(setLogs: DatedSet[], exercise: string): LastSession | null {
  const rows = setLogs.filter((r) => r.exercise === exercise);
  if (rows.length === 0) return null;
  let date = rows[0].date;
  for (const r of rows) if (r.date > date) date = r.date;
  const sets = rows
    .filter((r) => r.date === date)
    .map((r) => ({ weightKg: r.weightKg, reps: r.reps, rir: r.rir }));
  return { date, sets };
}

export type TopSet = SetPerf & { date: string; e1rm: number };

/** Best set (by e1RM) of the most recent session for this lift. */
export function topSetFor(setLogs: DatedSet[], exercise: string): TopSet | null {
  const last = lastSessionFor(setLogs, exercise);
  if (!last || last.sets.length === 0) return null;
  let best = last.sets[0];
  let bestE = e1rm(best.weightKg, best.reps, best.rir);
  for (const s of last.sets) {
    const est = e1rm(s.weightKg, s.reps, s.rir);
    if (est > bestE) {
      best = s;
      bestE = est;
    }
  }
  return { ...best, date: last.date, e1rm: bestE };
}

export type Pr = { exercise: string; e1rm: number; date: string };

/** Best estimated 1RM per lift, with the day it happened. Strongest first. */
export function prsFrom(setLogs: DatedSet[]): Pr[] {
  const best = new Map<string, Pr>();
  for (const row of setLogs) {
    const est = e1rm(row.weightKg, row.reps, row.rir);
    if (est <= 0) continue;
    const current = best.get(row.exercise);
    if (!current || est > current.e1rm) {
      best.set(row.exercise, { exercise: row.exercise, e1rm: est, date: row.date });
    }
  }
  return Array.from(best.values()).sort((a, b) => b.e1rm - a.e1rm || a.exercise.localeCompare(b.exercise));
}

/* ===== Profile filter, swaps, language ===== */

function skillOk(skill: Exercise["skill"], experience: TrainingProfile["experience"]): boolean {
  if (skill === "foundations") return true;
  if (skill === "standard") return experience === "returning" || experience === "trained";
  return experience === "trained";
}

/** Bodyweight kit "none" is always owned. Everything else must be in the bag. */
function kitOk(ex: Exercise, profile: TrainingProfile): boolean {
  return ex.kit.some((k) => k === "none" || profile.kit.includes(k));
}

export function exerciseAllowed(ex: Exercise, profile: TrainingProfile): boolean {
  if (!ex.settings.includes(profile.setting)) return false;
  if (!kitOk(ex, profile)) return false;
  if (!skillOk(ex.skill, profile.experience)) return false;
  if (ex.blocks.some((b) => profile.constraints.includes(b))) return false;
  return true;
}

export function legalSwaps(key: string, profile: TrainingProfile): string[] {
  const ex = EXERCISE_BY_KEY[key];
  if (!ex) return [];
  const fromSwaps = ex.swaps.filter((s) => {
    const other = EXERCISE_BY_KEY[s];
    return other && exerciseAllowed(other, profile);
  });
  if (fromSwaps.length > 0) return fromSwaps;
  return EXERCISES.filter(
    (other) =>
      other.key !== key &&
      other.muscle === ex.muscle &&
      other.pattern === ex.pattern &&
      exerciseAllowed(other, profile),
  ).map((other) => other.key);
}

export function resolveExercise(key: string, profile: TrainingProfile): string | null {
  const ex = EXERCISE_BY_KEY[key];
  if (!ex) return null;
  if (exerciseAllowed(ex, profile)) {
    if (profile.ageBand === "60-plus" && ex.impact === "normal") {
      const easier = legalSwaps(key, profile)
        .map((s) => EXERCISE_BY_KEY[s])
        .find((other) => other && other.impact === "low" && exerciseAllowed(other, profile));
      if (easier) return easier.key;
    }
    return key;
  }
  const swaps = legalSwaps(key, profile);
  if (swaps[0]) return swaps[0];
  const fallback = EXERCISES.find(
    (other) => other.muscle === ex.muscle && exerciseAllowed(other, profile),
  );
  return fallback?.key ?? null;
}

export function sessionScale(profile: TrainingProfile): {
  setDelta: number;
  rounds: number;
  preferLowImpact: boolean;
  maxBlocks: number;
} {
  let setDelta = 0;
  if (profile.experience === "new") setDelta -= 1;
  if (profile.ageBand === "60-plus") setDelta -= 1;
  const rounds = profile.experience === "new" || profile.ageBand === "60-plus" || profile.minutes < 25 ? 2 : 3;
  const perBlock = profile.setting === "gym" ? 8 : 5;
  const maxBlocks = Math.max(3, Math.floor(profile.minutes / perBlock));
  return {
    setDelta,
    rounds,
    preferLowImpact: profile.ageBand === "60-plus",
    maxBlocks,
  };
}

export function volumeLabel(
  verdict: VolumeVerdict,
  note: string,
  voice: TrainVoice,
): { verdict: string; note: string } {
  if (voice === "standard") return { verdict, note };
  switch (verdict) {
    case "below MEV":
      return { verdict: "not enough this week", note: "A bit light. Another session would help." };
    case "productive":
      return { verdict: "on track", note: "This week is doing the job." };
    case "at MRV":
      return { verdict: "enough — hold", note: "Hold here. More would cost more than it buys." };
    case "over MRV":
      return { verdict: "too much this week", note: "Ease off a set or two next time." };
    default: {
      const _never: never = verdict;
      return { verdict: _never, note };
    }
  }
}

export function targetLine(
  block: { sets: number; repLow: number; repHigh: number; rirTarget: number },
  voice: TrainVoice,
): string {
  const range = `${block.sets} × ${block.repLow}–${block.repHigh}`;
  if (voice === "easy") return `${range}, leave ${block.rirTarget} in the tank`;
  return `${range} @ ${block.rirTarget} RIR`;
}

export function survivalMoveFor(profile: TrainingProfile): { name: string; minutes: number; cue: string } {
  if (profile.constraints.includes("impact") || profile.ageBand === "60-plus") {
    return { name: "Easy walk", minutes: 8, cue: "A corridor or a block. Talk-pace. Nothing to make up." };
  }
  return { name: "Walk or easy mobility", minutes: 8, cue: "Eight minutes. Walk, or the hip hinge and a dead bug. Nothing owed." };
}

const SETTINGS: Setting[] = ["home", "gym", "box"];
const KITS: Kit[] = [
  "none",
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "pull-up-bar",
  "bench",
  "box",
  "rower",
  "bike",
  "jump-rope",
  "rings",
  "wall-ball",
];
const EXPERIENCES: Experience[] = ["new", "returning", "trained"];
const AGE_BANDS: AgeBand[] = ["under-40", "40-59", "60-plus"];
const CONSTRAINTS: Constraint[] = ["knees", "shoulders", "floor", "impact", "overhead"];

function isIn<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function profileFromRow(row: {
  setting: string;
  kit: string[];
  experience: string;
  ageBand: string;
  minutes: number;
  constraints: string[];
}): TrainingProfile {
  const kit = row.kit.filter((k): k is Kit => isIn(k, KITS));
  return {
    setting: isIn(row.setting, SETTINGS) ? row.setting : DEFAULT_TRAIN_PROFILE.setting,
    kit: kit.length > 0 ? kit : [...DEFAULT_TRAIN_PROFILE.kit],
    experience: isIn(row.experience, EXPERIENCES) ? row.experience : DEFAULT_TRAIN_PROFILE.experience,
    ageBand: isIn(row.ageBand, AGE_BANDS) ? row.ageBand : DEFAULT_TRAIN_PROFILE.ageBand,
    minutes: Number.isFinite(row.minutes) ? Math.min(180, Math.max(10, Math.round(row.minutes))) : 60,
    constraints: row.constraints.filter((c): c is Constraint => isIn(c, CONSTRAINTS)),
  };
}

export type SessionBlock = {
  exercise: string;
  muscle: Muscle;
  sets: number;
  repLow: number;
  repHigh: number;
  rirTarget: number;
  lastTopSet: { weightKg: number; reps: number; rir: number } | null;
  suggestionKg: number;
  why: string;
  e1rm: number;
  cue: string;
  swaps: { key: string; name: string }[];
  targetLine: string;
};

function isMuscle(value: string): value is Muscle {
  return (MUSCLES as string[]).includes(value);
}

export function sessionBlockFor(
  programmed: {
    exercise: string;
    muscle: string;
    sets: number;
    repLow: number;
    repHigh: number;
    rirTarget: number;
  },
  profile: TrainingProfile,
  voice: TrainVoice,
  history: DatedSet[],
  readiness: Readiness,
): SessionBlock | null {
  const resolvedKey = resolveExercise(programmed.exercise, profile);
  if (!resolvedKey) return null;
  const exercise = EXERCISE_BY_KEY[resolvedKey];
  if (!exercise) return null;
  const scale = sessionScale(profile);
  const last = lastSessionFor(history, resolvedKey);
  const top = topSetFor(history, resolvedKey);
  const progression = progressionFor(last?.sets ?? [], {
    repLow: programmed.repLow,
    repHigh: programmed.repHigh,
    rirTarget: programmed.rirTarget,
    loadStepKg: exercise.loadStepKg,
  });
  const scaled = roundHalf(progression.suggestionKg * readiness.multiplier);
  const why =
    readiness.multiplier < 1 && progression.suggestionKg > 0
      ? `${progression.why} Readiness ×${readiness.multiplier.toFixed(2)} → ${scaled.toFixed(1)} kg today.`
      : progression.why;
  const sets = Math.max(1, programmed.sets + scale.setDelta - (readiness.dropSet ? 1 : 0));
  const whyVoice =
    voice === "easy"
      ? why.replace(/\bRIR\b/g, "left in the tank").replace(/e1RM/gi, "best estimate")
      : why;
  return {
    exercise: resolvedKey,
    muscle: isMuscle(programmed.muscle) ? programmed.muscle : exercise.muscle,
    sets,
    repLow: programmed.repLow,
    repHigh: programmed.repHigh,
    rirTarget: programmed.rirTarget,
    lastTopSet: top ? { weightKg: top.weightKg, reps: top.reps, rir: top.rir } : null,
    suggestionKg: scaled,
    why: whyVoice,
    e1rm: top?.e1rm ?? 0,
    cue: exercise.cue,
    swaps: legalSwaps(resolvedKey, profile)
      .slice(0, 4)
      .map((key) => ({ key, name: exerciseName(key) })),
    targetLine: targetLine({ sets, repLow: programmed.repLow, repHigh: programmed.repHigh, rirTarget: programmed.rirTarget }, voice),
  };
}

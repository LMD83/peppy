import { daysBetween } from "./lib";
import { MUSCLES, type Landmark, type Muscle } from "./data/exercises";

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

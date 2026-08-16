/**
 * Static training reference data — exercise library, weekly-set landmarks and
 * the mesocycle template. Config, not user data: never written to, never
 * user-specific, safe to share between the Convex handlers and the demo store.
 *
 * Landmarks follow the published MEV/MAV/MRV framing (Renaissance Periodization).
 * Evidence: moderate — they are practice-derived planning heuristics, not
 * measured thresholds for any individual. Treat them as a starting range.
 */

import { CATALOGUE } from "./exerciseCatalogue";

export type Muscle =
  | "chest"
  | "back"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "delts"
  | "biceps"
  | "triceps"
  | "calves"
  | "core";

/** Display order — push, pull, arms, legs, then the small stuff. */
export const MUSCLES: Muscle[] = [
  "chest",
  "back",
  "delts",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";

export type Pattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "isolation"
  | "carry"
  | "jump"
  | "cond"
  | "olympic";

export type Setting = "home" | "gym" | "box";
export type Kit =
  | "none"
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "band"
  | "pull-up-bar"
  | "bench"
  | "box"
  | "rower"
  | "bike"
  | "jump-rope"
  | "rings"
  | "wall-ball";
export type Skill = "foundations" | "standard" | "skilled";
export type Impact = "low" | "normal";
export type Constraint = "knees" | "shoulders" | "floor" | "impact" | "overhead";
export type SessionFormat = "sets" | "circuit" | "emom" | "amrap";
export type Experience = "new" | "returning" | "trained";
export type AgeBand = "under-40" | "40-59" | "60-plus";
export type TrainVoice = "easy" | "standard";

export type TrainingProfile = {
  setting: Setting;
  kit: Kit[];
  experience: Experience;
  ageBand: AgeBand;
  minutes: number;
  constraints: Constraint[];
};

/** Gym, full kit, trained — the profile Liam's fixtures already assume. */
export const DEFAULT_TRAIN_PROFILE: TrainingProfile = {
  setting: "gym",
  kit: ["none", "barbell", "dumbbell", "machine", "cable", "bench", "pull-up-bar", "box"],
  experience: "trained",
  ageBand: "under-40",
  minutes: 60,
  constraints: [],
};

export type Exercise = {
  key: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  pattern: Pattern;
  defaultRepLow: number;
  defaultRepHigh: number;
  isCompound: boolean;
  /** Smallest honest jump on this lift — drives double progression. */
  loadStepKg: number;
  settings: Setting[];
  kit: Kit[];
  skill: Skill;
  impact: Impact;
  /** Stated constraints that make this lift a bad pick — never a diagnosis. */
  blocks: Constraint[];
  aliases: string[];
  swaps: string[];
  cue: string;
};

/** Catalogue lives in exerciseCatalogue.ts so this file stays the public API. */
export const EXERCISES: Exercise[] = CATALOGUE;

export const EXERCISE_BY_KEY: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.key, e]),
);

export function exerciseFor(key: string): Exercise | null {
  return EXERCISE_BY_KEY[key] ?? null;
}

/** Human name for a stored exercise key; falls back to the key itself. */
export function exerciseName(key: string): string {
  return EXERCISE_BY_KEY[key]?.name ?? key;
}

export type Landmark = { mev: number; mav: number; mrv: number };

/** Weekly hard sets per muscle. Starting range, not a measured threshold. */
export const DEFAULT_LANDMARKS: Record<Muscle, Landmark> = {
  chest: { mev: 8, mav: 16, mrv: 22 },
  back: { mev: 10, mav: 18, mrv: 25 },
  delts: { mev: 8, mav: 16, mrv: 26 },
  biceps: { mev: 6, mav: 14, mrv: 20 },
  triceps: { mev: 6, mav: 14, mrv: 18 },
  quads: { mev: 8, mav: 16, mrv: 20 },
  hamstrings: { mev: 6, mav: 14, mrv: 20 },
  glutes: { mev: 4, mav: 12, mrv: 16 },
  calves: { mev: 8, mav: 16, mrv: 20 },
  core: { mev: 4, mav: 10, mrv: 16 },
};

export type MesoGoal = "hypertrophy" | "strength" | "recomp";

export const MESO_WEEKS = 6;
/** Last week of the block is the deload — load down, one set off. */
export const MESO_DELOAD_WEEK = 6;

export type MesoBlockTemplate = {
  weekday: number;
  dayName: string;
  exercise: string;
  muscle: Muscle;
  sets: number;
  repLow: number;
  repHigh: number;
  rirTarget: number;
  orderIndex: number;
};

/**
 * Four-day split on the same weekdays as SESSION_PLAN in ./lib
 * (1 push · 2 lower · 4 pull · 5 full body; 0/3/6 rest).
 */
export const MESO_TEMPLATES: MesoBlockTemplate[] = [
  /* Monday — Upper · push */
  { weekday: 1, dayName: "Upper · push", exercise: "bench-press", muscle: "chest", sets: 4, repLow: 6, repHigh: 10, rirTarget: 2, orderIndex: 0 },
  { weekday: 1, dayName: "Upper · push", exercise: "overhead-press", muscle: "delts", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 1, dayName: "Upper · push", exercise: "incline-db-press", muscle: "chest", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 1, dayName: "Upper · push", exercise: "cable-lateral-raise", muscle: "delts", sets: 3, repLow: 12, repHigh: 18, rirTarget: 1, orderIndex: 3 },
  { weekday: 1, dayName: "Upper · push", exercise: "triceps-pushdown", muscle: "triceps", sets: 3, repLow: 12, repHigh: 15, rirTarget: 1, orderIndex: 4 },
  { weekday: 1, dayName: "Upper · push", exercise: "overhead-triceps-extension", muscle: "triceps", sets: 3, repLow: 10, repHigh: 14, rirTarget: 1, orderIndex: 5 },

  /* Tuesday — Lower */
  { weekday: 2, dayName: "Lower", exercise: "back-squat", muscle: "quads", sets: 4, repLow: 5, repHigh: 8, rirTarget: 2, orderIndex: 0 },
  { weekday: 2, dayName: "Lower", exercise: "romanian-deadlift", muscle: "hamstrings", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 2, dayName: "Lower", exercise: "leg-press", muscle: "quads", sets: 3, repLow: 10, repHigh: 15, rirTarget: 2, orderIndex: 2 },
  { weekday: 2, dayName: "Lower", exercise: "leg-curl", muscle: "hamstrings", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 3 },
  { weekday: 2, dayName: "Lower", exercise: "hip-thrust", muscle: "glutes", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 4 },
  { weekday: 2, dayName: "Lower", exercise: "standing-calf-raise", muscle: "calves", sets: 4, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 5 },
  { weekday: 2, dayName: "Lower", exercise: "hanging-leg-raise", muscle: "core", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 6 },

  /* Thursday — Upper · pull */
  { weekday: 4, dayName: "Upper · pull", exercise: "barbell-row", muscle: "back", sets: 4, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 4, dayName: "Upper · pull", exercise: "lat-pulldown", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 1 },
  { weekday: 4, dayName: "Upper · pull", exercise: "chest-supported-row", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 4, dayName: "Upper · pull", exercise: "face-pull", muscle: "delts", sets: 3, repLow: 15, repHigh: 20, rirTarget: 1, orderIndex: 3 },
  { weekday: 4, dayName: "Upper · pull", exercise: "ez-bar-curl", muscle: "biceps", sets: 3, repLow: 8, repHigh: 12, rirTarget: 1, orderIndex: 4 },
  { weekday: 4, dayName: "Upper · pull", exercise: "incline-db-curl", muscle: "biceps", sets: 3, repLow: 10, repHigh: 14, rirTarget: 1, orderIndex: 5 },

  /* Friday — Full body */
  { weekday: 5, dayName: "Full body", exercise: "deadlift", muscle: "hamstrings", sets: 3, repLow: 3, repHigh: 6, rirTarget: 3, orderIndex: 0 },
  { weekday: 5, dayName: "Full body", exercise: "db-bench-press", muscle: "chest", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 5, dayName: "Full body", exercise: "seated-cable-row", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 5, dayName: "Full body", exercise: "walking-lunge", muscle: "quads", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 3 },
  { weekday: 5, dayName: "Full body", exercise: "seated-calf-raise", muscle: "calves", sets: 3, repLow: 12, repHigh: 20, rirTarget: 1, orderIndex: 4 },
  { weekday: 5, dayName: "Full body", exercise: "cable-crunch", muscle: "core", sets: 3, repLow: 12, repHigh: 15, rirTarget: 1, orderIndex: 5 },
  { weekday: 5, dayName: "Full body", exercise: "hammer-curl", muscle: "biceps", sets: 2, repLow: 10, repHigh: 14, rirTarget: 1, orderIndex: 6 },
];

export const MESO_TRAINING_WEEKDAYS = [1, 2, 4, 5];

export function templateForWeekday(weekday: number): MesoBlockTemplate[] {
  return MESO_TEMPLATES.filter((b) => b.weekday === weekday).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
}

export function mesocycleName(goal: MesoGoal): string {
  const label = goal === "hypertrophy" ? "Hypertrophy" : goal === "strength" ? "Strength" : "Recomp";
  return `${label} · ${MESO_WEEKS} weeks`;
}

/** Three-day living-room circuit. Knee-friendly by default; swaps cover kit. */
export const HOME_TEMPLATES: MesoBlockTemplate[] = [
  { weekday: 1, dayName: "Home · circuit", exercise: "sit-to-stand", muscle: "quads", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 1, dayName: "Home · circuit", exercise: "wall-push-up", muscle: "chest", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 1, dayName: "Home · circuit", exercise: "towel-row", muscle: "back", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 2 },
  { weekday: 1, dayName: "Home · circuit", exercise: "glute-bridge", muscle: "glutes", sets: 3, repLow: 10, repHigh: 15, rirTarget: 2, orderIndex: 3 },
  { weekday: 1, dayName: "Home · circuit", exercise: "dead-bug", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 4 },
  { weekday: 1, dayName: "Home · circuit", exercise: "calf-raise-bw", muscle: "calves", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 5 },

  { weekday: 3, dayName: "Home · hinge", exercise: "hip-hinge", muscle: "hamstrings", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 3, dayName: "Home · hinge", exercise: "incline-push-up", muscle: "chest", sets: 3, repLow: 6, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 3, dayName: "Home · hinge", exercise: "band-row", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 3, dayName: "Home · hinge", exercise: "step-up", muscle: "quads", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 3 },
  { weekday: 3, dayName: "Home · hinge", exercise: "bird-dog", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 4 },
  { weekday: 3, dayName: "Home · hinge", exercise: "suitcase-carry-bag", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 5 },

  { weekday: 5, dayName: "Home · carry", exercise: "goblet-squat", muscle: "quads", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 5, dayName: "Home · carry", exercise: "db-floor-press", muscle: "chest", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 5, dayName: "Home · carry", exercise: "band-pulldown", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 5, dayName: "Home · carry", exercise: "db-rdl", muscle: "hamstrings", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 3 },
  { weekday: 5, dayName: "Home · carry", exercise: "pallof-band", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 4 },
  { weekday: 5, dayName: "Home · carry", exercise: "walk", muscle: "calves", sets: 2, repLow: 8, repHigh: 12, rirTarget: 3, orderIndex: 5 },
];

/** Three-day box engine. Step-ups not jumps, so a knees note still has a session. */
export const BOX_TEMPLATES: MesoBlockTemplate[] = [
  { weekday: 1, dayName: "Box · engine", exercise: "row-erg", muscle: "back", sets: 4, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 1, dayName: "Box · engine", exercise: "box-step-up", muscle: "quads", sets: 4, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 1, dayName: "Box · engine", exercise: "kb-swing", muscle: "hamstrings", sets: 4, repLow: 10, repHigh: 15, rirTarget: 2, orderIndex: 2 },
  { weekday: 1, dayName: "Box · engine", exercise: "ring-row", muscle: "back", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 3 },
  { weekday: 1, dayName: "Box · engine", exercise: "sit-up-abmat", muscle: "core", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 4 },

  { weekday: 3, dayName: "Box · mixed", exercise: "thruster-db", muscle: "quads", sets: 4, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 3, dayName: "Box · mixed", exercise: "jumping-pull-up", muscle: "back", sets: 4, repLow: 5, repHigh: 10, rirTarget: 2, orderIndex: 1 },
  { weekday: 3, dayName: "Box · mixed", exercise: "burpee-step-back", muscle: "chest", sets: 3, repLow: 6, repHigh: 10, rirTarget: 2, orderIndex: 2 },
  { weekday: 3, dayName: "Box · mixed", exercise: "single-under", muscle: "calves", sets: 3, repLow: 20, repHigh: 40, rirTarget: 2, orderIndex: 3 },
  { weekday: 3, dayName: "Box · mixed", exercise: "hanging-knee-raise", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 1, orderIndex: 4 },

  { weekday: 5, dayName: "Box · strength", exercise: "front-squat", muscle: "quads", sets: 4, repLow: 5, repHigh: 8, rirTarget: 2, orderIndex: 0 },
  { weekday: 5, dayName: "Box · strength", exercise: "push-press-db", muscle: "delts", sets: 4, repLow: 6, repHigh: 10, rirTarget: 2, orderIndex: 1 },
  { weekday: 5, dayName: "Box · strength", exercise: "power-clean", muscle: "hamstrings", sets: 4, repLow: 3, repHigh: 6, rirTarget: 3, orderIndex: 2 },
  { weekday: 5, dayName: "Box · strength", exercise: "ring-row", muscle: "back", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 3 },
  { weekday: 5, dayName: "Box · strength", exercise: "pallof-press", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 4 },
];

/** Machines and supported lifts — the gym file when someone is new, not a lighter meso. */
export const GYM_FOUNDATIONS_TEMPLATES: MesoBlockTemplate[] = [
  { weekday: 1, dayName: "Gym · foundations", exercise: "machine-chest-press", muscle: "chest", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 1, dayName: "Gym · foundations", exercise: "seated-cable-row", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 1 },
  { weekday: 1, dayName: "Gym · foundations", exercise: "seated-db-press", muscle: "delts", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 2 },
  { weekday: 1, dayName: "Gym · foundations", exercise: "leg-press", muscle: "quads", sets: 3, repLow: 10, repHigh: 15, rirTarget: 2, orderIndex: 3 },
  { weekday: 1, dayName: "Gym · foundations", exercise: "leg-curl", muscle: "hamstrings", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 4 },
  { weekday: 1, dayName: "Gym · foundations", exercise: "cable-crunch", muscle: "core", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 5 },

  { weekday: 3, dayName: "Gym · foundations", exercise: "leg-press", muscle: "quads", sets: 3, repLow: 10, repHigh: 15, rirTarget: 2, orderIndex: 0 },
  { weekday: 3, dayName: "Gym · foundations", exercise: "hip-thrust", muscle: "glutes", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 1 },
  { weekday: 3, dayName: "Gym · foundations", exercise: "chest-supported-row", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 3, dayName: "Gym · foundations", exercise: "machine-chest-press", muscle: "chest", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 3 },
  { weekday: 3, dayName: "Gym · foundations", exercise: "standing-calf-raise", muscle: "calves", sets: 3, repLow: 10, repHigh: 15, rirTarget: 1, orderIndex: 4 },
  { weekday: 3, dayName: "Gym · foundations", exercise: "dead-bug", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 5 },

  { weekday: 5, dayName: "Gym · foundations", exercise: "goblet-squat", muscle: "quads", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 0 },
  { weekday: 5, dayName: "Gym · foundations", exercise: "lat-pulldown", muscle: "back", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 1 },
  { weekday: 5, dayName: "Gym · foundations", exercise: "incline-db-press", muscle: "chest", sets: 3, repLow: 10, repHigh: 14, rirTarget: 2, orderIndex: 2 },
  { weekday: 5, dayName: "Gym · foundations", exercise: "romanian-deadlift", muscle: "hamstrings", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 3 },
  { weekday: 5, dayName: "Gym · foundations", exercise: "face-pull", muscle: "delts", sets: 3, repLow: 12, repHigh: 18, rirTarget: 1, orderIndex: 4 },
  { weekday: 5, dayName: "Gym · foundations", exercise: "pallof-press", muscle: "core", sets: 3, repLow: 8, repHigh: 12, rirTarget: 2, orderIndex: 5 },
];

export function templatesFor(profile: TrainingProfile): MesoBlockTemplate[] {
  if (profile.setting === "home") return HOME_TEMPLATES;
  if (profile.setting === "box") return BOX_TEMPLATES;
  if (profile.experience === "new") return GYM_FOUNDATIONS_TEMPLATES;
  return MESO_TEMPLATES;
}

export function formatFor(profile: TrainingProfile): SessionFormat {
  if (profile.setting === "home") return "circuit";
  if (profile.setting === "box") return "emom";
  return "sets";
}

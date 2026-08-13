/**
 * Static training reference data — exercise library, weekly-set landmarks and
 * the mesocycle template. Config, not user data: never written to, never
 * user-specific, safe to share between the Convex handlers and the demo store.
 *
 * Landmarks follow the published MEV/MAV/MRV framing (Renaissance Periodization).
 * Evidence: moderate — they are practice-derived planning heuristics, not
 * measured thresholds for any individual. Treat them as a starting range.
 */

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
  | "isolation";

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
};

/** 2.5 kg on everything upper; 5 kg on lower compounds, where the jump is real. */
export const EXERCISES: Exercise[] = [
  /* ----- chest ----- */
  { key: "bench-press", name: "Bench press", muscle: "chest", equipment: "barbell", pattern: "horizontal-push", defaultRepLow: 6, defaultRepHigh: 10, isCompound: true, loadStepKg: 2.5 },
  { key: "incline-barbell-press", name: "Incline barbell press", muscle: "chest", equipment: "barbell", pattern: "horizontal-push", defaultRepLow: 6, defaultRepHigh: 10, isCompound: true, loadStepKg: 2.5 },
  { key: "db-bench-press", name: "DB bench press", muscle: "chest", equipment: "dumbbell", pattern: "horizontal-push", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },
  { key: "incline-db-press", name: "Incline DB press", muscle: "chest", equipment: "dumbbell", pattern: "horizontal-push", defaultRepLow: 10, defaultRepHigh: 14, isCompound: true, loadStepKg: 2.5 },
  { key: "machine-chest-press", name: "Machine chest press", muscle: "chest", equipment: "machine", pattern: "horizontal-push", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },
  { key: "cable-fly", name: "Cable fly", muscle: "chest", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 16, isCompound: false, loadStepKg: 2.5 },
  { key: "dip", name: "Dip", muscle: "chest", equipment: "bodyweight", pattern: "horizontal-push", defaultRepLow: 6, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },

  /* ----- back ----- */
  { key: "barbell-row", name: "Barbell row", muscle: "back", equipment: "barbell", pattern: "horizontal-pull", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },
  { key: "chest-supported-row", name: "Chest-supported row", muscle: "back", equipment: "machine", pattern: "horizontal-pull", defaultRepLow: 10, defaultRepHigh: 14, isCompound: true, loadStepKg: 2.5 },
  { key: "seated-cable-row", name: "Seated cable row", muscle: "back", equipment: "cable", pattern: "horizontal-pull", defaultRepLow: 10, defaultRepHigh: 14, isCompound: true, loadStepKg: 2.5 },
  { key: "single-arm-db-row", name: "Single-arm DB row", muscle: "back", equipment: "dumbbell", pattern: "horizontal-pull", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },
  { key: "lat-pulldown", name: "Lat pulldown", muscle: "back", equipment: "cable", pattern: "vertical-pull", defaultRepLow: 10, defaultRepHigh: 14, isCompound: true, loadStepKg: 2.5 },
  { key: "pull-up", name: "Pull-up", muscle: "back", equipment: "bodyweight", pattern: "vertical-pull", defaultRepLow: 5, defaultRepHigh: 10, isCompound: true, loadStepKg: 2.5 },
  { key: "straight-arm-pulldown", name: "Straight-arm pulldown", muscle: "back", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 16, isCompound: false, loadStepKg: 2.5 },

  /* ----- delts ----- */
  { key: "overhead-press", name: "Overhead press", muscle: "delts", equipment: "barbell", pattern: "vertical-push", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },
  { key: "seated-db-press", name: "Seated DB press", muscle: "delts", equipment: "dumbbell", pattern: "vertical-push", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 2.5 },
  { key: "db-lateral-raise", name: "DB lateral raise", muscle: "delts", equipment: "dumbbell", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 18, isCompound: false, loadStepKg: 2.5 },
  { key: "cable-lateral-raise", name: "Cable lateral raise", muscle: "delts", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 18, isCompound: false, loadStepKg: 2.5 },
  { key: "face-pull", name: "Face pull", muscle: "delts", equipment: "cable", pattern: "horizontal-pull", defaultRepLow: 15, defaultRepHigh: 20, isCompound: false, loadStepKg: 2.5 },
  { key: "reverse-pec-deck", name: "Reverse pec deck", muscle: "delts", equipment: "machine", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 18, isCompound: false, loadStepKg: 2.5 },

  /* ----- biceps ----- */
  { key: "ez-bar-curl", name: "EZ-bar curl", muscle: "biceps", equipment: "barbell", pattern: "isolation", defaultRepLow: 8, defaultRepHigh: 12, isCompound: false, loadStepKg: 2.5 },
  { key: "incline-db-curl", name: "Incline DB curl", muscle: "biceps", equipment: "dumbbell", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 14, isCompound: false, loadStepKg: 2.5 },
  { key: "hammer-curl", name: "Hammer curl", muscle: "biceps", equipment: "dumbbell", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 14, isCompound: false, loadStepKg: 2.5 },
  { key: "cable-curl", name: "Cable curl", muscle: "biceps", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },

  /* ----- triceps ----- */
  { key: "close-grip-bench", name: "Close-grip bench", muscle: "triceps", equipment: "barbell", pattern: "horizontal-push", defaultRepLow: 6, defaultRepHigh: 10, isCompound: true, loadStepKg: 2.5 },
  { key: "triceps-pushdown", name: "Triceps pushdown", muscle: "triceps", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
  { key: "overhead-triceps-extension", name: "Overhead triceps extension", muscle: "triceps", equipment: "cable", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 14, isCompound: false, loadStepKg: 2.5 },
  { key: "skull-crusher", name: "Skull crusher", muscle: "triceps", equipment: "barbell", pattern: "isolation", defaultRepLow: 8, defaultRepHigh: 12, isCompound: false, loadStepKg: 2.5 },

  /* ----- quads ----- */
  { key: "back-squat", name: "Back squat", muscle: "quads", equipment: "barbell", pattern: "squat", defaultRepLow: 5, defaultRepHigh: 8, isCompound: true, loadStepKg: 5 },
  { key: "front-squat", name: "Front squat", muscle: "quads", equipment: "barbell", pattern: "squat", defaultRepLow: 5, defaultRepHigh: 8, isCompound: true, loadStepKg: 5 },
  { key: "hack-squat", name: "Hack squat", muscle: "quads", equipment: "machine", pattern: "squat", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 5 },
  { key: "leg-press", name: "Leg press", muscle: "quads", equipment: "machine", pattern: "squat", defaultRepLow: 10, defaultRepHigh: 15, isCompound: true, loadStepKg: 5 },
  { key: "walking-lunge", name: "Walking lunge", muscle: "quads", equipment: "dumbbell", pattern: "lunge", defaultRepLow: 10, defaultRepHigh: 14, isCompound: true, loadStepKg: 5 },
  { key: "bulgarian-split-squat", name: "Bulgarian split squat", muscle: "quads", equipment: "dumbbell", pattern: "lunge", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 5 },
  { key: "leg-extension", name: "Leg extension", muscle: "quads", equipment: "machine", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 18, isCompound: false, loadStepKg: 2.5 },

  /* ----- hamstrings ----- */
  { key: "deadlift", name: "Deadlift", muscle: "hamstrings", equipment: "barbell", pattern: "hinge", defaultRepLow: 3, defaultRepHigh: 6, isCompound: true, loadStepKg: 5 },
  { key: "romanian-deadlift", name: "Romanian deadlift", muscle: "hamstrings", equipment: "barbell", pattern: "hinge", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 5 },
  { key: "good-morning", name: "Good morning", muscle: "hamstrings", equipment: "barbell", pattern: "hinge", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 5 },
  { key: "leg-curl", name: "Seated leg curl", muscle: "hamstrings", equipment: "machine", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
  { key: "lying-leg-curl", name: "Lying leg curl", muscle: "hamstrings", equipment: "machine", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },

  /* ----- glutes ----- */
  { key: "hip-thrust", name: "Hip thrust", muscle: "glutes", equipment: "barbell", pattern: "hinge", defaultRepLow: 8, defaultRepHigh: 12, isCompound: true, loadStepKg: 5 },
  { key: "cable-kickback", name: "Cable kickback", muscle: "glutes", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 18, isCompound: false, loadStepKg: 2.5 },
  { key: "hip-abduction", name: "Hip abduction", muscle: "glutes", equipment: "machine", pattern: "isolation", defaultRepLow: 15, defaultRepHigh: 20, isCompound: false, loadStepKg: 2.5 },

  /* ----- calves ----- */
  { key: "standing-calf-raise", name: "Standing calf raise", muscle: "calves", equipment: "machine", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
  { key: "seated-calf-raise", name: "Seated calf raise", muscle: "calves", equipment: "machine", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 20, isCompound: false, loadStepKg: 2.5 },
  { key: "leg-press-calf-raise", name: "Leg-press calf raise", muscle: "calves", equipment: "machine", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 18, isCompound: false, loadStepKg: 2.5 },

  /* ----- core ----- */
  { key: "hanging-leg-raise", name: "Hanging leg raise", muscle: "core", equipment: "bodyweight", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
  { key: "cable-crunch", name: "Cable crunch", muscle: "core", equipment: "cable", pattern: "isolation", defaultRepLow: 12, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
  { key: "ab-wheel", name: "Ab wheel", muscle: "core", equipment: "bodyweight", pattern: "isolation", defaultRepLow: 8, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
  { key: "pallof-press", name: "Pallof press", muscle: "core", equipment: "cable", pattern: "isolation", defaultRepLow: 10, defaultRepHigh: 15, isCompound: false, loadStepKg: 2.5 },
];

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

/**
 * Row shapes for the in-memory demo backend. These mirror the `tm_*` Convex
 * tables one-for-one, except that rows are keyed by user *slug* (the demo has
 * no document ids for users) and generated ids are plain strings.
 *
 * The domain fixture builders under `convex/tm/fixtures/` produce exactly these
 * shapes, so the demo store and the Convex seed stay in lockstep.
 */

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type NutritionTargetRow = {
  userSlug: string;
  effectiveFrom: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMgMax: number;
  basis: "adaptive" | "manual";
};

export type MealEntryRow = {
  id: string;
  userSlug: string;
  date: string;
  slot: MealSlot;
  foodKey: string;
  grams: number;
  planned: boolean;
  eaten: boolean;
};

export type EnergyEstimateRow = {
  userSlug: string;
  weekStart: string;
  tdeeKcal: number;
  avgIntakeKcal: number;
  weightSlopeKgPerWeek: number;
};

export type MesocycleRow = {
  id: string;
  userSlug: string;
  name: string;
  startDate: string;
  weeks: number;
  deloadWeek: number;
  goal: "hypertrophy" | "strength" | "recomp";
  status: "planned" | "running" | "done";
};

export type ProgramBlockRow = {
  userSlug: string;
  mesocycleId: string;
  weekday: number;
  dayName: string;
  exercise: string;
  muscle: string;
  sets: number;
  repLow: number;
  repHigh: number;
  rirTarget: number;
  orderIndex: number;
};

export type SetLogRow = {
  userSlug: string;
  date: string;
  exercise: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rir: number;
};

export type TrainProfileRow = {
  userSlug: string;
  setting: "home" | "gym" | "box";
  kit: string[];
  experience: "new" | "returning" | "trained";
  ageBand: "under-40" | "40-59" | "60-plus";
  minutes: number;
  constraints: string[];
};

export type VolumeLandmarkRow = {
  userSlug: string;
  muscle: string;
  mev: number;
  mav: number;
  mrv: number;
};

export type ProtocolItemRow = {
  id: string;
  userSlug: string;
  name: string;
  kind: "med" | "peptide" | "supplement";
  dose: number;
  unit: string;
  route: "oral" | "subcut" | "intramuscular" | "topical" | "nasal";
  timings: string[];
  scheduleType: "daily" | "weekdays" | "interval" | "cycle";
  weekdays?: number[];
  intervalDays?: number;
  cycleOnWeeks?: number;
  cycleOffWeeks?: number;
  startDate: string;
  endDate?: string;
  withFood: boolean;
  evidence: "strong" | "moderate" | "limited" | "anecdotal";
  cautions: string[];
  note?: string;
  recon?: { vialMg: number; bacMl: number; syringeUnitsPerMl: number };
  active: boolean;
};

export type DoseLogRow = {
  userSlug: string;
  date: string;
  itemId: string;
  timing: string;
  taken: boolean;
  site?: string;
};

export type LabPanelRow = {
  id: string;
  userSlug: string;
  date: string;
  name: string;
  lab?: string;
  fasted?: boolean;
};

export type LabResultRow = {
  userSlug: string;
  panelId: string;
  date: string;
  marker: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
};

export type AssessmentRow = {
  userSlug: string;
  date: string;
  instrument: string;
  answers: number[];
  score: number;
  band: string;
};

export type IntentionRow = {
  id: string;
  userSlug: string;
  trigger: string;
  action: string;
  active: boolean;
  createdDate: string;
  wins: number;
};

export type ReflectionRow = {
  userSlug: string;
  date: string;
  prompt: string;
  response: string;
  win?: string;
};

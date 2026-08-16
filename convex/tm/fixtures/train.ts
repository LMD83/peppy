import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";
import {
  DEFAULT_LANDMARKS,
  EXERCISE_BY_KEY,
  MESO_DELOAD_WEEK,
  MESO_TEMPLATES,
  MESO_TRAINING_WEEKDAYS,
  MESO_WEEKS,
  MUSCLES,
  mesocycleName,
} from "../data/exercises";

/**
 * Train fixtures. Shapes are declared locally and must stay field-for-field
 * identical to src/app/_lib/demo/rows.ts — Convex code never imports from src/.
 */

export type TrainFixtures = {
  mesocycles: {
    id: string;
    userSlug: string;
    name: string;
    startDate: string;
    weeks: number;
    deloadWeek: number;
    goal: "hypertrophy" | "strength" | "recomp";
    status: "planned" | "running" | "done";
  }[];
  programBlocks: {
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
  }[];
  setLogs: {
    userSlug: string;
    date: string;
    exercise: string;
    setIndex: number;
    weightKg: number;
    reps: number;
    rir: number;
  }[];
  volumeLandmarks: { userSlug: string; muscle: string; mev: number; mav: number; mrv: number }[];
  trainProfiles: {
    userSlug: string;
    setting: "home" | "gym" | "box";
    kit: string[];
    experience: "new" | "returning" | "trained";
    ageBand: "under-40" | "40-59" | "60-plus";
    minutes: number;
    constraints: string[];
  }[];
};

/** Working loads Liam started the block on. */
const BASE_KG: Record<string, number> = {
  "bench-press": 75,
  "overhead-press": 45,
  "incline-db-press": 24,
  "cable-lateral-raise": 7.5,
  "triceps-pushdown": 30,
  "overhead-triceps-extension": 22.5,
  "back-squat": 100,
  "romanian-deadlift": 90,
  "leg-press": 160,
  "leg-curl": 45,
  "hip-thrust": 90,
  "standing-calf-raise": 70,
  "hanging-leg-raise": 0,
  "barbell-row": 70,
  "lat-pulldown": 65,
  "chest-supported-row": 50,
  "face-pull": 25,
  "ez-bar-curl": 30,
  "incline-db-curl": 12,
  deadlift: 130,
  "db-bench-press": 30,
  "seated-cable-row": 60,
  "walking-lunge": 20,
  "seated-calf-raise": 45,
  "cable-crunch": 35,
  "hammer-curl": 14,
};

/** The lift that stopped moving — proves the "hold and add a rep" branch. */
const STALLED = "overhead-press";

const SESSIONS_BACK = 4;

/** Dates for the last `count` occurrences of `weekday`, strictly before today. */
function pastSessionDates(today: string, weekday: number, count: number): string[] {
  const dates: string[] = [];
  for (let back = 1; back <= 35 && dates.length < count; back++) {
    const date = addDays(today, -back);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === weekday) dates.push(date);
  }
  return dates.reverse();
}

export function buildTrainFixtures(today: string): TrainFixtures {
  // Day 16 of the block → week 3 of 6 shows on the strip.
  const startDate = addDays(today, -16);
  const mesoId = "meso_liam_1";

  const mesocycles: TrainFixtures["mesocycles"] = [
    {
      id: mesoId,
      userSlug: "liam",
      name: mesocycleName("hypertrophy"),
      startDate,
      weeks: MESO_WEEKS,
      deloadWeek: MESO_DELOAD_WEEK,
      goal: "hypertrophy",
      status: "running",
    },
  ];

  const programBlocks: TrainFixtures["programBlocks"] = MESO_TEMPLATES.map((b) => ({
    userSlug: "liam",
    mesocycleId: mesoId,
    ...b,
  }));

  // Four weeks of honest logs: loads creep, reps sit inside the range, and one
  // lift has not moved since the block started.
  const setLogs: TrainFixtures["setLogs"] = [];
  for (const weekday of MESO_TRAINING_WEEKDAYS) {
    const dates = pastSessionDates(today, weekday, SESSIONS_BACK);
    const blocks = MESO_TEMPLATES.filter((b) => b.weekday === weekday);
    dates.forEach((date, session) => {
      for (const block of blocks) {
        const stalled = block.exercise === STALLED;
        const step = EXERCISE_BY_KEY[block.exercise]?.loadStepKg ?? 2.5;
        const base = BASE_KG[block.exercise] ?? 20;
        const weightKg = stalled ? base : base + step * session;
        // Every third lift finished its range last time → load goes up next.
        const topping = !stalled && block.orderIndex % 3 === 0;
        for (let setIndex = 0; setIndex < block.sets; setIndex++) {
          const reps = topping
            ? block.repHigh
            : Math.max(block.repLow, block.repHigh - 2 - (setIndex % 2));
          const rir = topping ? block.rirTarget : block.rirTarget + 1;
          setLogs.push({ userSlug: "liam", date, exercise: block.exercise, setIndex, weightKg, reps, rir });
        }
      }
    });
  }

  // Landmarks for every muscle, both users. Conor holds the floor: landmarks
  // exist so the numbers are there when he comes back, but no block runs.
  const volumeLandmarks: TrainFixtures["volumeLandmarks"] = ["liam", "conor"].flatMap((userSlug) =>
    MUSCLES.map((muscle) => ({ userSlug, muscle, ...DEFAULT_LANDMARKS[muscle] })),
  );

  const trainProfiles: TrainFixtures["trainProfiles"] = [
    {
      userSlug: "liam",
      setting: "gym",
      kit: ["none", "barbell", "dumbbell", "machine", "cable", "bench", "pull-up-bar", "box"],
      experience: "trained",
      ageBand: "under-40",
      minutes: 60,
      constraints: [],
    },
    {
      userSlug: "conor",
      setting: "home",
      kit: ["none", "dumbbell", "band"],
      experience: "returning",
      ageBand: "40-59",
      minutes: 25,
      constraints: [],
    },
  ];

  return { mesocycles, programBlocks, setLogs, volumeLandmarks, trainProfiles };
}

export async function seedTrain(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: TrainFixtures,
) {
  const idByFixtureId = new Map<string, Id<"tm_mesocycles">>();
  for (const { id, userSlug, ...row } of fx.mesocycles) {
    idByFixtureId.set(id, await ctx.db.insert("tm_mesocycles", { userId: uid(userSlug), ...row }));
  }
  for (const { userSlug, mesocycleId, ...row } of fx.programBlocks) {
    const realId = idByFixtureId.get(mesocycleId);
    if (!realId) continue;
    await ctx.db.insert("tm_programBlocks", { userId: uid(userSlug), mesocycleId: realId, ...row });
  }
  for (const { userSlug, ...row } of fx.setLogs)
    await ctx.db.insert("tm_setLogs", { userId: uid(userSlug), ...row });
  for (const { userSlug, ...row } of fx.volumeLandmarks)
    await ctx.db.insert("tm_volumeLandmarks", { userId: uid(userSlug), ...row });
  for (const { userSlug, ...row } of fx.trainProfiles)
    await ctx.db.insert("tm_trainProfiles", { userId: uid(userSlug), ...row });
}

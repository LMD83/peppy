import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "./db";
import { addDays } from "./lib";
import {
  DEFAULT_LANDMARKS,
  EXERCISE_BY_KEY,
  MESO_DELOAD_WEEK,
  MESO_TEMPLATES,
  MESO_WEEKS,
  MUSCLES,
  mesocycleName,
  type Landmark,
  type MesoGoal,
  type Muscle,
} from "./data/exercises";
import {
  e1rm,
  lastSessionFor,
  mesoWeekFor,
  progressionFor,
  prsFrom,
  readinessAdjust,
  roundHalf,
  topSetFor,
  volumeSetsByMuscle,
  volumeVerdict,
  type DatedSet,
  type MesoPhase,
  type VolumeVerdict,
} from "./logicTrain";

/**
 * Train — programming, autoregulation, volume. Every read is bounded by the
 * caller's own userId index; nothing here touches another user's rows.
 */

const dateArg = v.string();
const goalArg = v.union(v.literal("hypertrophy"), v.literal("strength"), v.literal("recomp"));

/** How far back the volume/PR window reads. Bounded — never a table scan. */
const SET_LOG_SCAN = 400;
const VOLUME_WINDOW_DAYS = 6;

export type TrainBlockView = {
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
};

export type TrainView = {
  mesocycle: {
    name: string;
    goal: MesoGoal;
    week: number;
    weeks: number;
    isDeload: boolean;
    phase: MesoPhase;
  } | null;
  today: { dayName: string; isRestDay: boolean; blocks: TrainBlockView[] };
  loggedSets: {
    exercise: string;
    setIndex: number;
    weightKg: number;
    reps: number;
    rir: number;
    e1rm: number;
  }[];
  weeklyVolume: {
    muscle: Muscle;
    sets: number;
    mev: number;
    mav: number;
    mrv: number;
    verdict: VolumeVerdict;
    note: string;
  }[];
  prs: { exercise: string; e1rm: number; date: string }[];
  readiness: { multiplier: number; note: string };
  survival: boolean;
};

export const get = query({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }): Promise<TrainView> => {
    const user = await requireUser(ctx, token);

    // Sets the owner logged today — cheap, single-day index read.
    const todayRows = await ctx.db
      .query("tm_setLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(60);
    const loggedSets = todayRows
      .slice()
      .sort((a, b) => a.exercise.localeCompare(b.exercise) || a.setIndex - b.setIndex)
      .map((r) => ({
        exercise: r.exercise,
        setIndex: r.setIndex,
        weightKg: r.weightKg,
        reps: r.reps,
        rir: r.rir,
        e1rm: e1rm(r.weightKg, r.reps, r.rir),
      }));

    // Survival is a floor: no programme, no volume targets, nothing to catch up on.
    if (user.mode === "survival") {
      return {
        mesocycle: null,
        today: { dayName: "Floor — movement only", isRestDay: true, blocks: [] },
        loggedSets,
        weeklyVolume: [],
        prs: [],
        readiness: { multiplier: 1, note: "floor mode — no load prescription" },
        survival: true,
      };
    }

    const mesoRows = await ctx.db
      .query("tm_mesocycles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
    const meso = mesoRows.find((m) => m.status === "running") ?? null;
    const position = meso ? mesoWeekFor(meso.startDate, date, meso.weeks, meso.deloadWeek) : null;

    const day = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();
    const readiness = readinessAdjust(day?.stress, day?.energy, position?.isDeload ?? false);

    // Trailing history for progression, weekly volume and PRs.
    const recent = await ctx.db
      .query("tm_setLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(SET_LOG_SCAN);
    const history: DatedSet[] = recent.map((r) => ({
      date: r.date,
      exercise: r.exercise,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir,
    }));

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const blockRows = meso
      ? (
          await ctx.db
            .query("tm_programBlocks")
            .withIndex("by_userId_and_weekday", (q) =>
              q.eq("userId", user._id).eq("weekday", weekday),
            )
            .take(40)
        )
          .filter((b) => b.mesocycleId === meso._id)
          .sort((a, b) => a.orderIndex - b.orderIndex)
      : [];

    const blocks: TrainBlockView[] = blockRows.map((b) => {
      const exercise = EXERCISE_BY_KEY[b.exercise];
      const last = lastSessionFor(history, b.exercise);
      const top = topSetFor(history, b.exercise);
      const progression = progressionFor(last?.sets ?? [], {
        repLow: b.repLow,
        repHigh: b.repHigh,
        rirTarget: b.rirTarget,
        loadStepKg: exercise?.loadStepKg ?? 2.5,
      });
      const scaled = roundHalf(progression.suggestionKg * readiness.multiplier);
      // State scales the number, so say so — otherwise "load goes up" reads as
      // a contradiction next to a smaller suggestion.
      const why =
        readiness.multiplier < 1 && progression.suggestionKg > 0
          ? `${progression.why} Readiness ×${readiness.multiplier.toFixed(2)} → ${scaled.toFixed(1)} kg today.`
          : progression.why;
      return {
        exercise: b.exercise,
        muscle: isMuscle(b.muscle) ? b.muscle : (exercise?.muscle ?? "core"),
        sets: readiness.dropSet ? Math.max(1, b.sets - 1) : b.sets,
        repLow: b.repLow,
        repHigh: b.repHigh,
        rirTarget: b.rirTarget,
        lastTopSet: top ? { weightKg: top.weightKg, reps: top.reps, rir: top.rir } : null,
        suggestionKg: scaled,
        why,
        e1rm: top?.e1rm ?? 0,
      };
    });

    const landmarkRows = await ctx.db
      .query("tm_volumeLandmarks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(20);
    const landmarks = new Map<string, Landmark>(
      landmarkRows.map((r) => [r.muscle, { mev: r.mev, mav: r.mav, mrv: r.mrv }]),
    );
    const setsByMuscle = volumeSetsByMuscle(
      history,
      EXERCISE_BY_KEY,
      addDays(date, -VOLUME_WINDOW_DAYS),
      date,
    );
    const weeklyVolume = MUSCLES.map((muscle) => {
      const landmark = landmarks.get(muscle) ?? DEFAULT_LANDMARKS[muscle];
      const sets = setsByMuscle[muscle];
      const { verdict, note } = volumeVerdict(sets, landmark);
      return { muscle, sets, ...landmark, verdict, note };
    });

    const dayName = meso
      ? blockRows.length > 0
        ? blockRows[0].dayName
        : "Rest — recovery is programmed"
      : "No mesocycle running";

    return {
      mesocycle:
        meso && position
          ? {
              name: meso.name,
              goal: meso.goal,
              week: position.week,
              weeks: meso.weeks,
              isDeload: position.isDeload,
              phase: position.phase,
            }
          : null,
      today: { dayName, isRestDay: blocks.length === 0, blocks },
      loggedSets,
      weeklyVolume,
      prs: prsFrom(history).slice(0, 8),
      readiness: { multiplier: readiness.multiplier, note: readiness.note },
      survival: false,
    };
  },
});

function isMuscle(value: string): value is Muscle {
  return (MUSCLES as string[]).includes(value);
}

export const logSet = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    exercise: v.string(),
    setIndex: v.number(),
    weightKg: v.number(),
    reps: v.number(),
    rir: v.number(),
  },
  handler: async (ctx, { token, date, exercise, setIndex, weightKg, reps, rir }) => {
    const user = await requireUser(ctx, token);
    if (!EXERCISE_BY_KEY[exercise]) throw new Error("Unknown exercise");
    const entry = {
      exercise,
      setIndex: Math.max(0, Math.round(setIndex)),
      weightKg: Math.max(0, roundHalf(weightKg)),
      reps: Math.max(1, Math.round(reps)),
      rir: Math.min(10, Math.max(0, Math.round(rir))),
    };
    const existing = await ctx.db
      .query("tm_setLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(60);
    // Re-logging the same set index corrects it rather than duplicating volume.
    const row = existing.find((r) => r.exercise === exercise && r.setIndex === entry.setIndex);
    if (row) await ctx.db.patch("tm_setLogs", row._id, entry);
    else await ctx.db.insert("tm_setLogs", { userId: user._id, date, ...entry });
    return null;
  },
});

export const startMesocycle = mutation({
  args: { token: v.string(), date: dateArg, goal: goalArg },
  handler: async (ctx, { token, date, goal }) => {
    const user = await requireUser(ctx, token);
    const existing = await ctx.db
      .query("tm_mesocycles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(20);
    // One block runs at a time — close the old one and clear its programme.
    for (const meso of existing) {
      if (meso.status !== "running") continue;
      await ctx.db.patch("tm_mesocycles", meso._id, { status: "done" });
      const stale = await ctx.db
        .query("tm_programBlocks")
        .withIndex("by_mesocycleId", (q) => q.eq("mesocycleId", meso._id))
        .take(200);
      for (const block of stale) await ctx.db.delete("tm_programBlocks", block._id);
    }
    const mesocycleId = await ctx.db.insert("tm_mesocycles", {
      userId: user._id,
      name: mesocycleName(goal),
      startDate: date,
      weeks: MESO_WEEKS,
      deloadWeek: MESO_DELOAD_WEEK,
      goal,
      status: "running",
    });
    for (const block of MESO_TEMPLATES) {
      await ctx.db.insert("tm_programBlocks", { userId: user._id, mesocycleId, ...block });
    }
    return null;
  },
});

import { addDays } from "@convex/tm/lib";
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
} from "@convex/tm/data/exercises";
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
} from "@convex/tm/logic-train";
import type { DemoDb } from "../demo-db";
import type { TrainData } from "../types";

/** Demo mirror of convex/tm/train.ts — same logic calls, same shapes. */

const VOLUME_WINDOW_DAYS = 6;

export function view(db: DemoDb, slug: string, date: string): TrainData {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const loggedSets = db.setLogs
    .filter((r) => r.userSlug === slug && r.date === date)
    .sort((a, b) => a.exercise.localeCompare(b.exercise) || a.setIndex - b.setIndex)
    .map((r) => ({
      exercise: r.exercise,
      setIndex: r.setIndex,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir,
      e1rm: e1rm(r.weightKg, r.reps, r.rir),
    }));

  if (user.modeMut === "survival") {
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

  const meso = db.mesocycles.find((m) => m.userSlug === slug && m.status === "running") ?? null;
  const position = meso ? mesoWeekFor(meso.startDate, date, meso.weeks, meso.deloadWeek) : null;

  const day = db.days.find((d) => d.userSlug === slug && d.date === date);
  const readiness = readinessAdjust(day?.stress, day?.energy, position?.isDeload ?? false);

  const history: DatedSet[] = db.setLogs
    .filter((r) => r.userSlug === slug)
    .map((r) => ({
      date: r.date,
      exercise: r.exercise,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir,
    }));

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const blockRows = meso
    ? db.programBlocks
        .filter((b) => b.userSlug === slug && b.weekday === weekday && b.mesocycleId === meso.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  const blocks = blockRows.map((b) => {
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

  const landmarks = new Map<string, Landmark>(
    db.volumeLandmarks
      .filter((r) => r.userSlug === slug)
      .map((r) => [r.muscle, { mev: r.mev, mav: r.mav, mrv: r.mrv }]),
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
}

function isMuscle(value: string): value is Muscle {
  return (MUSCLES as string[]).includes(value);
}

export function logSet(
  db: DemoDb,
  slug: string,
  date: string,
  exercise: string,
  setIndex: number,
  weightKg: number,
  reps: number,
  rir: number,
) {
  if (!EXERCISE_BY_KEY[exercise]) throw new Error("Unknown exercise");
  const entry = {
    setIndex: Math.max(0, Math.round(setIndex)),
    weightKg: Math.max(0, roundHalf(weightKg)),
    reps: Math.max(1, Math.round(reps)),
    rir: Math.min(10, Math.max(0, Math.round(rir))),
  };
  const row = db.setLogs.find(
    (r) => r.userSlug === slug && r.date === date && r.exercise === exercise && r.setIndex === entry.setIndex,
  );
  if (row) {
    row.weightKg = entry.weightKg;
    row.reps = entry.reps;
    row.rir = entry.rir;
  } else {
    db.setLogs.push({ userSlug: slug, date, exercise, ...entry });
  }
}

export function startMesocycle(db: DemoDb, slug: string, date: string, goal: MesoGoal) {
  for (const meso of db.mesocycles) {
    if (meso.userSlug !== slug || meso.status !== "running") continue;
    meso.status = "done";
    db.programBlocks = db.programBlocks.filter((b) => b.mesocycleId !== meso.id);
  }
  const id = db.newId("meso");
  db.mesocycles.push({
    id,
    userSlug: slug,
    name: mesocycleName(goal),
    startDate: date,
    weeks: MESO_WEEKS,
    deloadWeek: MESO_DELOAD_WEEK,
    goal,
    status: "running",
  });
  for (const block of MESO_TEMPLATES) {
    db.programBlocks.push({ userSlug: slug, mesocycleId: id, ...block });
  }
}

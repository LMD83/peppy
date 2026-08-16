import { addDays } from "@convex/tm/lib";
import {
  DEFAULT_LANDMARKS,
  DEFAULT_TRAIN_PROFILE,
  EXERCISE_BY_KEY,
  MESO_DELOAD_WEEK,
  MESO_WEEKS,
  MUSCLES,
  formatFor,
  mesocycleName,
  templatesFor,
  type Landmark,
  type MesoGoal,
  type TrainingProfile,
} from "@convex/tm/data/exercises";
import {
  e1rm,
  mesoWeekFor,
  profileFromRow,
  prsFrom,
  readinessAdjust,
  sessionBlockFor,
  sessionScale,
  survivalMoveFor,
  volumeLabel,
  volumeSetsByMuscle,
  volumeVerdict,
  type DatedSet,
  type TrainVoice,
} from "@convex/tm/logicTrain";
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

  const profileRow = db.trainProfiles.find((r) => r.userSlug === slug);
  const profile: TrainingProfile = profileRow ? profileFromRow(profileRow) : DEFAULT_TRAIN_PROFILE;
  const voice: TrainVoice = user.a11yProfileMut === "easy" ? "easy" : "standard";
  const format = formatFor(profile);

  if (user.modeMut === "survival") {
    return {
      mesocycle: null,
      today: { dayName: "Floor — movement only", isRestDay: true, blocks: [], format },
      loggedSets,
      weeklyVolume: [],
      prs: [],
      readiness: { multiplier: 1, note: "floor mode — no load prescription" },
      survival: true,
      profile,
      voice,
      survivalMove: survivalMoveFor(profile),
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

  const scale = sessionScale(profile);
  const blocks = blockRows
    .map((b) => sessionBlockFor(b, profile, voice, history, readiness))
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .slice(0, scale.maxBlocks);

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
    const labelled = volumeLabel(verdict, note, voice);
    return { muscle, sets, ...landmark, verdict, note: labelled.note, verdictLabel: labelled.verdict };
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
    today: { dayName, isRestDay: blocks.length === 0, blocks, format },
    loggedSets,
    weeklyVolume,
    prs: prsFrom(history).slice(0, 8),
    readiness: { multiplier: readiness.multiplier, note: readiness.note },
    survival: false,
    profile,
    voice,
    survivalMove: null,
  };
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
  const profileRow = db.trainProfiles.find((r) => r.userSlug === slug);
  const profile = profileRow ? profileFromRow(profileRow) : DEFAULT_TRAIN_PROFILE;
  for (const block of templatesFor(profile)) {
    db.programBlocks.push({ userSlug: slug, mesocycleId: id, ...block });
  }
}

export function saveProfile(
  db: DemoDb,
  slug: string,
  raw: {
    setting: string;
    kit: string[];
    experience: string;
    ageBand: string;
    minutes: number;
    constraints: string[];
  },
) {
  const profile = profileFromRow(raw);
  const row = db.trainProfiles.find((r) => r.userSlug === slug);
  if (row) {
    row.setting = profile.setting;
    row.kit = profile.kit;
    row.experience = profile.experience;
    row.ageBand = profile.ageBand;
    row.minutes = profile.minutes;
    row.constraints = profile.constraints;
  } else {
    db.trainProfiles.push({ userSlug: slug, ...profile });
  }
}

export function swapBlock(db: DemoDb, slug: string, exercise: string, replacement: string) {
  if (!EXERCISE_BY_KEY[replacement]) throw new Error("Unknown exercise");
  const meso = db.mesocycles.find((m) => m.userSlug === slug && m.status === "running");
  if (!meso) return;
  const row = db.programBlocks.find(
    (b) => b.userSlug === slug && b.mesocycleId === meso.id && b.exercise === exercise,
  );
  if (!row) return;
  row.exercise = replacement;
  row.muscle = EXERCISE_BY_KEY[replacement].muscle;
}

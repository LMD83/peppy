import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDMARKS,
  EXERCISES,
  EXERCISE_BY_KEY,
  MESO_TEMPLATES,
  MESO_TRAINING_WEEKDAYS,
  MUSCLES,
  exerciseName,
  mesocycleName,
  type Muscle,
} from "../convex/tm/data/exercises";
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
} from "../convex/tm/logicTrain";
import { buildTrainFixtures } from "../convex/tm/fixtures/train";

const TODAY = "2026-08-13"; // Thursday — pull day.

const BLOCK = { repLow: 8, repHigh: 12, rirTarget: 2, loadStepKg: 2.5 };

describe("exercise library", () => {
  it("carries at least 40 lifts, each with a sane rep range and load step", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
    for (const ex of EXERCISES) {
      expect(MUSCLES).toContain(ex.muscle);
      expect(ex.defaultRepLow).toBeLessThan(ex.defaultRepHigh);
      expect([2.5, 5]).toContain(ex.loadStepKg);
    }
  });

  it("keys are unique and resolve to display names", () => {
    expect(Object.keys(EXERCISE_BY_KEY)).toHaveLength(EXERCISES.length);
    expect(exerciseName("bench-press")).toBe("Bench press");
    expect(exerciseName("not-a-lift")).toBe("not-a-lift");
  });

  it("steps 5 kg on lower compounds and 2.5 kg everywhere upper", () => {
    expect(EXERCISE_BY_KEY["back-squat"].loadStepKg).toBe(5);
    expect(EXERCISE_BY_KEY["deadlift"].loadStepKg).toBe(5);
    expect(EXERCISE_BY_KEY["bench-press"].loadStepKg).toBe(2.5);
    expect(EXERCISE_BY_KEY["triceps-pushdown"].loadStepKg).toBe(2.5);
  });

  it("landmarks are ordered MEV < MAV < MRV for every muscle", () => {
    for (const muscle of MUSCLES) {
      const l = DEFAULT_LANDMARKS[muscle];
      expect(l.mev).toBeLessThan(l.mav);
      expect(l.mav).toBeLessThan(l.mrv);
    }
  });

  it("templates only use known lifts and only the four session weekdays", () => {
    expect(MESO_TEMPLATES.length).toBeGreaterThan(0);
    for (const block of MESO_TEMPLATES) {
      expect(MESO_TRAINING_WEEKDAYS).toContain(block.weekday);
      const ex = EXERCISE_BY_KEY[block.exercise];
      expect(ex).toBeDefined();
      expect(ex.muscle).toBe(block.muscle);
      expect(block.repLow).toBeLessThan(block.repHigh);
    }
    expect(mesocycleName("hypertrophy")).toBe("Hypertrophy · 6 weeks");
  });

  it("keeps every muscle inside its own MRV for one programmed week", () => {
    const weekly = {} as Record<Muscle, number>;
    for (const m of MUSCLES) weekly[m] = 0;
    for (const block of MESO_TEMPLATES) weekly[block.muscle] += block.sets;
    for (const muscle of MUSCLES) {
      expect(weekly[muscle]).toBeLessThanOrEqual(DEFAULT_LANDMARKS[muscle].mrv);
    }
  });
});

describe("e1rm", () => {
  it("applies Epley to reps-to-failure and rounds to the half kilo", () => {
    // 100 × (1 + (10 + 2)/30) = 140
    expect(e1rm(100, 10, 2)).toBe(140);
    // 60 × (1 + 8/30) = 76.0
    expect(e1rm(60, 8, 0)).toBe(76);
    // 62.5 × (1 + 10/30) = 83.33 → 83.5
    expect(e1rm(62.5, 7, 3)).toBe(83.5);
  });

  it("returns 0 for junk input rather than NaN", () => {
    expect(e1rm(0, 10, 2)).toBe(0);
    expect(e1rm(100, 0, 2)).toBe(0);
    expect(e1rm(Number.NaN, 5, 1)).toBe(0);
    expect(e1rm(100, 10, Number.NaN)).toBe(e1rm(100, 10, 0));
  });

  it("rounds halves consistently", () => {
    expect(roundHalf(2.24)).toBe(2);
    expect(roundHalf(2.26)).toBe(2.5);
    expect(roundHalf(Number.NaN)).toBe(0);
  });
});

describe("progressionFor", () => {
  it("adds the load step when every set topped the range at or under target RIR", () => {
    const p = progressionFor(
      [
        { weightKg: 60, reps: 12, rir: 2 },
        { weightKg: 60, reps: 12, rir: 1 },
      ],
      BLOCK,
    );
    expect(p.action).toBe("add-load");
    expect(p.deltaKg).toBe(2.5);
    expect(p.suggestionKg).toBe(62.5);
    expect(p.why).toContain("12+");
  });

  it("holds and buys a rep when reps sit inside the range", () => {
    const p = progressionFor(
      [
        { weightKg: 60, reps: 10, rir: 2 },
        { weightKg: 60, reps: 9, rir: 2 },
      ],
      BLOCK,
    );
    expect(p.action).toBe("add-rep");
    expect(p.deltaKg).toBe(0);
    expect(p.suggestionKg).toBe(60);
  });

  it("does not add load when the reps landed but RIR was above target", () => {
    const p = progressionFor([{ weightKg: 60, reps: 12, rir: 4 }], BLOCK);
    expect(p.action).toBe("add-rep");
  });

  it("cuts 5% when any set fell under the bottom of the range", () => {
    const p = progressionFor(
      [
        { weightKg: 100, reps: 12, rir: 1 },
        { weightKg: 100, reps: 6, rir: 0 },
      ],
      BLOCK,
    );
    expect(p.action).toBe("back-off");
    expect(p.suggestionKg).toBe(95);
    expect(p.deltaKg).toBe(-5);
  });

  it("asks for a first log instead of inventing a load", () => {
    const p = progressionFor([], BLOCK);
    expect(p.action).toBe("start");
    expect(p.suggestionKg).toBe(0);
    expect(p.deltaKg).toBe(0);
  });

  it("ignores zero-rep rows and falls back to a safe step", () => {
    const p = progressionFor([{ weightKg: 50, reps: 0, rir: 0 }], { ...BLOCK, loadStepKg: 0 });
    expect(p.action).toBe("start");
    const q = progressionFor([{ weightKg: 50, reps: 12, rir: 1 }], { ...BLOCK, loadStepKg: 0 });
    expect(q.suggestionKg).toBe(52.5);
  });
});

describe("mesoWeekFor", () => {
  it("counts weeks from the start date", () => {
    expect(mesoWeekFor("2026-08-01", "2026-08-01", 6, 6)).toEqual({
      week: 1,
      isDeload: false,
      phase: "accumulation",
    });
    expect(mesoWeekFor("2026-08-01", "2026-08-15", 6, 6).week).toBe(3);
  });

  it("flags the deload week and completion", () => {
    const deload = mesoWeekFor("2026-08-01", "2026-09-05", 6, 6);
    expect(deload).toEqual({ week: 6, isDeload: true, phase: "deload" });
    const done = mesoWeekFor("2026-08-01", "2026-09-30", 6, 6);
    expect(done).toEqual({ week: 6, isDeload: false, phase: "complete" });
  });

  it("never returns week 0 for a date before the block started", () => {
    expect(mesoWeekFor("2026-08-01", "2026-07-20", 6, 6).week).toBe(1);
    // A nonsense length clamps to one week rather than dividing by zero.
    expect(mesoWeekFor("2026-08-01", "2026-08-02", 0, 6).week).toBe(1);
    expect(mesoWeekFor("2026-08-01", "2026-08-12", 0, 6).phase).toBe("complete");
  });
});

describe("volume", () => {
  const logs: { date: string; exercise: string }[] = [
    { date: "2026-08-10", exercise: "bench-press" },
    { date: "2026-08-10", exercise: "bench-press" },
    { date: "2026-08-10", exercise: "cable-fly" },
    { date: "2026-08-01", exercise: "bench-press" },
    { date: "2026-08-11", exercise: "not-a-lift" },
    { date: "2026-08-11", exercise: "back-squat" },
  ];

  it("counts hard sets by muscle inside the window only", () => {
    const out = volumeSetsByMuscle(logs, EXERCISE_BY_KEY, "2026-08-07", "2026-08-13");
    expect(out.chest).toBe(3);
    expect(out.quads).toBe(1);
    expect(out.biceps).toBe(0);
  });

  it("returns a zeroed record for empty history", () => {
    const out = volumeSetsByMuscle([], EXERCISE_BY_KEY, "2026-08-07", "2026-08-13");
    for (const muscle of MUSCLES) expect(out[muscle]).toBe(0);
  });

  it("reads verdicts off the landmarks", () => {
    const landmark = { mev: 8, mav: 16, mrv: 22 };
    expect(volumeVerdict(4, landmark).verdict).toBe("below MEV");
    expect(volumeVerdict(4, landmark).note).toContain("4 sets short");
    expect(volumeVerdict(12, landmark).verdict).toBe("productive");
    expect(volumeVerdict(18, landmark).verdict).toBe("productive");
    expect(volumeVerdict(22, landmark).verdict).toBe("at MRV");
    expect(volumeVerdict(26, landmark).verdict).toBe("over MRV");
    expect(volumeVerdict(Number.NaN, landmark).verdict).toBe("below MEV");
  });
});

describe("readinessAdjust", () => {
  it("leaves the load alone when nothing was logged", () => {
    expect(readinessAdjust(undefined, undefined)).toEqual({
      multiplier: 1,
      note: "no state logged",
      dropSet: false,
    });
    expect(readinessAdjust(2, null).note).toBe("no state logged");
  });

  it("runs full load on a green day and backs off on a bad one", () => {
    const green = readinessAdjust(1, 5);
    expect(green.multiplier).toBe(1);
    expect(green.dropSet).toBe(false);
    const bad = readinessAdjust(5, 1);
    expect(bad.multiplier).toBe(0.85);
    expect(bad.note).toContain("stress high");
  });

  it("stays inside 0.85–1.0 across the whole grid", () => {
    for (let stress = 1; stress <= 5; stress++) {
      for (let energy = 1; energy <= 5; energy++) {
        const { multiplier } = readinessAdjust(stress, energy);
        expect(multiplier).toBeGreaterThanOrEqual(0.85);
        expect(multiplier).toBeLessThanOrEqual(1);
      }
    }
  });

  it("deload week forces 0.85 and drops a set regardless of state", () => {
    const r = readinessAdjust(1, 5, true);
    expect(r.multiplier).toBe(0.85);
    expect(r.dropSet).toBe(true);
    expect(readinessAdjust(undefined, undefined, true).dropSet).toBe(true);
  });

  it("clamps out-of-range inputs instead of drifting past the floor", () => {
    expect(readinessAdjust(99, -4).multiplier).toBe(0.85);
  });
});

describe("history", () => {
  const logs: DatedSet[] = [
    { date: "2026-08-01", exercise: "bench-press", weightKg: 80, reps: 8, rir: 1 },
    { date: "2026-08-08", exercise: "bench-press", weightKg: 60, reps: 12, rir: 2 },
    { date: "2026-08-08", exercise: "bench-press", weightKg: 62.5, reps: 10, rir: 1 },
    { date: "2026-08-08", exercise: "back-squat", weightKg: 100, reps: 5, rir: 2 },
  ];

  it("takes the last session's sets, not the whole history", () => {
    const last = lastSessionFor(logs, "bench-press");
    expect(last?.date).toBe("2026-08-08");
    expect(last?.sets).toHaveLength(2);
    expect(lastSessionFor(logs, "pull-up")).toBeNull();
  });

  it("picks the best set of that last session by e1RM", () => {
    // 60 × 12 @ 2 RIR outranks the heavier 62.5 × 10 @ 1 — reps-to-failure wins.
    const top = topSetFor(logs, "bench-press");
    expect(top?.weightKg).toBe(60);
    expect(top?.e1rm).toBe(e1rm(60, 12, 2));
    expect(top?.e1rm).toBeGreaterThan(e1rm(62.5, 10, 1));
    expect(topSetFor([], "bench-press")).toBeNull();
  });

  it("keeps the all-time best e1RM per lift with its date, strongest first", () => {
    const prs = prsFrom(logs);
    expect(prs[0].exercise).toBe("back-squat");
    expect(prs.find((p) => p.exercise === "bench-press")).toEqual({
      exercise: "bench-press",
      e1rm: e1rm(80, 8, 1),
      date: "2026-08-01",
    });
    expect(prsFrom([])).toEqual([]);
  });
});

describe("fixtures", () => {
  const fx = buildTrainFixtures(TODAY);

  it("puts Liam in week 3 of a running six-week block", () => {
    expect(fx.mesocycles).toHaveLength(1);
    const meso = fx.mesocycles[0];
    expect(meso.userSlug).toBe("liam");
    expect(meso.status).toBe("running");
    expect(mesoWeekFor(meso.startDate, TODAY, meso.weeks, meso.deloadWeek)).toEqual({
      week: 3,
      isDeload: false,
      phase: "accumulation",
    });
  });

  it("programmes every template block against that mesocycle", () => {
    expect(fx.programBlocks).toHaveLength(MESO_TEMPLATES.length);
    for (const block of fx.programBlocks) expect(block.mesocycleId).toBe(fx.mesocycles[0].id);
  });

  it("logs four weeks of sets, none of them dated today", () => {
    expect(fx.setLogs.length).toBeGreaterThan(200);
    for (const row of fx.setLogs) {
      expect(row.date < TODAY).toBe(true);
      expect(EXERCISE_BY_KEY[row.exercise]).toBeDefined();
    }
  });

  it("carries a stalled lift so the hold branch is visible", () => {
    const history: DatedSet[] = fx.setLogs.map((r) => ({
      date: r.date,
      exercise: r.exercise,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir,
    }));
    const stalled = lastSessionFor(history, "overhead-press");
    expect(stalled).not.toBeNull();
    const block = MESO_TEMPLATES.find((b) => b.exercise === "overhead-press");
    if (!block) throw new Error("overhead-press missing from the template");
    const p = progressionFor(stalled?.sets ?? [], {
      repLow: block.repLow,
      repHigh: block.repHigh,
      rirTarget: block.rirTarget,
      loadStepKg: EXERCISE_BY_KEY["overhead-press"].loadStepKg,
    });
    expect(p.action).toBe("add-rep");
    expect(p.deltaKg).toBe(0);
  });

  it("earns the load step somewhere in the block", () => {
    const history: DatedSet[] = fx.setLogs.map((r) => ({
      date: r.date,
      exercise: r.exercise,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir,
    }));
    const actions = MESO_TEMPLATES.map((block) =>
      progressionFor(lastSessionFor(history, block.exercise)?.sets ?? [], {
        repLow: block.repLow,
        repHigh: block.repHigh,
        rirTarget: block.rirTarget,
        loadStepKg: EXERCISE_BY_KEY[block.exercise].loadStepKg,
      }).action,
    );
    expect(actions).toContain("add-load");
    expect(actions).not.toContain("start");
  });

  it("gives both users landmarks but only Liam a block", () => {
    const slugs = new Set(fx.volumeLandmarks.map((r) => r.userSlug));
    expect(slugs).toEqual(new Set(["liam", "conor"]));
    expect(fx.volumeLandmarks).toHaveLength(MUSCLES.length * 2);
    expect(fx.setLogs.every((r) => r.userSlug === "liam")).toBe(true);
    expect(fx.programBlocks.every((r) => r.userSlug === "liam")).toBe(true);
  });

  it("lands the trailing week inside believable landmark territory", () => {
    const history = fx.setLogs.map((r) => ({ date: r.date, exercise: r.exercise }));
    const sets = volumeSetsByMuscle(history, EXERCISE_BY_KEY, "2026-08-07", TODAY);
    for (const muscle of MUSCLES) {
      expect(sets[muscle]).toBeLessThanOrEqual(DEFAULT_LANDMARKS[muscle].mrv);
    }
    expect(sets.back).toBeGreaterThan(0);
  });
});

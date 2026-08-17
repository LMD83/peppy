import { describe, expect, it } from "vitest";
import {
  AUDITC_THRESHOLDS,
  INSTRUMENTS,
  INTENTION_TEMPLATES,
  MINDSET_PROMPTS,
  REFRAMES,
  SURVIVAL_INSTRUMENT_KEYS,
  WEEKLY_REVIEW_PROMPTS,
  instrumentByKey,
  maxScoreOf,
  type Instrument,
} from "../convex/tm/data/instruments";
import {
  IDENTITY_HEADLINES,
  InstrumentInputError,
  MAX_SUGGESTIONS,
  QUIET_THRESHOLD_DAYS,
  SAFETY_TEXT,
  SUPPORT_LINES,
  TREND_FRAMING,
  bandFor,
  buildMindView,
  dateIndex,
  dueAssessments,
  encouragementFor,
  intentionSuggestions,
  mindsetPromptForDate,
  promptForDate,
  quietCheckFor,
  quietStreak,
  safetyFlagged,
  scoreInstrument,
  topSignals,
  trendFor,
  type MindViewInput,
  type RawAssessment,
  type TriggerBucket,
} from "../convex/tm/logicMind";
import { buildMindFixtures } from "../convex/tm/fixtures/mind";
import { addDays, daysBetween } from "../convex/tm/lib";
import type { WallDay } from "../convex/tm/logic";

const TODAY = "2026-08-13";
const FX = buildMindFixtures(TODAY);

function inst(key: string): Instrument {
  const found = instrumentByKey(key);
  if (!found) throw new Error(`missing instrument ${key}`);
  return found;
}

function zeros(key: string): number[] {
  return inst(key).items.map(() => 0);
}

function maxed(key: string): number[] {
  const i = inst(key);
  return i.items.map(() => i.scaleLabels.length - 1);
}

/* ===== the catalogue ===== */

describe("instrument catalogue", () => {
  it("carries the seven instruments the slice promises, each with a source and a note", () => {
    expect(INSTRUMENTS.map((i) => i.key)).toEqual([
      "phq9",
      "gad7",
      "pss10",
      "who5",
      "isi",
      "auditc",
      "pacs",
    ]);
    for (const i of INSTRUMENTS) {
      expect(i.source.length).toBeGreaterThan(10);
      expect(i.note.length).toBeGreaterThan(20);
      expect(i.cadenceDays).toBeGreaterThan(0);
    }
  });

  it("reproduces item counts, scale widths and cadences exactly", () => {
    const spec: [string, number, number, number][] = [
      // key, items, anchors (scale points), cadenceDays
      ["phq9", 9, 4, 14],
      ["gad7", 7, 4, 14],
      ["pss10", 10, 5, 28],
      ["who5", 5, 6, 14],
      ["isi", 7, 5, 28],
      ["auditc", 3, 5, 90],
      ["pacs", 5, 7, 7],
    ];
    for (const [key, items, anchors, cadence] of spec) {
      const i = inst(key);
      expect(i.items).toHaveLength(items);
      expect(i.scaleLabels).toHaveLength(anchors);
      expect(i.cadenceDays).toBe(cadence);
      expect(new Set(i.items).size).toBe(items); // no duplicated item text
    }
  });

  it("bands are contiguous, non-overlapping, and cover 0 to the maximum score", () => {
    for (const i of INSTRUMENTS) {
      const bands = i.bands;
      expect(bands[0].min).toBe(0);
      expect(bands[bands.length - 1].max).toBe(maxScoreOf(i));
      for (let n = 1; n < bands.length; n++) {
        expect(bands[n].min).toBe(bands[n - 1].max + 1);
        expect(bands[n].max).toBeGreaterThanOrEqual(bands[n].min);
      }
    }
  });

  it("reproduces the PHQ-9 and GAD-7 bands as published", () => {
    expect(inst("phq9").bands.map((b) => [b.min, b.max, b.label])).toEqual([
      [0, 4, "minimal"],
      [5, 9, "mild"],
      [10, 14, "moderate"],
      [15, 19, "moderately severe"],
      [20, 27, "severe"],
    ]);
    expect(inst("gad7").bands.map((b) => [b.min, b.max])).toEqual([
      [0, 4],
      [5, 9],
      [10, 14],
      [15, 21],
    ]);
  });

  it("puts the PHQ-9 safety item last, and declares it on no other instrument", () => {
    expect(inst("phq9").safetyItemIndex).toBe(8);
    expect(inst("phq9").items[8]).toMatch(/better off dead/);
    for (const i of INSTRUMENTS) {
      if (i.key !== "phq9") expect(i.safetyItemIndex).toBeUndefined();
    }
  });

  it("reverse-scores exactly the four PSS-10 items, and nothing else", () => {
    expect(inst("pss10").reverseItems).toEqual([3, 4, 6, 7]);
    for (const i of INSTRUMENTS) {
      if (i.key === "pss10") continue;
      expect(i.reverseItems ?? []).toEqual([]);
    }
  });

  it("keeps every reverse index and per-item scale aligned with the item list", () => {
    for (const i of INSTRUMENTS) {
      for (const idx of i.reverseItems ?? []) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(i.items.length);
      }
      if (i.itemScaleLabels) {
        expect(i.itemScaleLabels).toHaveLength(i.items.length);
        for (const anchors of i.itemScaleLabels) expect(anchors).toHaveLength(i.scaleLabels.length);
      }
    }
  });

  it("keeps the AUDIT-C sex-specific thresholds and says so in the note", () => {
    expect(AUDITC_THRESHOLDS).toEqual({ male: 4, female: 3 });
    expect(inst("auditc").note).toMatch(/4 or more \(men\), 3 or more \(women\)/);
  });

  it("labels PACS as validated for alcohol only — the honest evidence claim", () => {
    expect(inst("pacs").note).toMatch(/unvalidated/);
    expect(inst("pacs").note).toMatch(/no official clinical cut-offs/);
  });

  it("never asserts a diagnosis in a band label", () => {
    for (const i of INSTRUMENTS) {
      for (const b of i.bands) {
        expect(b.label).not.toMatch(/you (have|are)/i);
        expect(b.label).not.toMatch(/disorder/i);
      }
    }
  });

  it("caps survival at the two shortest instruments", () => {
    expect(SURVIVAL_INSTRUMENT_KEYS).toEqual(["who5", "pacs"]);
    for (const key of SURVIVAL_INSTRUMENT_KEYS) expect(inst(key).items.length).toBeLessThanOrEqual(5);
  });

  it("ships prompts, reframes and if-then templates for every craving signal", () => {
    expect(MINDSET_PROMPTS.length).toBeGreaterThanOrEqual(5);
    expect(WEEKLY_REVIEW_PROMPTS.length).toBeGreaterThanOrEqual(5);
    expect(REFRAMES.length).toBeGreaterThanOrEqual(5);
    for (const signal of ["tired", "emotion", "cue", "bored", "hungry"] as const) {
      expect(INTENTION_TEMPLATES[signal].length).toBeGreaterThanOrEqual(2);
      for (const t of INTENTION_TEMPLATES[signal]) {
        expect(t.trigger.length).toBeGreaterThan(4);
        expect(t.action.length).toBeGreaterThan(4);
      }
    }
  });

  it("never shames in a reframe — a missed day is a data point, not a verdict", () => {
    for (const r of REFRAMES) {
      expect(r).not.toMatch(/lazy|weak|excuse|failure|shame/i);
    }
  });
});

/* ===== scoring ===== */

describe("scoreInstrument", () => {
  it("totals a plain 0–3 instrument", () => {
    expect(scoreInstrument(inst("phq9"), [1, 2, 3, 0, 1, 2, 0, 1, 0]).score).toBe(10);
    expect(scoreInstrument(inst("phq9"), [1, 2, 3, 0, 1, 2, 0, 1, 0]).band).toBe("moderate");
  });

  it("floors and ceilings land in the first and last band", () => {
    for (const i of INSTRUMENTS) {
      const low = scoreInstrument(i, zeros(i.key));
      const high = scoreInstrument(i, maxed(i.key));
      expect(low.score).toBe(i.key === "pss10" ? 16 : 0); // reverse items score max at zero
      expect(high.score).toBe(i.key === "pss10" ? 24 : maxScoreOf(i));
      expect(i.bands.some((b) => b.label === low.band)).toBe(true);
      expect(i.bands.some((b) => b.label === high.band)).toBe(true);
    }
  });

  it("reverse-scores the PSS-10 items and only those", () => {
    // All 4s: the six normal items score 4, the four reverse items score 0.
    expect(scoreInstrument(inst("pss10"), Array(10).fill(4)).score).toBe(24);
    // All 0s: the reverse items score 4 each.
    expect(scoreInstrument(inst("pss10"), Array(10).fill(0)).score).toBe(16);
    // A single reverse item moved by one moves the total by one, downwards.
    const base = Array(10).fill(2);
    const bumped = [...base];
    bumped[3] = 3;
    expect(scoreInstrument(inst("pss10"), bumped).score).toBe(
      scoreInstrument(inst("pss10"), base).score - 1,
    );
  });

  it("multiplies WHO-5 by four onto the 0–100 scale", () => {
    expect(scoreInstrument(inst("who5"), [5, 5, 5, 5, 5]).score).toBe(100);
    expect(scoreInstrument(inst("who5"), [2, 2, 3, 1, 3]).score).toBe(44);
    expect(scoreInstrument(inst("who5"), [2, 2, 3, 1, 3]).band).toBe(
      "low wellbeing — worth a conversation",
    );
    expect(scoreInstrument(inst("who5"), [3, 3, 4, 2, 4]).score).toBe(64);
    expect(scoreInstrument(inst("who5"), [3, 3, 4, 2, 4]).band).toBe("adequate");
    // The published boundary: 50 is low, 52 is adequate.
    expect(bandFor(inst("who5"), 50).label).toMatch(/low wellbeing/);
    expect(bandFor(inst("who5"), 52).label).toBe("adequate");
  });

  it("raises the safety flag only for a non-zero answer on the declared item", () => {
    expect(scoreInstrument(inst("phq9"), [3, 3, 3, 3, 3, 3, 3, 3, 0]).safetyFlag).toBe(false);
    expect(scoreInstrument(inst("phq9"), [0, 0, 0, 0, 0, 0, 0, 0, 1]).safetyFlag).toBe(true);
    // No other instrument can raise it, at any answer.
    for (const i of INSTRUMENTS) {
      if (i.key === "phq9") continue;
      expect(scoreInstrument(i, maxed(i.key)).safetyFlag).toBe(false);
    }
  });

  it("throws a typed error on a malformed submission", () => {
    const cases: [number[], string][] = [
      [[0, 0, 0], "wrong-answer-count"],
      [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "wrong-answer-count"],
      [[0, 0, 0, 0, 0, 0, 0, 0, 4], "answer-out-of-range"],
      [[0, 0, 0, 0, 0, 0, 0, 0, -1], "answer-out-of-range"],
      [[0, 0, 0, 0, 0, 0, 0, 0, 1.5], "answer-not-integer"],
      [[0, 0, 0, 0, 0, 0, 0, 0, Number.NaN], "answer-not-integer"],
    ];
    for (const [answers, code] of cases) {
      try {
        scoreInstrument(inst("phq9"), answers);
        throw new Error(`expected ${code}`);
      } catch (err) {
        expect(err).toBeInstanceOf(InstrumentInputError);
        expect((err as InstrumentInputError).code).toBe(code);
      }
    }
  });

  it("agrees with bandFor for every attainable score", () => {
    for (const i of INSTRUMENTS) {
      for (let s = 0; s <= maxScoreOf(i); s++) {
        const band = bandFor(i, s);
        expect(i.bands.some((b) => b.label === band.label)).toBe(true);
      }
    }
  });
});

/* ===== cadence ===== */

describe("dueAssessments", () => {
  it("lists an instrument that has never been taken, with a null daysSince", () => {
    const due = dueAssessments([inst("isi")], [], TODAY);
    expect(due).toEqual([{ key: "isi", name: "ISI", daysSince: null, cadenceDays: 28 }]);
  });

  it("holds an instrument until its cadence has elapsed, then releases it", () => {
    const history = [{ instrument: "phq9", date: addDays(TODAY, -13) }];
    expect(dueAssessments([inst("phq9")], history, TODAY)).toEqual([]);
    const older = [{ instrument: "phq9", date: addDays(TODAY, -14) }];
    expect(dueAssessments([inst("phq9")], older, TODAY)[0].daysSince).toBe(14);
  });

  it("uses only the most recent take of each instrument", () => {
    const history = [
      { instrument: "pacs", date: addDays(TODAY, -40) },
      { instrument: "pacs", date: addDays(TODAY, -2) },
    ];
    expect(dueAssessments([inst("pacs")], history, TODAY)).toEqual([]);
  });

  it("puts never-taken first, then most overdue, deterministically", () => {
    const due = dueAssessments(
      [inst("phq9"), inst("gad7"), inst("isi")],
      [
        { instrument: "phq9", date: addDays(TODAY, -30) },
        { instrument: "gad7", date: addDays(TODAY, -16) },
      ],
      TODAY,
    );
    expect(due.map((d) => d.key)).toEqual(["isi", "phq9", "gad7"]);
  });
});

/* ===== trend ===== */

describe("trendFor", () => {
  it("refuses to call one reading a trend", () => {
    const t = trendFor([{ date: TODAY, score: 9 }]);
    expect(t.change).toBeNull();
    expect(t.direction).toBe("none");
    expect(t.previous).toBeNull();
    expect(t.framing).toMatch(/not a trend/);
  });

  it("has an empty state that still states the epistemic status", () => {
    const t = trendFor([]);
    expect(t.latest).toBeNull();
    expect(t.framing).toContain(TREND_FRAMING);
  });

  it("compares the latest with the one before it, in date order", () => {
    const t = trendFor([
      { date: addDays(TODAY, -21), score: 12 },
      { date: addDays(TODAY, -35), score: 15 },
      { date: addDays(TODAY, -7), score: 6 },
    ]);
    expect(t.previous?.score).toBe(12);
    expect(t.latest?.score).toBe(6);
    expect(t.change).toBe(-6);
    expect(t.direction).toBe("down");
  });

  it("calls an identical pair flat", () => {
    const t = trendFor([
      { date: addDays(TODAY, -14), score: 8 },
      { date: TODAY, score: 8 },
    ]);
    expect(t.direction).toBe("flat");
    expect(t.change).toBe(0);
  });

  it("always frames the number as correlational, never diagnostic", () => {
    const cases = [
      trendFor([]),
      trendFor([{ date: TODAY, score: 3 }]),
      trendFor([
        { date: addDays(TODAY, -14), score: 3 },
        { date: TODAY, score: 11 },
      ]),
    ];
    for (const t of cases) {
      expect(t.framing).toContain(TREND_FRAMING);
      expect(t.framing).not.toMatch(/you have|diagnosis|worsening depression/i);
    }
  });
});

/* ===== encouragement ===== */

describe("encouragementFor", () => {
  const base = { mode: "cut" as const, streak: 9, adherence7: 86, missedYesterday: false, date: TODAY };

  it("is deterministic — same date, same words, on every device", () => {
    const a = encouragementFor(base);
    const b = encouragementFor({ ...base });
    expect(a).toEqual(b);
    expect(IDENTITY_HEADLINES).toContain(a.headline);
  });

  it("varies the headline across dates without ever leaving the identity set", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const e = encouragementFor({ ...base, date: addDays(TODAY, -i) });
      expect(IDENTITY_HEADLINES).toContain(e.headline);
      seen.add(e.headline);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is identity-based, never an instruction", () => {
    for (const h of IDENTITY_HEADLINES) expect(h).toMatch(/^You are someone who/);
  });

  it("answers a missed day with self-compassion and no penance", () => {
    const e = encouragementFor({ ...base, streak: 0, missedYesterday: true });
    expect(e.tone).toBe("amber");
    expect(e.headline).toMatch(/Repair is a decision/);
    expect(REFRAMES.some((r) => e.body.startsWith(r))).toBe(true);
    expect(e.body).toMatch(/Nothing is owed/);
    expect(`${e.headline} ${e.body}`).not.toMatch(/lazy|failed|make up for|catch up|punish/i);
  });

  it("collapses to the floor in survival, in amber, with no extra obligation", () => {
    const e = encouragementFor({ ...base, mode: "survival", streak: 4 });
    expect(e.tone).toBe("amber");
    expect(e.headline).toMatch(/Three checks/);
    expect(e.body).toMatch(/no bonus round/);
  });

  it("survival's missed-day line still leads with the floor, not the streak", () => {
    const e = encouragementFor({ ...base, mode: "survival", streak: 0, missedYesterday: true });
    expect(e.headline).toMatch(/floor is still the floor/);
    expect(e.tone).toBe("amber");
  });

  it("reports the real numbers rather than inventing a streak", () => {
    const none = encouragementFor({ ...base, streak: 0, adherence7: 41 });
    expect(none.body).toContain("41%");
    expect(none.body).toMatch(/No streak running/);
    expect(none.tone).toBe("blue");
    const long = encouragementFor({ ...base, streak: 21, adherence7: 100 });
    expect(long.body).toContain("21 full days");
    expect(long.tone).toBe("green");
  });
});

describe("dateIndex", () => {
  it("is stable, bounded and never negative", () => {
    for (let i = 0; i < 400; i++) {
      const d = addDays("2026-01-01", i);
      const n = dateIndex(d, 7);
      expect(n).toBe(dateIndex(d, 7));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(dateIndex(TODAY, 0)).toBe(0);
  });

  it("drives a weekly prompt that is always one of the published prompts", () => {
    for (let i = 0; i < 30; i++) {
      expect(WEEKLY_REVIEW_PROMPTS).toContain(promptForDate(addDays(TODAY, i)));
      expect(MINDSET_PROMPTS).toContain(mindsetPromptForDate(addDays(TODAY, i)));
    }
    expect(promptForDate(TODAY)).toBe(promptForDate(TODAY));
    expect(mindsetPromptForDate(TODAY)).toBe(mindsetPromptForDate(TODAY));
  });
});

/* ===== intentions ===== */

describe("intentionSuggestions", () => {
  const map: TriggerBucket[] = [
    { hour: 20, counts: { tired: 3, bored: 1 } },
    { hour: 21, counts: { tired: 6, bored: 2 } },
    { hour: 22, counts: { bored: 1, hungry: 1 } },
  ];

  it("ranks the signals this person actually logs", () => {
    expect(topSignals(map)).toEqual([
      { signal: "tired", count: 9 },
      { signal: "bored", count: 4 },
      { signal: "hungry", count: 1 },
    ]);
  });

  it("builds if-then plans from the top two signals only", () => {
    const out = intentionSuggestions(map);
    expect(out.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    expect(new Set(out.map((s) => s.signal))).toEqual(new Set(["tired", "bored"]));
    for (const s of out) {
      expect(INTENTION_TEMPLATES[s.signal as "tired" | "bored"]).toContainEqual({
        trigger: s.trigger,
        action: s.action,
      });
    }
  });

  it("invents nothing when there are no craving logs", () => {
    expect(intentionSuggestions([])).toEqual([]);
    expect(intentionSuggestions([{ hour: 21, counts: {} }])).toEqual([]);
  });

  it("is order-independent and deterministic", () => {
    expect(intentionSuggestions([...map].reverse())).toEqual(intentionSuggestions(map));
  });
});

/* ===== the quiet check ===== */

/** A 14-day wall where `doneFor` maps days-ago to checks done that day. */
function wallOf(today: string, doneFor: (daysAgo: number) => number, total = 5): WallDay[] {
  const wall: WallDay[] = [];
  for (let i = 13; i >= 0; i--) wall.push({ date: addDays(today, -i), done: doneFor(i), total });
  return wall;
}

const activeWall = wallOf(TODAY, () => 5);
const silentWall = wallOf(TODAY, () => 0);

describe("quietStreak", () => {
  it("is zero on a wall with something logged yesterday", () => {
    expect(quietStreak(activeWall, TODAY)).toBe(0);
    expect(quietStreak(wallOf(TODAY, (ago) => (ago === 1 ? 1 : 0)), TODAY)).toBe(0);
  });

  it("counts consecutive quiet days ending yesterday", () => {
    expect(quietStreak(wallOf(TODAY, (ago) => (ago >= 3 ? 5 : 0)), TODAY)).toBe(2);
    expect(quietStreak(wallOf(TODAY, (ago) => (ago >= 5 ? 5 : 0)), TODAY)).toBe(4);
  });

  it("excludes today — a day still in play cannot be quiet yet", () => {
    // Everything logged except today: no quiet run has started.
    expect(quietStreak(wallOf(TODAY, (ago) => (ago === 0 ? 0 : 5)), TODAY)).toBe(0);
    // Today's zero adds nothing to the run behind it.
    expect(quietStreak(wallOf(TODAY, (ago) => (ago >= 4 ? 5 : 0)), TODAY)).toBe(3);
  });

  it("resets on a gap — one logged check ends the run", () => {
    // Quiet, then one active day two days ago, then quiet yesterday.
    const gapped = wallOf(TODAY, (ago) => (ago === 2 ? 1 : ago >= 6 ? 5 : 0));
    expect(quietStreak(gapped, TODAY)).toBe(1);
  });

  it("spans the whole window when nothing was ever logged", () => {
    expect(quietStreak(silentWall, TODAY)).toBe(13);
  });
});

describe("quietCheckFor", () => {
  const started = addDays(TODAY, -60);

  it("stays silent below the threshold", () => {
    for (let quiet = 0; quiet < QUIET_THRESHOLD_DAYS; quiet++) {
      const wall = wallOf(TODAY, (ago) => (ago > quiet ? 5 : 0));
      expect(quietCheckFor({ wall, startDate: started, date: TODAY })).toBeNull();
    }
  });

  it("asks the question at three quiet days, with the real number", () => {
    const wall = wallOf(TODAY, (ago) => (ago > 3 ? 5 : 0));
    const check = quietCheckFor({ wall, startDate: started, date: TODAY });
    expect(check).not.toBeNull();
    expect(check?.days).toBe(3);
    expect(check?.heading).toBe("You've gone quiet.");
    expect(check?.body).toContain("Nothing logged in 3 days");
    expect(check?.body).toMatch(/Are you ok\?$/);
    expect(check?.support).toBe(SUPPORT_LINES);
  });

  it("never triggers for a brand-new file — it has not gone quiet, it has just started", () => {
    expect(quietCheckFor({ wall: silentWall, startDate: TODAY, date: TODAY })).toBeNull();
    expect(
      quietCheckFor({ wall: silentWall, startDate: addDays(TODAY, -2), date: TODAY }),
    ).toBeNull();
  });

  it("caps the quiet count at the file's age", () => {
    const check = quietCheckFor({ wall: silentWall, startDate: addDays(TODAY, -5), date: TODAY });
    expect(check?.days).toBe(5);
  });

  it("carries the same support lines the safety card ends with", () => {
    expect(SAFETY_TEXT.endsWith(SUPPORT_LINES)).toBe(true);
    expect(SUPPORT_LINES).toContain("999 or 112");
    expect(SUPPORT_LINES).toContain("116 123");
  });

  it("asks, and never shames — no streak arithmetic, no penance", () => {
    const check = quietCheckFor({ wall: silentWall, startDate: started, date: TODAY });
    const words = `${check?.heading} ${check?.body}`;
    expect(words).not.toMatch(/lazy|failed|failure|make up|catch up|broke your streak/i);
    expect(check?.body).toMatch(/tool, not a judge/);
  });
});

/* ===== the view ===== */

function inputFor(slug: string, mode: MindViewInput["mode"], over: Partial<MindViewInput> = {}): MindViewInput {
  return {
    mode,
    date: TODAY,
    startDate: addDays(TODAY, -60),
    wall: activeWall,
    assessments: FX.assessments
      .filter((a) => a.userSlug === slug)
      .map((a) => ({ date: a.date, instrument: a.instrument, answers: a.answers, score: a.score, band: a.band })),
    intentions: FX.intentions
      .filter((i) => i.userSlug === slug)
      .map((i) => ({ id: i.id, trigger: i.trigger, action: i.action, active: i.active, createdDate: i.createdDate, wins: i.wins })),
    reflections: FX.reflections
      .filter((r) => r.userSlug === slug)
      .map((r) => ({ date: r.date, prompt: r.prompt, response: r.response, win: r.win ?? null })),
    triggerMap: [
      { hour: 21, counts: { tired: 6, bored: 2 } },
      { hour: 22, counts: { tired: 4, bored: 1 } },
    ],
    streak: 9,
    adherence7: 86,
    missedYesterday: false,
    ...over,
  };
}

describe("buildMindView", () => {
  it("offers the full instrument set outside survival", () => {
    const view = buildMindView(inputFor("liam", "cut"));
    expect(view.survival).toBe(false);
    expect(view.instruments.map((i) => i.key)).toEqual(INSTRUMENTS.map((i) => i.key));
    expect(view.due.map((d) => d.key)).toContain("phq9");
    expect(view.due.map((d) => d.key)).toContain("gad7");
    // Taken inside cadence — not due.
    expect(view.due.map((d) => d.key)).not.toContain("who5");
    expect(view.due.map((d) => d.key)).not.toContain("pacs");
  });

  it("collapses survival to who5 + pacs — the floor offers no extra questionnaire", () => {
    const view = buildMindView(inputFor("artur", "survival"));
    expect(view.survival).toBe(true);
    expect(view.instruments.map((i) => i.key)).toEqual(["who5", "pacs"]);
    expect(view.due.map((d) => d.key).sort()).toEqual(["pacs", "who5"]);
    expect(view.suggestions).toEqual([]); // no new obligations on the floor
  });

  it("hides longer instruments from survival even when history exists for them", () => {
    const withPhq = inputFor("artur", "survival", {
      assessments: [
        ...inputFor("artur", "survival").assessments,
        { date: addDays(TODAY, -60), instrument: "phq9", answers: [1, 1, 1, 1, 1, 1, 1, 1, 0], score: 8, band: "mild" },
      ],
    });
    const view = buildMindView(withPhq);
    expect(view.history.map((h) => h.key)).not.toContain("phq9");
    expect(view.due.map((d) => d.key)).not.toContain("phq9");
  });

  it("flattens instrument definitions for the wire with no undefined fields", () => {
    for (const i of buildMindView(inputFor("liam", "cut")).instruments) {
      expect(Object.values(i).every((v) => v !== undefined)).toBe(true);
      expect(i.items).toHaveLength(inst(i.key).items.length);
      expect(i.maxScore).toBe(maxScoreOf(inst(i.key)));
      expect(i.safetyItemIndex === null || typeof i.safetyItemIndex === "number").toBe(true);
    }
  });

  it("builds a per-instrument history with band chips, points and correlational framing", () => {
    const view = buildMindView(inputFor("liam", "cut"));
    const phq9 = view.history.find((h) => h.key === "phq9");
    expect(phq9).toBeDefined();
    expect(phq9?.points).toHaveLength(2);
    expect(phq9?.points.map((p) => p.date)).toEqual([...(phq9?.points ?? [])].map((p) => p.date).sort());
    expect(phq9?.previous?.score).toBe(12);
    expect(phq9?.latest?.score).toBe(6);
    expect(phq9?.latest?.band).toBe("mild");
    expect(phq9?.trend.direction).toBe("down");
    expect(phq9?.trend.framing).toContain(TREND_FRAMING);
    // Never-taken instruments contribute no empty history rows.
    expect(view.history.map((h) => h.key)).not.toContain("isi");
  });

  it("shows the safety notice only while the latest PHQ-9 flags it, with real help", () => {
    const clean = buildMindView(inputFor("liam", "cut"));
    expect(clean.safetyNotice.active).toBe(false);
    expect(clean.safetyNotice.text).toBe(SAFETY_TEXT);

    const flagged = buildMindView(
      inputFor("liam", "cut", {
        assessments: [
          ...inputFor("liam", "cut").assessments,
          { date: addDays(TODAY, -2), instrument: "phq9", answers: [1, 1, 1, 1, 1, 1, 1, 1, 1], score: 9, band: "mild" },
        ],
      }),
    );
    expect(flagged.safetyNotice.active).toBe(true);
    expect(flagged.safetyNotice.text).toContain("999 or 112");
    expect(flagged.safetyNotice.text).toContain("116 123");
    expect(flagged.safetyNotice.text).toMatch(/support, not an assessment/);
    expect(flagged.safetyNotice.text).not.toMatch(/at risk|high risk|suicidal ideation/i);
  });

  it("clears the notice when a later PHQ-9 answers the item at zero", () => {
    const rows: RawAssessment[] = [
      { date: addDays(TODAY, -30), instrument: "phq9", answers: [1, 1, 1, 1, 1, 1, 1, 1, 2], score: 10, band: "moderate" },
      { date: addDays(TODAY, -2), instrument: "phq9", answers: [1, 1, 1, 1, 1, 1, 1, 1, 0], score: 8, band: "mild" },
    ];
    expect(safetyFlagged(rows)).toBe(false);
    expect(safetyFlagged([rows[0]])).toBe(true);
  });

  it("carries no quiet check while the person is logging", () => {
    expect(buildMindView(inputFor("liam", "cut")).quietCheck).toBeNull();
  });

  it("raises the quiet check after silent days — in survival too, because support is not an obligation the floor removes", () => {
    const quiet = buildMindView(inputFor("liam", "cut", { wall: silentWall }));
    expect(quiet.quietCheck?.days).toBe(13);
    expect(quiet.quietCheck?.support).toBe(SUPPORT_LINES);
    const floor = buildMindView(inputFor("artur", "survival", { wall: silentWall }));
    expect(floor.quietCheck?.days).toBe(13);
  });

  it("sorts intentions by wins and never suggests a plan already on the list", () => {
    const view = buildMindView(inputFor("liam", "cut"));
    expect(view.intentions.map((i) => i.wins)).toEqual([11, 4]);
    const taken = new Set(view.intentions.map((i) => i.action));
    for (const s of view.suggestions) expect(taken.has(s.action)).toBe(false);
    expect(view.suggestions.length).toBeGreaterThan(0);
  });

  it("returns reflections newest-first with a null-normalised win", () => {
    const view = buildMindView(inputFor("liam", "cut"));
    expect(view.reflections.map((r) => r.date)).toEqual(
      [...view.reflections].map((r) => r.date).sort().reverse(),
    );
    expect(view.reflections.some((r) => r.win === null)).toBe(true);
    expect(view.reflections.every((r) => r.win !== undefined)).toBe(true);
  });

  it("leads with encouragement and a prompt on every path, including empty state", () => {
    const empty = buildMindView(
      inputFor("liam", "cut", { assessments: [], intentions: [], reflections: [], triggerMap: [] }),
    );
    expect(empty.encouragement.headline.length).toBeGreaterThan(0);
    expect(WEEKLY_REVIEW_PROMPTS).toContain(empty.weeklyPrompt);
    expect(empty.history).toEqual([]);
    expect(empty.due.length).toBe(INSTRUMENTS.length);
  });
});

/* ===== fixtures ===== */

describe("mind fixtures", () => {
  it("stores a score that the scorer reproduces from the answers", () => {
    for (const row of FX.assessments) {
      const scored = scoreInstrument(inst(row.instrument), row.answers);
      expect(scored.score).toBe(row.score);
      expect(scored.band).toBe(row.band);
    }
  });

  it("never fabricates a safety flag", () => {
    for (const row of FX.assessments) {
      expect(scoreInstrument(inst(row.instrument), row.answers).safetyFlag).toBe(false);
    }
    expect(safetyFlagged(FX.assessments.filter((a) => a.userSlug === "liam"))).toBe(false);
  });

  it("gives Liam two takes each of four instruments, mildly improving", () => {
    const liam = FX.assessments.filter((a) => a.userSlug === "liam");
    const byKey = new Map<string, typeof liam>();
    for (const row of liam) byKey.set(row.instrument, [...(byKey.get(row.instrument) ?? []), row]);
    expect([...byKey.keys()].sort()).toEqual(["gad7", "pacs", "phq9", "who5"]);
    for (const [key, rows] of byKey) {
      expect(rows).toHaveLength(2);
      const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      // WHO-5 is higher-is-better; the other three are lower-is-better.
      if (key === "who5") expect(asc[1].score).toBeGreaterThan(asc[0].score);
      else expect(asc[1].score).toBeLessThan(asc[0].score);
    }
    // Six weeks of history, no take dated in the future.
    const dates = liam.map((r) => daysBetween(r.date, TODAY));
    expect(Math.max(...dates)).toBe(42);
    expect(Math.min(...dates)).toBeGreaterThan(0);
  });

  it("gives Artur the floor set only, plus one intention", () => {
    const artur = FX.assessments.filter((a) => a.userSlug === "artur");
    expect(artur.map((a) => a.instrument).sort()).toEqual(["pacs", "who5"]);
    expect(FX.intentions.filter((i) => i.userSlug === "artur")).toHaveLength(1);
    for (const a of artur) {
      expect(SURVIVAL_INSTRUMENT_KEYS).toContain(a.instrument as (typeof SURVIVAL_INSTRUMENT_KEYS)[number]);
    }
  });

  it("gives Liam two active intentions with wins and three reflections", () => {
    const liamIntentions = FX.intentions.filter((i) => i.userSlug === "liam");
    expect(liamIntentions).toHaveLength(2);
    expect(liamIntentions.every((i) => i.active && i.wins > 0)).toBe(true);
    expect(FX.reflections.filter((r) => r.userSlug === "liam")).toHaveLength(3);
  });

  it("is positioned relative to today, so the demo never goes stale", () => {
    const other = buildMindFixtures("2027-03-01");
    expect(other.assessments.map((a) => a.date)).not.toEqual(FX.assessments.map((a) => a.date));
    expect(other.assessments.map((a) => a.score)).toEqual(FX.assessments.map((a) => a.score));
  });
});

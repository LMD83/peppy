import { describe, expect, it } from "vitest";
import {
  EASY_MAX_CHECKS,
  TODAY_CARDS,
  easyCardOrder,
  easyChecks,
  isEasy,
  nextAction,
  plain,
  plainLanguage,
  profileOf,
  projectToday,
  type CheckRow,
  type TodayPayload,
} from "../convex/tm/logicEasy";
import { MODE_CHECKS, type TmMode } from "../convex/tm/lib";

/**
 * Easy mode's contract, asserted rather than described.
 *
 * The claim under test is the one the whole feature rests on: easy mode returns
 * FEWER OBJECTS, not smaller ones — and it composes with survival mode without
 * either one resurrecting what the other removed.
 */

const TODAY = "2026-08-13";

function checks(mode: TmMode, doneKeys: string[] = []): CheckRow[] {
  return MODE_CHECKS[mode].map((c) => ({ ...c, done: doneKeys.includes(c.key) }));
}

function payload(over: Partial<TodayPayload> = {}): TodayPayload {
  const mode: TmMode = over.user?.mode ?? "cut";
  return {
    user: {
      slug: "liam",
      name: "Liam",
      mode,
      protocolTitle: "Cut protocol 95→85",
      kitchenClose: "20:15",
      ceilingKg: 96,
      goalKg: 85,
      startKg: 95,
      reviewDate: null,
      modeSince: TODAY,
      ...over.user,
    },
    checks: over.checks ?? checks(mode),
    day: { weightKg: null, stress: null, energy: null, ritualDone: false, sessionDone: false, ...over.day },
    latestKg: over.latestKg ?? 92.8,
    deltaKg: over.deltaKg ?? -2.2,
    dayNumber: over.dayNumber ?? 43,
    cravingsToday: over.cravingsToday ?? [],
    stats: { adherence7: 86, streak: 9, todayDone: 3, todayTotal: 5, ...over.stats },
    session:
      over.session !== undefined
        ? over.session
        : {
            name: "Upper · pull",
            exercises: [{ name: "Barbell row", repRange: "8–12", lastKg: 70, flag: null }],
          },
    tripwire: over.tripwire ?? null,
  };
}

/* ===== the setting is read, never inferred ================================ */

describe("profile", () => {
  it("reads the stored choice and nothing else", () => {
    expect(isEasy({ a11yProfile: "easy" })).toBe(true);
    expect(isEasy({ a11yProfile: "standard" })).toBe(false);
    expect(isEasy({})).toBe(false);
    expect(isEasy(null)).toBe(false);
    expect(isEasy(undefined)).toBe(false);
    expect(profileOf({ a11yProfile: "easy" })).toBe("easy");
    expect(profileOf({})).toBe("standard");
  });

  it("defaults to standard, so easy mode is never switched on for someone", () => {
    // A brand-new user has no a11yProfile at all. If this ever flips, the app
    // has started deciding on someone's behalf — which it must not do.
    expect(profileOf({ a11yProfile: null })).toBe("standard");
    expect(projectToday(payload(), profileOf({})).a11y.profile).toBe("standard");
  });
});

/* ===== fewer objects ====================================================== */

describe("easyChecks", () => {
  it("returns at most three, and only the ones due now", () => {
    const rows = easyChecks(checks("cut", ["session"]));
    expect(rows).toHaveLength(EASY_MAX_CHECKS);
    expect(rows.every((c) => !c.done)).toBe(true);
    expect(rows.map((c) => c.key)).toEqual(["plan", "salt", "steps"]);
  });

  it("keeps the mode's own order — it re-ranks nothing", () => {
    const rows = easyChecks(checks("cut"));
    expect(rows.map((c) => c.key)).toEqual(["session", "plan", "salt"]);
  });

  it("hides nothing permanently: ticking one surfaces the next", () => {
    const before = easyChecks(checks("cut")).map((c) => c.key);
    const after = easyChecks(checks("cut", ["session"])).map((c) => c.key);
    expect(before).not.toContain("steps");
    expect(after).toContain("steps");
    // Every check in the mode is reachable three at a time, so easy mode can
    // never quietly cost someone the adherence the standard screen would give.
    const reachable = new Set<string>();
    const done: string[] = [];
    for (let i = 0; i < MODE_CHECKS.cut.length; i++) {
      const visible = easyChecks(checks("cut", done));
      visible.forEach((c) => reachable.add(c.key));
      done.push(visible[0].key);
    }
    expect([...reachable].sort()).toEqual(MODE_CHECKS.cut.map((c) => c.key).sort());
  });

  it("never returns an empty list — a finished day is still undoable", () => {
    const all = MODE_CHECKS.cut.map((c) => c.key);
    const rows = easyChecks(checks("cut", all));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows).toHaveLength(EASY_MAX_CHECKS);
    expect(rows.every((c) => c.done)).toBe(true);
  });

  it("is a no-op on a survival day — survival already stopped at three", () => {
    const rows = checks("survival");
    expect(easyChecks(rows)).toEqual(rows);
  });
});

/* ===== the card list ====================================================== */

describe("easyCardOrder", () => {
  it("leaves standard mode exactly as it shipped, in both modes", () => {
    expect(easyCardOrder("standard", "cut")).toEqual([...TODAY_CARDS]);
    expect(easyCardOrder("standard", "maintain")).toEqual([...TODAY_CARDS]);
    expect(easyCardOrder("standard", "survival")).toEqual([...TODAY_CARDS]);
  });

  it("only ever removes — easy is a subset of standard", () => {
    for (const mode of ["cut", "maintain", "survival"] as TmMode[]) {
      const easy = easyCardOrder("easy", mode);
      expect(easy.length).toBeLessThan(TODAY_CARDS.length);
      for (const id of easy) expect(TODAY_CARDS).toContain(id);
    }
  });

  it("composes with survival: survival removes more, and adds nothing back", () => {
    const easyCut = easyCardOrder("easy", "cut");
    const easySurvival = easyCardOrder("easy", "survival");
    for (const id of easySurvival) expect(easyCut).toContain(id);
    expect(easySurvival.length).toBeLessThan(easyCut.length);
    // The obligation survival drops is the weigh-in; the medicines stay.
    expect(easyCut).toContain("weigh");
    expect(easySurvival).not.toContain("weigh");
    expect(easySurvival).toContain("stack");
    expect(easySurvival).toContain("supply");
  });

  it("never drops the medicines or the run-out count", () => {
    for (const mode of ["cut", "maintain", "survival"] as TmMode[]) {
      expect(easyCardOrder("easy", mode)).toContain("stack");
      expect(easyCardOrder("easy", mode)).toContain("supply");
    }
  });
});

/* ===== plain language ===================================================== */

describe("plainLanguage", () => {
  it("keeps every sentence under fifteen words", () => {
    for (const [term, phrase] of Object.entries(plainLanguage)) {
      expect(phrase.split(/\s+/).length, `${term} → ${phrase}`).toBeLessThanOrEqual(15);
    }
  });

  it("translates the instrument-panel words the brief names", () => {
    expect(plain("Bloods")).toBe("Blood tests");
    expect(plain("Adherence")).toBe("How often you did it");
    expect(plain("Mesocycle")).toBe("Training block");
  });

  it("carries no jargon through to the plain side", () => {
    const jargon =
      /\b(mesocycle|adherence|tripwire|macros?|TDEE|RIR|reconstitution|protocol|instrument|marker|titrat)/i;
    for (const [term, phrase] of Object.entries(plainLanguage)) {
      expect(jargon.test(phrase), `${term} → ${phrase}`).toBe(false);
    }
  });

  it("never prescribes — no dose, amount or instruction to change anything", () => {
    const prescribing = /\b(take|stop|increase|decrease|adjust|should|must|prescrib)\b/i;
    for (const [term, phrase] of Object.entries(plainLanguage)) {
      expect(prescribing.test(phrase), `${term} → ${phrase}`).toBe(false);
    }
  });

  it("passes unknown terms straight through", () => {
    expect(plain("Squat")).toBe("Squat");
  });
});

/* ===== the one next action ================================================ */

describe("nextAction", () => {
  it("points at the first check that is not done", () => {
    const a = nextAction({ checks: checks("cut", ["session"]), weightLogged: false, mode: "cut" });
    expect(a.kind).toBe("check");
    expect(a.key).toBe("plan");
  });

  it("asks for the weigh-in only once the checks are clear", () => {
    const all = MODE_CHECKS.cut.map((c) => c.key);
    const a = nextAction({ checks: checks("cut", all), weightLogged: false, mode: "cut" });
    expect(a.kind).toBe("weigh");
  });

  it("adds no obligation in survival — never asks for the scales", () => {
    const all = MODE_CHECKS.survival.map((c) => c.key);
    const a = nextAction({ checks: checks("survival", all), weightLogged: false, mode: "survival" });
    expect(a.kind).toBe("rest");
    expect(a.label).toMatch(/done for today/i);
  });

  it("always answers — there is no blank screen", () => {
    for (const mode of ["cut", "maintain", "survival"] as TmMode[]) {
      for (const done of [[], MODE_CHECKS[mode].map((c) => c.key)]) {
        for (const weightLogged of [true, false]) {
          const a = nextAction({ checks: checks(mode, done), weightLogged, mode });
          expect(a.label.length).toBeGreaterThan(0);
          expect(a.label.split(/\s+/).length).toBeLessThanOrEqual(15);
        }
      }
    }
  });
});

/* ===== the projection ===================================================== */

describe("projectToday", () => {
  it("leaves the standard payload untouched apart from the two new keys", () => {
    const p = payload();
    const projected = projectToday(p, "standard");
    const { a11y, nextAction: next, ...rest } = projected;
    expect(rest).toEqual(p);
    expect(a11y.profile).toBe("standard");
    expect(next.kind).toBe("check");
  });

  it("easy mode returns fewer objects", () => {
    const p = payload();
    const easy = projectToday(p, "easy");
    expect(easy.checks.length).toBeLessThan(p.checks.length);
    expect(easy.checks).toHaveLength(EASY_MAX_CHECKS);
    expect(easy.session).toBeNull();
    expect(easy.a11y.cards.length).toBeLessThan(TODAY_CARDS.length);
  });

  it("easy mode does not return smaller ones: the arithmetic is identical", () => {
    const p = payload();
    const easy = projectToday(p, "easy");
    // stats drives the scoreboard, adherence and the streak. Hiding three
    // checks must not quietly rewrite what the day was worth.
    expect(easy.stats).toEqual(p.stats);
    expect(easy.latestKg).toBe(p.latestKg);
    expect(easy.deltaKg).toBe(p.deltaKg);
    expect(easy.dayNumber).toBe(p.dayNumber);
    expect(easy.day).toEqual(p.day);
    expect(easy.user).toEqual(p.user);
  });

  it("replaces the tripwire paragraph with one short sentence, same number", () => {
    const p = payload({
      user: { ...payload().user, mode: "maintain", goalKg: 85 },
      latestKg: 88.6,
      tripwire: {
        level: "hard",
        message:
          "Hard tripwire: 3.6 kg over goal. Survival mode is the pre-written response — ceiling re-anchors to goal +4 kg. Executing it is a decision. Zero guilt clause applies.",
      },
    });
    const easy = projectToday(p, "easy");
    expect(easy.tripwire?.level).toBe("hard");
    expect(easy.tripwire?.message).toContain("3.6 kg");
    expect(easy.tripwire?.message.length).toBeLessThan(p.tripwire!.message.length / 2);
    expect(easy.tripwire?.message).not.toMatch(/tripwire|re-anchor|clause|sub-routine/i);
    for (const sentence of easy.tripwire!.message.split(". ")) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(15);
    }
    expect(projectToday({ ...p, tripwire: null }, "easy").tripwire).toBeNull();
  });

  it("survival wins where they disagree, and easy resurrects nothing", () => {
    const survivalPayload = payload({
      user: { ...payload().user, mode: "survival" },
      checks: checks("survival"),
      session: null,
      tripwire: null,
    });
    const easy = projectToday(survivalPayload, "easy");
    const standard = projectToday(survivalPayload, "standard");
    // Survival's three checks survive intact; easy cannot add a fourth.
    expect(easy.checks).toHaveLength(3);
    expect(easy.session).toBeNull();
    expect(standard.session).toBeNull();
    // And easy's card list is a subset of what standard-survival would render.
    for (const id of easy.a11y.cards) expect(standard.a11y.cards).toContain(id);
    // Neither profile puts the session block back on a survival day.
    expect(easy.a11y.cards).not.toContain("train");
  });

  it("is idempotent — projecting a projection changes nothing", () => {
    const once = projectToday(payload(), "easy");
    const twice = projectToday(once, "easy");
    expect(twice.checks).toEqual(once.checks);
    expect(twice.a11y).toEqual(once.a11y);
    expect(twice.nextAction).toEqual(once.nextAction);
  });

  it("points the next action at the real day, not the projected three", () => {
    const done = ["session", "plan", "salt"];
    const p = payload({ checks: checks("cut", done) });
    const easy = projectToday(p, "easy");
    // "steps" is check four of five — invisible in the standard easy window,
    // but it is still what comes next, so the sentence has to name it.
    expect(easy.nextAction.key).toBe("steps");
  });
});

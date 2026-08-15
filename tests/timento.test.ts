import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

// Module map for convex-test (avoids import.meta.glob so repo-wide tsc stays clean).
const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api"),
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./tm/auth.ts": () => import("../convex/tm/auth"),
  "./tm/crew.ts": () => import("../convex/tm/crew"),
  "./tm/fixtures.ts": () => import("../convex/tm/fixtures"),
  "./tm/db.ts": () => import("../convex/tm/db"),
  "./tm/lib.ts": () => import("../convex/tm/lib"),
  "./tm/logic.ts": () => import("../convex/tm/logic"),
  "./tm/progress.ts": () => import("../convex/tm/progress"),
  "./tm/research.ts": () => import("../convex/tm/research"),
  "./tm/seed.ts": () => import("../convex/tm/seed"),
  "./tm/today.ts": () => import("../convex/tm/today"),
};

// A Thursday — pull day in the session plan.
const TODAY = "2026-08-13";

type TestHarness = ReturnType<typeof convexTest>;

async function loginOk(t: TestHarness, slug: string, passcode: string): Promise<string> {
  const res = await t.mutation(api.tm.auth.login, { slug, passcode });
  if (!res.ok) throw new Error(`login failed: ${res.code}`);
  return res.token;
}

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.tm.seed.run, { today: TODAY });
  const liam = await loginOk(t, "liam", "2580");
  const conor = await loginOk(t, "conor", "1379");
  return { t, liam, conor };
}

describe("auth", () => {
  it("logs in with the right passcode and rejects the wrong one", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.tm.seed.run, { today: TODAY });
    const res = await t.mutation(api.tm.auth.login, { slug: "liam", passcode: "2580" });
    expect(res.ok && res.name).toBe("Liam");
    expect(res.ok && res.token).toHaveLength(64);
    const bad = await t.mutation(api.tm.auth.login, { slug: "liam", passcode: "0000" });
    expect(bad).toEqual({ ok: false, code: "wrong-passcode" });
    await expect(t.query(api.tm.today.get, { token: "forged", date: TODAY })).rejects.toThrow(
      /not-signed-in/,
    );
  });

  it("locks a user out after five failed attempts", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.tm.seed.run, { today: TODAY });
    for (let i = 0; i < 5; i++) {
      const bad = await t.mutation(api.tm.auth.login, { slug: "liam", passcode: "0000" });
      expect(bad).toEqual({ ok: false, code: "wrong-passcode" });
    }
    // Even the RIGHT passcode is refused during the lockout window.
    const locked = await t.mutation(api.tm.auth.login, { slug: "liam", passcode: "2580" });
    expect(locked).toEqual({ ok: false, code: "too-many-attempts" });
  });

  it("seed accepts passcode overrides so demo passcodes never reach production", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.tm.seed.run, { today: TODAY, passcodes: { liam: "907341" } });
    const demoPass = await t.mutation(api.tm.auth.login, { slug: "liam", passcode: "2580" });
    expect(demoPass).toEqual({ ok: false, code: "wrong-passcode" });
    const res = await t.mutation(api.tm.auth.login, { slug: "liam", passcode: "907341" });
    expect(res.ok && res.name).toBe("Liam");
  });

  it("logout invalidates the token", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.auth.logout, { token: liam });
    await expect(t.query(api.tm.today.get, { token: liam, date: TODAY })).rejects.toThrow(
      /not-signed-in/,
    );
  });
});

describe("privacy split (query level)", () => {
  it("crew board exposes only the shared projection — no weights, BP or labs", async () => {
    const { t, conor } = await seeded();
    const board = await t.query(api.tm.crew.board, { token: conor, date: TODAY });
    expect(board).toHaveLength(2);
    // The board is an allow-list: a field only appears because a granted scope
    // named it. `link` carries the consent state, `supplyState` is the coarse
    // flag the "supply" scope permits — never a medicine, dose or count.
    const allowed = [
      "slug",
      "name",
      "isYou",
      "mode",
      "modeSince",
      "reviewDate",
      "daysInMode",
      "streak",
      "adherence7",
      "todayDone",
      "todayTotal",
      "link",
      "supplyState",
    ].sort();
    for (const member of board) {
      // Subset, not equality: a member with narrower scopes legitimately carries
      // fewer fields, and that direction is never a leak.
      const keys = Object.keys(member).sort();
      expect(allowed).toEqual(expect.arrayContaining(keys));
      if ("supplyState" in member) {
        expect(["ok", "order-due", null]).toContain(
          (member as { supplyState: string | null }).supplyState,
        );
      }
    }
    const serialized = JSON.stringify(board);
    expect(serialized).not.toMatch(/92\.8|weight|kg|ldl|lab/i);
    // Nothing from the stack may cross, by name or by number.
    expect(serialized).not.toMatch(/metformin|creatine|bpc|vitamin|mg\b|tablet/i);
  });

  it("partner session cannot read the owner's raw logs in either direction", async () => {
    const { t, liam, conor } = await seeded();
    // Conor's session: every owner-scoped query resolves to CONOR's rows only.
    const conorResearch = await t.query(api.tm.research.get, { token: conor, date: TODAY });
    expect(conorResearch.labs).toHaveLength(0); // Liam has labs; Conor sees none of them.
    expect(conorResearch.markers).toHaveLength(0);
    const conorProgress = await t.query(api.tm.progress.get, { token: conor, date: TODAY });
    expect(conorProgress.series.map((s) => s.actual)).not.toContain(92.8); // Liam's weight

    // And the reverse: Liam cannot see Conor's weigh-ins.
    const liamProgress = await t.query(api.tm.progress.get, { token: liam, date: TODAY });
    expect(liamProgress.series.map((s) => s.actual)).not.toContain(94.8); // Conor's weight
    // There is no API surface that accepts another user's id — privacy by construction.
  });
});

describe("today + checks engine", () => {
  it("materializes mode-aware checks and toggles them", async () => {
    const { t, liam, conor } = await seeded();
    const liamToday = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(liamToday.checks).toHaveLength(5);
    expect(liamToday.stats.todayDone).toBe(3);
    const conorToday = await t.query(api.tm.today.get, { token: conor, date: TODAY });
    expect(conorToday.checks).toHaveLength(3);
    expect(conorToday.stats.todayDone).toBe(3);

    await t.mutation(api.tm.today.toggleCheck, { token: liam, date: TODAY, key: "steps" });
    const after = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(after.stats.todayDone).toBe(4);
    await t.mutation(api.tm.today.toggleCheck, { token: liam, date: TODAY, key: "steps" });
    const reverted = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(reverted.stats.todayDone).toBe(3);
    await expect(
      t.mutation(api.tm.today.toggleCheck, { token: liam, date: TODAY, key: "nope" }),
    ).rejects.toThrow(/Unknown check/);
  });

  it("computes streak and adherence from the wall", async () => {
    const { t, liam } = await seeded();
    const today = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(today.stats.streak).toBe(9);
    expect(today.stats.adherence7).toBeGreaterThan(80);
    expect(today.dayNumber).toBe(43);
  });

  it("flags progressive overload after two sessions at ≥12 reps and same load", async () => {
    const { t, liam } = await seeded();
    const today = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(today.session?.name).toBe("Upper · pull");
    const row = today.session?.exercises.find((e) => e.name === "Barbell row");
    expect(row?.flag).toBe("+2.5 kg → 72.5");
    const curl = today.session?.exercises.find((e) => e.name === "Curl");
    expect(curl?.flag).toBeNull(); // only one session at 12 reps so far
  });
});

describe("mode engine", () => {
  it("survival mode: three checks, ceiling re-anchored, logged as an executed decision", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.today.setMode, {
      token: liam,
      date: TODAY,
      mode: "survival",
      reason: "Newborn week",
      reviewDate: "2026-11-01",
    });
    const today = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(today.user.mode).toBe("survival");
    expect(today.checks).toHaveLength(3);
    expect(today.user.ceilingKg).toBe(96); // configured ceiling survives by default
    expect(today.user.reviewDate).toBe("2026-11-01");
    const feed = await t.query(api.tm.crew.feed, { token: liam });
    const last = feed[feed.length - 1];
    expect(last.message).toMatch(/Executed as designed/);
    expect(last.message).not.toMatch(/fail/i);
  });

  it("explicit re-anchor applies for the survival stay only — ceiling restores on exit", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.today.setMode, {
      token: liam,
      date: TODAY,
      mode: "survival",
      ceilingKg: 89, // hard-tripwire path: goal 85 + 4
    });
    const during = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(during.user.ceilingKg).toBe(89);
    await t.mutation(api.tm.today.setMode, { token: liam, date: TODAY, mode: "cut" });
    const after = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(after.user.ceilingKg).toBe(96); // round trip never destroys the configured ceiling
  });

  it("logState persists only the scalar that was tapped", async () => {
    const { t, conor } = await seeded();
    await t.mutation(api.tm.today.logState, { token: conor, date: TODAY, stress: 4 });
    const today = await t.query(api.tm.today.get, { token: conor, date: TODAY });
    expect(today.day.stress).toBe(4);
    expect(today.day.energy).toBeNull(); // never fabricated
  });

  it("maintain tripwires: soft at goal +2, hard at goal +3.5", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.today.setMode, { token: liam, date: TODAY, mode: "maintain" });
    await t.mutation(api.tm.today.logWeight, { token: liam, date: TODAY, weightKg: 87.2 });
    const soft = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(soft.tripwire?.level).toBe("soft");
    expect(soft.tripwire?.message).toMatch(/mini-cut/);
    await t.mutation(api.tm.today.logWeight, { token: liam, date: TODAY, weightKg: 88.7 });
    const hard = await t.query(api.tm.today.get, { token: liam, date: TODAY });
    expect(hard.tripwire?.level).toBe("hard");
    expect(hard.tripwire?.message).not.toMatch(/fail(ed|ure)/i);
  });
});

describe("research engine", () => {
  it("builds the trigger map and reads out a depletion-dominant engine", async () => {
    const { t, liam } = await seeded();
    const research = await t.query(api.tm.research.get, { token: liam, date: TODAY });
    expect(research.engine).toBe("depletion");
    expect(research.peak?.fromHour).toBe(21);
    expect(research.peak?.signal).toBe("tired");
    expect(research.totalCravings).toBeGreaterThan(14);
    expect(research.experiments.map((e) => e.code)).toEqual(["E1", "E2", "E3", "E4"]);
    const disputed = research.markers.filter((m) => m.status === "disputed");
    expect(disputed.map((m) => m.gene)).toContain("MTHFR C677T");
    const ldl = research.labs.find((l) => l.marker === "LDL-C");
    expect(ldl?.recheckInDays).toBe(41);
  });

  it("logCraving feeds the map", async () => {
    const { t, conor } = await seeded();
    await t.mutation(api.tm.today.logCraving, {
      token: conor,
      date: TODAY,
      time: "21:12",
      signal: "tired",
      afterState: "relief",
      action: "rode",
    });
    const research = await t.query(api.tm.research.get, { token: conor, date: TODAY });
    expect(research.totalCravings).toBe(1);
    expect(research.engine).toBe("insufficient"); // needs ≥6 logs for a read-out
  });
});

describe("progress", () => {
  it("returns actual vs 0.5 kg/wk target series with the survival ceiling", async () => {
    const { t, liam } = await seeded();
    const progress = await t.query(api.tm.progress.get, { token: liam, date: TODAY });
    expect(progress.series.length).toBeGreaterThanOrEqual(6);
    expect(progress.series[0].actual).toBe(95);
    expect(progress.series[0].target).toBe(95);
    const last = progress.series[progress.series.length - 1];
    expect(last.actual).toBe(92.8);
    expect(progress.ceilingKg).toBe(96);
    expect(progress.deltaKg).toBe(-2.2);
    expect(progress.wall).toHaveLength(14);
  });

  it("seed is idempotent", async () => {
    const { t } = await seeded();
    await t.mutation(internal.tm.seed.run, { today: TODAY });
    const roster = await t.query(api.tm.auth.roster, {});
    expect(roster).toHaveLength(2);
  });
});

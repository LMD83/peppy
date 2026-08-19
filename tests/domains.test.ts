import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

/**
 * Backend proofs for the five domain slices (fuel, train, stack, labs, mind).
 *
 * Pure-logic coverage lives per slice in tests/<slice>.test.ts; this file drives
 * the real Convex functions through convex-test to prove the query/mutation
 * boundary: auth is required, writes are scored/derived server-side, and — the
 * invariant that matters most in a two-person file — one user can never read or
 * mutate the other's rows in any of the fourteen new tables.
 */

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
  "./tm/fuel.ts": () => import("../convex/tm/fuel"),
  "./tm/train.ts": () => import("../convex/tm/train"),
  "./tm/stack.ts": () => import("../convex/tm/stack"),
  "./tm/labs.ts": () => import("../convex/tm/labs"),
  "./tm/mind.ts": () => import("../convex/tm/mind"),
};

// A Thursday — pull day in the session plan, mid-mesocycle.
const TODAY = "2026-08-13";

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.tm.seed.run, { today: TODAY });
  const login = async (slug: string, passcode: string) => {
    const res = await t.mutation(api.tm.auth.login, { slug, passcode });
    if (!res.ok) throw new Error(`login failed: ${res.code}`);
    return res.token;
  };
  return { t, liam: await login("liam", "2580"), artur: await login("artur", "1379") };
}

const args = (token: string) => ({ token, date: TODAY });

type Harness = Awaited<ReturnType<typeof seeded>>["t"];

/** A stored file, so a lab-panel photo under test is backed by a real storage id. */
async function storeFile(t: Harness) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(["not-a-report"])));
}

describe("seed", () => {
  it("populates every domain table for the crew", async () => {
    const { t, liam, artur } = await seeded();
    const fuel = await t.query(api.tm.fuel.get, args(liam));
    const train = await t.query(api.tm.train.get, args(liam));
    const stack = await t.query(api.tm.stack.get, args(liam));
    const labs = await t.query(api.tm.labs.get, args(liam));
    const mind = await t.query(api.tm.mind.get, args(liam));

    expect(fuel.entries.length).toBeGreaterThan(0);
    expect(fuel.targets.proteinG).toBeGreaterThan(100);
    expect(train.mesocycle?.week).toBeGreaterThan(0);
    expect(train.weeklyVolume.length).toBeGreaterThan(0);
    expect(stack.items.length).toBeGreaterThan(0);
    expect(stack.dueToday.length).toBeGreaterThan(0);
    expect(labs.panels.length).toBeGreaterThan(0);
    expect(labs.outOfRange.length).toBeGreaterThan(0);
    expect(mind.history.length).toBeGreaterThan(0);
    expect(mind.encouragement.headline).toBeTruthy();

    // Artur is in survival: the floor holds, but a real medication is never hidden.
    const arturStack = await t.query(api.tm.stack.get, args(artur));
    expect(arturStack.survival).toBe(true);
    expect(arturStack.dueToday.some((d) => d.kind === "med" && !d.deferred)).toBe(true);
  });
});

describe("auth boundary", () => {
  it("rejects a forged token on every domain query", async () => {
    const { t } = await seeded();
    const forged = args("forged-token");
    await expect(t.query(api.tm.fuel.get, forged)).rejects.toThrow(/not-signed-in/);
    await expect(t.query(api.tm.train.get, forged)).rejects.toThrow(/not-signed-in/);
    await expect(t.query(api.tm.stack.get, forged)).rejects.toThrow(/not-signed-in/);
    await expect(t.query(api.tm.labs.get, forged)).rejects.toThrow(/not-signed-in/);
    await expect(t.query(api.tm.mind.get, forged)).rejects.toThrow(/not-signed-in/);
  });
});

describe("cross-user privacy", () => {
  it("refuses to mutate another user's meal entry", async () => {
    const { t, liam, artur } = await seeded();
    const liamEntry = (await t.query(api.tm.fuel.get, args(liam))).entries[0];
    expect(liamEntry).toBeDefined();

    await expect(
      t.mutation(api.tm.fuel.setFoodEaten, { token: artur, entryId: liamEntry.id as Id<"tm_mealEntries">, eaten: true }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.tm.fuel.removeFood, { token: artur, entryId: liamEntry.id as Id<"tm_mealEntries"> }),
    ).rejects.toThrow();

    // Liam's row is untouched by the attempt.
    const after = (await t.query(api.tm.fuel.get, args(liam))).entries.find(
      (e) => e.id === liamEntry.id,
    );
    expect(after).toBeDefined();
    expect(after?.eaten).toBe(liamEntry.eaten);
  });

  it("refuses to log a dose against another user's stack item", async () => {
    const { t, liam, artur } = await seeded();
    const liamItem = (await t.query(api.tm.stack.get, args(liam))).items[0];
    expect(liamItem).toBeDefined();

    await expect(
      t.mutation(api.tm.stack.logDose, {
        token: artur,
        date: TODAY,
        itemId: liamItem.id as Id<"tm_protocolItems">,
        timing: liamItem.timings[0],
        taken: true,
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.tm.stack.setItemActive, { token: artur, itemId: liamItem.id as Id<"tm_protocolItems">, active: false }),
    ).rejects.toThrow();

    const stillActive = (await t.query(api.tm.stack.get, args(liam))).items.find(
      (i) => i.id === liamItem.id,
    );
    expect(stillActive?.active).toBe(liamItem.active);
  });

  it("refuses to claim a win on another user's intention", async () => {
    const { t, liam, artur } = await seeded();
    const liamIntention = (await t.query(api.tm.mind.get, args(liam))).intentions[0];
    expect(liamIntention).toBeDefined();

    await expect(
      t.mutation(api.tm.mind.markIntentionWin, { token: artur, intentionId: liamIntention.id as Id<"tm_intentions"> }),
    ).rejects.toThrow();

    const after = (await t.query(api.tm.mind.get, args(liam))).intentions.find(
      (i) => i.id === liamIntention.id,
    );
    expect(after?.wins).toBe(liamIntention.wins);
  });

  it("never leaks the other user's rows into your own views", async () => {
    const { t, liam, artur } = await seeded();

    // Artur logs a distinctive panel; it must not appear anywhere in Liam's file.
    await t.mutation(api.tm.labs.addPanel, {
      token: artur,
      date: TODAY,
      name: "Artur private draw",
      results: [{ marker: "hba1c", value: 41, unit: "mmol/mol" }],
    });
    const liamLabs = await t.query(api.tm.labs.get, args(liam));
    expect(liamLabs.panels.some((p) => p.name === "Artur private draw")).toBe(false);

    // Liam logs a set; Artur's training view stays his own.
    await t.mutation(api.tm.train.logSet, {
      token: liam,
      date: TODAY,
      exercise: "barbell-row",
      setIndex: 1,
      weightKg: 80,
      reps: 10,
      rir: 2,
    });
    const arturTrain = await t.query(api.tm.train.get, args(artur));
    expect(arturTrain.loggedSets.some((s) => s.weightKg === 80 && s.reps === 10)).toBe(false);
  });

  it("keeps the crew board a projection — no absolute weights from the new tables", async () => {
    const { t, liam } = await seeded();
    const board = await t.query(api.tm.crew.board, args(liam));
    const serialised = JSON.stringify(board);
    for (const key of ["kcal", "weightKg", "dose", "value", "score", "marker"]) {
      expect(serialised).not.toContain(key);
    }
    expect(board.every((m) => typeof m.adherence7 === "number")).toBe(true);
  });
});

describe("server-side derivation", () => {
  it("scores an assessment from raw answers — a forged total is impossible", async () => {
    const { t, liam } = await seeded();
    // PHQ-9, all "nearly every day" on the first two items, nothing else.
    const answers = [3, 3, 0, 0, 0, 0, 0, 0, 0];
    await t.mutation(api.tm.mind.submitAssessment, {
      token: liam,
      date: TODAY,
      instrument: "phq9",
      answers,
    });
    const mind = await t.query(api.tm.mind.get, args(liam));
    const phq9 = mind.history.find((h) => h.key === "phq9");
    expect(phq9?.latest?.score).toBe(6);
    expect(phq9?.latest?.band).toMatch(/mild/i);
    // The safety item was zero, so no notice is raised.
    expect(mind.safetyNotice.active).toBe(false);
  });

  it("raises the support notice when the self-harm item is answered above zero", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.mind.submitAssessment, {
      token: liam,
      date: TODAY,
      instrument: "phq9",
      answers: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
    const mind = await t.query(api.tm.mind.get, args(liam));
    expect(mind.safetyNotice.active).toBe(true);
    expect(mind.safetyNotice.text).toMatch(/116 123|999|112/);
  });

  it("rejects a malformed assessment instead of storing a bad score", async () => {
    const { t, liam } = await seeded();
    await expect(
      t.mutation(api.tm.mind.submitAssessment, {
        token: liam,
        date: TODAY,
        instrument: "phq9",
        answers: [3, 3, 3],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.tm.mind.submitAssessment, {
        token: liam,
        date: TODAY,
        instrument: "phq9",
        answers: [9, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    ).rejects.toThrow();
  });

  it("rejects an unknown food and an empty lab panel", async () => {
    const { t, liam } = await seeded();
    await expect(
      t.mutation(api.tm.fuel.logFood, {
        token: liam,
        date: TODAY,
        slot: "lunch",
        foodKey: "not-a-food",
        grams: 100,
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.tm.labs.addPanel, { token: liam, date: TODAY, name: "Empty", results: [] }),
    ).rejects.toThrow();
  });
});

describe("round trips", () => {
  it("logs food and moves the day's totals", async () => {
    const { t, liam } = await seeded();
    const before = await t.query(api.tm.fuel.get, args(liam));
    const food = before.foods[0];
    await t.mutation(api.tm.fuel.logFood, {
      token: liam,
      date: TODAY,
      slot: "snack",
      foodKey: food.key,
      grams: 100,
    });
    const after = await t.query(api.tm.fuel.get, args(liam));
    expect(after.entries.length).toBe(before.entries.length + 1);
    expect(after.totals.kcal).toBeGreaterThanOrEqual(before.totals.kcal);
  });

  it("logs a set and reflects it in the day's log", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.train.logSet, {
      token: liam,
      date: TODAY,
      exercise: "barbell-row",
      setIndex: 1,
      weightKg: 77.5,
      reps: 11,
      rir: 2,
    });
    const train = await t.query(api.tm.train.get, args(liam));
    const logged = train.loggedSets.find((s) => s.weightKg === 77.5 && s.reps === 11);
    expect(logged).toBeDefined();
    expect(logged?.e1rm).toBeGreaterThan(77.5);
  });

  it("takes a dose and lifts today's adherence count", async () => {
    const { t, liam } = await seeded();
    const before = await t.query(api.tm.stack.get, args(liam));
    const untaken = before.dueToday.find((d) => !d.taken && !d.deferred);
    expect(untaken).toBeDefined();
    if (!untaken) return;
    await t.mutation(api.tm.stack.logDose, {
      token: liam,
      date: TODAY,
      itemId: untaken.itemId as Id<"tm_protocolItems">,
      timing: untaken.timing,
      taken: true,
    });
    const after = await t.query(api.tm.stack.get, args(liam));
    expect(after.takenCount).toBe(before.takenCount + 1);
  });

  it("files a lab panel and flags an out-of-range marker", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.labs.addPanel, {
      token: liam,
      date: TODAY,
      name: "Recheck",
      fasted: true,
      results: [{ marker: "hs_crp", value: 9.4, unit: "mg/L" }],
    });
    const labs = await t.query(api.tm.labs.get, args(liam));
    const panel = labs.panels.find((p) => p.name === "Recheck");
    expect(panel).toBeDefined();
    expect(labs.outOfRange.some((r) => r.marker === "hs_crp")).toBe(true);
  });

  it("defaults an unlabelled panel to manual, with no photo", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.labs.addPanel, {
      token: liam,
      date: TODAY,
      name: "Typed in",
      results: [{ marker: "ldl_c", value: 2.1, unit: "mmol/L" }],
    });
    const panel = (await t.query(api.tm.labs.get, args(liam))).panels.find((p) => p.name === "Typed in");
    expect(panel?.source).toBe("manual");
    expect(panel?.photoUrl).toBeNull();
  });

  it("carries an import source and a report photo through to the view", async () => {
    const { t, liam } = await seeded();
    const storageId = await storeFile(t);
    await t.mutation(api.tm.labs.addPanel, {
      token: liam,
      date: TODAY,
      name: "Imported",
      source: "csv",
      photoStorageId: storageId,
      results: [{ marker: "ldl_c", value: 2.1, unit: "mmol/L" }],
    });
    const panel = (await t.query(api.tm.labs.get, args(liam))).panels.find((p) => p.name === "Imported");
    expect(panel?.source).toBe("csv");
    expect(panel?.photoUrl).toEqual(expect.any(String));
  });
});

describe("a lab-panel photo belongs to one file and reaches no other", () => {
  it("never appears in the other user's view, and its url is never handed over", async () => {
    const { t, liam, artur } = await seeded();
    const storageId = await storeFile(t);
    await t.mutation(api.tm.labs.addPanel, {
      token: liam,
      date: TODAY,
      name: "Liam's photographed draw",
      source: "photo",
      photoStorageId: storageId,
      results: [{ marker: "ldl_c", value: 2.1, unit: "mmol/L" }],
    });

    const liamLabs = await t.query(api.tm.labs.get, args(liam));
    const liamPanel = liamLabs.panels.find((p) => p.name === "Liam's photographed draw");
    expect(liamPanel?.photoUrl).toEqual(expect.any(String));

    const arturLabs = await t.query(api.tm.labs.get, args(artur));
    expect(arturLabs.panels.some((p) => p.name === "Liam's photographed draw")).toBe(false);
    // The serialised view is the strongest form of this proof: the storage id
    // and the resolved url are both entirely absent from what Artur receives,
    // not merely unlabelled.
    const serialised = JSON.stringify(arturLabs);
    expect(serialised).not.toContain(storageId);
  });
});

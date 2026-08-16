import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

/**
 * Backend proofs for reminders and visual check-ins.
 *
 * The rules themselves are proved pure in tests/remind.test.ts and
 * tests/capture.test.ts. This file drives the real Convex functions to prove the
 * two things only the boundary can prove.
 *
 * **Photos are the most sensitive rows in the file.** A capture can hold a name,
 * an address, a dosette box, someone else's medicine. There is no crew scope for
 * them and there never will be, so the proof that matters is that the other user
 * cannot read one, cannot delete one, and cannot get a url for one — whatever
 * they send.
 *
 * **A push subscription is a capability to interrupt somebody.** Its endpoint and
 * keys are the whole of that capability, so they must never leave the server,
 * and an endpoint already on one person's file must not be claimable by another.
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
  "./tm/remind.ts": () => import("../convex/tm/remind"),
  "./tm/logicEmail.ts": () => import("../convex/tm/logicEmail"),
  // Read alongside remind.get to prove the confirm list is drawn from the
  // owner's own stack and nothing else.
  "./tm/stack.ts": () => import("../convex/tm/stack"),
};

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

type Harness = Awaited<ReturnType<typeof seeded>>["t"];

/** A stored file, so a capture under test is backed by a real storage id. */
async function storeFile(t: Harness) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(["not-an-image"])));
}

describe("auth boundary", () => {
  it("gives a forged token nothing — not a view, not an upload url, not a write", async () => {
    const { t } = await seeded();
    const storageId = await storeFile(t);
    await expect(t.query(api.tm.remind.get, { token: "forged", date: TODAY })).rejects.toThrow(
      /not-signed-in/,
    );
    await expect(t.mutation(api.tm.remind.generateUploadUrl, { token: "forged" })).rejects.toThrow(
      /not-signed-in/,
    );
    await expect(
      t.mutation(api.tm.remind.saveCapture, {
        token: "forged",
        date: TODAY,
        kind: "organiser",
        storageId,
      }),
    ).rejects.toThrow(/not-signed-in/);
    await expect(
      t.mutation(api.tm.remind.setPrefs, { token: "forged", enabled: true }),
    ).rejects.toThrow(/not-signed-in/);
  });
});

describe("a photo belongs to one file and reaches no other", () => {
  it("never appears in the other user's view, and its url is never handed over", async () => {
    const { t, liam, artur } = await seeded();
    const storageId = await storeFile(t);
    await t.mutation(api.tm.remind.saveCapture, {
      token: liam,
      date: TODAY,
      kind: "organiser",
      storageId,
      note: "You confirmed: Morning",
    });

    const mine = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(mine.capture.today).toHaveLength(1);
    expect(mine.capture.today[0]?.url).toBeTruthy();

    const theirs = await t.query(api.tm.remind.get, { token: artur, date: TODAY });
    expect(theirs.capture.today).toEqual([]);
    expect(theirs.capture.days).toEqual([]);
    // Belt and braces: the whole of the other user's payload, searched for the
    // note and for any url at all. A leak through a field nobody thought about
    // is still a leak.
    const serialised = JSON.stringify(theirs);
    expect(serialised).not.toContain("You confirmed: Morning");
    expect(serialised).not.toContain(storageId);
  });

  it("refuses to delete another user's photo, and the photo survives the attempt", async () => {
    const { t, liam, artur } = await seeded();
    const storageId = await storeFile(t);
    await t.mutation(api.tm.remind.saveCapture, {
      token: liam,
      date: TODAY,
      kind: "dose",
      storageId,
    });
    const captureId = await t.run(async (ctx) => {
      const rows = await ctx.db.query("tm_captures").take(2);
      return rows[0]!._id;
    });

    await expect(
      t.mutation(api.tm.remind.removeCapture, { token: artur, captureId }),
    ).rejects.toThrow(/not-your-capture/);

    const mine = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(mine.capture.today).toHaveLength(1);
  });

  it("takes the file with the row when the owner deletes it", async () => {
    const { t, liam } = await seeded();
    const storageId = await storeFile(t);
    await t.mutation(api.tm.remind.saveCapture, {
      token: liam,
      date: TODAY,
      kind: "meal",
      storageId,
    });
    const captureId = await t.run(async (ctx) => {
      const rows = await ctx.db.query("tm_captures").take(2);
      return rows[0]!._id;
    });

    await t.mutation(api.tm.remind.removeCapture, { token: liam, captureId });

    const after = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(after.capture.today).toEqual([]);
    // A deleted photo that survives in storage is not deleted, whatever the
    // list says.
    const stillThere = await t.run(async (ctx) => await ctx.storage.getUrl(storageId));
    expect(stillThere).toBeNull();
  });

  it("stops at the day's ceiling rather than becoming a camera roll", async () => {
    const { t, liam } = await seeded();
    for (let i = 0; i < 12; i++) {
      await t.mutation(api.tm.remind.saveCapture, {
        token: liam,
        date: TODAY,
        kind: "organiser",
        storageId: await storeFile(t),
      });
    }
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(view.capture.atLimit).toBe(true);
    await expect(
      t.mutation(api.tm.remind.saveCapture, {
        token: liam,
        date: TODAY,
        kind: "organiser",
        storageId: await storeFile(t),
      }),
    ).rejects.toThrow(/capture-limit/);
  });

  it("labels a photo only from the owner's own stack and plan", async () => {
    const { t, liam } = await seeded();
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    const own = await t.query(api.tm.stack.get, { token: liam, date: TODAY });
    const ownNames = new Set(own.dueToday.map((d) => d.name));
    // Assert the list is actually populated, so the loop below is a proof
    // rather than a vacuous pass over nothing.
    expect(view.capture.choices.dose.length).toBeGreaterThan(0);
    // Every dose the confirm list offers is something already on the file. The
    // app has no classifier, so a name it did not already hold cannot appear.
    for (const choice of view.capture.choices.dose) {
      expect([...ownNames].some((n) => choice.label.startsWith(n))).toBe(true);
    }
  });
});

describe("a subscription is a capability, not a name", () => {
  it("never returns the endpoint or the keys to the tab", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.remind.saveSubscription, {
      token: liam,
      date: TODAY,
      endpoint: "https://push.example/ep-secret",
      p256dh: "key-p256dh",
      auth: "key-auth",
      label: "Phone",
    });
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(view.subscriptions).toHaveLength(1);
    expect(view.subscriptions[0]?.label).toBe("Phone");
    const serialised = JSON.stringify(view);
    for (const secret of ["ep-secret", "key-p256dh", "key-auth"]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("refuses to let the other user claim or remove an endpoint already on a file", async () => {
    const { t, liam, artur } = await seeded();
    const endpoint = "https://push.example/ep-liam";
    await t.mutation(api.tm.remind.saveSubscription, {
      token: liam,
      date: TODAY,
      endpoint,
      p256dh: "a",
      auth: "b",
      label: "Phone",
    });

    await expect(
      t.mutation(api.tm.remind.saveSubscription, {
        token: artur,
        date: TODAY,
        endpoint,
        p256dh: "x",
        auth: "y",
        label: "Stolen",
      }),
    ).rejects.toThrow(/not-your-subscription/);
    await expect(
      t.mutation(api.tm.remind.removeSubscription, { token: artur, endpoint }),
    ).rejects.toThrow(/not-your-subscription/);

    const mine = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(mine.subscriptions[0]?.label).toBe("Phone");
    const theirs = await t.query(api.tm.remind.get, { token: artur, date: TODAY });
    expect(theirs.subscriptions).toEqual([]);
  });

  it("re-saving the same endpoint refreshes the device rather than piling up", async () => {
    const { t, liam } = await seeded();
    const sub = {
      token: liam,
      date: TODAY,
      endpoint: "https://push.example/ep",
      p256dh: "a",
      auth: "b",
      label: "Phone",
    };
    await t.mutation(api.tm.remind.saveSubscription, sub);
    await t.mutation(api.tm.remind.saveSubscription, { ...sub, label: "Same phone" });
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(view.subscriptions).toHaveLength(1);
    expect(view.subscriptions[0]?.label).toBe("Same phone");
  });
});

describe("what the deployment can honestly promise", () => {
  it("says it cannot deliver while the server has no push keys", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, { token: liam, enabled: true });
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    // No VAPID keys on this deployment, so the switch must not claim otherwise.
    expect(view.supported).toBe(false);
    expect(view.ready).toBe(false);
    expect(view.blockers.join(" ")).toMatch(/no send keys/i);
  });

  it("stores preferences per user and normalises what it is given", async () => {
    const { t, liam, artur } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, {
      token: liam,
      enabled: true,
      quietFrom: "not-a-time",
      maxPerDay: 99,
    });
    const mine = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(mine.prefs.enabled).toBe(true);
    // A malformed quiet window falls back rather than becoming a rule that
    // silences a person's medicine reminders.
    expect(mine.prefs.quietFrom).toBe("22:30");
    expect(mine.prefs.maxPerDay).toBe(8);

    const theirs = await t.query(api.tm.remind.get, { token: artur, date: TODAY });
    expect(theirs.prefs.enabled).toBe(false);
  });

  it("stores an email on the file and never puts it on the crew board", async () => {
    const { t, liam, artur } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, {
      token: liam,
      enabled: true,
      email: "Liam@Example.COM",
    });
    const mine = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(mine.prefs.email).toBe("liam@example.com");

    const board = await t.query(api.tm.crew.board, { token: artur, date: TODAY });
    expect(JSON.stringify(board)).not.toContain("liam@example.com");
    expect(JSON.stringify(board)).not.toContain("Liam@Example.COM");
  });
});

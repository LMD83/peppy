import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { GRANT_TTL_MS } from "../convex/tm/logicRemind";
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
  // The "Taken" button rides the ingest credential, so the token mint and the
  // HTTP surface are both under test here.
  "./tm/ingest.ts": () => import("../convex/tm/ingest"),
  "./http.ts": () => import("../convex/http"),
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

  it("previews the fixture file's script and recheck reminders once switched on", async () => {
    const { t, liam } = await seeded();
    // A high cap so nothing under test hides in overCap by accident.
    await t.mutation(api.tm.remind.setPrefs, { token: liam, enabled: true, maxPerDay: 8 });
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    const cards = [...view.preview, ...view.overCap];
    // The statin on Liam's file has no repeats left — only the practice can move it.
    const scriptCard = cards.find((r) => r.kind === "script");
    expect(scriptCard?.title).toContain("needs the GP");
    expect(scriptCard?.title).toContain("Atorvastatin");
    // Homocysteine was drawn once, high, 180 days ago — long past its interval.
    const recheckCard = cards.find((r) => r.kind === "recheck");
    expect(recheckCard?.title).toContain("recheck");
  });

  it("stores the newer kind switches per user and honours them in the preview", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, {
      token: liam,
      enabled: true,
      maxPerDay: 8,
      rechecks: false,
      scripts: false,
    });
    const view = await t.query(api.tm.remind.get, { token: liam, date: TODAY });
    expect(view.prefs.rechecks).toBe(false);
    expect(view.prefs.scripts).toBe(false);
    const cards = [...view.preview, ...view.overCap, ...view.quietHeld, ...view.survivalHeld];
    expect(cards.some((r) => r.kind === "script" || r.kind === "recheck")).toBe(false);
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

describe("the Taken grant logs the exact doses it names, once, and nothing else", () => {
  async function userIdOf(t: Harness, slug: string): Promise<Id<"tm_users">> {
    return await t.run(async (ctx) => {
      const users = await ctx.db.query("tm_users").take(10);
      const owner = users.find((u) => u.slug === slug);
      if (owner === undefined) throw new Error(`no user ${slug}`);
      return owner._id;
    });
  }

  /** An item of the named user carrying the given timing, straight off the file. */
  async function itemWithTiming(
    t: Harness,
    slug: string,
    timing: string,
  ): Promise<Id<"tm_protocolItems">> {
    return await t.run(async (ctx) => {
      const users = await ctx.db.query("tm_users").take(10);
      const owner = users.find((u) => u.slug === slug);
      if (owner === undefined) throw new Error(`no user ${slug}`);
      const items = await ctx.db
        .query("tm_protocolItems")
        .withIndex("by_userId", (q) => q.eq("userId", owner._id))
        .take(50);
      const item = items.find((i) => i.active && i.timings.includes(timing));
      if (item === undefined) throw new Error(`no active ${timing} item for ${slug}`);
      return item._id;
    });
  }

  /** Mint one grant the way push.sweep does, and hand back its opaque token. */
  async function mintGrant(
    t: Harness,
    slug: string,
    doses: { itemId: Id<"tm_protocolItems">; timing: string }[],
    nowMs = Date.now(),
  ): Promise<string> {
    const userId = await userIdOf(t, slug);
    const tokens = await t.mutation(internal.tm.remind.mintTakenGrants, {
      userId,
      nowMs,
      grants: [{ date: TODAY, doses }],
    });
    const token = tokens[0];
    if (token === undefined) throw new Error("no grant minted");
    return token;
  }

  async function doseLogsFor(t: Harness, itemId: Id<"tm_protocolItems">, timing: string) {
    return await t.run(async (ctx) => {
      const rows = await ctx.db.query("tm_doseLogs").take(500);
      return rows.filter((r) => r.itemId === itemId && r.date === TODAY && r.timing === timing);
    });
  }

  it("writes the named doses once; the same grant spent again gets nothing", async () => {
    const { t } = await seeded();
    // Today's evening doses are unlogged in the fixtures — exactly the case a
    // lock-screen answer exists for.
    const itemId = await itemWithTiming(t, "liam", "pm");
    const grant = await mintGrant(t, "liam", [{ itemId, timing: "pm" }]);

    const first = await t.mutation(internal.tm.remind.doseTaken, { grantToken: grant });
    expect(first).toEqual({ ok: true, wrote: 1 });
    const logs = await doseLogsFor(t, itemId, "pm");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.taken).toBe(true);

    // Single-use is the security property: a replayed token — a retried POST,
    // a same-origin script reading the notification store after the fact — is
    // refused outright, and the worker then opens the app instead.
    const second = await t.mutation(internal.tm.remind.doseTaken, { grantToken: grant });
    expect(second).toEqual({ ok: false, wrote: 0 });
    expect(await doseLogsFor(t, itemId, "pm")).toHaveLength(1);
  });

  it("refuses a timing the item does not carry — never a guess", async () => {
    const { t } = await seeded();
    const itemId = await itemWithTiming(t, "liam", "pm");
    const grant = await mintGrant(t, "liam", [{ itemId, timing: "am" }]);
    const res = await t.mutation(internal.tm.remind.doseTaken, { grantToken: grant });
    expect(res).toEqual({ ok: true, wrote: 0 });
    expect(await doseLogsFor(t, itemId, "am")).toHaveLength(0);
  });

  it("gives a forged or expired grant nothing", async () => {
    const { t } = await seeded();
    const itemId = await itemWithTiming(t, "liam", "pm");

    const forged = await t.mutation(internal.tm.remind.doseTaken, { grantToken: "tmg_forged" });
    expect(forged).toEqual({ ok: false, wrote: 0 });

    // A grant minted more than a TTL ago has outlived its notification's
    // usefulness — whoever presents it now is not answering a reminder.
    const stale = await mintGrant(
      t,
      "liam",
      [{ itemId, timing: "pm" }],
      Date.now() - GRANT_TTL_MS - 60_000,
    );
    const expired = await t.mutation(internal.tm.remind.doseTaken, { grantToken: stale });
    expect(expired).toEqual({ ok: false, wrote: 0 });
    expect(await doseLogsFor(t, itemId, "pm")).toHaveLength(0);
  });

  it("cannot touch another user's file, whatever ids the grant was handed", async () => {
    const { t } = await seeded();
    // Artur's levothyroxine is a morning med. A grant on Liam's file must not
    // reach it, even if the pair somehow named it.
    const itemId = await itemWithTiming(t, "artur", "am");
    const grant = await mintGrant(t, "liam", [{ itemId, timing: "am" }]);
    const res = await t.mutation(internal.tm.remind.doseTaken, { grantToken: grant });
    expect(res).toEqual({ ok: true, wrote: 0 });
    expect(await doseLogsFor(t, itemId, "am")).toHaveLength(0);
  });

  it("writes nothing for an item that was paused or deleted after minting", async () => {
    const { t } = await seeded();
    const itemId = await itemWithTiming(t, "liam", "pm");

    // Paused between the notification and the tap: the write is skipped, the
    // response says so, and the worker's wrote-0 check opens the app instead.
    const pausedGrant = await mintGrant(t, "liam", [{ itemId, timing: "pm" }]);
    await t.run(async (ctx) => {
      await ctx.db.patch("tm_protocolItems", itemId, { active: false });
    });
    const paused = await t.fetch("/ingest/dose-taken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: pausedGrant }),
    });
    expect(paused.status).toBe(200);
    expect((await paused.json()) as { ok: boolean; wrote: number }).toEqual({ ok: true, wrote: 0 });
    expect(await doseLogsFor(t, itemId, "pm")).toHaveLength(0);

    // Deleted outright: the dangling id resolves to nothing and nothing lands.
    const deletedGrant = await mintGrant(t, "liam", [{ itemId, timing: "pm" }]);
    await t.run(async (ctx) => {
      await ctx.db.delete("tm_protocolItems", itemId);
    });
    const deleted = await t.mutation(internal.tm.remind.doseTaken, { grantToken: deletedGrant });
    expect(deleted).toEqual({ ok: true, wrote: 0 });
  });

  it("cleans up spent and expired grants on the next mint", async () => {
    const { t } = await seeded();
    const itemId = await itemWithTiming(t, "liam", "pm");

    const spent = await mintGrant(t, "liam", [{ itemId, timing: "pm" }]);
    await t.mutation(internal.tm.remind.doseTaken, { grantToken: spent });
    await mintGrant(t, "liam", [{ itemId, timing: "pm" }], Date.now() - GRANT_TTL_MS - 60_000);

    // The next mint sweeps both out: a spent grant is evidence, not inventory,
    // and an expired one is a credential nobody may ever present again.
    await mintGrant(t, "liam", [{ itemId, timing: "pm" }]);
    const remaining = await t.run(async (ctx) => await ctx.db.query("tm_takenGrants").take(10));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.usedAt).toBeUndefined();
  });

  it("answers the worker over HTTP: 400 for junk, 401 for a dead grant, 200 for a live one", async () => {
    const { t } = await seeded();
    const itemId = await itemWithTiming(t, "liam", "pm");
    const post = (body: unknown) =>
      t.fetch("/ingest/dose-taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });

    // Every malformed shape is a 400 before a database is touched — a body
    // that is not JSON, not an object, missing its token, or inflated past
    // the raw-size cap all die at the door, not in the mutation.
    const notJson = await post("not json at all");
    expect(notJson.status).toBe(400);
    const notObject = await post(JSON.stringify("just a string"));
    expect(notObject.status).toBe(400);
    const noToken = await post({});
    expect(noToken.status).toBe(400);
    const oversize = await post({ token: "tmg_x", padding: "y".repeat(4000) });
    expect(oversize.status).toBe(400);

    // The browser's preflight gets its 204 and the CORS grant, nothing more.
    const preflight = await t.fetch("/ingest/dose-taken", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const dead = await post({ token: "tmg_forged" });
    expect(dead.status).toBe(401);

    const grant = await mintGrant(t, "liam", [{ itemId, timing: "pm" }]);
    const live = await post({ token: grant });
    expect(live.status).toBe(200);
    const parsed = (await live.json()) as { ok: boolean; wrote: number };
    expect(parsed).toEqual({ ok: true, wrote: 1 });
    expect(await doseLogsFor(t, itemId, "pm")).toHaveLength(1);

    // Single-use over the wire too: the same token again is a 401, which the
    // worker answers by opening the app — the intended second-tap experience.
    const replay = await post({ token: grant });
    expect(replay.status).toBe(401);
  });

  it("plans grant hand-offs for dose notifications, and no payload carries an ingest token", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, { token: liam, enabled: true, maxPerDay: 8 });
    await t.mutation(api.tm.remind.saveSubscription, {
      token: liam,
      date: TODAY,
      endpoint: "https://push.example/ep",
      p256dh: "a",
      auth: "b",
      label: "Phone",
    });
    // A live ingest token on the file, minted the way the tab mints one. The
    // proof of MEDIUM-4 is that the sweep now leaves it entirely alone.
    await t.mutation(api.tm.ingest.createToken, { token: liam, date: TODAY, label: "Phone" });
    const ingestTokens = await t.run(async (ctx) =>
      (await ctx.db.query("tm_ingestTokens").take(10)).map((r) => r.token),
    );
    expect(ingestTokens.length).toBeGreaterThan(0);

    const previous = process.env.CONVEX_SITE_URL;
    process.env.CONVEX_SITE_URL = "https://x.convex.site";
    try {
      // 17:30 UTC is 18:30 in Dublin — the pm slot exactly, and the fixtures
      // leave today's evening doses unlogged.
      const batches = await t.query(internal.tm.remind.sweepPlan, {
        nowMs: Date.parse("2026-08-13T17:30:00Z"),
        windowMinutes: 30,
      });
      expect(batches).toHaveLength(1);
      const doseNotes = batches[0]!.notifications.filter((n) => n.kind === "dose");
      expect(doseNotes.length).toBeGreaterThan(0);
      for (const note of doseNotes) {
        expect(note.grant?.url).toBe("https://x.convex.site/ingest/dose-taken");
        expect(note.grant?.date).toBe(TODAY);
        expect(note.grant?.doses.length).toBeGreaterThan(0);
        for (const d of note.grant?.doses ?? []) expect(d.timing).toBe("pm");
        // The plan itself carries no credential — a query cannot mint one.
        expect(note.taken).toBeUndefined();
      }
      // Nothing that is not a dose ever carries a hand-off.
      for (const note of batches[0]!.notifications.filter((n) => n.kind !== "dose")) {
        expect(note.grant).toBeUndefined();
        expect(note.taken).toBeUndefined();
      }
      // The whole batch, serialised: no long-lived credential anywhere in it.
      const serialised = JSON.stringify(batches);
      expect(serialised).not.toContain("tmnt_");
      for (const token of ingestTokens) expect(serialised).not.toContain(token);

      // And the hand-off works end to end: mint what the plan asked for, post
      // it the way the worker would, watch the named doses land.
      const first = doseNotes[0]!;
      const tokens = await t.mutation(internal.tm.remind.mintTakenGrants, {
        userId: await userIdOf(t, "liam"),
        nowMs: Date.now(),
        grants: [{ date: first.grant!.date, doses: first.grant!.doses }],
      });
      expect(tokens[0]).toMatch(/^tmg_/);
      const res = await t.fetch("/ingest/dose-taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokens[0] }),
      });
      expect(res.status).toBe(200);
      const parsed = (await res.json()) as { ok: boolean; wrote: number };
      expect(parsed.ok).toBe(true);
      expect(parsed.wrote).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.CONVEX_SITE_URL;
      else process.env.CONVEX_SITE_URL = previous;
    }
  });

  it("hands no grant to a coalesced pile past the cap — never a button that logs a subset", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, { token: liam, enabled: true, maxPerDay: 8 });
    await t.mutation(api.tm.remind.saveSubscription, {
      token: liam,
      date: TODAY,
      endpoint: "https://push.example/ep",
      p256dh: "a",
      auth: "b",
      label: "Phone",
    });
    // Inflate the evening past MAX_TAKEN_DOSES exact pairs. The coalesced
    // notification still goes out — the words still matter — but a Taken
    // button that could only log the first twenty would be a quiet lie.
    await t.run(async (ctx) => {
      const users = await ctx.db.query("tm_users").take(10);
      const owner = users.find((u) => u.slug === "liam");
      if (owner === undefined) throw new Error("no user liam");
      for (let i = 0; i < 21; i++) {
        await ctx.db.insert("tm_protocolItems", {
          userId: owner._id,
          name: `Trial compound ${i + 1}`,
          kind: "supplement",
          dose: 1,
          unit: "capsule",
          route: "oral",
          timings: ["pm"],
          scheduleType: "daily",
          startDate: "2026-01-01",
          withFood: false,
          evidence: "limited",
          cautions: [],
          active: true,
        });
      }
    });

    const previous = process.env.CONVEX_SITE_URL;
    process.env.CONVEX_SITE_URL = "https://x.convex.site";
    try {
      const batches = await t.query(internal.tm.remind.sweepPlan, {
        nowMs: Date.parse("2026-08-13T17:30:00Z"),
        windowMinutes: 30,
      });
      const doseNotes = batches[0]!.notifications.filter((n) => n.kind === "dose");
      expect(doseNotes.length).toBeGreaterThan(0);
      for (const note of doseNotes) {
        expect(note.grant).toBeUndefined();
        expect(note.taken).toBeUndefined();
      }
    } finally {
      if (previous === undefined) delete process.env.CONVEX_SITE_URL;
      else process.env.CONVEX_SITE_URL = previous;
    }
  });

  it("plans no hand-off at all when no site URL is configured", async () => {
    const { t, liam } = await seeded();
    await t.mutation(api.tm.remind.setPrefs, { token: liam, enabled: true, maxPerDay: 8 });
    await t.mutation(api.tm.remind.saveSubscription, {
      token: liam,
      date: TODAY,
      endpoint: "https://push.example/ep",
      p256dh: "a",
      auth: "b",
      label: "Phone",
    });
    const previous = process.env.CONVEX_SITE_URL;
    delete process.env.CONVEX_SITE_URL;
    try {
      const batches = await t.query(internal.tm.remind.sweepPlan, {
        nowMs: Date.parse("2026-08-13T17:30:00Z"),
        windowMinutes: 30,
      });
      for (const note of batches[0]?.notifications ?? []) {
        // Nowhere for the button to post means no grant is ever minted — the
        // button then simply opens the app, which is the honest degradation.
        expect(note.grant).toBeUndefined();
        expect(note.taken).toBeUndefined();
      }
    } finally {
      if (previous !== undefined) process.env.CONVEX_SITE_URL = previous;
    }
  });
});

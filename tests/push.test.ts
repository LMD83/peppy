import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_ACTIONS,
  MAX_ACTION_TITLE,
  actionsFor,
  blockedLog,
  blockedReport,
  classifyError,
  deliveryResult,
  encodePayload,
  notificationPayload,
  nothingDue,
  sentReport,
  type Notification,
  type TakenPost,
} from "../convex/tm/logicPush";

/**
 * Delivery rules. The transport is a network call and is not tested here; every
 * decision around it is, because those are the parts that can be quietly wrong.
 */

function note(over: Partial<Notification> = {}): Notification {
  return {
    key: "dose:2026-08-16:am:item1",
    title: "Time for your morning dose",
    body: "Metformin. Tap it off when it's done.",
    tab: "stack",
    tag: "dose:stack",
    kind: "dose",
    ...over,
  };
}

function takenPost(): TakenPost {
  return {
    url: "https://x.convex.site/ingest/dose-taken",
    token: "tmk_secret",
    date: "2026-08-16",
    doses: [{ itemId: "item1", timing: "am" }],
  };
}

/* ===== the contract with the service worker ===== */

describe("the payload matches what public/sw.js actually reads", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  it("sends exactly the five keys the worker looks for", () => {
    expect(Object.keys(notificationPayload(note())).sort()).toEqual([
      "actions",
      "body",
      "tab",
      "tag",
      "title",
    ]);
  });

  it("names each key the same way the worker does", () => {
    // Nothing validates these two files against each other at build time. Rename
    // a key here and the worker silently shows "A reminder from your file." — a
    // notification that fires, says nothing, and looks perfectly healthy.
    for (const key of Object.keys(notificationPayload(note({ taken: takenPost() })))) {
      expect(sw, `sw.js never reads payload.${key}`).toContain(`payload.${key}`);
    }
  });

  it("carries no key the worker would ignore", () => {
    // `key` is the sweep's own idempotency handle and has no business on a lock
    // screen; it stays server-side. `kind` collapses into the actions list.
    const payload = notificationPayload(note()) as Record<string, unknown>;
    expect(payload.key).toBeUndefined();
    expect(payload.kind).toBeUndefined();
  });

  it("encodes to JSON the worker can parse", () => {
    const parsed: unknown = JSON.parse(encodePayload(note()));
    expect(parsed).toEqual({
      title: "Time for your morning dose",
      body: "Metformin. Tap it off when it's done.",
      tab: "stack",
      tag: "dose:stack",
      actions: [
        { action: "taken", title: "Taken" },
        { action: "open", title: "Open" },
      ],
    });
  });

  it("puts the person's own words through unchanged", () => {
    const words = "Nortriptyline — about 3 days left";
    expect(encodePayload(note({ body: words }))).toContain(words);
  });
});

/* ===== lock-screen buttons ===== */

describe("what a lock screen may offer", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  it("gives a dose an answer and an open, and everything else an open only", () => {
    expect(actionsFor("dose").map((a) => a.action)).toEqual(["taken", "open"]);
    for (const kind of ["supply", "checkin", "recheck", "script", undefined]) {
      expect(actionsFor(kind).map((a) => a.action)).toEqual(["open"]);
    }
  });

  it("never exceeds the two buttons Chromium will actually draw", () => {
    // iOS draws zero and Android draws two; a third button is a button that
    // silently vanishes on every platform there is.
    expect(MAX_ACTIONS).toBe(2);
    for (const kind of ["dose", "supply", "checkin", "recheck", "script", undefined]) {
      expect(actionsFor(kind).length).toBeLessThanOrEqual(MAX_ACTIONS);
    }
  });

  it("keeps every title short enough for a lock-screen button", () => {
    for (const kind of ["dose", "supply", "checkin", "recheck", "script", undefined]) {
      for (const a of actionsFor(kind)) {
        expect(a.title.length).toBeGreaterThan(0);
        expect(a.title.length).toBeLessThanOrEqual(MAX_ACTION_TITLE);
      }
    }
  });

  it("lets the worker defer to the platform's own ceiling", () => {
    // sw.js slices to Notification.maxActions — 0 on iOS, 2 on Android — so a
    // platform that draws fewer buttons is never handed more.
    expect(sw).toContain("maxActions");
  });

  it("rides the taken hand-off only on a dose", () => {
    const dose = notificationPayload(note({ taken: takenPost() }));
    expect(dose.taken).toEqual(takenPost());
    const supply = notificationPayload(note({ kind: "supply", taken: takenPost() }));
    expect(supply.taken).toBeUndefined();
    const bare = notificationPayload(note());
    expect(bare.taken).toBeUndefined();
  });

  it("has the worker POST the hand-off and fall back to opening the app", () => {
    // The click path: action "taken" fetches the exact doses to the ingest
    // endpoint, and anything short of res.ok lands on the app instead. A tap
    // is never silently lost.
    expect(sw).toContain('event.action === "taken"');
    expect(sw).toContain("fetch(data.taken.url");
    expect(sw).toContain("res.ok ? undefined : focusOrOpen(data)");
    expect(sw).toContain(".catch(() => focusOrOpen(data))");
  });
});

/* ===== what a failure means ===== */

describe("classifying a delivery failure", () => {
  it("treats 404 and 410 as a device that is gone", () => {
    for (const statusCode of [404, 410]) {
      expect(classifyError({ statusCode })).toBe("gone");
    }
  });

  it("treats every other status as a failure to count, not a device to delete", () => {
    for (const statusCode of [400, 401, 403, 413, 429, 500, 502, 503]) {
      expect(classifyError({ statusCode })).toBe("failed");
    }
  });

  it("treats anything unrecognisable as failed rather than gone", () => {
    // Guessing "failed" costs a retry. Guessing "gone" deletes a working
    // subscription and silently stops reminding someone who was relying on it,
    // so every ambiguous case has to fall the same way.
    for (const weird of [null, undefined, new Error("socket hang up"), "410", { statusCode: "410" }, {}]) {
      expect(classifyError(weird)).toBe("failed");
    }
  });
});

describe("the row handed to recordDelivery", () => {
  it("marks a success without a gone flag at all", () => {
    expect(deliveryResult("s1", "ok")).toEqual({ subscriptionId: "s1", ok: true });
  });

  it("flags a dead endpoint so the row and its device are dropped", () => {
    expect(deliveryResult("s1", "gone")).toEqual({ subscriptionId: "s1", ok: false, gone: true });
  });

  it("omits gone entirely on a countable failure", () => {
    const row = deliveryResult("s1", "failed");
    expect(row).toEqual({ subscriptionId: "s1", ok: false });
    expect("gone" in row).toBe(false);
  });
});

/* ===== a deployment that cannot send ===== */

describe("a sweep that cannot deliver", () => {
  it("reports nothing sent, and says how much went undelivered", () => {
    const report = blockedReport(2, 5);
    expect(report).toEqual({ users: 2, notifications: 5, sent: 0, reason: "no-keys" });
  });

  it("names the cause and the remedy in the line it logs", () => {
    const line = blockedLog(2, 5);
    expect(line).toContain("5 notification(s) were due for 2 file(s)");
    expect(line).toContain("VAPID_PUBLIC_KEY");
    expect(line).toContain("RESEND_API_KEY");
    expect(line).toContain("DEPLOY.md");
  });

  it("says plainly that nothing was penalised", () => {
    // The failure was the deployment's. A subscription that was never contacted
    // must not carry a strike for it — three strikes retire a device.
    expect(blockedLog(1, 1)).toContain("no subscription was penalised");
  });

  it("has no reason for a missing package, because that is now a broken deploy", () => {
    // The dynamic-import fallback is gone: web-push is a real dependency and the
    // import is static, so an uninstalled package fails `npx convex deploy`
    // rather than silently sending nothing on a weekday morning.
    const logic = readFileSync(join(process.cwd(), "convex", "tm", "logicPush.ts"), "utf8");
    expect(logic).toContain('"nothing-due" | "no-keys" | "sent"');
    const push = readFileSync(join(process.cwd(), "convex", "tm", "push.ts"), "utf8");
    expect(push).toContain('import webpush from "web-push"');
    expect(push).not.toContain("dynamicImport");
  });

  it("returns a zero report when nothing was due, without touching anything", () => {
    expect(nothingDue()).toEqual({ users: 0, notifications: 0, sent: 0, reason: "nothing-due" });
  });
});

describe("a sweep that did deliver", () => {
  it("reports what was sent against what was due", () => {
    expect(sentReport(2, 5, 5)).toEqual({ users: 2, notifications: 5, sent: 5, reason: "sent" });
  });

  it("can report fewer sent than due, because a device may drop mid-batch", () => {
    const report = sentReport(2, 5, 3);
    expect(report.sent).toBeLessThan(report.notifications);
    expect(report.reason).toBe("sent");
  });
});

/* ===== the wiring that only breaks in production ===== */

describe("the runtime split is the thing that makes delivery possible", () => {
  const push = readFileSync(join(process.cwd(), "convex", "tm", "push.ts"), "utf8");
  const crons = readFileSync(join(process.cwd(), "convex", "crons.ts"), "utf8");
  const remind = readFileSync(join(process.cwd(), "convex", "tm", "remind.ts"), "utf8");

  it("puts the sending action in the Node runtime", () => {
    // web-push needs Node built-ins. Without this pragma the import resolves at
    // deploy time and fails at call time, which is the worst place to find out.
    expect(push.startsWith('"use node";')).toBe(true);
  });

  it("keeps queries and mutations out of the Node-runtime file", () => {
    // A "use node" file may export actions only. remind.ts holds the queries and
    // the mutations, so the two cannot be merged however tempting it looks.
    expect(push).not.toMatch(/\b(?<!internal)(query|mutation)\(\{/);
    // Only the first line counts — both files discuss the pragma in prose.
    expect(remind.startsWith('"use node"')).toBe(false);
  });

  it("does not put the pragma on crons.ts, which is analysed in the default runtime", () => {
    expect(crons.startsWith('"use node"')).toBe(false);
  });

  it("schedules the action that actually sends", () => {
    expect(crons).toContain("internal.tm.push.sweep");
  });

  it("does not import the Node-runtime module from crons.ts", () => {
    // Importing push.ts here pulls web-push into the default runtime and the
    // deploy fails. The interval lives in logicPush.ts, which has no Node APIs.
    expect(crons).not.toMatch(/from ["']\.\/tm\/push["']/);
    expect(crons).toContain("from \"./tm/logicPush\"");
  });

  it("declares web-push as a dependency, not a dev dependency", () => {
    // It runs on the Convex deployment, so it has to ship with it.
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies["web-push"]).toBeTruthy();
    expect(pkg.devDependencies["web-push"]).toBeUndefined();
  });
});

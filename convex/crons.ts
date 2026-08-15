import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { SweepBatch } from "./tm/remind";

/**
 * The reminder sweep.
 *
 * iOS gives a web app no Background Sync and no Periodic Sync at all, and a
 * timer in an open tab is not a reminder system — it is a tab that happens to
 * be open. So the schedule lives here, on the server, and the only thing the
 * device does is receive.
 *
 * The sweep runs on a fixed interval and asks `sweepPlan` for the slice of the
 * day that has just elapsed. That window is how "a missed dose is reminded
 * once" is kept without a sent-log table: each due thing falls inside exactly
 * one sweep, so it goes out once and is never escalated into a second, louder
 * copy. Everything about *what* is due is decided in convex/tm/logic-remind.ts,
 * the same pure module the Reminders tab previews from.
 *
 * ## Delivery, and the honest state of it
 *
 * Sending a web push means signing a VAPID JWT and encrypting the payload per
 * RFC 8291. That is the `web-push` package's job, and `web-push` is NOT a
 * dependency of this repo — adding one was explicitly out of scope for this
 * pass. So `sendPush` below resolves it at runtime and, when it is absent,
 * logs one clear line and returns without sending. It is a no-op, not a crash:
 * the sweep still runs, still computes the correct plan, and still leaves every
 * subscription untouched, so nothing is marked delivered and no device is
 * penalised with a failure it did not earn.
 *
 * To switch delivery on, three steps, in this order:
 *   1. `npm install web-push`
 *   2. move `sendPush` and `sweep` into their own module with `"use node";` at
 *      the top — `web-push` needs Node built-ins, and this file cannot carry
 *      that pragma because Convex analyses `convex/crons.ts` in the default
 *      runtime — then run `npx convex dev` so the generated api picks it up.
 *   3. set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`
 *      (a `mailto:` address) on the deployment.
 * Until step 3 is done, `remind.get` reports `supported: false` and the tab
 * says so plainly rather than showing a switch that lies.
 */

/** How often the sweep runs, and therefore how wide its due-window is. */
const SWEEP_MINUTES = 30;

type PushResult = { subscriptionId: Id<"tm_pushSubscriptions">; ok: boolean; gone?: boolean };

type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

type WebPushLike = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (sub: WebPushSubscription, payload: string) => Promise<unknown>;
};

/**
 * Resolve `web-push` without letting the bundler try to resolve it.
 *
 * A static `import "web-push"` would fail at deploy time for a package that is
 * not installed, taking the whole deployment down with it — an unshipped
 * feature must never be able to break a shipped one. The indirection keeps the
 * reference invisible to esbuild; the try/catch turns "not installed" into a
 * logged null instead of an exception.
 */
async function loadWebPush(): Promise<WebPushLike | null> {
  try {
    const dynamicImport = Function("s", "return import(s)") as (s: string) => Promise<unknown>;
    const mod = (await dynamicImport("web-push")) as { default?: unknown } | undefined;
    const candidate = (mod && "default" in mod ? mod.default : mod) as Partial<WebPushLike> | undefined;
    if (
      candidate === undefined ||
      typeof candidate.setVapidDetails !== "function" ||
      typeof candidate.sendNotification !== "function"
    ) {
      return null;
    }
    return candidate as WebPushLike;
  } catch {
    return null;
  }
}

function vapid(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = (process.env.VAPID_SUBJECT ?? "").trim();
  if (publicKey === "" || privateKey === "" || subject === "") return null;
  return { subject, publicKey, privateKey };
}

/**
 * A push service answers 404 or 410 for an endpoint that no longer exists.
 * That is not a transient failure and there is nothing to retry — the device
 * is gone, and the row goes with it.
 */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: unknown })?.statusCode;
  return status === 404 || status === 410;
}

/** What one sweep did, for the log. Annotated because the generated `api` type
 *  is derived from this very module — without it the reference is circular. */
type SweepReport = {
  users: number;
  notifications: number;
  sent: number;
  reason: "nothing-due" | "no-vapid" | "no-web-push" | "sent";
};

export const sweep = internalAction({
  args: { windowMinutes: v.optional(v.number()) },
  handler: async (ctx, { windowMinutes }): Promise<SweepReport> => {
    const nowMs = Date.now();
    const window = windowMinutes ?? SWEEP_MINUTES;

    const batches: SweepBatch[] = await ctx.runQuery(internal.tm.remind.sweepPlan, {
      nowMs,
      windowMinutes: window,
    });
    const notificationCount = batches.reduce((n, b) => n + b.notifications.length, 0);
    if (batches.length === 0) return { users: 0, notifications: 0, sent: 0, reason: "nothing-due" };

    const keys = vapid();
    if (keys === null) {
      console.warn(
        `[timento reminders] ${notificationCount} notification(s) were due for ${batches.length} file(s) and none were sent: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not all set on this deployment. Nothing was marked delivered and no subscription was penalised.`,
      );
      return { users: batches.length, notifications: notificationCount, sent: 0, reason: "no-vapid" };
    }

    const webpush = await loadWebPush();
    if (webpush === null) {
      console.warn(
        `[timento reminders] ${notificationCount} notification(s) were due for ${batches.length} file(s) and none were sent: the "web-push" package is not installed, so this deployment has no way to sign and encrypt a push. See the header of convex/crons.ts for the three steps that switch delivery on. Nothing was marked delivered and no subscription was penalised.`,
      );
      return { users: batches.length, notifications: notificationCount, sent: 0, reason: "no-web-push" };
    }

    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

    const results: PushResult[] = [];
    let sent = 0;
    for (const batch of batches) {
      for (const target of batch.targets) {
        const subscription: WebPushSubscription = {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        };
        // One delivery per notification: the service worker's per-subject tag
        // replaces rather than stacks, so a device never gets a pile.
        let ok = true;
        let gone = false;
        for (const note of batch.notifications) {
          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({ title: note.title, body: note.body, tab: note.tab, tag: note.tag }),
            );
            sent += 1;
          } catch (error) {
            ok = false;
            if (isGone(error)) gone = true;
            console.warn(
              `[timento reminders] delivery failed for one device: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            break;
          }
        }
        results.push(gone ? { subscriptionId: target.subscriptionId, ok, gone } : { subscriptionId: target.subscriptionId, ok });
      }
    }

    await ctx.runMutation(internal.tm.remind.recordDelivery, { results, atMs: nowMs });
    return { users: batches.length, notifications: notificationCount, sent, reason: "sent" };
  },
});

const crons = cronJobs();

crons.interval("timento reminder sweep", { minutes: SWEEP_MINUTES }, internal.crons.sweep, {});

export default crons;

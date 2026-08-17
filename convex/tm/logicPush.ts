/**
 * Delivery rules for web push — the decisions, with no network in sight.
 *
 * The transport half lives in convex/tm/push.ts, which is a Node-runtime action
 * because signing a VAPID JWT and encrypting a payload per RFC 8291 needs Node
 * built-ins. Everything that is a *decision* rather than a syscall lives here,
 * for the same reason every other slice splits this way: a rule you can only
 * exercise by sending a real push to a real phone is a rule nobody exercises.
 *
 * Three decisions, and each one has a way to be wrong that matters:
 *
 *  1. **What is on the wire.** The service worker parses this JSON and nothing
 *     validates the two ends against each other at build time. If a key is
 *     renamed here the worker silently falls back to "A reminder from your
 *     file." — a notification that fires, says nothing, and looks fine.
 *  2. **What a failure means.** A push service answers 404/410 for an endpoint
 *     that is gone. Treating that as transient retries forever against a device
 *     that no longer exists; treating a transient 500 as gone deletes a working
 *     subscription and silently stops reminding a person.
 *  3. **What a deployment that cannot send should do.** Nothing — but visibly.
 *     No subscription may be marked delivered and none may be penalised with a
 *     failure it did not earn, because the failure was ours.
 */

/** How often the sweep runs, and therefore how wide its due-window is. */
export const SWEEP_MINUTES = 30;

/* ===== what goes on the wire ===== */

/**
 * Everything the worker needs to log a dose from the lock screen: where to
 * POST, and the single-use grant token that authorises it. The doses the
 * notification named live server-side on the grant (tm_takenGrants), keyed by
 * this token — nothing about them travels. The token spends itself on first
 * use and expires within a day, so a payload read out of the OS notification
 * store after the fact — by another same-origin script, or after sign-out —
 * is worth at most one tap at exactly the doses the notification named, and
 * usually worth nothing at all.
 */
export type TakenPost = {
  url: string;
  token: string;
};

/** The shape convex/tm/remind.ts hands to the sweep for one notification. */
export type Notification = {
  key: string;
  title: string;
  body: string;
  tab: string;
  tag: string;
  /** Which rule produced it. Absent on the demo deliver path, which is fine. */
  kind?: string;
  /** Present only when a dose can actually be logged without opening the app. */
  taken?: TakenPost;
};

export type PushAction = { action: "taken" | "open"; title: string };

/**
 * Chromium and Android draw at most two buttons on a notification, and iOS
 * Safari web push draws none at all — there, the tap itself is the whole
 * interface. So: never more than two actions, and the tap-through route stays
 * first-class, because for every iPhone it is the only route.
 */
export const MAX_ACTIONS = 2;
/** Lock-screen buttons truncate hard. One word each. */
export const MAX_ACTION_TITLE = 12;

/**
 * What a lock screen may offer. The "Taken" button appears only when a grant
 * hand-off is actually attached — a button that could not log what it names
 * would either lie or silently log a subset, and both are worse than "Open".
 */
export function actionsFor(hasTaken: boolean): PushAction[] {
  if (hasTaken) {
    return [
      { action: "taken", title: "Taken" },
      { action: "open", title: "Open" },
    ];
  }
  return [{ action: "open", title: "Open" }];
}

/**
 * Exactly the keys public/sw.js reads, and no others.
 *
 * What actually travels, plainly: the title and body of a dose, script or
 * recheck reminder name compounds and markers, and land on a lock screen — by
 * design, because a reminder that will not say what it is about reminds nobody,
 * and both newer kinds are switchable per user for anyone who wants the lock
 * screen quieter. `tab` is a route. The only credential is `taken.token`, a
 * single-use grant scoped server-side to the exact doses this notification
 * names; the OS store holds it, no lock screen shows it, and it is spent or
 * expired by the time it could be worth stealing.
 */
export type PushPayload = {
  title: string;
  body: string;
  tab: string;
  tag: string;
  actions: PushAction[];
  taken?: TakenPost;
};

export function notificationPayload(note: Notification): PushPayload {
  // The POST rides only on a dose — the one kind whose button writes anything.
  const taken = note.kind === "dose" ? note.taken : undefined;
  const base: PushPayload = {
    title: note.title,
    body: note.body,
    tab: note.tab,
    tag: note.tag,
    actions: actionsFor(taken !== undefined),
  };
  if (taken !== undefined) return { ...base, taken };
  return base;
}

/**
 * Ceiling on one encoded payload. Push services reject near 4 KB, and a
 * rejected send counts as a delivery failure — three of those in a row retire
 * the device and silently end its medicine reminders. Comfortably under the
 * hard limit, with headroom for the encryption overhead.
 */
export const PAYLOAD_MAX_BYTES = 3500;

const payloadBytes = new TextEncoder();

/**
 * The bytes actually sent. Separate from the object so a test can read them.
 *
 * An oversized payload sheds the grant hand-off (and with it the "Taken"
 * button) rather than risk rejection: the tap then opens the app, which is the
 * honest degradation. The words are never truncated — they are the reminder.
 */
export function encodePayload(note: Notification): string {
  const full = JSON.stringify(notificationPayload(note));
  if (payloadBytes.encode(full).length <= PAYLOAD_MAX_BYTES) return full;
  const { taken: _dropped, ...stripped } = note;
  return JSON.stringify(notificationPayload(stripped));
}

/* ===== what a failure means ===== */

export type DeliveryOutcome = "ok" | "gone" | "failed";

/**
 * A push service answers 404 or 410 for an endpoint that no longer exists.
 * That is not transient and there is nothing to retry — the device is gone and
 * the row goes with it. Everything else is counted, and three consecutive
 * failures retire the device (see MAX_CONSECUTIVE_FAILURES in logicRemind).
 *
 * Anything unrecognisable is "failed", never "gone": guessing wrong in this
 * direction costs a retry, and guessing wrong in the other deletes a working
 * subscription and stops reminding somebody who was relying on it.
 */
export function classifyError(error: unknown): DeliveryOutcome {
  const status = (error as { statusCode?: unknown } | null | undefined)?.statusCode;
  return status === 404 || status === 410 ? "gone" : "failed";
}

export type DeliveryResult<Id> = { subscriptionId: Id; ok: boolean; gone?: boolean };

/** The row recordDelivery expects, with `gone` omitted rather than false. */
export function deliveryResult<Id>(subscriptionId: Id, outcome: DeliveryOutcome): DeliveryResult<Id> {
  if (outcome === "ok") return { subscriptionId, ok: true };
  if (outcome === "gone") return { subscriptionId, ok: false, gone: true };
  return { subscriptionId, ok: false };
}

/* ===== what a deployment that cannot send should say ===== */

/**
 * There is deliberately no "no-web-push" reason any more.
 *
 * The package used to be resolved through a dynamic import so that an
 * uninstalled dependency degraded to a logged no-op rather than breaking the
 * deployment. It is a real dependency now and the import is static, which moves
 * that failure from 8am on a weekday to `npx convex deploy` — the right place
 * for it. A missing package is a broken build, not a quiet morning.
 */
export type SweepReason = "nothing-due" | "no-keys" | "sent";

export type SweepReport = {
  users: number;
  notifications: number;
  sent: number;
  reason: SweepReason;
};

export function nothingDue(): SweepReport {
  return { users: 0, notifications: 0, sent: 0, reason: "nothing-due" };
}

/**
 * A deployment that cannot deliver says so in one line that names the cause and
 * the remedy, and reports zero sent.
 *
 * The wording matters more than it looks. This line is the only trace a missing
 * key leaves — the tab already says reminders cannot fire, but nobody reads a
 * tab at 3am when a dose was missed, and the question then is "did the app try".
 */
export function blockedReport(users: number, notifications: number): SweepReport {
  return { users, notifications, sent: 0, reason: "no-keys" };
}

export function blockedLog(users: number, notifications: number): string {
  return (
    `[timento reminders] ${notifications} notification(s) were due for ${users} file(s) and none ` +
    "were sent: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not all set, and " +
    "RESEND_API_KEY is not set either. Nothing was marked delivered and no subscription was " +
    "penalised. See DEPLOY.md — Reminders — for the keys that switch delivery on."
  );
}

export function sentReport(users: number, notifications: number, sent: number): SweepReport {
  return { users, notifications, sent, reason: "sent" };
}

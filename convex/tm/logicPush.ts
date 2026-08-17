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

/** One exact dose the notification named. Never a guess, never a category. */
export type TakenDose = { itemId: string; timing: string };

/**
 * Everything the worker needs to log a dose from the lock screen: where to
 * POST, the revocable ingest token that authorises it, and the exact doses the
 * notification spoke about. The token is the same credential the phone Shortcut
 * carries — revoking it on the Hands-free tab kills this button too, which is
 * the point of a separate credential.
 */
export type TakenPost = {
  url: string;
  token: string;
  date: string;
  doses: TakenDose[];
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

/** What a lock screen may offer per kind. A dose can be answered; the rest opened. */
export function actionsFor(kind: string | undefined): PushAction[] {
  if (kind === "dose") {
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
 * Nothing clinical and nothing identifying travels in a push payload: the title
 * and body are already the person's own schedule in their own words, and `tab`
 * is a route. A push payload is encrypted in transit but it lands in an OS
 * notification store, so it carries what a lock screen may show — plus, for a
 * dose, the revocable token and exact subject the "Taken" button needs, which
 * the store holds but never displays.
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
  const base: PushPayload = {
    title: note.title,
    body: note.body,
    tab: note.tab,
    tag: note.tag,
    actions: actionsFor(note.kind),
  };
  // The POST rides only on a dose — the one kind whose button writes anything.
  if (note.kind === "dose" && note.taken !== undefined) return { ...base, taken: note.taken };
  return base;
}

/** The bytes actually sent. Separate from the object so a test can read them. */
export function encodePayload(note: Notification): string {
  return JSON.stringify(notificationPayload(note));
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

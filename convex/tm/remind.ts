import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "../_generated/server";
import { checksForDate, requireUser } from "./db";
import { daysBetween } from "./lib";
import { buildSupplyView, type SupplyRow } from "./logicSupply";
// The capture rules live in the captures slice; this module owns the mutations
// only because backend.tsx already wires them here. One set of rules, one place.
import {
  MAX_CAPTURES_PER_DAY,
  buildCaptureView,
  canSaveCapture,
  doseChoices,
  mealChoices,
  normaliseCaptureNote,
  type CaptureRow,
} from "./logicCapture";
import { foodByKey } from "./data/foods";
import { dosesForDate, type DoseLog, type StackItem } from "./logicStack";
import { emailConfigured } from "./logicEmail";
import {
  APP_TIMEZONE,
  MAX_CONSECUTIVE_FAILURES,
  buildRemindView,
  checkinsFor,
  localNow,
  normalisePrefs,
  planReminders,
  type AssessmentHistory,
  type RemindView,
  type ReminderPrefs,
  type SubscriptionRow,
} from "./logicRemind";

/**
 * Reminders — the server half of a promise the app could not previously keep.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and every mutation re-checks that the row it touches
 * belongs to the caller. A push subscription is a capability to interrupt
 * somebody; it is never addressable by anyone but its owner.
 *
 * All of the judgement — what is due, what quiet hours swallow, what survival
 * mode lets speak, what the words are — lives in ./logicRemind.ts, which the
 * demo backend calls too. This module only gathers rows and hands them over.
 *
 * The endpoint and keys of a subscription never leave the server. The tab is
 * shown a label, a date and whether it is healthy; that is everything a person
 * needs to manage their own devices and nothing an attacker could use.
 */

const MAX_SUBSCRIPTIONS = 12;
const MAX_ITEMS = 200;
const MAX_SUPPLY = 200;
const MAX_DOSE_LOGS = 200;
const MAX_CAPTURES = 60;
const MAX_ASSESSMENTS = 200;
const MAX_LABEL = 60;
/** Per-sweep ceiling on files examined. A bound, not a business rule. */
const MAX_SWEEP_USERS = 400;

const captureKind = v.union(v.literal("dose"), v.literal("meal"), v.literal("organiser"));

/* ===== deployment capability ===== */

/**
 * Whether this deployment can actually deliver a push. Absent VAPID keys, the
 * honest answer on the tab is "not yet" rather than a switch that lies.
 */
function vapidPublicKey(): string {
  const key = process.env.VAPID_PUBLIC_KEY;
  return typeof key === "string" ? key.trim() : "";
}

function pushReady(): boolean {
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return (
    vapidPublicKey() !== "" &&
    typeof priv === "string" &&
    priv.trim() !== "" &&
    typeof subject === "string" &&
    subject.trim() !== ""
  );
}

function emailSupported(): boolean {
  return emailConfigured(process.env.RESEND_API_KEY);
}

/* ===== gathering ===== */

async function prefsRow(ctx: QueryCtx, userId: Id<"tm_users">) {
  return await ctx.db
    .query("tm_reminderPrefs")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

async function prefsFor(ctx: QueryCtx, userId: Id<"tm_users">): Promise<ReminderPrefs> {
  const row = await prefsRow(ctx, userId);
  if (row === null) return normalisePrefs(null);
  return normalisePrefs({
    enabled: row.enabled,
    quietFrom: row.quietFrom,
    quietTo: row.quietTo,
    doses: row.doses,
    supply: row.supply,
    checkins: row.checkins,
    maxPerDay: row.maxPerDay,
    email: row.email,
  });
}

function toStackItem(r: Doc<"tm_protocolItems">): StackItem {
  return {
    id: r._id,
    name: r.name,
    kind: r.kind,
    dose: r.dose,
    unit: r.unit,
    route: r.route,
    timings: r.timings,
    scheduleType: r.scheduleType,
    weekdays: r.weekdays,
    intervalDays: r.intervalDays,
    cycleOnWeeks: r.cycleOnWeeks,
    cycleOffWeeks: r.cycleOffWeeks,
    startDate: r.startDate,
    endDate: r.endDate,
    withFood: r.withFood,
    evidence: r.evidence,
    cautions: r.cautions,
    note: r.note,
    recon: r.recon,
    active: r.active,
  };
}

/**
 * Everything the reminder rules need for one person on one date. Deliberately
 * the same sources the Stack, Supply and Today tabs read, so a reminder can
 * never describe a state the app is not showing.
 */
async function gather(ctx: QueryCtx, user: Doc<"tm_users">, date: string) {
  const itemRows = await ctx.db
    .query("tm_protocolItems")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_ITEMS);
  const items = itemRows.map(toStackItem);

  const doseRows = await ctx.db
    .query("tm_doseLogs")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
    .take(MAX_DOSE_LOGS);
  const logs: DoseLog[] = doseRows.map((r) => ({
    itemId: r.itemId,
    date: r.date,
    timing: r.timing,
    taken: r.taken,
    site: r.site,
  }));

  const supplyRows = await ctx.db
    .query("tm_supply")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_SUPPLY);
  const supply: SupplyRow[] = supplyRows.map((r) => ({
    itemId: r.itemId,
    onHand: r.onHand,
    unitsPerDose: r.unitsPerDose,
    packSize: r.packSize,
    lastCountedDate: r.lastCountedDate,
    reorderLeadDays: r.reorderLeadDays,
    scriptExpiryDate: r.scriptExpiryDate,
    repeatsRemaining: r.repeatsRemaining,
  }));

  const assessmentRows = await ctx.db
    .query("tm_assessments")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_ASSESSMENTS);
  // Only instruments already on the file, and only the most recent of each.
  // A notification is never the place a new questionnaire is introduced.
  const lastByInstrument = new Map<string, string>();
  for (const a of assessmentRows) {
    const seen = lastByInstrument.get(a.instrument);
    if (seen === undefined || a.date > seen) lastByInstrument.set(a.instrument, a.date);
  }
  const assessments: AssessmentHistory[] = [...lastByInstrument].map(([instrument, lastDate]) => ({
    instrument,
    lastDate,
  }));

  const checks = await checksForDate(ctx, user._id, user.mode, date);

  return {
    items,
    doses: dosesForDate(items, logs, date),
    supply: buildSupplyView({ mode: user.mode, date, userName: user.name, items, supply, contacts: [] }).items,
    checkins: checkinsFor(checks, assessments, date, daysBetween),
  };
}

async function subscriptionRows(ctx: QueryCtx, userId: Id<"tm_users">): Promise<SubscriptionRow[]> {
  const rows = await ctx.db
    .query("tm_pushSubscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_SUBSCRIPTIONS);
  return rows.map((r) => ({
    id: r._id,
    label: r.label,
    createdDate: r.createdDate,
    lastSuccessAt: r.lastSuccessAt,
    failures: r.failures,
  }));
}

/**
 * Every capture on the file, newest day first, each with a viewable link.
 *
 * The index prefix scans one user's rows only, and `getUrl` is the only thing
 * in the app that turns a stored file into something a browser can fetch — it
 * is called here, for the owner, and nowhere else. A file that has gone comes
 * back as `null` rather than a broken image.
 */
async function captureRowsFor(ctx: QueryCtx, userId: Id<"tm_users">): Promise<CaptureRow[]> {
  const rows = await ctx.db
    .query("tm_captures")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_CAPTURES);
  return await Promise.all(
    rows.map(async (r) => ({
      id: r._id as string,
      date: r.date,
      kind: r.kind,
      url: await ctx.storage.getUrl(r.storageId),
      note: r.note ?? null,
      at: r.at,
    })),
  );
}

/**
 * The confirm list, drawn entirely out of the user's own file: the doses their
 * own schedule puts on this date, and the meals already on their own plan.
 * Nothing here is inferred from an image — the capture slice has no classifier.
 */
async function captureChoices(ctx: QueryCtx, userId: Id<"tm_users">, date: string, items: StackItem[]) {
  const meals = await ctx.db
    .query("tm_mealEntries")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .take(MAX_ITEMS);
  return {
    items: doseChoices(items, date),
    foods: mealChoices(
      meals.map((m) => ({
        id: m._id as string,
        name: foodByKey(m.foodKey)?.name ?? m.foodKey,
        slot: m.slot,
      })),
    ),
  };
}

/* ===== the view ===== */

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }): Promise<RemindView> => {
    const user = await requireUser(ctx, token);
    const { items, doses, supply, checkins } = await gather(ctx, user, date);
    const { items: choiceItems, foods } = await captureChoices(ctx, user._id, date, items);
    return buildRemindView({
      mode: user.mode,
      date,
      prefs: await prefsFor(ctx, user._id),
      subscriptions: await subscriptionRows(ctx, user._id),
      capture: buildCaptureView({
        mode: user.mode,
        date,
        captures: await captureRowsFor(ctx, user._id),
        items: choiceItems,
        foods,
        a11y: user.a11yProfile ?? "standard",
      }),
      doses,
      supply,
      checkins,
      pushReady: pushReady(),
      emailSupported: emailSupported(),
      vapidPublicKey: vapidPublicKey(),
      demo: false,
    });
  },
});

/* ===== subscriptions ===== */

/**
 * One row per device, keyed on the endpoint the browser minted. Re-saving the
 * same endpoint refreshes it and clears the failure count rather than piling up
 * duplicates — a browser hands out the same endpoint on every page load.
 */
export const saveSubscription = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    label: v.string(),
  },
  handler: async (ctx, { token, date, endpoint, p256dh, auth, label }) => {
    const user = await requireUser(ctx, token);
    const cleanEndpoint = endpoint.trim();
    if (cleanEndpoint === "" || p256dh.trim() === "" || auth.trim() === "") {
      throw new ConvexError("bad-subscription");
    }
    const cleanLabel = label.trim().slice(0, MAX_LABEL) || "This device";

    const existing = await ctx.db
      .query("tm_pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", cleanEndpoint))
      .unique();

    if (existing !== null) {
      // An endpoint is a capability, not a name: if it is already on someone
      // else's file, the caller does not get to claim it.
      if (existing.userId !== user._id) throw new ConvexError("not-your-subscription");
      await ctx.db.patch("tm_pushSubscriptions", existing._id, {
        p256dh,
        auth,
        label: cleanLabel,
        failures: 0,
      });
      return null;
    }

    const mine = await ctx.db
      .query("tm_pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_SUBSCRIPTIONS);
    if (mine.length >= MAX_SUBSCRIPTIONS) throw new ConvexError("too-many-devices");

    await ctx.db.insert("tm_pushSubscriptions", {
      userId: user._id,
      endpoint: cleanEndpoint,
      p256dh,
      auth,
      label: cleanLabel,
      createdDate: date,
      failures: 0,
    });
    return null;
  },
});

/** Turning it off on a device removes the row outright. No tombstone, no residue. */
export const removeSubscription = mutation({
  args: { token: v.string(), endpoint: v.string() },
  handler: async (ctx, { token, endpoint }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db
      .query("tm_pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint.trim()))
      .unique();
    if (row === null) return null;
    if (row.userId !== user._id) throw new ConvexError("not-your-subscription");
    await ctx.db.delete("tm_pushSubscriptions", row._id);
    return null;
  },
});

/* ===== preferences ===== */

export const setPrefs = mutation({
  args: {
    token: v.string(),
    enabled: v.optional(v.boolean()),
    quietFrom: v.optional(v.string()),
    quietTo: v.optional(v.string()),
    doses: v.optional(v.boolean()),
    supply: v.optional(v.boolean()),
    checkins: v.optional(v.boolean()),
    maxPerDay: v.optional(v.number()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...patch }) => {
    const user = await requireUser(ctx, token);
    const existing = await prefsRow(ctx, user._id);
    const base = await prefsFor(ctx, user._id);
    // Every value is normalised before it is stored, so a malformed quiet
    // window can never become a rule that silences everything.
    const next = normalisePrefs(patch, base);
    if (existing === null) await ctx.db.insert("tm_reminderPrefs", { userId: user._id, ...next });
    else await ctx.db.patch("tm_reminderPrefs", existing._id, next);
    return null;
  },
});

/* ===== captures =====
   A photo is evidence attached to something you logged. It is never an
   identification: nothing here reads the image, matches a tablet, or infers
   what was taken. It is stored, listed and deletable, and that is all. */

export const saveCapture = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    kind: captureKind,
    storageId: v.id("_storage"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, date, kind, storageId, note }): Promise<null> => {
    const user = await requireUser(ctx, token);
    // A day's worth of evidence, not a camera roll — the same ceiling the
    // captures screen shows, enforced where it actually binds.
    const today = await ctx.db
      .query("tm_captures")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(MAX_CAPTURES_PER_DAY + 1);
    if (!canSaveCapture(today.length)) throw new ConvexError("capture-limit");

    const trimmed = normaliseCaptureNote(note);
    await ctx.db.insert("tm_captures", {
      userId: user._id,
      date,
      kind,
      storageId,
      ...(trimmed !== undefined ? { note: trimmed } : {}),
      at: Date.now(),
    });
    return null;
  },
});

export const removeCapture = mutation({
  args: { token: v.string(), captureId: v.id("tm_captures") },
  handler: async (ctx, { token, captureId }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db.get("tm_captures", captureId);
    if (row === null || row.userId !== user._id) throw new ConvexError("not-your-capture");
    // The file goes with the row. A deleted photo that survives in storage is
    // not deleted, whatever the list says.
    await ctx.db.delete("tm_captures", captureId);
    await ctx.storage.delete(row.storageId);
    return null;
  },
});

/** Upload URL for a capture. Session-scoped, so an anonymous caller gets nothing. */
export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<string> => {
    await requireUser(ctx, token);
    return await ctx.storage.generateUploadUrl();
  },
});

/* ===== the server sweep =====
   Internal only. The cron in convex/crons.ts asks what should go out in the
   slice of the day that has just elapsed, sends it, and reports back. */

export type SweepNotification = {
  key: string;
  title: string;
  body: string;
  tab: string;
  tag: string;
};

export type SweepTarget = {
  subscriptionId: Id<"tm_pushSubscriptions">;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type SweepBatch = {
  userId: Id<"tm_users">;
  notifications: SweepNotification[];
  targets: SweepTarget[];
  email: string;
};

/**
 * What should be sent right now, for everyone who has reminders on.
 *
 * `nowMs` is an argument rather than a clock read: a query is not rerun because
 * time passed, so a query that reads `Date.now()` returns whatever it cached.
 * The cron owns the clock.
 */
export const sweepPlan = internalQuery({
  args: { nowMs: v.number(), windowMinutes: v.number() },
  handler: async (ctx, { nowMs, windowMinutes }): Promise<SweepBatch[]> => {
    const prefsRows = await ctx.db.query("tm_reminderPrefs").take(MAX_SWEEP_USERS);
    const { date, time } = localNow(nowMs, APP_TIMEZONE);
    const batches: SweepBatch[] = [];

    for (const row of prefsRows) {
      if (!row.enabled) continue;
      const user = await ctx.db.get("tm_users", row.userId);
      if (user === null) continue;

      const subs = await ctx.db
        .query("tm_pushSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(MAX_SUBSCRIPTIONS);
      const targets: SweepTarget[] = subs
        .filter((s) => s.failures < MAX_CONSECUTIVE_FAILURES)
        .map((s) => ({ subscriptionId: s._id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
      const prefs = await prefsFor(ctx, user._id);
      if (targets.length === 0 && prefs.email === "") continue;
      const { doses, supply, checkins } = await gather(ctx, user, date);

      // Anything that was already due earlier today counts against the day's
      // budget, so a sweep late in the evening cannot spend it all over again.
      const earlier = planReminders({
        mode: user.mode,
        prefs,
        doses,
        supply,
        checkins,
        now: { date, time, windowMinutes: 24 * 60 },
      }).send.filter((r) => r.at < time);

      const plan = planReminders({
        mode: user.mode,
        prefs,
        doses,
        supply,
        checkins,
        now: { date, time, windowMinutes },
        sent: earlier.map((r) => ({ key: r.key, at: nowMs })),
      });
      if (plan.send.length === 0) continue;

      batches.push({
        userId: user._id,
        // The words came from the same `copyFor` the tab previews, so what
        // lands on the lock screen is exactly what the preview promised.
        notifications: plan.send.map((r) => ({
          key: r.key,
          title: r.title,
          body: r.body,
          tab: r.tab,
          tag: `${r.kind}:${r.tab}`,
        })),
        targets,
        email: prefs.email,
      });
    }

    return batches;
  },
});

/**
 * A subscription that fails repeatedly is dropped, not retried forever. Push
 * services return 404/410 for an endpoint that is gone; anything else is
 * counted, and three consecutive failures retire the device.
 */
export const recordDelivery = internalMutation({
  args: {
    results: v.array(
      v.object({
        subscriptionId: v.id("tm_pushSubscriptions"),
        ok: v.boolean(),
        gone: v.optional(v.boolean()),
      }),
    ),
    atMs: v.number(),
  },
  handler: async (ctx, { results, atMs }) => {
    for (const r of results) {
      const row = await ctx.db.get("tm_pushSubscriptions", r.subscriptionId);
      if (row === null) continue;
      if (r.ok) {
        await ctx.db.patch("tm_pushSubscriptions", row._id, { lastSuccessAt: atMs, failures: 0 });
        continue;
      }
      if (r.gone === true) {
        await ctx.db.delete("tm_pushSubscriptions", row._id);
        continue;
      }
      const failures = row.failures + 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        await ctx.db.delete("tm_pushSubscriptions", row._id);
      } else {
        await ctx.db.patch("tm_pushSubscriptions", row._id, { failures, lastFailureAt: atMs });
      }
    }
    return null;
  },
});

import { MODE_CHECKS, daysBetween } from "@convex/tm/lib";
import { dosesForDate, type DoseLog, type StackItem } from "@convex/tm/logicStack";
import { buildSupplyView, type SupplyRow as SupplyLogicRow } from "@convex/tm/logicSupply";
import { buildLabsView, type RawLabPanel, type RawLabResult } from "@convex/tm/logicLabs";
import type { CaptureKind } from "@convex/tm/logicCapture";
import { SWEEP_MINUTES } from "@convex/tm/logicPush";
import type { DeliverRequest } from "@convex/tm/logicEmail";
import {
  APP_TIMEZONE,
  buildRemindView,
  checkinsFor,
  localNow,
  normalisePrefs,
  planReminders,
  scriptsFor,
  type AssessmentHistory,
  type PrefsPatch,
  type SubscriptionRow,
} from "@convex/tm/logicRemind";
import { postDeliver } from "../deliver-client";
// The captures screen is the capture slice's, in both backends. This module
// carries it through; it does not keep a second copy of the rules.
import * as capture from "./capture";
import type { DemoDb } from "../demo-db";
import type { RemindData } from "../types";

/**
 * Demo mirror of convex/tm/remind.ts. Same gather, same shared logic, same
 * shape — the view type is derived from the Convex query, so any drift is a
 * build error rather than a bug.
 *
 * Delivery goes through `/api/remind` while this tab is open. The preview is
 * the same `planReminders` output the route sends. Closed-tab delivery still
 * needs Convex.
 */

function checksFor(db: DemoDb, slug: string, date: string) {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");
  const rows = db.checks.filter((c) => c.userSlug === slug && c.date === date);
  const doneByKey = new Map(rows.map((r) => [r.key, r.done]));
  return MODE_CHECKS[user.modeMut].map((c) => ({ ...c, done: doneByKey.get(c.key) ?? false }));
}

function gather(db: DemoDb, slug: string, date: string) {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const items: StackItem[] = db.protocolItems
    .filter((r) => r.userSlug === slug)
    .map(({ userSlug: _slug, ...row }) => row);

  const logs: DoseLog[] = db.doseLogs
    .filter((r) => r.userSlug === slug && r.date === date)
    .map(({ userSlug: _slug, ...row }) => row);

  const supply: SupplyLogicRow[] = db.supplyRows
    .filter((r) => r.userSlug === slug)
    .map(({ id: _id, userSlug: _slug, ...row }) => row);

  // Only instruments already on the file, most recent answer of each. A
  // reminder never introduces a questionnaire the person has not chosen.
  const lastByInstrument = new Map<string, string>();
  for (const a of db.assessments.filter((r) => r.userSlug === slug)) {
    const seen = lastByInstrument.get(a.instrument);
    if (seen === undefined || a.date > seen) lastByInstrument.set(a.instrument, a.date);
  }
  const assessments: AssessmentHistory[] = [...lastByInstrument].map(([instrument, lastDate]) => ({
    instrument,
    lastDate,
  }));

  // The same rows the Bloods tab reads, through the same view, so a recheck
  // reminder and the screen can never disagree about what is due.
  const panels: RawLabPanel[] = db.labPanels
    .filter((p) => p.userSlug === slug)
    .map((p) => ({ id: p.id, date: p.date, name: p.name, lab: p.lab ?? null, fasted: p.fasted ?? null }));
  const results: RawLabResult[] = db.labResults
    .filter((r) => r.userSlug === slug)
    .map((r) => ({
      panelId: r.panelId,
      date: r.date,
      marker: r.marker,
      value: r.value,
      unit: r.unit,
      refLow: r.refLow ?? null,
      refHigh: r.refHigh ?? null,
    }));

  const supplyView = buildSupplyView({
    mode: user.modeMut,
    date,
    userName: user.name,
    items,
    supply,
    contacts: [],
  });

  return {
    mode: user.modeMut,
    doses: dosesForDate(items, logs, date),
    // The survival floor for *reminders* is survivalFilter's decision, so the
    // rows go in unfloored — `attention` carries exactly the non-ok rows the
    // floor keeps showing, and a genuine run-out must still be able to speak.
    supply: supplyView.survival ? supplyView.attention : supplyView.items,
    checkins: checkinsFor(checksFor(db, slug, date), assessments, date, daysBetween),
    rechecks: buildLabsView({ mode: user.modeMut, date, panels, results }).dueRechecks,
    // Script standings from the raw rows, not the floored view — a script only
    // the practice can move is due a word whatever the inventory shows.
    scripts: scriptsFor(items, supply, date),
  };
}

function prefsFor(db: DemoDb, slug: string) {
  const row = db.reminderPrefs.find((p) => p.userSlug === slug);
  if (!row) return normalisePrefs(null);
  const { userSlug: _slug, ...rest } = row;
  return normalisePrefs(rest);
}

export function view(db: DemoDb, slug: string, date: string): RemindData {
  const { mode, doses, supply, checkins, rechecks, scripts } = gather(db, slug, date);

  const subscriptions: SubscriptionRow[] = db.pushSubs
    .filter((s) => s.userSlug === slug)
    .map((s) => ({ id: s.id, label: s.label, createdDate: s.createdDate, failures: s.failures }));

  return buildRemindView({
    mode,
    date,
    prefs: prefsFor(db, slug),
    subscriptions,
    capture: capture.view(db, slug, date),
    doses,
    supply,
    checkins,
    rechecks,
    scripts,
    pushReady: db.delivery.push,
    emailSupported: db.delivery.email,
    vapidPublicKey: db.delivery.vapidPublicKey,
    demo: true,
  });
}

export function buildDeliverPayload(db: DemoDb, slug: string, date: string): (DeliverRequest & { keys: string[] }) | null {
  const prefs = prefsFor(db, slug);
  if (!prefs.enabled) return null;
  const { mode, doses, supply, checkins, rechecks, scripts } = gather(db, slug, date);
  const { time } = localNow(Date.now(), APP_TIMEZONE);
  const sent = db.sentReminders.filter((s) => s.userSlug === slug).map((s) => ({ key: s.key, at: s.at }));
  const plan = planReminders({
    mode,
    prefs,
    doses,
    supply,
    checkins,
    rechecks,
    scripts,
    now: { date, time, windowMinutes: SWEEP_MINUTES },
    sent,
  });
  if (plan.send.length === 0) return null;

  const targets = db.pushSubs
    .filter((s) => s.userSlug === slug && s.failures < 3)
    .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
  if (prefs.email === "" && targets.length === 0) return null;

  return {
    email: prefs.email,
    targets,
    notifications: plan.send.map((r) => ({
      title: r.title,
      body: r.body,
      tab: r.tab,
      tag: `${r.kind}:${r.tab}`,
    })),
    keys: plan.send.map((r) => r.key),
  };
}

export async function sweepOpenTab(db: DemoDb, slug: string, date: string): Promise<void> {
  const payload = buildDeliverPayload(db, slug, date);
  if (payload === null) return;
  const { keys, ...body } = payload;
  const ok = await postDeliver(body);
  if (!ok) return;
  const at = Date.now();
  for (const key of keys) db.sentReminders.push({ userSlug: slug, key, at });
}

export function saveSubscription(
  db: DemoDb,
  slug: string,
  date: string,
  sub: { endpoint: string; p256dh: string; auth: string; label: string },
): void {
  const endpoint = sub.endpoint.trim();
  if (endpoint === "" || sub.p256dh.trim() === "" || sub.auth.trim() === "") {
    throw new Error("bad-subscription");
  }
  const label = sub.label.trim().slice(0, 60) || "This device";

  const existing = db.pushSubs.find((s) => s.endpoint === endpoint);
  if (existing) {
    // An endpoint is a capability, not a name — it stays with whoever holds it.
    if (existing.userSlug !== slug) throw new Error("not-your-subscription");
    existing.p256dh = sub.p256dh;
    existing.auth = sub.auth;
    existing.label = label;
    existing.failures = 0;
    return;
  }
  db.pushSubs.push({
    id: db.newId("ps"),
    userSlug: slug,
    endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    label,
    createdDate: date,
    failures: 0,
  });
}

export function removeSubscription(db: DemoDb, endpoint: string): void {
  const trimmed = endpoint.trim();
  db.pushSubs = db.pushSubs.filter((s) => s.endpoint !== trimmed);
}

export function setPrefs(db: DemoDb, slug: string, prefs: PrefsPatch): void {
  const existing = db.reminderPrefs.find((p) => p.userSlug === slug);
  const base = prefsFor(db, slug);
  const next = normalisePrefs(prefs, base);
  if (existing) Object.assign(existing, next);
  else db.reminderPrefs.push({ userSlug: slug, ...next });
}

/* The capture mutations are wired here because backend.tsx wires them here.
   The rules are the capture slice's, in both backends. */

export function saveCapture(
  db: DemoDb,
  slug: string,
  date: string,
  kind: CaptureKind,
  storageId: string,
  note?: string,
): void {
  capture.saveCapture(db, slug, date, kind, storageId, note);
}

export function removeCapture(db: DemoDb, captureId: string): void {
  capture.removeCapture(db, captureId);
}

import { MODE_CHECKS, daysBetween } from "@convex/tm/lib";
import { dosesForDate, type DoseLog, type StackItem } from "@convex/tm/logicStack";
import { buildSupplyView, type SupplyRow as SupplyLogicRow } from "@convex/tm/logicSupply";
import type { CaptureKind } from "@convex/tm/logicCapture";
import {
  buildRemindView,
  checkinsFor,
  normalisePrefs,
  type AssessmentHistory,
  type PrefsPatch,
  type SubscriptionRow,
} from "@convex/tm/logicRemind";
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
 * One deliberate difference, and it is the honest one: `demo: true`. There is
 * no server behind this copy of the app, so nothing can actually be delivered.
 * The preview is real — it is computed by exactly the rules the sweep uses —
 * but the tab says plainly that nothing will fire, rather than showing a switch
 * that lies.
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

  return {
    mode: user.modeMut,
    doses: dosesForDate(items, logs, date),
    supply: buildSupplyView({
      mode: user.modeMut,
      date,
      userName: user.name,
      items,
      supply,
      contacts: [],
    }).items,
    checkins: checkinsFor(checksFor(db, slug, date), assessments, date, daysBetween),
  };
}

function prefsFor(db: DemoDb, slug: string) {
  const row = db.reminderPrefs.find((p) => p.userSlug === slug);
  if (!row) return normalisePrefs(null);
  const { userSlug: _slug, ...rest } = row;
  return normalisePrefs(rest);
}

export function view(db: DemoDb, slug: string, date: string): RemindData {
  const { mode, doses, supply, checkins } = gather(db, slug, date);

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
    // No server, no keys, no delivery. Said out loud rather than implied.
    serverReady: false,
    vapidPublicKey: "",
    demo: true,
  });
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

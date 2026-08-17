import { MODE_CHECKS, type TmMode } from "./lib";
import { cleanEmail } from "./logicEmail";
// The captures screen is its own slice: what a photo means, what may label it,
// and what is never shared all live there. Reminders only carry the finished
// view through, so there is exactly one set of rules about photos in the app.
import type { CaptureView as CaptureScreenView } from "./logicCapture";
// The script rules are the supply slice's. Reminders ask the same question the
// refill sheet asks — who can move this prescription — and never re-derive it.
import { scriptStatus, type SupplyRow as RawSupplyRow } from "./logicSupply";

/**
 * Reminders — the product judgement, in one pure file.
 *
 * The app has promised reminders since Wave 1 and could not send one. The hard
 * part was never the transport; it is deciding what is worth interrupting a
 * person for. That decision lives here, deterministically, so both backends and
 * the server sweep agree, and so every rule below is a test rather than a hope.
 *
 * Four rules the whole module exists to keep:
 *
 *  1. **Never remind about something already done.** A dose that is logged, a
 *     check that is ticked, a box that is full — these are silent. A reminder
 *     for work already finished teaches people the app is not paying attention.
 *  2. **Quiet hours are absolute.** Nothing fires inside them, whatever is due,
 *     including a window that crosses midnight.
 *  3. **A missed thing is mentioned once.** Never escalated, never repeated
 *     into a pile. Alarm fatigue is how people stop reading reminders, and a
 *     reminder nobody reads is worse than no reminder at all.
 *  4. **Survival is a floor.** In survival mode only the floor's three checks
 *     and a genuine run-out may speak. Everything else stays on its own screen —
 *     nothing is stopped, nothing is hidden, the app simply stops paging you.
 *
 * Nothing here diagnoses or prescribes. A reminder repeats back only what the
 * person already configured: their own schedule, their own count, their own
 * checks. It never proposes a dose, a change, or a clinical interpretation.
 */

/* ===== kinds and shapes ===== */

export type ReminderKind = "dose" | "supply" | "checkin" | "recheck" | "script";

/** How much of a hurry this is. Never rendered as colour alone. */
export type Severity = "normal" | "low" | "out";

export type RemindTab = "today" | "stack" | "supply" | "labs";

export type Reminder = {
  /** Stable for the day: the same due thing produces the same key. */
  key: string;
  kind: ReminderKind;
  /** What produced it — a timing, an item, a check key. Survives coalescing. */
  sourceKeys: string[];
  /** Clock time it becomes due, "HH:MM". */
  at: string;
  /** The thing being spoken about: a time of day, a name, "today's file". */
  subject: string;
  /** Specifics, already worded. `copyFor` joins these; it never computes them. */
  detail: string[];
  severity: Severity;
  tab: RemindTab;
};

export type ReminderCopy = { title: string; body: string };

export type ReminderCard = Reminder & ReminderCopy;

/* ===== preferences ===== */

export type ReminderPrefs = {
  enabled: boolean;
  /** "HH:MM". Nothing fires between quietFrom and quietTo. */
  quietFrom: string;
  quietTo: string;
  doses: boolean;
  supply: boolean;
  checkins: boolean;
  /** A blood recheck the person's own results say is due. */
  rechecks: boolean;
  /** A prescription that is running out of road — expiry, or no repeats. */
  scripts: boolean;
  /** Ceiling on notifications in a day. A pile is not a reminder system. */
  maxPerDay: number;
  /** Delivery address. Empty means email is not a channel for this file. */
  email: string;
};

/**
 * Off until asked for. A notification permission the person did not seek is a
 * permission they will deny, and a denial is expensive to undo on iOS.
 */
export const DEFAULT_PREFS: ReminderPrefs = {
  enabled: false,
  quietFrom: "22:30",
  quietTo: "07:00",
  doses: true,
  supply: true,
  checkins: true,
  rechecks: true,
  scripts: true,
  maxPerDay: 4,
  email: "",
};

export const MIN_PER_DAY = 1;
export const MAX_PER_DAY = 8;

export type PrefsPatch = {
  enabled?: boolean;
  quietFrom?: string;
  quietTo?: string;
  doses?: boolean;
  supply?: boolean;
  checkins?: boolean;
  rechecks?: boolean;
  scripts?: boolean;
  maxPerDay?: number;
  email?: string;
};

/** A stored row, a partial patch and nothing at all all land on the same shape. */
export function normalisePrefs(patch: PrefsPatch | null | undefined, base = DEFAULT_PREFS): ReminderPrefs {
  const p = patch ?? {};
  return {
    enabled: p.enabled ?? base.enabled,
    quietFrom: cleanTime(p.quietFrom ?? base.quietFrom, DEFAULT_PREFS.quietFrom),
    quietTo: cleanTime(p.quietTo ?? base.quietTo, DEFAULT_PREFS.quietTo),
    doses: p.doses ?? base.doses,
    supply: p.supply ?? base.supply,
    checkins: p.checkins ?? base.checkins,
    rechecks: p.rechecks ?? base.rechecks,
    scripts: p.scripts ?? base.scripts,
    maxPerDay: clampInt(p.maxPerDay ?? base.maxPerDay, MIN_PER_DAY, MAX_PER_DAY),
    email: cleanEmail(p.email ?? base.email),
  };
}

/* ===== the inputs, kept structural ===== */

/** A `DoseView` from logicStack satisfies this without conversion. */
export type DueDose = { itemId: string; name: string; timing: string; taken: boolean };

/** A `SupplyItemView` from logicSupply satisfies this without conversion. */
export type DueSupply = {
  itemId: string;
  name: string;
  status: "ok" | "order-now" | "urgent" | "out";
  daysRemaining: number;
  reorderLeadDays: number;
};

/** A daily check or a periodic instrument already on the file — never a new one. */
export type DueCheckin = { key: string; label: string; done: boolean; at: string };

/** A `RecheckView` from logicLabs satisfies this without conversion. Already due. */
export type DueRecheck = {
  marker: string;
  name: string;
  lastDate: string;
  dueDate: string;
  overdueDays: number;
};

/** A prescription's standing, as `scriptStatus` from logicSupply reads it. */
export type DueScript = {
  itemId: string;
  name: string;
  repeatsRemaining: number | null;
  scriptExpiryDate: string | null;
  daysToExpiry: number | null;
  expired: boolean;
  expiringSoon: boolean;
};

/**
 * The script standing of every item that actually has a script on the file.
 * Built from the same raw rows and the same `scriptStatus` the refill sheet
 * uses, so a reminder can never claim a repeat the sheet does not.
 */
export function scriptsFor(
  items: { id: string; name: string; active: boolean }[],
  supply: RawSupplyRow[],
  date: string,
): DueScript[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: DueScript[] = [];
  for (const row of supply) {
    const item = byId.get(row.itemId);
    // A paused item is not an obligation; a row with no script fields has no
    // script to speak about.
    if (!item || !item.active) continue;
    const s = scriptStatus(row, date);
    if (!s.hasScript) continue;
    out.push({
      itemId: row.itemId,
      name: item.name,
      repeatsRemaining: s.repeatsRemaining,
      scriptExpiryDate: s.scriptExpiryDate,
      daysToExpiry: s.daysToExpiry,
      expired: s.expired,
      expiringSoon: s.expiringSoon,
    });
  }
  return out;
}

export type Now = {
  date: string;
  /** "HH:MM" local wall clock. */
  time: string;
  /** How far back the caller is willing to look. A sweep passes its interval. */
  windowMinutes: number;
};

/* ===== when things are due ===== */

/**
 * Wall-clock times for the four timings the stack uses. These are the app's
 * defaults, not a clinical schedule: they say when to *ask*, never when a dose
 * must be taken. `pre-bed` sits before the default quiet window on purpose —
 * a bedtime reminder that lands inside quiet hours is a reminder that never fires.
 */
export const TIMING_AT: Record<string, string> = {
  am: "08:00",
  "pre-workout": "17:00",
  pm: "18:30",
  "pre-bed": "21:30",
};
export const DEFAULT_DOSE_AT = "12:00";
export const SUPPLY_AT = "09:30";
/** Same errand as supply — a phone call in office hours — so the same slot. */
export const SCRIPT_AT = "09:30";
/** Half an hour after the supply slot, so two mornings' worth never lands as one buzz-pile. */
export const RECHECK_AT = "10:00";
export const CHECKIN_AT = "19:00";

const TIMING_WORD: Record<string, string> = {
  am: "morning",
  "pre-workout": "pre-workout",
  pm: "evening",
  "pre-bed": "bedtime",
};

export function timingWord(timing: string): string {
  return TIMING_WORD[timing] ?? timing;
}

/* ===== time helpers ===== */

const MINUTES_IN_DAY = 24 * 60;

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Minutes since local midnight. An unparseable time is treated as midnight. */
export function minutesOf(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (m === null) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return 0;
  return clampInt(h, 0, 23) * 60 + clampInt(min, 0, 59);
}

function cleanTime(time: string, fallback: string): string {
  if (!/^(\d{1,2}):(\d{2})$/.test(time.trim())) return fallback;
  const mins = minutesOf(time);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Local date and time for a timestamp, in a named zone.
 *
 * Timezone data is not guaranteed in every runtime this file is bundled into,
 * so an unsupported zone degrades to UTC rather than throwing. A reminder an
 * hour out is a nuisance; a sweep that crashes sends nothing to anybody.
 */
export function localNow(ms: number, timeZone: string): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ms));
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = pick("year");
    const month = pick("month");
    const day = pick("day");
    // "24" is a legal hour12:false rendering of midnight in some ICU versions.
    const hour = pick("hour") === "24" ? "00" : pick("hour");
    const minute = pick("minute");
    if (year === "" || month === "" || day === "" || hour === "" || minute === "") throw new Error("bad-parts");
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
  } catch {
    const d = new Date(ms);
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}

/** The app's assumed wall clock. There is no per-user timezone on the file yet. */
export const APP_TIMEZONE = "Europe/Dublin";

/* ===== quiet hours ===== */

/**
 * True when `time` sits inside the quiet window, including a window that wraps
 * midnight (22:30 → 07:00). A window whose ends are equal is not a window —
 * it silences nothing, rather than silencing everything, because a preference
 * saved by a mis-tap should never mute a person's medication reminders.
 */
export function inQuietHours(prefs: ReminderPrefs, time: string): boolean {
  const from = minutesOf(prefs.quietFrom);
  const to = minutesOf(prefs.quietTo);
  if (from === to) return false;
  const t = minutesOf(time);
  return from < to ? t >= from && t < to : t >= from || t < to;
}

/* ===== what is due ===== */

function inWindow(at: string, now: Now): boolean {
  const t = minutesOf(now.time);
  const window = clampInt(now.windowMinutes, 1, MINUTES_IN_DAY);
  const a = minutesOf(at);
  return a <= t && a > t - window;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function days(n: number): string {
  return `${n} ${plural(n, "day", "days")}`;
}

/**
 * Everything that should speak right now, given what is already done.
 *
 * `now.windowMinutes` is how the "once, never repeated" rule is kept without a
 * sent-log: a sweep asks only for the slice of the day that has just elapsed,
 * so each due thing falls inside exactly one sweep. Pass a full day to preview
 * everything that would have fired.
 */
export function dueReminders(
  prefs: ReminderPrefs,
  doses: DueDose[],
  supply: DueSupply[],
  checkins: DueCheckin[],
  now: Now,
  rechecks: DueRecheck[] = [],
  scripts: DueScript[] = [],
): Reminder[] {
  if (!prefs.enabled) return [];
  const out: Reminder[] = [];

  if (prefs.doses) {
    for (const dose of doses) {
      // Rule 1: what is logged is silent.
      if (dose.taken) continue;
      const at = TIMING_AT[dose.timing] ?? DEFAULT_DOSE_AT;
      if (!inWindow(at, now)) continue;
      out.push({
        key: `dose:${now.date}:${dose.timing}:${dose.itemId}`,
        kind: "dose",
        sourceKeys: [`${dose.itemId}:${dose.timing}`],
        at,
        subject: timingWord(dose.timing),
        detail: [dose.name],
        severity: "normal",
        tab: "stack",
      });
    }
  }

  if (prefs.supply) {
    for (const row of supply) {
      if (row.status === "ok") continue;
      if (!inWindow(SUPPLY_AT, now)) continue;
      const severity: Severity = row.status === "out" ? "out" : row.status === "urgent" ? "low" : "normal";
      const detail =
        severity === "out"
          ? [`${row.name} — none left`]
          : [`${row.name} — about ${days(row.daysRemaining)} left`, `a refill takes about ${days(row.reorderLeadDays)}`];
      out.push({
        key: `supply:${now.date}:${row.itemId}`,
        kind: "supply",
        sourceKeys: [row.itemId],
        at: SUPPLY_AT,
        subject: row.name,
        detail,
        severity,
        tab: "supply",
      });
    }
  }

  if (prefs.scripts) {
    for (const row of scripts) {
      // Rule 1's shape here: a script with repeats left and time on it is fine,
      // and fine is silent.
      const blocked = row.expired || row.repeatsRemaining === 0;
      if (!blocked && !row.expiringSoon) continue;
      if (!inWindow(SCRIPT_AT, now)) continue;
      const detail =
        row.repeatsRemaining === 0 && row.expired
          ? [`${row.name} — no repeats left and the script ran out ${row.scriptExpiryDate}`]
          : row.repeatsRemaining === 0
            ? [`${row.name} — no repeats left on the script`]
            : row.expired
              ? [`${row.name} — the script ran out ${row.scriptExpiryDate}`]
              : [`${row.name} — the script runs out ${row.scriptExpiryDate}`];
      out.push({
        key: `script:${now.date}:${row.itemId}`,
        kind: "script",
        sourceKeys: [row.itemId],
        at: SCRIPT_AT,
        subject: row.name,
        detail,
        // Blocked means only the practice can move it — the pharmacy-sized
        // problem is "low"; a script merely nearing its date is routine.
        severity: blocked ? "low" : "normal",
        tab: "supply",
      });
    }
  }

  if (prefs.rechecks) {
    for (const row of rechecks) {
      // The rows arrive already due — the labs view filtered them — but a
      // not-yet-due row handed in by mistake must stay silent.
      if (row.overdueDays <= 0) continue;
      if (!inWindow(RECHECK_AT, now)) continue;
      out.push({
        key: `recheck:${now.date}:${row.marker}`,
        kind: "recheck",
        sourceKeys: [row.marker],
        at: RECHECK_AT,
        subject: row.name,
        detail: [`${row.name} — last drawn ${row.lastDate}`],
        severity: "normal",
        tab: "labs",
      });
    }
  }

  if (prefs.checkins) {
    for (const check of checkins) {
      if (check.done) continue;
      const at = cleanTime(check.at, CHECKIN_AT);
      if (!inWindow(at, now)) continue;
      out.push({
        key: `checkin:${now.date}:${check.key}`,
        kind: "checkin",
        sourceKeys: [check.key],
        at,
        subject: "today's file",
        detail: [check.label],
        severity: "normal",
        tab: "today",
      });
    }
  }

  return sortReminders(out);
}

/**
 * A dose reminder's sourceKeys are `<itemId>:<timing>` — the exact things it
 * spoke about, kept through coalescing. Parsed back here, and only here, so
 * "log the dose this notification named" can never drift into a guess.
 */
export function doseSourcePairs(sourceKeys: string[]): { itemId: string; timing: string }[] {
  const out: { itemId: string; timing: string }[] = [];
  for (const key of sourceKeys) {
    const split = key.indexOf(":");
    if (split <= 0 || split === key.length - 1) continue;
    out.push({ itemId: key.slice(0, split), timing: key.slice(split + 1) });
  }
  return out;
}

export function sortReminders(rows: Reminder[]): Reminder[] {
  return [...rows].sort((a, b) => minutesOf(a.at) - minutesOf(b.at) || a.key.localeCompare(b.key));
}

/* ===== fewer, larger notifications ===== */

/**
 * Merge everything that would arrive at the same moment about the same kind of
 * thing into one notification. Three tablets at 08:00 is one buzz that lists
 * three names, not three buzzes — the same information, a third of the
 * interruption.
 */
export function coalesce(rows: Reminder[]): Reminder[] {
  const groups = new Map<string, Reminder[]>();
  for (const r of sortReminders(rows)) {
    const bucket = `${r.kind}|${r.at}|${r.severity}|${r.tab}`;
    const list = groups.get(bucket);
    if (list) list.push(r);
    else groups.set(bucket, [r]);
  }

  const merged: Reminder[] = [];
  for (const list of groups.values()) {
    const first = list[0];
    if (first === undefined) continue;
    if (list.length === 1) {
      merged.push(first);
      continue;
    }
    const sources = list.flatMap((r) => r.sourceKeys).sort();
    merged.push({
      // Deterministic for the same set of due things, so a sweep that has
      // already sent this group recognises it rather than sending it twice.
      key: `${first.kind}:${first.at}:${first.severity}:${sources.join("+")}`,
      kind: first.kind,
      sourceKeys: sources,
      at: first.at,
      // Doses share a time-of-day subject; supply rows, scripts and rechecks
      // are named things, so the merged subject names them all rather than
      // inventing a category word.
      subject: NAMED_SUBJECT_KINDS.has(first.kind)
        ? joinNames(list.map((r) => r.subject))
        : first.subject,
      detail: list.flatMap((r) => r.detail),
      severity: first.severity,
      tab: first.tab,
    });
  }
  return sortReminders(merged);
}

const NAMED_SUBJECT_KINDS = new Set<ReminderKind>(["supply", "script", "recheck"]);

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/* ===== the once-only rule ===== */

export type SentReminder = { key: string; at: number };

/**
 * A missed thing is mentioned once.
 *
 * Anything whose key has already gone out today is dropped outright — never
 * re-sent, never escalated into a louder second copy. What is left is capped at
 * the day's remaining budget, in due order, so the earliest thing wins rather
 * than the noisiest.
 */
export function throttle(reminders: Reminder[], sent: SentReminder[], maxPerDay: number): Reminder[] {
  const cap = clampInt(maxPerDay, 0, MAX_PER_DAY);
  const already = new Set(sent.map((s) => s.key));
  const fresh = sortReminders(reminders).filter((r) => !already.has(r.key));
  const budget = Math.max(0, cap - already.size);
  return fresh.slice(0, budget);
}

/* ===== the floor ===== */

const SURVIVAL_FLOOR_KEYS = new Set(MODE_CHECKS.survival.map((c) => c.key));

export const SURVIVAL_REMIND_NOTE =
  "In survival mode the app only pages you about the three checks, about something genuinely running out, and about a prescription the pharmacy can no longer repeat. Everything else — your doses, your panels, your plan — is still on its own screen, unchanged. Fewer interruptions, not less care.";

/**
 * Survival is a floor, not a lite mode. The floor's three checks may speak, and
 * so may a genuine run-out, because running out of a medicine is the one thing
 * a quiet week cannot fix on its own. A script only the practice can move is
 * the same category — waiting makes it a run-out. A recheck is not: the Bloods
 * screen keeps showing it, and a blood draw can wait for a better week.
 */
export function survivalFilter(reminders: Reminder[], mode: TmMode): Reminder[] {
  if (mode !== "survival") return reminders;
  return reminders.filter((r) => {
    if (r.kind === "checkin") return r.sourceKeys.some((k) => SURVIVAL_FLOOR_KEYS.has(k));
    if (r.kind === "supply") return r.severity === "out" || r.severity === "low";
    if (r.kind === "script") return r.severity === "low";
    return false;
  });
}

/* ===== the words ===== */

/**
 * Plain, kind, never scolding. "Time for your evening tablets", not "You MISSED
 * your dose!". A reminder a person dreads is a reminder they turn off, and an
 * app nobody lets speak cannot help anybody.
 *
 * No number here is a target and no sentence here is advice: the copy repeats
 * the person's own schedule and their own count back to them.
 */
export function copyFor(reminder: Reminder): ReminderCopy {
  const count = reminder.detail.length;
  switch (reminder.kind) {
    case "dose": {
      const title =
        count === 1
          ? `Time for your ${reminder.subject} dose`
          : `Time for your ${reminder.subject} doses`;
      const tail = count === 1 ? "Tap it off when it's done." : "Tap them off when they're done.";
      return { title, body: `${reminder.detail.join(", ")}. ${tail}` };
    }
    case "supply": {
      const many = reminder.sourceKeys.length > 1;
      if (reminder.severity === "out") {
        return {
          title: many ? `${reminder.subject} have run out` : `${reminder.subject} has run out`,
          body: `${reminder.detail.join(" · ")}. Your refill sheet has the number to ring.`,
        };
      }
      if (reminder.severity === "low") {
        return {
          title: many ? `${reminder.subject} are nearly gone` : `${reminder.subject} is nearly gone`,
          body: `${reminder.detail.join(" · ")}. Worth sorting today if you can.`,
        };
      }
      return {
        title: `Time to reorder ${reminder.subject}`,
        body: `${reminder.detail.join(" · ")}. Ordering now keeps you ahead of it.`,
      };
    }
    case "script": {
      const many = reminder.sourceKeys.length > 1;
      if (reminder.severity === "low") {
        return {
          title: many
            ? `Prescriptions for ${reminder.subject} need the GP`
            : `Prescription for ${reminder.subject} needs the GP`,
          body: `${reminder.detail.join(" · ")}. The pharmacy cannot repeat ${many ? "these" : "this one"} — the refill sheet has the practice's number.`,
        };
      }
      return {
        title: many
          ? `Scripts for ${reminder.subject} run out soon`
          : `The script for ${reminder.subject} runs out soon`,
        body: `${reminder.detail.join(" · ")}. Worth renewing before it bites.`,
      };
    }
    case "recheck": {
      const many = reminder.sourceKeys.length > 1;
      return {
        title: many
          ? `Blood rechecks due: ${reminder.subject}`
          : `Blood recheck due: ${reminder.subject}`,
        body: `${reminder.detail.join(" · ")}. Whenever suits — the Bloods screen has the list.`,
      };
    }
    case "checkin":
    default:
      return {
        title: "Two minutes on today's file?",
        body: `${reminder.detail.join(", ")}. Whenever suits — there's no wrong time.`,
      };
  }
}

export function withCopy(reminders: Reminder[]): ReminderCard[] {
  return reminders.map((r) => ({ ...r, ...copyFor(r) }));
}

/* ===== the whole pipeline, in the order the rules apply ===== */

export type PlanInput = {
  mode: TmMode;
  prefs: ReminderPrefs;
  doses: DueDose[];
  supply: DueSupply[];
  checkins: DueCheckin[];
  rechecks?: DueRecheck[];
  scripts?: DueScript[];
  now: Now;
  sent?: SentReminder[];
};

export type Plan = {
  /** What will actually be sent. */
  send: ReminderCard[];
  /** Due, but held back because it landed inside quiet hours. */
  quietHeld: ReminderCard[];
  /** Due, but not something survival mode lets speak. */
  survivalHeld: ReminderCard[];
  /** Due and allowed, but over the day's ceiling. */
  overCap: ReminderCard[];
};

/**
 * One function both backends and the server sweep call, so "what would fire"
 * on the Reminders tab and "what fires" at 08:00 can never disagree.
 */
export function planReminders(input: PlanInput): Plan {
  const due = coalesce(
    dueReminders(
      input.prefs,
      input.doses,
      input.supply,
      input.checkins,
      input.now,
      input.rechecks ?? [],
      input.scripts ?? [],
    ),
  );

  const awake = due.filter((r) => !inQuietHours(input.prefs, r.at));
  const quietHeld = due.filter((r) => inQuietHours(input.prefs, r.at));

  const allowed = survivalFilter(awake, input.mode);
  const allowedKeys = new Set(allowed.map((r) => r.key));
  const survivalHeld = awake.filter((r) => !allowedKeys.has(r.key));

  const send = throttle(allowed, input.sent ?? [], input.prefs.maxPerDay);
  const sendKeys = new Set(send.map((r) => r.key));
  const overCap = allowed.filter((r) => !sendKeys.has(r.key));

  return {
    send: withCopy(send),
    quietHeld: withCopy(quietHeld),
    survivalHeld: withCopy(survivalHeld),
    overCap: withCopy(overCap),
  };
}

/* ===== subscriptions ===== */

/** Consecutive failures after which a subscription is dropped, not retried forever. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export type SubscriptionRow = {
  id: string;
  label: string;
  createdDate: string;
  lastSuccessAt?: number;
  failures: number;
};

export type SubscriptionView = {
  id: string;
  label: string;
  createdDate: string;
  lastSuccessAt: number | null;
  healthy: boolean;
  /** One line about this device, in words rather than a status code. */
  line: string;
};

export function subscriptionView(row: SubscriptionRow): SubscriptionView {
  const healthy = row.failures < MAX_CONSECUTIVE_FAILURES;
  const last = row.lastSuccessAt ?? null;
  const line = !healthy
    ? "This device has stopped accepting reminders. Turn them on again there, or remove it."
    : last === null
      ? "Added, but nothing has been delivered to it yet."
      : "Reminders are reaching this device.";
  return { id: row.id, label: row.label, createdDate: row.createdDate, lastSuccessAt: last, healthy, line };
}

/* ===== the view both backends build ===== */

export const REMIND_NOTE =
  "A reminder repeats back what you already put on your file — your schedule, your count, your checks. It never decides what you should take, and it never tells anyone else. Times are the app's defaults for when to ask, not a clinical schedule.";

export const IOS_NOTE =
  "On an iPhone or iPad, notifications only work once the app is added to the Home Screen: open it in Safari, tap Share, then Add to Home Screen, and turn reminders on from there. Apple allows no other route, and there is no background timer on iOS at all — which is why the schedule runs on the server rather than in this tab.";

export const NO_KEYS_NOTE =
  "This copy of the app has no send keys configured, so it cannot send anything yet.";

export type RemindViewInput = {
  mode: TmMode;
  date: string;
  prefs: ReminderPrefs;
  subscriptions: SubscriptionRow[];
  /**
   * Already built by `buildCaptureView`, because only a backend can turn a
   * stored file into something viewable. This module never touches storage.
   */
  capture: CaptureScreenView;
  doses: DueDose[];
  supply: DueSupply[];
  checkins: DueCheckin[];
  /** Required, not optional: both backends must say what they found, even "nothing". */
  rechecks: DueRecheck[];
  scripts: DueScript[];
  /** Web-push keys are present. */
  pushReady: boolean;
  /** Resend key is present. */
  emailSupported: boolean;
  vapidPublicKey: string;
  demo: boolean;
};

export type RemindView = {
  /** Whether the *backend* can deliver. The tab overlays what the browser can do. */
  supported: boolean;
  /** Server-side inference only — the browser is the authority, and says so in the tab. */
  permission: "unknown" | "granted" | "denied";
  subscriptions: SubscriptionView[];
  prefs: ReminderPrefs;
  /** Exactly what would have fired today, in order, with its words. */
  preview: ReminderCard[];
  quietHeld: ReminderCard[];
  survivalHeld: ReminderCard[];
  overCap: ReminderCard[];
  vapidPublicKey: string;
  emailSupported: boolean;
  ready: boolean;
  /** Why reminders cannot fire yet, in plain words. Empty when they can. */
  blockers: string[];
  note: string;
  iosNote: string;
  survival: boolean;
  survivalNote: string;
  /** The visual check-in screen, whole. Never reachable through a crew scope. */
  capture: CaptureScreenView;
  date: string;
};

/** The end of the day, so a preview covers everything the day would have said. */
const WHOLE_DAY: Pick<Now, "time" | "windowMinutes"> = { time: "23:59", windowMinutes: MINUTES_IN_DAY };

export function buildRemindView(input: RemindViewInput): RemindView {
  const now: Now = { date: input.date, ...WHOLE_DAY };
  const plan = planReminders({
    mode: input.mode,
    prefs: input.prefs,
    doses: input.doses,
    supply: input.supply,
    checkins: input.checkins,
    rechecks: input.rechecks,
    scripts: input.scripts,
    now,
  });

  const subscriptions = input.subscriptions.map(subscriptionView);
  const healthy = subscriptions.filter((s) => s.healthy);
  const hasEmail = input.prefs.email !== "";
  const canPush = input.pushReady && healthy.length > 0;
  const canEmail = input.emailSupported && hasEmail;
  const supported = input.pushReady || input.emailSupported;

  const blockers: string[] = [];
  if (!supported) blockers.push(NO_KEYS_NOTE);
  if (!input.prefs.enabled) blockers.push("Reminders are switched off for your file.");
  if (!canPush && !canEmail) {
    if (hasEmail && !input.emailSupported) {
      blockers.push("An email is on the file, but this copy of the app has no email key, so mail will not go out.");
    } else if (healthy.length === 0) {
      blockers.push("No device has been set up, and no email is on the file.");
    }
  } else if (subscriptions.length > healthy.length) {
    blockers.push("One of your devices has stopped accepting reminders.");
  }

  const ready = supported && input.prefs.enabled && (canPush || canEmail);

  return {
    supported,
    permission: healthy.length > 0 ? "granted" : "unknown",
    subscriptions,
    prefs: input.prefs,
    preview: plan.send,
    quietHeld: plan.quietHeld,
    survivalHeld: plan.survivalHeld,
    overCap: plan.overCap,
    vapidPublicKey: input.vapidPublicKey,
    emailSupported: input.emailSupported,
    ready,
    blockers,
    note: REMIND_NOTE,
    iosNote: IOS_NOTE,
    survival: input.mode === "survival",
    survivalNote: SURVIVAL_REMIND_NOTE,
    capture: input.capture,
    date: input.date,
  };
}

/* ===== check-ins worth asking about ===== */

/**
 * How often an instrument already on the file is worth asking about again.
 * Long on purpose: a questionnaire that arrives weekly stops being answered
 * honestly, and this app never introduces an instrument the person has not
 * already chosen to take.
 */
export const ASSESSMENT_CADENCE_DAYS = 14;

export type AssessmentHistory = { instrument: string; lastDate: string };

/**
 * The day's check-ins: the mode's own checks, plus any instrument already on
 * the file that has not been answered inside its cadence. Nothing new is ever
 * suggested here.
 */
export function checkinsFor(
  checks: { key: string; label: string; done: boolean }[],
  assessments: AssessmentHistory[],
  date: string,
  daysBetween: (a: string, b: string) => number,
): DueCheckin[] {
  const out: DueCheckin[] = checks.map((c) => ({
    key: c.key,
    label: c.label,
    done: c.done,
    at: CHECKIN_AT,
  }));
  for (const a of assessments) {
    const age = daysBetween(a.lastDate, date);
    out.push({
      key: `instrument:${a.instrument}`,
      label: `${a.instrument} — last answered ${days(Math.max(0, age))} ago`,
      done: age < ASSESSMENT_CADENCE_DAYS,
      at: CHECKIN_AT,
    });
  }
  return out;
}

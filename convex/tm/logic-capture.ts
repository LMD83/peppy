import type { TmMode } from "./lib";
import type { MealSlot } from "./logic-fuel";
import { dueOn, timingLabel, timingRank, type StackItem } from "./logic-stack";

/**
 * Visual check-ins — evidence, never identification.
 *
 * A photo here is a receipt, not a diagnosis. Published pill-identification
 * systems get roughly one in four wrong on unfamiliar tablets, so this module
 * contains no classifier, no scorer and no inference of any kind: it never looks
 * at an image, never guesses what is in one, and never derives a fact from one.
 * The only label a capture can carry is one the user picked, from a list drawn
 * entirely out of their own configured stack and their own meal plan.
 *
 * Everything here is pure and deterministic — no Date.now(), no Math.random(),
 * no storage access. Both backends call it to build the identical view.
 */

/* ===== kinds ===== */

export type CaptureKind = "organiser" | "meal" | "dose";

export const CAPTURE_KINDS = ["organiser", "meal", "dose"] as const;

export function isCaptureKind(value: string): value is CaptureKind {
  return (CAPTURE_KINDS as readonly string[]).includes(value);
}

export type CaptureKindOption = {
  kind: CaptureKind;
  /** Plain words. What the photo is of, not what the app will do with it. */
  label: string;
  detail: string;
};

/**
 * The three things worth photographing, in the order a person reaches for them.
 * No fourth. A longer list is a menu, and a menu is the thing this replaces.
 */
export function captureKinds(): CaptureKindOption[] {
  return [
    {
      kind: "organiser",
      label: "Pill organiser",
      detail: "The box, filled — so you can look back and see it was.",
    },
    { kind: "meal", label: "A meal", detail: "A plate, as it actually was." },
    { kind: "dose", label: "A dose", detail: "The packet, the pen, the date on the box." },
  ];
}

export function captureKindLabel(kind: CaptureKind): string {
  return captureKinds().find((k) => k.kind === kind)?.label ?? "A photo";
}

/* ===== rows ===== */

export type CaptureRow = {
  id: string;
  date: string;
  kind: CaptureKind;
  /** A viewable link to the stored image, or null when it has gone. */
  url: string | null;
  /** The words the user themselves confirmed. Never written by the app. */
  note: string | null;
  at: number;
};

export type CaptureDay = { date: string; captures: CaptureRow[] };

/** Newest day first, and newest capture first inside a day. Never reorders on tie. */
export function groupByDate(captures: CaptureRow[]): CaptureDay[] {
  const byDate = new Map<string, CaptureRow[]>();
  for (const row of captures) {
    const bucket = byDate.get(row.date);
    if (bucket) bucket.push(row);
    else byDate.set(row.date, [row]);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]) => ({
      date,
      captures: [...rows].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)),
    }));
}

/* ===== the confirm list — drawn only from what the user configured ===== */

/** One dose the user has on their own stack, at one of its own timings. */
export type ConfirmItem = { id: string; name: string; timing: string };

/** One meal out of the user's own plan for the day. */
export type ConfirmFood = { id: string; name: string; slot: MealSlot | string };

export type ConfirmChoice = {
  id: string;
  /** The whole answer, in the user's own words for their own things. */
  label: string;
  detail: string | null;
};

/** Three is the list a tired person can read. A fourth answer is a search box. */
export const CONFIRM_CHOICE_LIMIT = 3;
export const EASY_CHOICE_LIMIT = 2;

/**
 * The way out. Choosing it stores the photo with no label at all — which is
 * the honest outcome when none of the offered answers is true.
 */
export const CONFIRM_ESCAPE: ConfirmChoice = {
  id: "something-else",
  label: "Something else",
  detail: "Keep the photo without a label.",
};

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? slot;
}

/**
 * The doses the user's own schedule says fall on this date, flattened one row
 * per timing. `dueOn` is the single source of truth for whether a day counts, so
 * a paused item, an off-cycle week and an every-third-day item are all treated
 * exactly as the stack tab treats them.
 */
export function doseChoices(items: StackItem[], date: string): ConfirmItem[] {
  const rows: ConfirmItem[] = [];
  for (const item of items) {
    if (!item.active || !dueOn(item, date)) continue;
    for (const timing of item.timings) {
      rows.push({ id: `${item.id}:${timing}`, name: item.name, timing });
    }
  }
  return rows.sort(
    (a, b) => timingRank(a.timing) - timingRank(b.timing) || a.name.localeCompare(b.name),
  );
}

/** The meals already on the plan for the day, in the order the day runs. */
export function mealChoices(
  entries: { id: string; name: string; slot: MealSlot | string }[],
): ConfirmFood[] {
  const order = ["breakfast", "lunch", "dinner", "snack"];
  const rank = (slot: string) => {
    const i = order.indexOf(slot);
    return i === -1 ? order.length : i;
  };
  return [...entries].sort((a, b) => rank(a.slot) - rank(b.slot) || a.name.localeCompare(b.name));
}

/**
 * The list a person picks from to say what their own photo shows.
 *
 * Every entry is something the user configured or planned. Nothing is inferred
 * from the image, and an empty list stays empty — the escape hatch is the answer
 * then, not an invented guess.
 */
export function confirmChoicesFor(
  kind: CaptureKind,
  items: ConfirmItem[],
  foods: ConfirmFood[],
  limit: number = CONFIRM_CHOICE_LIMIT,
): ConfirmChoice[] {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : CONFIRM_CHOICE_LIMIT;

  if (kind === "meal") {
    return foods
      .slice(0, cap)
      .map((f) => ({ id: f.id, label: `${slotLabel(String(f.slot))} — ${f.name}`, detail: null }));
  }

  if (kind === "dose") {
    return items
      .slice(0, cap)
      .map((i) => ({ id: i.id, label: `${i.name} — ${timingLabel(i.timing)}`, detail: null }));
  }

  // An organiser holds many things at once, so there is no single item to name.
  // What it does have is a time of day — and the times of day come straight off
  // the user's own configured timings, not out of the picture.
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.timing, (counts.get(item.timing) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => timingRank(a[0]) - timingRank(b[0]))
    .slice(0, cap)
    .map(([timing, n]) => ({
      id: `organiser:${timing}`,
      label: timingLabel(timing),
      detail: `${n} thing${n === 1 ? "" : "s"} at this time`,
    }));
}

/* ===== the note a confirmation writes ===== */

export const MAX_NOTE_LEN = 200;
export const CONFIRM_PREFIX = "You confirmed: ";

/**
 * The stored note is stamped as the user's own words, because in six months the
 * only question that matters about a photo's label is who wrote it.
 */
export function noteForChoice(choice: ConfirmChoice): string | undefined {
  if (choice.id === CONFIRM_ESCAPE.id) return undefined;
  return normaliseCaptureNote(`${CONFIRM_PREFIX}${choice.label}`);
}

export function normaliseCaptureNote(note?: string): string | undefined {
  if (note === undefined) return undefined;
  const trimmed = note.trim().slice(0, MAX_NOTE_LEN);
  return trimmed === "" ? undefined : trimmed;
}

/** What a capture is called on screen. Unlabelled says so, plainly. */
export function captureLabel(row: CaptureRow): string {
  return row.note ?? `${captureKindLabel(row.kind)} — not labelled`;
}

/* ===== the limit ===== */

/** A day's worth of evidence, not a camera roll. */
export const MAX_CAPTURES_PER_DAY = 12;

export function canSaveCapture(countToday: number, limit: number = MAX_CAPTURES_PER_DAY): boolean {
  return countToday < limit;
}

/* ===== what the user is told, in plain words ===== */

export const CAPTURE_NOTE =
  "Timento never reads a photo. It does not identify a tablet, a food or a dose — published pill-identification systems get roughly one in four wrong on tablets they have not seen before, so the only label a photo here can carry is the one you picked yourself.";

export const NEVER_SHARED =
  "Photos are never part of a crew or carer view. There is no sharing scope for them, so nobody you share adherence with can see one.";

export type RetentionNote = {
  where: string;
  sharing: string;
  deleting: string;
  care: string;
  lines: string[];
};

/** Where the photo lives and how it goes away. No euphemisms. */
export function retentionNote(): RetentionNote {
  const where =
    "Photos are stored in this app's own file storage, attached to your file and nobody else's. They are not sent to any other service and no one is asked to look at them.";
  const sharing = NEVER_SHARED;
  const deleting =
    "Delete removes the photo and its row immediately — one tap, no confirmation step, nothing kept in a bin.";
  const care =
    "A photo of a box or an organiser can also hold a name, an address, or someone else's medicine. Take the shot you actually want kept.";
  return { where, sharing, deleting, care, lines: [where, sharing, deleting, care] };
}

/* ===== the Today card ===== */

export type CaptureSummary = {
  /** False means the card renders nothing at all. */
  show: boolean;
  todayCount: number;
  latest: CaptureRow | null;
  line: string;
  detail: string;
};

/**
 * Silent unless there is something to show, and silent in the floor either way.
 * Capture is an aid; it never becomes another obligation on the Today screen.
 */
export function captureSummary(
  captures: CaptureRow[],
  date: string,
  survival: boolean = false,
): CaptureSummary {
  const today = captures
    .filter((c) => c.date === date)
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  const latest = today[0] ?? null;
  const empty: CaptureSummary = { show: false, todayCount: today.length, latest, line: "", detail: "" };
  if (survival || latest === null) return empty;

  return {
    show: true,
    todayCount: today.length,
    latest,
    line:
      today.length === 1
        ? "One photo saved today."
        : `${today.length} photos saved today.`,
    detail: captureLabel(latest),
  };
}

/* ===== the view both backends build ===== */

export type CaptureA11yProfile = "standard" | "easy";

export type CaptureViewInput = {
  mode: TmMode;
  date: string;
  captures: CaptureRow[];
  items: ConfirmItem[];
  foods: ConfirmFood[];
  a11y?: CaptureA11yProfile;
};

export type CaptureView = {
  date: string;
  /** The kinds offered. Easy mode offers one, not three smaller ones. */
  kinds: CaptureKindOption[];
  today: CaptureRow[];
  /** Every day with a capture, newest first — today included. */
  days: CaptureDay[];
  summary: CaptureSummary;
  choices: Record<CaptureKind, ConfirmChoice[]>;
  escape: ConfirmChoice;
  retention: RetentionNote;
  note: string;
  neverShared: string;
  limitPerDay: number;
  atLimit: boolean;
  /** Available in the floor, never asked for there. */
  survival: boolean;
  easy: boolean;
};

export function buildCaptureView(input: CaptureViewInput): CaptureView {
  const { date, captures, items, foods } = input;
  const survival = input.mode === "survival";
  const easy = input.a11y === "easy";
  const limit = easy ? EASY_CHOICE_LIMIT : CONFIRM_CHOICE_LIMIT;

  const days = groupByDate(captures);
  const today = days.find((d) => d.date === date)?.captures ?? [];
  const all = captureKinds();

  return {
    date,
    // Easy mode: one big button, not three small ones.
    kinds: easy ? all.slice(0, 1) : all,
    today,
    days,
    summary: captureSummary(captures, date, survival),
    choices: {
      organiser: confirmChoicesFor("organiser", items, foods, limit),
      meal: confirmChoicesFor("meal", items, foods, limit),
      dose: confirmChoicesFor("dose", items, foods, limit),
    },
    escape: CONFIRM_ESCAPE,
    retention: retentionNote(),
    note: CAPTURE_NOTE,
    neverShared: NEVER_SHARED,
    limitPerDay: MAX_CAPTURES_PER_DAY,
    atLimit: !canSaveCapture(today.length),
    survival,
    easy,
  };
}

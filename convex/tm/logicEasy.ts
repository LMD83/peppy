import type { TmMode } from "./lib";

/**
 * Easy mode — pure projection logic.
 *
 * The rule this whole file exists to enforce: **easy mode returns FEWER
 * OBJECTS, not smaller ones.** A stylesheet can make type bigger and targets
 * fatter, and Wave 1's accessibility pass already did that for everybody. What
 * a stylesheet cannot do is deliver one decision per screen — that has to
 * happen where the data is assembled, which is here, at the query boundary,
 * exactly the way survival mode already works.
 *
 * Composition with survival mode is not a special case; it falls out of the
 * order of operations. Survival has already collapsed the day to three checks
 * and removed the session before this module runs, so `easyChecks` is a no-op
 * on a survival day and `projectToday` has nothing left to strip. Where the two
 * disagree, survival wins, because every rule here only ever removes — nothing
 * in this file can put back something survival took away, and nothing here adds
 * an obligation that was not already on the file.
 *
 * Deterministic by construction: no Date.now(), no Math.random(), no ctx. Every
 * input is an argument, so tests/easy.test.ts can prove the invariants rather
 * than sample them.
 *
 * Nothing here diagnoses, prescribes, or infers that someone needs easy mode.
 * `isEasy` reads a setting the person chose in Settings. There is deliberately
 * no function in this file that looks at someone's data and recommends it.
 */

export type A11yProfile = "standard" | "easy";

/** One screen, one decision — three is the ceiling, not the target. */
export const EASY_MAX_CHECKS = 3;

/** Easy mode is offered, never applied. This reads a choice; it never makes one. */
export function isEasy(user: { a11yProfile?: A11yProfile | null } | null | undefined): boolean {
  return user?.a11yProfile === "easy";
}

export function profileOf(
  user: { a11yProfile?: A11yProfile | null } | null | undefined,
): A11yProfile {
  return isEasy(user) ? "easy" : "standard";
}

/* ===== checks ============================================================= */

export type CheckRow = { key: string; label: string; done: boolean };

/**
 * At most three checks: the ones actually due now.
 *
 * Undone first, in the order the mode defines them. Nothing is hidden
 * permanently — a check that drops off the bottom reappears the moment one
 * above it is ticked, so the full day stays reachable three at a time and easy
 * mode never quietly costs someone their adherence.
 *
 * When everything is done we return the ticked rows rather than an empty list.
 * An empty screen is a dead end, and it also removes the only way to undo a
 * mis-tap.
 */
export function easyChecks(checks: CheckRow[]): CheckRow[] {
  const due = checks.filter((c) => !c.done);
  const source = due.length > 0 ? due : checks;
  return source.slice(0, EASY_MAX_CHECKS);
}

/* ===== which cards exist at all =========================================== */

/**
 * The Today surface, in render order. The checks card is not in this list — it
 * is the one card that exists in every mode and every profile.
 */
export const TODAY_CARDS = [
  "supply",
  "stack",
  "fuel",
  "train",
  "kitchen",
  "craving",
  "state",
  "weigh",
  "mind",
  "labs",
  // Silent unless a photo was actually taken today, and silent in the floor
  // either way — see captureSummary. It never asks for anything.
  "capture",
  "winter",
] as const;

export type TodayCardId = (typeof TODAY_CARDS)[number];

/**
 * Easy mode keeps the two things that hurt most when they are missed — the
 * medicines and running out of them — plus the one number the file is built on.
 */
const EASY_CARDS: readonly TodayCardId[] = ["stack", "supply", "weigh"];

/**
 * Survival removes one more. A weigh-in is an obligation, and the floor
 * protocol's whole point is that it adds none. Medicines stay: nothing in this
 * app is ever allowed to switch off someone's medicine reminder.
 */
const EASY_SURVIVAL_CARDS: readonly TodayCardId[] = ["stack", "supply"];

/** Card list for a profile/mode pair. Standard is unchanged in both modes. */
export function easyCardOrder(profile: A11yProfile, mode: TmMode): TodayCardId[] {
  if (profile !== "easy") return [...TODAY_CARDS];
  return [...(mode === "survival" ? EASY_SURVIVAL_CARDS : EASY_CARDS)];
}

/* ===== stakes by clock ==================================================== */

/** The craving hour starts when the kitchen fight does. */
export const EVENING_FROM_HOUR = 20;
/** Scales mean nothing after breakfast. */
export const MORNING_UNTIL_HOUR = 10;

/**
 * Reorder a card list for the hour on the person's own clock.
 *
 * Reorder only: the result holds exactly the cards it was given, so every
 * removal upstream (easy, survival) survives untouched — this function cannot
 * add, drop or duplicate a card. The hour is an argument because queries stay
 *_deterministic; the client reads its own clock and passes it in. An hour
 * outside 0–23 (the server render, which has no clock) means the file order
 * stands.
 *
 * Two rules, nothing else:
 *  - evening (20:00 on): the craving card rises to sit directly under the
 *    checks card, because that is the hour it exists for.
 *  - morning (before 10:00): the weigh-in rises the same way.
 * Everything unranked keeps its file order — the sort is stable.
 */
export function todayCardOrder(cards: readonly TodayCardId[], hourOfDay: number): TodayCardId[] {
  if (!Number.isInteger(hourOfDay) || hourOfDay < 0 || hourOfDay > 23) return [...cards];
  const rank = (id: TodayCardId): number => {
    if (hourOfDay >= EVENING_FROM_HOUR && id === "craving") return -1;
    if (hourOfDay < MORNING_UNTIL_HOUR && id === "weigh") return -1;
    return 0;
  };
  return [...cards].sort((a, b) => rank(a) - rank(b));
}

/* ===== plain language ===================================================== */

/**
 * Instrument-panel vocabulary → plain words.
 *
 * House rules for every value below: under fifteen words, active voice, no
 * jargon, no clinical framing, and never an instruction about a dose. These are
 * substitutions for the reader's sake, not simplifications of what the app
 * does — the arithmetic behind "Adherence" is identical whichever word is on
 * the screen.
 */
export const plainLanguage: Record<string, string> = {
  Adherence: "How often you did it",
  Assessment: "Check-in questions",
  Bloods: "Blood tests",
  "Check-in": "Questions",
  Compound: "Medicine or supplement",
  Connect: "Scales and files",
  Craving: "Urges",
  "Trigger map": "When urges hit",
  Crew: "People helping you",
  Cut: "Losing weight",
  Dose: "One tablet or shot",
  "Hard tripwire": "Heads up",
  Instrument: "Set of questions",
  Intention: "If-then plan",
  Macros: "Food amounts",
  Maintain: "Staying the same",
  Marker: "One blood result",
  Mesocycle: "Training block",
  Mode: "How the app is set up today",
  Panel: "One set of blood tests",
  Protocol: "Your plan",
  RIR: "Reps you had left",
  Reconstitution: "Mixing the liquid",
  Session: "Workout",
  "Soft tripwire": "Heads up",
  Stack: "Medicines",
  Streak: "Days in a row",
  Supply: "What you have left",
  "Survival mode": "Bad-day mode",
  TDEE: "Energy you use in a day",
  Trend: "How it is going",
  Tripwire: "Heads up",
  Volume: "How much work you did",
};

/** Plain word for a term, or the term unchanged when we have nothing better. */
export function plain(term: string): string {
  return plainLanguage[term] ?? term;
}

/* ===== the one next action =============================================== */

export type NextAction = {
  kind: "check" | "weigh" | "rest";
  /** The check this points at, when it points at one. */
  key: string | null;
  /**
   * The thing itself — plain, never a demand, never a diagnosis, and **never
   * prefixed**. "Next" is a word each render site owns and says exactly once.
   * Baking it in here meant the scoreboard's eyebrow said it too, and Chrome
   * computed the header's accessible name as "Next: Next: 8k+ steps."
   *
   * Work that remains is a bare phrase ("8k+ steps"). Rest is a whole
   * sentence, because a finished day is a state and nothing puts "Next" in
   * front of it.
   */
  label: string;
};

/**
 * One next action, always present. "You are done" is an answer, so this never
 * returns null and easy mode never lands on a blank screen.
 */
export function nextAction(input: {
  checks: CheckRow[];
  weightLogged: boolean;
  mode: TmMode;
}): NextAction {
  const due = input.checks.find((c) => !c.done);
  if (due) return { kind: "check", key: due.key, label: due.label };
  // Survival never asks for the scales. The floor adds no obligation.
  if (input.mode !== "survival" && !input.weightLogged)
    return { kind: "weigh", key: null, label: "Weigh yourself and type the number in" };
  return { kind: "rest", key: null, label: "You are done for today. Nothing else is needed." };
}

/* ===== the projection ===================================================== */

export type TodayUser = {
  slug: string;
  name: string;
  mode: TmMode;
  protocolTitle: string;
  kitchenClose: string;
  ceilingKg: number;
  goalKg: number;
  startKg: number;
  reviewDate: string | null;
  modeSince: string;
};

export type TodaySession = {
  name: string;
  exercises: { name: string; repRange: string; lastKg: number | null; flag: string | null }[];
};

export type Tripwire = { level: "soft" | "hard"; message: string };

/** Everything the Today query assembles before any profile is applied. */
export type TodayPayload = {
  user: TodayUser;
  checks: CheckRow[];
  day: {
    weightKg: number | null;
    stress: number | null;
    energy: number | null;
    ritualDone: boolean;
    sessionDone: boolean;
  };
  latestKg: number;
  deltaKg: number;
  dayNumber: number;
  cravingsToday: { id: string; time: string; signal: string; action: string | null }[];
  stats: { adherence7: number; streak: number; todayDone: number; todayTotal: number };
  session: TodaySession | null;
  tripwire: Tripwire | null;
};

export type TodayProjection = TodayPayload & {
  a11y: { profile: A11yProfile; cards: TodayCardId[] };
  nextAction: NextAction;
};

/**
 * The tripwire, in one or two short sentences instead of a paragraph.
 *
 * The standard copy names the sub-routine, the re-anchor and the guilt clause —
 * useful to someone reading an instrument panel, a wall of text to someone who
 * is not. The number is the same number; only the sentence changed. Neither
 * version tells anyone what to do.
 */
function easyTripwire(tripwire: Tripwire, overKg: number): Tripwire {
  const over = `${Math.abs(overKg).toFixed(1)} kg over your goal weight`;
  return {
    level: tripwire.level,
    message:
      tripwire.level === "hard"
        ? `You are ${over}. Bad-day mode is ready when you want it.`
        : `You are ${over}. Nothing to do right now.`,
  };
}

/**
 * Project a Today payload for a profile.
 *
 * Standard returns the payload untouched, plus the two keys the client needs to
 * lay it out. Easy removes: the checks past the third, the whole session block,
 * the tripwire paragraph and every card outside `easyCardOrder`. `stats` is
 * deliberately NOT projected — the day's real total still counts toward
 * adherence and the scoreboard, because easy mode changes what is on the screen
 * and never what is true.
 */
export function projectToday(payload: TodayPayload, profile: A11yProfile): TodayProjection {
  const cards = easyCardOrder(profile, payload.user.mode);
  if (profile !== "easy") {
    return {
      ...payload,
      a11y: { profile, cards },
      nextAction: nextAction({
        checks: payload.checks,
        weightLogged: payload.day.weightKg !== null,
        mode: payload.user.mode,
      }),
    };
  }
  const checks = easyChecks(payload.checks);
  return {
    ...payload,
    checks,
    session: null,
    tripwire: payload.tripwire
      ? easyTripwire(payload.tripwire, payload.latestKg - payload.user.goalKg)
      : null,
    a11y: { profile, cards },
    nextAction: nextAction({
      checks: payload.checks,
      weightLogged: payload.day.weightKg !== null,
      mode: payload.user.mode,
    }),
  };
}

/* ===== next action, with a destination ==================================== */

/**
 * Where tapping the file's to-do line should land.
 *
 * The tab is always Today, and that is a finding rather than a shortcut:
 * `checksForDate` reads `tm_checks`, and the only surface in the app that
 * writes it is the Today screen's checks card. An earlier version sent
 * "session done" to Train and "ate on plan" to Fuel — screens that display
 * the work but cannot tick the box the header had just promised. Sending
 * someone where the work cannot be done is worse than not moving them.
 *
 * So what varies is not the tab but the control: `focusId` is the id of the
 * exact element the header hands the keyboard to. Null means there is
 * genuinely nothing to do, and a null destination must not render as a
 * control at all — see scoreboard.tsx.
 */
export type NextActionDestination = {
  tab: "today";
  focusId: string | null;
};

export type NextActionWithDestination = NextAction & NextActionDestination;

/**
 * The id Today puts on a check's button. Derived rather than written twice:
 * the header targets what today-tab renders, so both ends call this and the
 * two cannot drift apart. It lives beside the destination it serves, the same
 * way `tab` above names a client route without importing the client's types.
 */
export function checkAnchorId(key: string): string {
  return `tm-check-${key}`;
}

/** Today's weight field. One control, so a constant rather than a function. */
export const WEIGH_ANCHOR_ID = "tm-weigh-in";

/**
 * `nextAction`'s output, plus where tapping it should go. This never
 * recomputes what's next — it takes the same `NextAction` both profiles
 * already produce and only adds a destination on top, so the scoreboard's
 * NEXT stamp can navigate without forking the arithmetic that decided what's
 * next.
 */
export function withDestination(action: NextAction): NextActionWithDestination {
  const focusId =
    action.kind === "check" && action.key
      ? checkAnchorId(action.key)
      : action.kind === "weigh"
        ? WEIGH_ANCHOR_ID
        : null;
  return { ...action, tab: "today", focusId };
}

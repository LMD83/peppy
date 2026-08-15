import { addDays, daysBetween, type TmMode } from "./lib";
import type { CompoundKind } from "./data/compounds";
import { dueOn, scheduleLabel, type StackItem } from "./logic-stack";

/**
 * Pure supply logic — "never run out".
 *
 * Timento already knows the schedule; it has never known how many tablets are in
 * the house. This module joins the two: a physical count, the schedule that eats
 * it, and the date by which someone has to pick up a phone.
 *
 * Deterministic by construction: no Date.now(), no Math.random(). Every date is
 * an argument. The schedule is never re-derived here — `dueOn` from
 * ./logic-stack is the single source of truth for when a dose falls, so a cycle
 * that is currently off, a paused item and an every-third-day item all consume
 * exactly what the stack tab says they consume.
 *
 * Nothing here prescribes. It counts what the user counted, subtracts what the
 * user's own schedule consumes, and names the date. It never proposes a dose, a
 * quantity to order, or a change to a prescription.
 */

/* ===== the row shapes the logic works on ===== */

export type SupplyRow = {
  itemId: string;
  /** Units physically in the house at `lastCountedDate`. */
  onHand: number;
  unitsPerDose: number;
  packSize: number;
  lastCountedDate: string;
  /** Days between asking for more and having it in hand. */
  reorderLeadDays: number;
  scriptExpiryDate?: string;
  repeatsRemaining?: number;
};

export type ContactKind = "gp" | "pharmacy";

export type SupplyContact = {
  id: string;
  kind: ContactKind;
  name: string;
  phone: string;
  note: string | null;
};

export type SupplyStatus = "ok" | "order-now" | "urgent" | "out";

/** Who a refill actually goes through. A supplement goes through nobody. */
export type RefillRoute = "self" | "pharmacy" | "gp";

/* ===== constants ===== */

/** How far forward a projection will walk before calling it "plenty". */
export const DEFAULT_HORIZON_DAYS = 180;
/** Hard ceiling on any day-by-day walk, forward or backward. */
export const MAX_PROJECTION_DAYS = 400;
export const DEFAULT_LEAD_DAYS = 5;
export const DEFAULT_UNITS_PER_DOSE = 1;
export const DEFAULT_PACK_SIZE = 28;
/** A script inside this window is worth mentioning before it bites. */
export const EXPIRY_WARN_DAYS = 30;

export const SUPPLY_NOTE =
  "Arithmetic on the number you last counted and the schedule you configured. Counts drift — recount when you next open the box. Nothing here changes a prescription, and nothing here decides what you should be taking.";

/* ===== guards ===== */

function clampWindow(days: number): number {
  if (!Number.isFinite(days)) return 1;
  return Math.max(1, Math.min(Math.round(days), MAX_PROJECTION_DAYS));
}

/** A count that cannot be a quantity is treated as nothing in the house. */
function safeOnHand(supply: SupplyRow): number {
  if (!Number.isFinite(supply.onHand) || supply.onHand <= 0) return 0;
  return supply.onHand;
}

function perDoseUnits(supply: SupplyRow): number {
  if (!Number.isFinite(supply.unitsPerDose) || supply.unitsPerDose <= 0) return 0;
  return supply.unitsPerDose;
}

export function leadDays(supply: SupplyRow): number {
  if (!Number.isFinite(supply.reorderLeadDays) || supply.reorderLeadDays <= 0) return 0;
  return Math.min(Math.round(supply.reorderLeadDays), MAX_PROJECTION_DAYS);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ===== consumption ===== */

/**
 * The natural period of a schedule — the shortest window over which its average
 * is exact. A 5-on/2-off cycle repeats every 49 days; weekdays every 7; an
 * every-3-days item every 3. Averaging over an arbitrary window would round a
 * cycle wrong, which is the whole point of doing this properly.
 */
export function schedulePeriodDays(item: StackItem): number {
  switch (item.scheduleType) {
    case "daily":
      return 1;
    case "weekdays":
      return 7;
    case "interval": {
      const every = item.intervalDays ?? 0;
      return Number.isInteger(every) && every >= 1 ? clampWindow(every) : 1;
    }
    case "cycle": {
      const period = ((item.cycleOnWeeks ?? 0) + (item.cycleOffWeeks ?? 0)) * 7;
      return period >= 1 ? clampWindow(period) : 1;
    }
    default:
      return 1;
  }
}

/**
 * Average doses per day over the window starting at `fromDate`, counted by
 * asking `dueOn` for every day in it — never assumed to be one a day. A paused
 * item, an item past its end date and an item with no timings all return 0.
 */
export function dosesPerDay(item: StackItem, fromDate: string, windowDays?: number): number {
  const perDay = item.timings.length;
  if (perDay === 0) return 0;
  const window = clampWindow(windowDays ?? schedulePeriodDays(item));
  let hits = 0;
  for (let i = 0; i < window; i++) if (dueOn(item, addDays(fromDate, i))) hits += 1;
  return (hits * perDay) / window;
}

/** Doses per day turned into units of the thing in the box. */
export function unitsPerDay(
  item: StackItem,
  supply: SupplyRow,
  fromDate: string,
  windowDays?: number,
): number {
  const perDose = perDoseUnits(supply);
  if (perDose === 0) return 0;
  return dosesPerDay(item, fromDate, windowDays) * perDose;
}

/** Units the schedule eats on one specific day. Exact, not averaged. */
export function unitsOn(item: StackItem, supply: SupplyRow, date: string): number {
  if (!dueOn(item, date)) return 0;
  return item.timings.length * perDoseUnits(supply);
}

/**
 * "You counted 24 on Monday, so you have about 19 today."
 *
 * Consumes every scheduled day strictly after the count date through `today`
 * inclusive, so the number returned is the stock at the end of today with
 * today's doses taken. A count stamped today (or in the future) is returned
 * untouched — a fresh count is the truth, not something to project.
 */
export function countAfterDays(item: StackItem, supply: SupplyRow, today: string): number {
  let stock = safeOnHand(supply);
  if (stock === 0) return 0;
  const elapsed = daysBetween(supply.lastCountedDate, today);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return stock;

  const span = Math.min(elapsed, MAX_PROJECTION_DAYS);
  for (let i = 1; i <= span; i++) {
    stock -= unitsOn(item, supply, addDays(supply.lastCountedDate, i));
    if (stock <= 0) return 0;
  }
  return round2(stock);
}

/* ===== the projection ===== */

export type RunOut = {
  /** Units in the house at the end of today, projected from the last count. */
  onHand: number;
  /** Whole days of cover left. 0 means there is nothing for the next dose. */
  daysRemaining: number;
  /** First date a scheduled dose cannot be covered. `null` past the horizon. */
  runOutDate: string | null;
  /** runOutDate minus the reorder lead. `null` when there is no run-out date. */
  orderByDate: string | null;
  status: SupplyStatus;
};

/**
 * `order-now` once today has reached the order-by date; `urgent` once there is
 * less cover left than half the lead time, because at that point ordering
 * normally is already too late; `out` at zero.
 */
export function runOutStatus(
  daysRemaining: number,
  today: string,
  orderByDate: string | null,
  lead: number,
): SupplyStatus {
  if (daysRemaining <= 0) return "out";
  if (daysRemaining <= lead / 2) return "urgent";
  if (orderByDate !== null && today >= orderByDate) return "order-now";
  return "ok";
}

export function projectRunOut(
  item: StackItem,
  supply: SupplyRow,
  today: string,
  horizonDays: number = DEFAULT_HORIZON_DAYS,
): RunOut {
  const horizon = clampWindow(horizonDays);
  const lead = leadDays(supply);
  let stock = countAfterDays(item, supply, today);

  // Nothing consumes it — a paused item, an ended item, a zero unitsPerDose.
  // There is no run-out date because there is no run-out.
  if (unitsPerDay(item, supply, today) <= 0) {
    return { onHand: stock, daysRemaining: horizon, runOutDate: null, orderByDate: null, status: "ok" };
  }

  if (stock <= 0) {
    return {
      onHand: 0,
      daysRemaining: 0,
      runOutDate: today,
      orderByDate: addDays(today, -lead),
      status: "out",
    };
  }

  for (let i = 1; i <= horizon; i++) {
    const date = addDays(today, i);
    const need = unitsOn(item, supply, date);
    if (need <= 0) continue;
    if (stock < need) {
      const orderByDate = addDays(date, -lead);
      return {
        onHand: countAfterDays(item, supply, today),
        daysRemaining: i,
        runOutDate: date,
        orderByDate,
        status: runOutStatus(i, today, orderByDate, lead),
      };
    }
    stock -= need;
  }

  return {
    onHand: countAfterDays(item, supply, today),
    daysRemaining: horizon,
    runOutDate: null,
    orderByDate: null,
    status: "ok",
  };
}

/* ===== the script ===== */

export type ScriptStatus = {
  repeatsRemaining: number | null;
  scriptExpiryDate: string | null;
  daysToExpiry: number | null;
  expired: boolean;
  expiringSoon: boolean;
  hasScript: boolean;
  /** True when a pharmacy call cannot fix this — it takes the doctor. */
  needsGp: boolean;
  /** Why, in the words the user would use. Empty when nothing is wrong. */
  gpReason: string | null;
};

/**
 * The distinction that decides who gets phoned. Repeats left and an in-date
 * script mean the pharmacy can dispense; no repeats, or an expired script, and
 * only the practice can move it.
 */
export function scriptStatus(supply: SupplyRow, today: string): ScriptStatus {
  const repeats =
    supply.repeatsRemaining !== undefined && Number.isFinite(supply.repeatsRemaining)
      ? Math.max(0, Math.floor(supply.repeatsRemaining))
      : null;
  const expiry = supply.scriptExpiryDate ?? null;
  const daysToExpiry = expiry === null ? null : daysBetween(today, expiry);
  const expired = daysToExpiry !== null && daysToExpiry < 0;
  const expiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= EXPIRY_WARN_DAYS;
  const hasScript = repeats !== null || expiry !== null;

  const reasons: string[] = [];
  if (repeats !== null && repeats <= 0) reasons.push("no repeats left on the script");
  if (expired && expiry !== null) reasons.push(`the script expired ${expiry}`);

  return {
    repeatsRemaining: repeats,
    scriptExpiryDate: expiry,
    daysToExpiry,
    expired,
    expiringSoon,
    hasScript,
    needsGp: reasons.length > 0,
    gpReason: reasons.length > 0 ? reasons.join(" and ") : null,
  };
}

export function refillRoute(kind: CompoundKind, script: ScriptStatus): RefillRoute {
  if (kind !== "med") return "self";
  return script.needsGp ? "gp" : "pharmacy";
}

export const ROUTE_NOTE: Record<RefillRoute, string> = {
  self: "No script — reorder this one yourself.",
  pharmacy: "The pharmacy can repeat this.",
  gp: "This one needs the doctor.",
};

/* ===== ordering ===== */

const STATUS_RANK: Record<SupplyStatus, number> = { out: 0, urgent: 1, "order-now": 2, ok: 3 };

/** Worst first, then soonest, then alphabetical so the list never jitters. */
export function sortByUrgency<T extends { status: SupplyStatus; daysRemaining: number; name: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.daysRemaining - b.daysRemaining ||
      a.name.localeCompare(b.name),
  );
}

/* ===== the view both backends build ===== */

export type SupplyItemView = {
  itemId: string;
  name: string;
  kind: CompoundKind;
  dose: number;
  unit: string;
  scheduleLabel: string;
  /** Units in the house at the end of today, projected from the last count. */
  onHand: number;
  /** What was physically counted on `lastCountedDate`. */
  countedOnHand: number;
  unitsPerDose: number;
  packSize: number;
  unitsPerDay: number;
  daysRemaining: number;
  runOutDate: string | null;
  orderByDate: string | null;
  status: SupplyStatus;
  reorderLeadDays: number;
  scriptExpiryDate: string | null;
  repeatsRemaining: number | null;
  daysToExpiry: number | null;
  expiringSoon: boolean;
  needsGp: boolean;
  gpReason: string | null;
  route: RefillRoute;
  routeNote: string;
  lastCountedDate: string;
  /** Days since the count — the honest measure of how much this is a guess. */
  countAgeDays: number;
  /** One line a tired person can act on. */
  line: string;
};

export type SupplyView = {
  items: SupplyItemView[];
  attention: SupplyItemView[];
  okCount: number;
  contacts: { gp: SupplyContact | null; pharmacy: SupplyContact | null };
  refillMessage: string;
  note: string;
  survival: boolean;
};

export type SupplyViewInput = {
  mode: TmMode;
  date: string;
  userName: string;
  items: StackItem[];
  supply: SupplyRow[];
  contacts: SupplyContact[];
  horizonDays?: number;
};

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

/** "Metformin · 6 days left · order by Friday" — words, not a dashboard. */
function actionLine(row: Omit<SupplyItemView, "line">): string {
  const left =
    row.status === "out"
      ? "none left"
      : `${row.daysRemaining} day${row.daysRemaining === 1 ? "" : "s"} left`;
  const parts = [row.name, left];
  if (row.status === "out") parts.push("order today");
  else if (row.orderByDate !== null) parts.push(`order by ${row.orderByDate}`);
  return parts.join(" · ");
}

/**
 * The thing a person reads down the phone or pastes into an email. It names the
 * item, the dose already on the file, and how long is left. It never asks for a
 * change, a different quantity, or anything that is not already prescribed.
 */
export function buildRefillMessage(userName: string, rows: SupplyItemView[]): string {
  if (rows.length === 0) return "";
  const pharmacy = rows.filter((r) => r.route === "pharmacy");
  const gp = rows.filter((r) => r.route === "gp");
  const self = rows.filter((r) => r.route === "self");

  const line = (r: SupplyItemView) => {
    const left = r.status === "out" ? "none left" : `about ${r.daysRemaining} days left`;
    const runsOut = r.runOutDate === null ? "" : `, runs out ${r.runOutDate}`;
    return `- ${r.name} ${fmtQty(r.dose)} ${r.unit} — ${left}${runsOut}`;
  };

  const out: string[] = [`Hello, this is ${userName}.`];
  if (pharmacy.length > 0) {
    out.push("", "Repeat prescription, please:", ...pharmacy.map(line));
  }
  if (gp.length > 0) {
    out.push("", "These have no repeat left, so they need the practice:", ...gp.map(line));
  }
  if (self.length > 0) {
    out.push("", "Also running low (no prescription):", ...self.map(line));
  }
  out.push("", "Could you let me know when it is ready to collect? Thank you.");
  return out.join("\n");
}

export function buildSupplyView(input: SupplyViewInput): SupplyView {
  const { date, items, supply, contacts } = input;
  const survival = input.mode === "survival";
  const horizon = clampWindow(input.horizonDays ?? DEFAULT_HORIZON_DAYS);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const rows: SupplyItemView[] = [];

  for (const row of supply) {
    const item = itemById.get(row.itemId);
    // No item, or a paused one: a paused item is not an obligation, so it never
    // asks to be reordered.
    if (!item || !item.active) continue;

    const run = projectRunOut(item, row, date, horizon);
    const script = scriptStatus(row, date);
    const route = refillRoute(item.kind, script);
    const countAge = daysBetween(row.lastCountedDate, date);

    const base: Omit<SupplyItemView, "line"> = {
      itemId: item.id,
      name: item.name,
      kind: item.kind,
      dose: item.dose,
      unit: item.unit,
      scheduleLabel: scheduleLabel(item, date),
      onHand: run.onHand,
      countedOnHand: safeOnHand(row),
      unitsPerDose: perDoseUnits(row),
      packSize: Number.isFinite(row.packSize) && row.packSize > 0 ? row.packSize : 0,
      unitsPerDay: round2(unitsPerDay(item, row, date)),
      daysRemaining: run.daysRemaining,
      runOutDate: run.runOutDate,
      orderByDate: run.orderByDate,
      status: run.status,
      reorderLeadDays: leadDays(row),
      scriptExpiryDate: script.scriptExpiryDate,
      repeatsRemaining: script.repeatsRemaining,
      daysToExpiry: script.daysToExpiry,
      expiringSoon: script.expiringSoon,
      needsGp: script.needsGp,
      gpReason: script.gpReason,
      route,
      routeNote: ROUTE_NOTE[route],
      lastCountedDate: row.lastCountedDate,
      countAgeDays: Number.isFinite(countAge) ? Math.max(0, countAge) : 0,
    };
    rows.push({ ...base, line: actionLine(base) });
  }

  const sorted = sortByUrgency(rows);
  const attention = sorted.filter((r) => r.status !== "ok");
  const okCount = sorted.length - attention.length;

  return {
    // The floor shows what runs out and nothing else. An inventory is an
    // obligation; "you run out Thursday" is an action.
    items: survival ? [] : sorted,
    attention,
    okCount,
    contacts: {
      gp: contacts.find((c) => c.kind === "gp") ?? null,
      pharmacy: contacts.find((c) => c.kind === "pharmacy") ?? null,
    },
    refillMessage: buildRefillMessage(input.userName, attention),
    note: SUPPLY_NOTE,
    survival,
  };
}

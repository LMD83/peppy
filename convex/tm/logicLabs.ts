import {
  GROUP_LABELS,
  GROUP_ORDER,
  MARKERS,
  PANEL_TEMPLATES,
  markerByKey,
  markerByNameOrKey,
  type MarkerDef,
  type MarkerGroup,
} from "./data/markers";
import { addDays, daysBetween, type TmMode } from "./lib";

/**
 * Pure labs logic — flagging against reference and optimal bands, deltas,
 * sparkline normalisation, recheck intervals and the two unit conversions that
 * actually bite. Shared verbatim between the Convex handlers (convex/tm/labs.ts)
 * and the demo backend (src/app/_lib/demo/labs.ts) so both compute identical
 * numbers.
 *
 * Deterministic by construction: no Date.now(), no Math.random(). Every date
 * arrives as an argument.
 *
 * Evidence note: reference intervals are population statistics — 5% of healthy
 * people sit outside one by definition. A flag here means "outside the interval
 * your lab prints", never "you have a condition". Optimal bands exist only
 * where outcome evidence supports them, and are labelled as the narrower claim
 * they are. This file correlates and sorts. It does not diagnose or prescribe.
 */

export type LabFlag =
  | "low"
  | "borderline-low"
  | "in-range"
  | "optimal"
  | "borderline-high"
  | "high";

export const FLAG_LABELS: Record<LabFlag, string> = {
  low: "below range",
  "borderline-low": "near low bound",
  "in-range": "in range",
  optimal: "optimal band",
  "borderline-high": "near high bound",
  high: "above range",
};

/** Borderline = inside the interval but within this fraction of its width of a bound. */
export const BORDERLINE_FRACTION = 0.1;

/**
 * Where a value sits against its reference interval.
 * Unknown marker or a non-finite value returns "in-range": a render path must
 * never be handed a flag it cannot draw, and inventing a concern is worse than
 * showing none.
 */
export function flagFor(marker: MarkerDef | null | undefined, value: number): LabFlag {
  if (!marker || !Number.isFinite(value)) return "in-range";
  if (value < marker.refLow) return "low";
  if (value > marker.refHigh) return "high";
  // Optimal wins over borderline: a band with evidence behind it outranks proximity to a bound.
  if (
    marker.optimalLow !== undefined &&
    marker.optimalHigh !== undefined &&
    value >= marker.optimalLow &&
    value <= marker.optimalHigh
  ) {
    return "optimal";
  }
  const span = marker.refHigh - marker.refLow;
  if (span <= 0) return "in-range";
  const edge = span * BORDERLINE_FRACTION;
  // A floor of zero is not a bound you can sit "too close" to — nobody needs a
  // warning that their hs-CRP is nearly 0. And on a higher-is-better marker,
  // proximity to the ceiling is the good end, not a concern.
  if (marker.refLow > 0 && value <= marker.refLow + edge) return "borderline-low";
  if (!marker.higherIsBetter && value >= marker.refHigh - edge) return "borderline-high";
  return "in-range";
}

/** Sort weight only — 3 is "outside the printed interval", never "worse person". */
export function severityOf(flag: LabFlag): number {
  switch (flag) {
    case "optimal":
      return 0;
    case "in-range":
      return 1;
    case "borderline-low":
    case "borderline-high":
      return 2;
    case "low":
    case "high":
      return 3;
  }
}

export function isOutOfRange(flag: LabFlag): boolean {
  return flag === "low" || flag === "high";
}

export type LabPoint = { date: string; value: number };

export type LabDelta = {
  change: number;
  pctChange: number;
  direction: "up" | "down" | "flat";
  sinceDate: string;
};

/** Flat when the move is smaller than this — lab assay noise, not a trend. */
export const FLAT_PCT = 2;

/** Latest vs the draw before it. Fewer than two draws is not a trend — null. */
export function deltaFor(historyAscending: readonly LabPoint[]): LabDelta | null {
  if (historyAscending.length < 2) return null;
  const latest = historyAscending[historyAscending.length - 1];
  const previous = historyAscending[historyAscending.length - 2];
  if (!Number.isFinite(latest.value) || !Number.isFinite(previous.value)) return null;
  const change = round2(latest.value - previous.value);
  const pctChange = previous.value === 0 ? 0 : round1((change / Math.abs(previous.value)) * 100);
  const direction: LabDelta["direction"] =
    Math.abs(pctChange) < FLAT_PCT ? "flat" : change > 0 ? "up" : "down";
  return { change, pctChange, direction, sinceDate: previous.date };
}

export type SparkPoint = { date: string; value: number; y01: number };

/**
 * Last `maxPoints` draws normalised into 0..1 for a sparkline. A flat series
 * plots down the middle rather than dividing by zero.
 */
export function trendFor(historyAscending: readonly LabPoint[], maxPoints: number): SparkPoint[] {
  if (maxPoints <= 0) return [];
  const points = historyAscending.slice(-maxPoints).filter((p) => Number.isFinite(p.value));
  if (points.length === 0) return [];
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return points.map((p) => ({
    date: p.date,
    value: p.value,
    y01: span === 0 ? 0.5 : round2((p.value - min) / span),
  }));
}

/** How far outside the interval, as a percentage of the interval's width. Inside → 0. */
export function pctOutsideRange(
  value: number,
  refLow: number | null,
  refHigh: number | null,
): number {
  if (!Number.isFinite(value) || refLow === null || refHigh === null) return 0;
  const span = refHigh - refLow;
  if (span <= 0) return 0;
  if (value < refLow) return round1(((refLow - value) / span) * 100);
  if (value > refHigh) return round1(((value - refHigh) / span) * 100);
  return 0;
}

export type SummarisableResult = {
  flag: LabFlag;
  value: number;
  refLow: number | null;
  refHigh: number | null;
};

export type PanelSummary<T> = {
  counts: Record<LabFlag, number>;
  /** Everything worth a second look — borderline and out-of-range, worst first. */
  concerns: T[];
};

export function panelSummary<T extends SummarisableResult>(results: readonly T[]): PanelSummary<T> {
  const counts: Record<LabFlag, number> = {
    low: 0,
    "borderline-low": 0,
    "in-range": 0,
    optimal: 0,
    "borderline-high": 0,
    high: 0,
  };
  for (const r of results) counts[r.flag] += 1;
  const concerns = results
    .filter((r) => severityOf(r.flag) >= 2)
    .slice()
    .sort((a, b) => {
      const bySeverity = severityOf(b.flag) - severityOf(a.flag);
      if (bySeverity !== 0) return bySeverity;
      return (
        pctOutsideRange(b.value, b.refLow, b.refHigh) -
        pctOutsideRange(a.value, a.refLow, a.refHigh)
      );
    });
  return { counts, concerns };
}

export const RECHECK_DAYS = {
  outOfRange: 90,
  /** Acute-phase markers renormalise fast — a 90-day wait wastes the signal. */
  outOfRangeInflammation: 60,
  borderline: 180,
  routine: 365,
} as const;

/** Suggested interval to the next draw. A suggestion on your own data — not an order. */
export function recheckDueDays(marker: MarkerDef | null | undefined, flag: LabFlag): number {
  if (!marker) return RECHECK_DAYS.routine;
  const severity = severityOf(flag);
  if (severity === 3) {
    return marker.group === "inflammation"
      ? RECHECK_DAYS.outOfRangeInflammation
      : RECHECK_DAYS.outOfRange;
  }
  if (severity === 2) return RECHECK_DAYS.borderline;
  return RECHECK_DAYS.routine;
}

export type RecheckDue = { dueDate: string; overdueDays: number; due: boolean };

/** Where the next draw lands, and by how many days it has been missed. */
export function recheckDue(lastDate: string, intervalDays: number, today: string): RecheckDue {
  const dueDate = addDays(lastDate, intervalDays);
  const overdueDays = Math.max(0, daysBetween(dueDate, today));
  return { dueDate, overdueDays, due: overdueDays > 0 };
}

/* ===== unit conversion ===== */

/** mg/dL = mmol/L × 18.016 for glucose. */
export const GLUCOSE_FACTOR = 18.016;
/** mg/dL = mmol/L × 38.67 for cholesterol fractions. */
export const CHOLESTEROL_FACTOR = 38.67;

const GLUCOSE_KEYS = new Set(["glucose_fasting"]);
const CHOLESTEROL_KEYS = new Set(["total_cholesterol", "ldl_c", "hdl_c", "non_hdl_c"]);

function normUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * The two conversions that actually bite: glucose and cholesterol between
 * mmol/L and mg/dL. Triglycerides use a different factor (88.57) and are
 * deliberately NOT handled here — an unknown pair returns null rather than a
 * guessed number.
 */
export function convertUnit(
  markerKey: string,
  value: number,
  from: string,
  to: string,
): number | null {
  if (!Number.isFinite(value)) return null;
  const a = normUnit(from);
  const b = normUnit(to);
  if (a === b) return round2(value);
  const factor = GLUCOSE_KEYS.has(markerKey)
    ? GLUCOSE_FACTOR
    : CHOLESTEROL_KEYS.has(markerKey)
      ? CHOLESTEROL_FACTOR
      : null;
  if (factor === null) return null;
  if (a === "mmol/l" && b === "mg/dl") return round2(value * factor);
  if (a === "mg/dl" && b === "mmol/l") return round2(value / factor);
  return null;
}

/* ===== the view ===== */

/**
 * How the numbers in a panel got into the file. Not a claim about accuracy —
 * a manually typed value and a CSV-imported one are checked against the same
 * catalogue the same way. It exists so the file can say, honestly, where a
 * number came from, and so a future import path can never be silently
 * indistinguishable from something a person sat down and typed.
 */
export type PanelSource = "manual" | "csv" | "photo";

export const PANEL_SOURCE_LABELS: Record<PanelSource, string> = {
  manual: "typed in",
  csv: "imported",
  photo: "typed in, with a photo attached",
};

export type RawLabPanel = {
  id: string;
  date: string;
  name: string;
  lab?: string | null;
  fasted?: boolean | null;
  /** Absent means manual — see PanelSource. */
  source?: PanelSource | null;
  /** A viewable link to the attached report photo, or null when there is none. */
  photoUrl?: string | null;
};

export type RawLabResult = {
  panelId: string;
  date: string;
  marker: string;
  value: number;
  unit: string;
  /** The interval this lab printed, when it differs from the catalogue default. */
  refLow?: number | null;
  refHigh?: number | null;
};

export type LabsViewInput = {
  mode: TmMode;
  date: string;
  panels: readonly RawLabPanel[];
  results: readonly RawLabResult[];
};

export type LabResultView = {
  marker: string;
  name: string;
  unit: string;
  date: string;
  value: number;
  flag: LabFlag;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  delta: LabDelta | null;
  blurb: string;
  movedBy: string[];
};

export type PanelView = {
  id: string;
  date: string;
  name: string;
  lab: string | null;
  fasted: boolean | null;
  source: PanelSource;
  photoUrl: string | null;
  results: LabResultView[];
};

export type GroupView = { group: MarkerGroup; label: string; markers: LabResultView[] };

export type TrendView = {
  marker: string;
  name: string;
  unit: string;
  points: SparkPoint[];
  delta: LabDelta | null;
};

export type RecheckView = {
  marker: string;
  name: string;
  lastDate: string;
  dueDate: string;
  overdueDays: number;
};

export type TemplateView = {
  key: string;
  name: string;
  markers: { key: string; name: string; unit: string; refLow: number; refHigh: number }[];
};

export type LabsView = {
  panels: PanelView[];
  latestByMarker: LabResultView[];
  outOfRange: LabResultView[];
  byGroup: GroupView[];
  trends: TrendView[];
  dueRechecks: RecheckView[];
  templates: TemplateView[];
  survival: boolean;
};

/** Sparkline width — a decade of quarterly draws still fits. */
export const MAX_TREND_POINTS = 12;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The lab's own printed interval wins over the catalogue default when present. */
function effectiveMarker(row: RawLabResult): MarkerDef | null {
  const def = markerByKey(row.marker);
  if (!def) return null;
  if (row.refLow === undefined || row.refLow === null) {
    if (row.refHigh === undefined || row.refHigh === null) return def;
  }
  return {
    ...def,
    refLow: row.refLow ?? def.refLow,
    refHigh: row.refHigh ?? def.refHigh,
  };
}

function groupIndex(group: MarkerGroup | null): number {
  if (group === null) return GROUP_ORDER.length;
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? GROUP_ORDER.length : i;
}

/** Worst first, then panel order, then name — the order a person reads a panel in. */
function bySeverityThenGroup(a: LabResultView, b: LabResultView): number {
  const severity = severityOf(b.flag) - severityOf(a.flag);
  if (severity !== 0) return severity;
  const outside =
    pctOutsideRange(b.value, b.refLow, b.refHigh) - pctOutsideRange(a.value, a.refLow, a.refHigh);
  if (outside !== 0) return outside;
  const group = groupIndex(markerByKey(a.marker)?.group ?? null) - groupIndex(markerByKey(b.marker)?.group ?? null);
  if (group !== 0) return group;
  return a.name.localeCompare(b.name);
}

const TEMPLATE_VIEWS: TemplateView[] = PANEL_TEMPLATES.map((t) => ({
  key: t.key,
  name: t.name,
  markers: t.markers
    .map((key) => markerByKey(key))
    .filter((m): m is MarkerDef => m !== null)
    .map((m) => ({ key: m.key, name: m.name, unit: m.unit, refLow: m.refLow, refHigh: m.refHigh })),
}));

export function buildLabsView(input: LabsViewInput): LabsView {
  const survival = input.mode === "survival";

  // Panels drawn on or before the viewed date, newest first.
  const panels = input.panels
    .filter((p) => p.date <= input.date)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const panelIds = new Set(panels.map((p) => p.id));
  const rows = input.results
    .filter((r) => panelIds.has(r.panelId))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  // Ascending history per marker — deltas and sparklines both read from it.
  const history = new Map<string, LabPoint[]>();
  for (const row of rows) {
    const list = history.get(row.marker) ?? [];
    list.push({ date: row.date, value: row.value });
    history.set(row.marker, list);
  }

  const seen = new Map<string, number>();
  const viewByRow = new Map<RawLabResult, LabResultView>();
  for (const row of rows) {
    const marker = effectiveMarker(row);
    const index = seen.get(row.marker) ?? 0;
    seen.set(row.marker, index + 1);
    const upToHere = (history.get(row.marker) ?? []).slice(0, index + 1);
    viewByRow.set(row, {
      marker: row.marker,
      name: marker?.name ?? row.marker,
      unit: row.unit,
      date: row.date,
      value: row.value,
      flag: flagFor(marker, row.value),
      refLow: marker?.refLow ?? null,
      refHigh: marker?.refHigh ?? null,
      optimalLow: marker?.optimalLow ?? null,
      optimalHigh: marker?.optimalHigh ?? null,
      delta: deltaFor(upToHere),
      blurb: marker?.blurb ?? "Not in the marker catalogue — value recorded, no reference interval applied.",
      movedBy: marker?.movedBy ?? [],
    });
  }

  const panelViews: PanelView[] = panels.map((p) => ({
    id: p.id,
    date: p.date,
    name: p.name,
    lab: p.lab ?? null,
    fasted: p.fasted ?? null,
    source: p.source ?? "manual",
    photoUrl: p.photoUrl ?? null,
    results: rows
      .filter((r) => r.panelId === p.id)
      .map((r) => viewByRow.get(r))
      .filter((v): v is LabResultView => v !== undefined)
      .sort(bySeverityThenGroup),
  }));

  // Latest draw per marker — rows are ascending, so the last one wins.
  const latestRow = new Map<string, RawLabResult>();
  for (const row of rows) latestRow.set(row.marker, row);
  const latestByMarker = Array.from(latestRow.values())
    .map((r) => viewByRow.get(r))
    .filter((v): v is LabResultView => v !== undefined)
    .sort(bySeverityThenGroup);

  const outOfRange = latestByMarker.filter((r) => isOutOfRange(r.flag));

  const byGroup: GroupView[] = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    markers: latestByMarker
      .filter((r) => markerByKey(r.marker)?.group === group)
      .slice()
      .sort(bySeverityThenGroup),
  })).filter((g) => g.markers.length > 0);

  const trends: TrendView[] = latestByMarker
    .map((r) => {
      const points = trendFor(history.get(r.marker) ?? [], MAX_TREND_POINTS);
      return { marker: r.marker, name: r.name, unit: r.unit, points, delta: r.delta };
    })
    .filter((t) => t.points.length >= 2);

  const dueRechecks: RecheckView[] = latestByMarker
    .map((r) => {
      const marker = markerByKey(r.marker);
      const { dueDate, overdueDays, due } = recheckDue(
        r.date,
        recheckDueDays(marker, r.flag),
        input.date,
      );
      return { marker: r.marker, name: r.name, lastDate: r.date, dueDate, overdueDays, due };
    })
    .filter((r) => r.due)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .map(({ marker, name, lastDate, dueDate, overdueDays }) => ({
      marker,
      name,
      lastDate,
      dueDate,
      overdueDays,
    }));

  // Survival is a floor: what is already outside range and what is overdue stay
  // visible, because those are decisions already owed. Everything browsable —
  // panel history, group tables, trends, the add-panel form — is withheld, so
  // the floor adds no new obligation.
  if (survival) {
    return {
      panels: [],
      latestByMarker: [],
      outOfRange,
      byGroup: [],
      trends: [],
      dueRechecks,
      templates: [],
      survival,
    };
  }

  return {
    panels: panelViews,
    latestByMarker,
    outOfRange,
    byGroup,
    trends,
    dueRechecks,
    templates: TEMPLATE_VIEWS,
    survival,
  };
}

/** Guard for the add-panel path — keeps a typo out of the file. */
export function isKnownMarkerKey(key: string): boolean {
  return markerByKey(key) !== null;
}

/** Every catalogue marker, for callers that need the full list without a template. */
export function allMarkerKeys(): string[] {
  return MARKERS.map((m) => m.key);
}

/* ===== CSV import =====
 * A structured-data import, not a document reader. It parses text a person
 * exported or typed themselves — a spreadsheet, a lab portal's CSV download —
 * into the same shape the manual-entry form produces, and every row goes
 * through the identical marker-catalogue check either path uses. It never
 * reads a PDF, an image, or free text describing a result: the moment this
 * function had to guess at what a cell meant, it would be doing the thing
 * research.ts and logicCapture.ts both refuse to do elsewhere in this app. */

/** One row of parsed input, resolved against the catalogue and ready for addPanel. */
export type CsvImportRow = { marker: string; name: string; value: number; unit: string };


export type CsvImportResult = {
  rows: CsvImportRow[];
  /**
   * One line per rejected input row, in the order encountered. A CSV that
   * drops rows without saying which ones is the same silent-truncation
   * failure the a11y sweep exists to catch elsewhere in this app — a person
   * checking their own bloods against a printed report deserves to know
   * their file has fewer rows than their CSV did, and why.
   */
  errors: string[];
};

/** Same ceiling addPanel enforces — checked here too, so the error is legible before submit. */
export const MAX_RESULTS_PER_PANEL = 80;

/** Splits one CSV line on commas, honouring "quoted, fields" — nothing fancier. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

const HEADER_ALIASES = {
  marker: ["marker", "test", "name", "analyte"],
  value: ["value", "result"],
  unit: ["unit", "units"],
};

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

/**
 * Parses `marker,value[,unit]` text — a header row naming the columns (in any
 * order, matched case-insensitively against a few common aliases so "Test",
 * "Result", "Units" all work), then one result per line.
 *
 * The unit column is optional: when a row omits it, or spells it differently
 * from the catalogue, the catalogue's own unit is used rather than trusting
 * an unfamiliar string — this app already refuses to guess a unit conversion
 * anywhere else (see convertUnit above), and an import is not the exception.
 *
 * Every rejected row is reported, never dropped silently: an unrecognised
 * marker name, a non-numeric value, and the panel-size ceiling all produce a
 * line in `errors` that names the row and why it did not make it in.
 */
export function parseLabsCsv(text: string): CsvImportResult {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const markerCol = findColumn(header, HEADER_ALIASES.marker);
  const valueCol = findColumn(header, HEADER_ALIASES.value);
  const unitCol = findColumn(header, HEADER_ALIASES.unit);

  if (markerCol === -1 || valueCol === -1) {
    return {
      rows: [],
      errors: [
        'The first row must name the columns — at least "marker" and "value" ' +
          '(e.g. "marker,value,unit").',
      ],
    };
  }

  const rows: CsvImportRow[] = [];
  const errors: string[] = [];
  const dataLines = lines.slice(1);

  for (let i = 0; i < dataLines.length; i++) {
    if (rows.length >= MAX_RESULTS_PER_PANEL) {
      errors.push(
        `Row ${i + 2}: skipped — a panel holds at most ${MAX_RESULTS_PER_PANEL} results, and this file has more.`,
      );
      continue;
    }
    const cells = splitCsvLine(dataLines[i]);
    const rawMarker = (cells[markerCol] ?? "").trim();
    const rawValue = (cells[valueCol] ?? "").trim();
    if (rawMarker === "" && rawValue === "") continue; // a blank line, not a row

    const def = markerByNameOrKey(rawMarker);
    if (!def) {
      errors.push(`Row ${i + 2}: "${rawMarker || "(blank)"}" is not a marker this file tracks — skipped.`);
      continue;
    }
    const rawValueNum = Number(rawValue.replace(",", ".")); // a locale that commas its decimals
    if (!Number.isFinite(rawValueNum)) {
      errors.push(`Row ${i + 2}: "${rawValue || "(blank)"}" is not a number for ${def.name} — skipped.`);
      continue;
    }
    const rawUnit = unitCol === -1 ? "" : (cells[unitCol] ?? "").trim();

    // No unit column, or it already matches: take the value as printed, in the
    // catalogue's unit — this is what the manual-entry form does too, since its
    // template fixes the unit and never asks.
    let value = rawValueNum;
    if (rawUnit !== "" && rawUnit.toLowerCase() !== def.unit.toLowerCase()) {
      // A different unit is only ever handled by converting it, never by
      // relabelling — a 5.6 written down as mg/dL and stored as mmol/L would
      // flag as critically low when it is a normal cholesterol reading.
      // convertUnit only knows glucose and cholesterol (see its own docstring);
      // anything else it cannot convert is a row this parser has to refuse
      // rather than guess.
      const converted = convertUnit(def.key, rawValueNum, rawUnit, def.unit);
      if (converted === null) {
        errors.push(
          `Row ${i + 2}: ${def.name} is tracked in ${def.unit}, not "${rawUnit}" — skipped rather than guess a conversion.`,
        );
        continue;
      }
      value = converted;
    }
    rows.push({ marker: def.key, name: def.name, value, unit: def.unit });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No result rows found after the header.");
  }

  return { rows, errors };
}

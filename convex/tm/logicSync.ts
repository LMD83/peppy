/**
 * Pure connect logic — file parsing, plausibility bounds, dedupe planning and
 * the view model. Shared verbatim between the Convex handlers
 * (convex/tm/sync.ts), the Renpho poller (convex/tm/renphoCloud.ts) and the
 * demo backend (src/app/_lib/demo/sync.ts), so every route a number can take
 * into the file goes through the same checks.
 *
 * Deterministic by construction: no Date.now(), no Math.random(). Timestamps
 * arrive as arguments.
 *
 * Two rules from docs/research/INTEGRATIONS.md govern everything here:
 *
 *  - **A structured-data import, not a document reader.** These parsers accept
 *    text a person exported themselves — a Renpho CSV, a Samsung Health
 *    download, a spreadsheet — never a PDF or a photo. The moment a function
 *    here had to guess what a cell meant, it would be doing the thing
 *    logicCapture.ts refuses to do.
 *  - **Reject rather than coerce.** Numeric accuracy is the real danger: a
 *    decimal slip or a unit mix-up looks plausible and lies silently. Every
 *    value is checked against a physiological range in its stated unit, an
 *    ambiguous date is refused with a reason, and the only conversion
 *    performed is lb→kg where the file's own header declares pounds.
 */

/* ===== the reading ===== */

export type SyncSource = "renpho-csv" | "samsung-csv" | "csv" | "inbody" | "renpho-cloud";

export const SOURCE_LABELS: Record<SyncSource, string> = {
  "renpho-csv": "Renpho export",
  "samsung-csv": "Samsung Health export",
  csv: "spreadsheet",
  inbody: "InBody sheet",
  "renpho-cloud": "Renpho sync",
};

/** One reading as parsed — date plus whatever metrics the source printed. */
export type MeasurementInput = {
  date: string;
  time?: string;
  weightKg?: number;
  bodyFatPct?: number;
  bodyFatMassKg?: number;
  skeletalMuscleKg?: number;
  muscleMassKg?: number;
  visceralFat?: number;
  waterPct?: number;
  bmrKcal?: number;
};

export type MetricKey = Exclude<keyof MeasurementInput, "date" | "time">;

/**
 * Plausibility bounds per metric, in the unit the app tracks. A value outside
 * its band is refused, never clamped — 620 kg is a decimal slip, and writing
 * 62 instead would be the guess this file exists to refuse.
 */
export const METRICS: {
  key: MetricKey;
  label: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  { key: "weightKg", label: "Weight", unit: "kg", min: 25, max: 350 },
  { key: "bodyFatPct", label: "Body fat", unit: "%", min: 1, max: 75 },
  { key: "bodyFatMassKg", label: "Body fat mass", unit: "kg", min: 0.5, max: 200 },
  { key: "skeletalMuscleKg", label: "Skeletal muscle (SMM)", unit: "kg", min: 5, max: 80 },
  { key: "muscleMassKg", label: "Muscle mass", unit: "kg", min: 5, max: 120 },
  { key: "visceralFat", label: "Visceral fat", unit: "level", min: 1, max: 60 },
  { key: "waterPct", label: "Body water", unit: "%", min: 20, max: 80 },
  { key: "bmrKcal", label: "BMR", unit: "kcal", min: 500, max: 5000 },
];

export const METRIC_KEYS: MetricKey[] = METRICS.map((m) => m.key);

const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export function metricLabel(key: MetricKey): string {
  return METRIC_BY_KEY.get(key)?.label ?? key;
}

export function metricUnit(key: MetricKey): string {
  return METRIC_BY_KEY.get(key)?.unit ?? "";
}

/** lb→kg, the one conversion performed — and only where a header says (lb). */
export const LB_PER_KG = 2.2046226218;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Everything wrong with one reading, in words. Empty means it can be written.
 * A reading with a date and no metric at all is an error too — an empty row
 * is not evidence of anything.
 */
export function validateMeasurement(m: MeasurementInput): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) errors.push(`"${m.date}" is not a YYYY-MM-DD date.`);
  if (m.time !== undefined && !/^\d{2}:\d{2}$/.test(m.time)) {
    errors.push(`"${m.time}" is not a HH:MM time.`);
  }
  let metrics = 0;
  for (const def of METRICS) {
    const value = m[def.key];
    if (value === undefined) continue;
    metrics += 1;
    if (!Number.isFinite(value)) {
      errors.push(`${def.label} is not a number.`);
    } else if (value < def.min || value > def.max) {
      errors.push(
        `${def.label} ${value} ${def.unit} is outside the plausible band ` +
          `(${def.min}–${def.max} ${def.unit}) — refused rather than guessed at.`,
      );
    }
  }
  if (metrics === 0) errors.push("The reading carries no metrics at all.");
  return errors;
}

/* ===== CSV parsing ===== */

/** A year-plus of daily weigh-ins. Beyond this, rows are reported, not dropped. */
export const MAX_IMPORT_ROWS = 400;

export type ConnectCsvFormat = "renpho" | "samsung" | "generic";

export type ConnectCsvResult = {
  rows: MeasurementInput[];
  /** Which mapping the header matched, or null when no mapping fits. */
  format: ConnectCsvFormat | null;
  /** One line per rejected row or file-level problem — never a silent drop. */
  errors: string[];
};

/** Splits one CSV line on commas, honouring "quoted, fields" — same rule logicLabs uses. */
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

function norm(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * "2026-08-12", "2026/08/12 07:32:11.000", "12/08/2026 07:32" — into a date
 * and an optional HH:MM. A slashed date where both leading parts could be a
 * month ("03/08/2026") is ambiguous between day-first and month-first, and an
 * 18× unit error has cousins in date order too: refused, with the reason.
 */
export function parseDateTimeCell(cell: string): { date: string; time?: string } | null | "ambiguous" {
  const trimmed = cell.trim();
  if (trimmed === "") return null;
  const m = trimmed.match(
    /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/,
  );
  if (!m) return null;
  const [, aRaw, bRaw, cRaw, hh, mm] = m;
  const a = Number(aRaw);
  const b = Number(bRaw);
  const c = Number(cRaw);
  let year: number, month: number, day: number;
  if (aRaw.length === 4) {
    // ISO order: YYYY-MM-DD.
    year = a;
    month = b;
    day = c;
  } else if (cRaw.length === 4) {
    // Slashed with the year last. Which of the first two is the day?
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    } else if (a === b) {
      day = a;
      month = b;
    } else {
      return "ambiguous";
    }
    year = c;
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (hh !== undefined && mm !== undefined) {
    const hour = Number(hh);
    if (hour > 23 || Number(mm) > 59) return null;
    return { date, time: `${String(hour).padStart(2, "0")}:${mm}` };
  }
  return { date };
}

/** "78.6", "78,6" (comma decimal), "" / "--" (absent). Anything else is a refusal. */
function parseNumberCell(cell: string): number | null | undefined {
  const trimmed = cell.trim();
  if (trimmed === "" || trimmed === "--" || trimmed === "-") return undefined;
  const normalised = /^\d+,\d+$/.test(trimmed) ? trimmed.replace(",", ".") : trimmed;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

type ColumnRole =
  | { kind: "date" }
  | { kind: "time" }
  | { kind: "metric"; key: MetricKey }
  | { kind: "weightLb" };

type FormatSpec = {
  format: ConnectCsvFormat;
  matches: (header: string[]) => boolean;
  aliases: [string[], ColumnRole][];
};

/** Header cells each mapping recognises. Anything unlisted is left alone. */
const RENPHO_SPEC: FormatSpec = {
  format: "renpho",
  matches: (h) =>
    h.some((c) => /^weight ?\((kg|lb|lbs)\)$/.test(c)) &&
    h.some((c) => /visceral fat|muscle mass|^bmr|body water/.test(c)),
  aliases: [
    [["date", "date of measurement", "measurement date"], { kind: "date" }],
    [["time", "time of measurement", "measurement time"], { kind: "time" }],
    [["weight(kg)", "weight (kg)"], { kind: "metric", key: "weightKg" }],
    [["weight(lb)", "weight (lb)", "weight(lbs)", "weight (lbs)"], { kind: "weightLb" }],
    [["body fat(%)", "body fat (%)", "bodyfat(%)", "body fat%"], { kind: "metric", key: "bodyFatPct" }],
    [["body water(%)", "body water (%)", "water(%)"], { kind: "metric", key: "waterPct" }],
    [["muscle mass(kg)", "muscle mass (kg)"], { kind: "metric", key: "muscleMassKg" }],
    [["visceral fat"], { kind: "metric", key: "visceralFat" }],
    [["bmr(kcal)", "bmr (kcal)", "bmr"], { kind: "metric", key: "bmrKcal" }],
  ],
};

/**
 * Samsung Health's download ships one CSV per data type with a provenance
 * title line above the header. Only columns whose meaning is certain are
 * mapped: `total_body_water` is litres, not a percentage, so it is left
 * where it is rather than relabelled into waterPct.
 */
const SAMSUNG_SPEC: FormatSpec = {
  format: "samsung",
  matches: (h) => h.includes("start_time") && h.includes("weight"),
  aliases: [
    [["start_time"], { kind: "date" }],
    [["weight"], { kind: "metric", key: "weightKg" }],
    [["body_fat"], { kind: "metric", key: "bodyFatPct" }],
    [["body_fat_mass"], { kind: "metric", key: "bodyFatMassKg" }],
    [["skeletal_muscle_mass"], { kind: "metric", key: "skeletalMuscleKg" }],
    [["muscle_mass"], { kind: "metric", key: "muscleMassKg" }],
    [["basal_metabolic_rate"], { kind: "metric", key: "bmrKcal" }],
    [["vfa_level"], { kind: "metric", key: "visceralFat" }],
  ],
};

const GENERIC_SPEC: FormatSpec = {
  format: "generic",
  matches: (h) =>
    h.some((c) => ["date", "day"].includes(c)) &&
    h.some((c) => ["weight", "weight(kg)", "weight (kg)", "weight kg", "kg"].includes(c)),
  aliases: [
    [["date", "day"], { kind: "date" }],
    [["time"], { kind: "time" }],
    [["weight", "weight(kg)", "weight (kg)", "weight kg", "kg"], { kind: "metric", key: "weightKg" }],
    [["weight(lb)", "weight (lb)", "weight lb"], { kind: "weightLb" }],
    [
      ["body fat", "body fat %", "body fat(%)", "body fat (%)", "bodyfat", "fat %"],
      { kind: "metric", key: "bodyFatPct" },
    ],
    [["body fat mass", "fat mass", "fat mass (kg)"], { kind: "metric", key: "bodyFatMassKg" }],
    [
      ["skeletal muscle", "skeletal muscle (kg)", "smm", "smm (kg)"],
      { kind: "metric", key: "skeletalMuscleKg" },
    ],
    [["muscle mass", "muscle mass (kg)"], { kind: "metric", key: "muscleMassKg" }],
    [["visceral fat", "visceral fat level", "vfl"], { kind: "metric", key: "visceralFat" }],
    [["body water", "body water %", "water %"], { kind: "metric", key: "waterPct" }],
    [["bmr", "bmr (kcal)", "bmr(kcal)"], { kind: "metric", key: "bmrKcal" }],
  ],
};

const FORMAT_SPECS = [RENPHO_SPEC, SAMSUNG_SPEC, GENERIC_SPEC];

function columnRoles(header: string[], spec: FormatSpec): Map<number, ColumnRole> {
  const roles = new Map<number, ColumnRole>();
  for (const [aliases, role] of spec.aliases) {
    const index = header.findIndex((cell) => aliases.includes(cell));
    if (index !== -1 && !roles.has(index)) roles.set(index, role);
  }
  return roles;
}

/** Maps a source's CSV format label onto the reading's stored source tag. */
export function sourceForFormat(format: ConnectCsvFormat): "renpho-csv" | "samsung-csv" | "csv" {
  if (format === "renpho") return "renpho-csv";
  if (format === "samsung") return "samsung-csv";
  return "csv";
}

/**
 * Parses a body-scale or body-composition CSV export into readings. Detects
 * which mapping the header matches — a Renpho app export, a Samsung Health
 * download, or a plain date/weight spreadsheet — and reports every row it
 * refuses with the reason. Values are taken as printed; only a weight column
 * whose own header declares pounds is converted, because that is the file
 * stating its unit, not this parser guessing one.
 */
export function parseConnectCsv(text: string): ConnectCsvResult {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length === 0) return { rows: [], format: null, errors: ["The file is empty."] };

  // Samsung's title line ("com.samsung.health.weight,…") sits above the header.
  let headerLine = 0;
  if (/com\.samsung/i.test(lines[0]) && lines.length > 1) headerLine = 1;

  const header = splitCsvLine(lines[headerLine]).map(norm);
  const spec = FORMAT_SPECS.find((s) => s.matches(header));
  if (!spec) {
    return {
      rows: [],
      format: null,
      errors: [
        "The first row must name the columns — at least a date and a weight " +
          '(e.g. "date,weight (kg),body fat (%)"). Renpho and Samsung Health exports are recognised as they are.',
      ],
    };
  }

  const roles = columnRoles(header, spec);
  const rows: MeasurementInput[] = [];
  const errors: string[] = [];
  const dataLines = lines.slice(headerLine + 1);

  for (let i = 0; i < dataLines.length; i++) {
    const rowNo = headerLine + i + 2;
    if (rows.length >= MAX_IMPORT_ROWS) {
      errors.push(
        `Row ${rowNo}: skipped — one import takes at most ${MAX_IMPORT_ROWS} readings, and this file has more. Import the rest separately.`,
      );
      continue;
    }
    const cells = splitCsvLine(dataLines[i]);
    if (cells.every((c) => c === "")) continue;

    const reading: MeasurementInput = { date: "" };
    let rowError: string | null = null;
    for (const [index, role] of roles) {
      const cell = cells[index] ?? "";
      if (role.kind === "date") {
        const parsed = parseDateTimeCell(cell);
        if (parsed === "ambiguous") {
          rowError = `"${cell}" could be day-first or month-first — refused rather than guess the order.`;
          break;
        }
        if (parsed === null) {
          rowError = `"${cell || "(blank)"}" is not a date this import reads.`;
          break;
        }
        reading.date = parsed.date;
        if (parsed.time !== undefined && reading.time === undefined) reading.time = parsed.time;
      } else if (role.kind === "time") {
        const t = cell.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (t) reading.time = `${t[1].padStart(2, "0")}:${t[2]}`;
      } else {
        const value = parseNumberCell(cell);
        if (value === null) {
          rowError = `"${cell}" is not a number for ${
            role.kind === "weightLb" ? "weight" : metricLabel(role.key)
          }.`;
          break;
        }
        if (value === undefined) continue;
        if (role.kind === "weightLb") {
          reading.weightKg = round2(value / LB_PER_KG);
        } else {
          reading[role.key] = round2(value);
        }
      }
    }

    if (rowError !== null) {
      errors.push(`Row ${rowNo}: ${rowError}`);
      continue;
    }
    const invalid = validateMeasurement(reading);
    if (invalid.length > 0) {
      errors.push(`Row ${rowNo}: ${invalid[0]}`);
      continue;
    }
    rows.push(reading);
  }

  if (rows.length === 0 && errors.length === 0) errors.push("No readings found after the header.");
  return { rows, format: spec.format, errors };
}

/* ===== dedupe planning ===== */

/** What is already on file, as far as the plan needs to know. */
export type ExistingReading = MeasurementInput & { source: SyncSource };

export type ImportPlan = {
  toWrite: MeasurementInput[];
  /** Same reading already on file (any source) — nothing to do. */
  duplicates: number;
  /** Same source, date and time but different numbers — the file's version is kept. */
  conflicts: number;
  /** Dates whose daily weigh-in (tm_days) this import would fill. Never overwrites one. */
  fills: string[];
};

function sameTime(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "") === (b ?? "");
}

function sameValues(a: MeasurementInput, b: MeasurementInput): boolean {
  return METRIC_KEYS.every((key) => {
    const av = a[key];
    const bv = b[key];
    if (av === undefined || bv === undefined) return av === bv;
    return Math.abs(av - bv) < 0.05;
  });
}

/**
 * Which incoming readings are new, which are already on file, and which daily
 * weigh-ins they would fill. Pure, so the preview on the screen and the commit
 * on the server run the identical rule — the preview is never a different
 * promise than the write keeps.
 *
 * A reading that matches an existing one's date, time and numbers is a
 * duplicate whatever its source: the same morning on the same scale reached
 * through the CSV and through the poller must land once. Same source and
 * moment with different numbers is a conflict, and the file's version wins —
 * an import never silently rewrites history.
 */
export function planImport(
  existing: readonly ExistingReading[],
  incoming: readonly MeasurementInput[],
  source: SyncSource,
  /** date → true when tm_days already carries a weigh-in for it. */
  dayHasWeight: ReadonlyMap<string, boolean>,
): ImportPlan {
  const toWrite: MeasurementInput[] = [];
  let duplicates = 0;
  let conflicts = 0;

  const written: ExistingReading[] = existing.slice();
  for (const reading of incoming) {
    const sameMoment = written.filter((e) => e.date === reading.date && sameTime(e.time, reading.time));
    if (sameMoment.some((e) => sameValues(e, reading))) {
      duplicates += 1;
      continue;
    }
    if (sameMoment.some((e) => e.source === source)) {
      conflicts += 1;
      continue;
    }
    toWrite.push(reading);
    written.push({ ...reading, source });
  }

  // First weight of each day fills the daily weigh-in — morning convention —
  // and only where nobody has logged one. A typed weigh-in is never overwritten.
  const firstByDate = new Map<string, MeasurementInput>();
  for (const reading of toWrite) {
    if (reading.weightKg === undefined) continue;
    const current = firstByDate.get(reading.date);
    if (!current || (reading.time ?? "99:99") < (current.time ?? "99:99")) {
      firstByDate.set(reading.date, reading);
    }
  }
  const fills = [...firstByDate.keys()].filter((date) => dayHasWeight.get(date) !== true).sort();

  return { toWrite, duplicates, conflicts, fills };
}

/** What a commit reports back — the numbers the screen repeats to the person. */
export type ImportReport = {
  wrote: number;
  duplicates: number;
  conflicts: number;
  filledDays: number;
  errors: string[];
};

/* ===== the view ===== */

export type RawSyncRun = {
  at: number;
  ok: boolean;
  reason: string;
  fetched: number;
  wrote: number;
};

export type ConnectViewInput = {
  mode: "cut" | "maintain" | "survival";
  date: string;
  measurements: readonly ExistingReading[];
  lastRun: RawSyncRun | null;
  /** Whether the deployment holds Renpho credentials. Demo mode never does. */
  pollerConfigured: boolean;
};

export type ReadingView = MeasurementInput & {
  source: SyncSource;
  sourceLabel: string;
};

export type SourceSummary = {
  source: SyncSource;
  label: string;
  count: number;
  lastDate: string;
};

export type ConnectView = {
  survival: boolean;
  /** Newest first, on or before the viewed date. */
  readings: ReadingView[];
  /** Latest value per metric across all sources, for the summary strip. */
  latest: { key: MetricKey; label: string; unit: string; value: number; date: string }[];
  sources: SourceSummary[];
  poller: { configured: boolean; lastRun: RawSyncRun | null };
  maxImportRows: number;
};

/** Readings shown on the screen — a fortnight-plus, not an archive dump. */
export const MAX_READINGS_SHOWN = 30;

export function buildConnectView(input: ConnectViewInput): ConnectView {
  const survival = input.mode === "survival";
  const visible = input.measurements
    .filter((m) => m.date <= input.date)
    .slice()
    .sort((a, b) =>
      a.date === b.date ? (b.time ?? "").localeCompare(a.time ?? "") : b.date.localeCompare(a.date),
    );

  const latest: ConnectView["latest"] = [];
  for (const def of METRICS) {
    const hit = visible.find((m) => m[def.key] !== undefined);
    if (hit) {
      const value = hit[def.key];
      if (value !== undefined) {
        latest.push({ key: def.key, label: def.label, unit: def.unit, value, date: hit.date });
      }
    }
  }

  const bySource = new Map<SyncSource, { count: number; lastDate: string }>();
  for (const m of visible) {
    const entry = bySource.get(m.source) ?? { count: 0, lastDate: m.date };
    entry.count += 1;
    if (m.date > entry.lastDate) entry.lastDate = m.date;
    bySource.set(m.source, entry);
  }
  const sources: SourceSummary[] = [...bySource.entries()]
    .map(([source, s]) => ({ source, label: SOURCE_LABELS[source], ...s }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  const poller = { configured: input.pollerConfigured, lastRun: input.lastRun };

  // The floor asks for three checks and nothing else. Imports, forms and
  // archives all wait; the poller status stays, because a sync that broke
  // during a survival stay should not be discovered only afterwards.
  if (survival) {
    return { survival, readings: [], latest: [], sources: [], poller, maxImportRows: MAX_IMPORT_ROWS };
  }

  return {
    survival,
    readings: visible.slice(0, MAX_READINGS_SHOWN).map((m) => ({
      ...m,
      sourceLabel: SOURCE_LABELS[m.source],
    })),
    latest,
    sources,
    poller,
    maxImportRows: MAX_IMPORT_ROWS,
  };
}

/* ===== the Renpho cloud record ===== */

/**
 * One decrypted record from the Renpho cloud API into a reading. Only fields
 * whose meaning is certain are mapped — the cloud's "muscle" is a percentage
 * where the app tracks muscle mass in kg, so it is left out rather than
 * derived. The record's epoch timestamp is rendered in the household's zone,
 * passed in, because a Convex action runs in UTC and a 23:40 weigh-in must
 * not land on tomorrow's date.
 */
export function mapRenphoCloudRecord(record: unknown, zone: string): MeasurementInput | null {
  if (typeof record !== "object" || record === null) return null;
  const r = record as Record<string, unknown>;
  const stamp = typeof r.timeStamp === "number" ? r.timeStamp : null;
  if (stamp === null || stamp <= 0) return null;

  const when = new Date(stamp * 1000);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(when);

  const reading: MeasurementInput = { date, time };
  const take = (field: string, key: MetricKey) => {
    const value = r[field];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      reading[key] = round2(value);
    }
  };
  take("weight", "weightKg");
  take("bodyfat", "bodyFatPct");
  take("water", "waterPct");
  take("visfat", "visceralFat");
  take("bmr", "bmrKcal");

  return validateMeasurement(reading).length === 0 ? reading : null;
}

/* ===== files out ===== */

/**
 * CSV text from rows. UTF-8 BOM so Excel on a UK/IE locale reads it as UTF-8,
 * ISO-8601 dates so it never mangles them into month-first — both from the
 * integration research, both cheap here and expensive to discover later.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const escape = (cell: string | number | null): string => {
    if (cell === null) return "";
    const text = String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export type ExportDayRow = { date: string; weightKg?: number; stress?: number; energy?: number };
export type ExportSetRow = {
  date: string;
  exercise: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rir: number;
};
export type ExportLabRow = {
  date: string;
  marker: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
};

export function weighInsCsv(days: readonly ExportDayRow[]): string {
  return toCsv(
    ["date", "weight_kg", "stress_1_5", "energy_1_5"],
    days
      .filter((d) => d.weightKg !== undefined || d.stress !== undefined || d.energy !== undefined)
      .map((d) => [d.date, d.weightKg ?? null, d.stress ?? null, d.energy ?? null]),
  );
}

export function trainingCsv(sets: readonly ExportSetRow[]): string {
  return toCsv(
    ["date", "exercise", "set", "weight_kg", "reps", "rir"],
    sets.map((s) => [s.date, s.exercise, s.setIndex, s.weightKg, s.reps, s.rir]),
  );
}

export function labsCsv(results: readonly ExportLabRow[]): string {
  return toCsv(
    ["date", "marker", "value", "unit", "ref_low", "ref_high"],
    results.map((r) => [r.date, r.marker, r.value, r.unit, r.refLow ?? null, r.refHigh ?? null]),
  );
}

export function readingsCsv(readings: readonly ExistingReading[]): string {
  return toCsv(
    [
      "date",
      "time",
      "source",
      "weight_kg",
      "body_fat_pct",
      "body_fat_mass_kg",
      "skeletal_muscle_kg",
      "muscle_mass_kg",
      "visceral_fat",
      "body_water_pct",
      "bmr_kcal",
    ],
    readings.map((m) => [
      m.date,
      m.time ?? null,
      m.source,
      m.weightKg ?? null,
      m.bodyFatPct ?? null,
      m.bodyFatMassKg ?? null,
      m.skeletalMuscleKg ?? null,
      m.muscleMassKg ?? null,
      m.visceralFat ?? null,
      m.waterPct ?? null,
      m.bmrKcal ?? null,
    ]),
  );
}

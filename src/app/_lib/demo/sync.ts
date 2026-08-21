import {
  buildConnectView,
  planImport,
  validateMeasurement,
  MAX_IMPORT_ROWS,
  type ExistingReading,
  type ImportReport,
  type MeasurementInput,
  type SyncSource,
} from "@convex/tm/logicSync";
import type { DemoDb } from "../demo-db";
import type { ConnectData, ExportBundle } from "../types";

/**
 * Demo mirror of convex/tm/sync.ts. Same gather, same shared plan, same
 * shapes — the view and report types are derived from the Convex functions,
 * so any drift is a build error.
 *
 * The poller never runs here: there is no cron in a browser tab and no
 * credentials to hold, so the view reports `configured: false` and the screen
 * says so, exactly as an unconfigured deployment would.
 */

function gatherReadings(db: DemoDb, slug: string): ExistingReading[] {
  return db.bodyMeasurements
    .filter((m) => m.userSlug === slug)
    .map((m) => ({
      date: m.date,
      time: m.time,
      weightKg: m.weightKg,
      bodyFatPct: m.bodyFatPct,
      bodyFatMassKg: m.bodyFatMassKg,
      skeletalMuscleKg: m.skeletalMuscleKg,
      muscleMassKg: m.muscleMassKg,
      visceralFat: m.visceralFat,
      waterPct: m.waterPct,
      bmrKcal: m.bmrKcal,
      source: m.source,
    }));
}

export function view(db: DemoDb, slug: string, date: string): ConnectData {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");
  return buildConnectView({
    mode: user.modeMut,
    date,
    measurements: gatherReadings(db, slug),
    lastRun: null,
    pollerConfigured: false,
  });
}

/** Same commit rules as convex/tm/sync.ts's commitReadings, over the demo store. */
export function importMeasurements(
  db: DemoDb,
  slug: string,
  source: Exclude<SyncSource, "renpho-cloud">,
  rows: MeasurementInput[],
  device?: string,
): ImportReport {
  if (rows.length === 0) throw new Error("empty-import");
  if (rows.length > MAX_IMPORT_ROWS) throw new Error("too-many-rows");

  const errors: string[] = [];
  const valid: MeasurementInput[] = [];
  for (const row of rows) {
    const rowErrors = validateMeasurement(row);
    if (rowErrors.length > 0) errors.push(`${row.date || "(no date)"}: ${rowErrors[0]}`);
    else valid.push(row);
  }

  const dayHasWeight = new Map(
    db.days.filter((d) => d.userSlug === slug).map((d) => [d.date, d.weightKg !== undefined]),
  );
  const plan = planImport(gatherReadings(db, slug), valid, source, dayHasWeight);
  const deviceLabel = device?.trim().slice(0, 60) || undefined;
  const importedAt = Date.now();

  for (const reading of plan.toWrite) {
    db.bodyMeasurements.push({ userSlug: slug, ...reading, source, device: deviceLabel, importedAt });
  }

  const fillWeight = new Map<string, number>();
  for (const reading of plan.toWrite) {
    if (reading.weightKg === undefined || !plan.fills.includes(reading.date)) continue;
    if (!fillWeight.has(reading.date)) fillWeight.set(reading.date, reading.weightKg);
  }
  for (const date of plan.fills) {
    const weightKg = fillWeight.get(date);
    if (weightKg === undefined) continue;
    const day = db.days.find((d) => d.userSlug === slug && d.date === date);
    if (day) {
      if (day.weightKg === undefined) day.weightKg = weightKg;
    } else {
      db.days.push({ userSlug: slug, date, weightKg });
    }
  }

  return {
    wrote: plan.toWrite.length,
    duplicates: plan.duplicates,
    conflicts: plan.conflicts,
    filledDays: plan.fills.length,
    errors,
  };
}

export function exportBundle(db: DemoDb, slug: string): ExportBundle {
  const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
  return {
    days: db.days
      .filter((d) => d.userSlug === slug)
      .map((d) => ({ date: d.date, weightKg: d.weightKg, stress: d.stress, energy: d.energy }))
      .sort(byDate),
    sets: db.setLogs
      .filter((s) => s.userSlug === slug)
      .map((s) => ({
        date: s.date,
        exercise: s.exercise,
        setIndex: s.setIndex,
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
      }))
      .sort(byDate),
    labs: db.labResults
      .filter((r) => r.userSlug === slug)
      .map((r) => ({
        date: r.date,
        marker: r.marker,
        value: r.value,
        unit: r.unit,
        refLow: r.refLow,
        refHigh: r.refHigh,
      }))
      .sort(byDate),
    readings: gatherReadings(db, slug).sort(byDate),
  };
}

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireUser } from "./db";
import {
  MAX_IMPORT_ROWS,
  buildConnectView,
  planImport,
  validateMeasurement,
  type ConnectView,
  type ExistingReading,
  type ExportDayRow,
  type ExportLabRow,
  type ExportSetRow,
  type ImportReport,
  type MeasurementInput,
  type RawSyncRun,
  type SyncSource,
} from "./logicSync";

/**
 * Connect — readings from devices and files, and the poller's honesty trail.
 *
 * Every handler is scoped to the caller: reads are index scans on the caller's
 * own userId, writes re-derive the user from the session token. Nothing here
 * is gathered by any crew query — a reading never leaves the file it landed in.
 *
 * The commit path is one path. A CSV picked on the screen, an InBody sheet
 * typed into the form and the Renpho poller all come through the same
 * validation, the same dedupe plan and the same day-fill rule — so the route
 * a number took can never change what was allowed in. This file never parses
 * a file: parsing happens where the file is (parseConnectCsv on the client,
 * the record mapper in the poller), and what arrives here is structured rows,
 * checked again.
 */

const POLLER_SOURCE = "renpho-cloud";

/** Bounds on a single request. A two-person file does not exceed these. */
const MAX_MEASUREMENTS_READ = 2000;
const MAX_DAYS_READ = 800;
const MAX_SETS_READ = 2000;
const MAX_LAB_RESULTS_READ = 1200;
/** Runs kept per source — a trail, not an archive. */
const KEEP_RUNS = 20;

const measurementArg = v.object({
  date: v.string(),
  time: v.optional(v.string()),
  weightKg: v.optional(v.number()),
  bodyFatPct: v.optional(v.number()),
  bodyFatMassKg: v.optional(v.number()),
  skeletalMuscleKg: v.optional(v.number()),
  muscleMassKg: v.optional(v.number()),
  visceralFat: v.optional(v.number()),
  waterPct: v.optional(v.number()),
  bmrKcal: v.optional(v.number()),
});

/** The screen's import sources. The poller's own tag is not accepted from a client. */
const importSourceArg = v.union(
  v.literal("renpho-csv"),
  v.literal("samsung-csv"),
  v.literal("csv"),
  v.literal("inbody"),
);

async function gatherReadings(ctx: QueryCtx, userId: Id<"tm_users">): Promise<ExistingReading[]> {
  const rows = await ctx.db
    .query("tm_bodyMeasurements")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
    .take(MAX_MEASUREMENTS_READ);
  return rows.map((r) => ({
    date: r.date,
    time: r.time,
    weightKg: r.weightKg,
    bodyFatPct: r.bodyFatPct,
    bodyFatMassKg: r.bodyFatMassKg,
    skeletalMuscleKg: r.skeletalMuscleKg,
    muscleMassKg: r.muscleMassKg,
    visceralFat: r.visceralFat,
    waterPct: r.waterPct,
    bmrKcal: r.bmrKcal,
    source: r.source,
  }));
}

async function lastRunFor(ctx: QueryCtx, source: string): Promise<RawSyncRun | null> {
  const runs = await ctx.db
    .query("tm_syncRuns")
    .withIndex("by_source", (q) => q.eq("source", source))
    .order("desc")
    .take(1);
  const run = runs[0];
  return run ? { at: run.at, ok: run.ok, reason: run.reason, fetched: run.fetched, wrote: run.wrote } : null;
}

/** Whether this deployment can poll Renpho at all. The screen repeats the answer honestly. */
function pollerConfigured(): boolean {
  return (
    (process.env.RENPHO_EMAIL ?? "").trim() !== "" && (process.env.RENPHO_PASSWORD ?? "").trim() !== ""
  );
}

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }): Promise<ConnectView> => {
    const user = await requireUser(ctx, token);
    return buildConnectView({
      mode: user.mode,
      date,
      measurements: await gatherReadings(ctx, user._id),
      lastRun: await lastRunFor(ctx, POLLER_SOURCE),
      pollerConfigured: pollerConfigured(),
    });
  },
});

/**
 * The single commit path. Validates every row again — the client's preview is
 * a courtesy, not an authority — plans against what is on file, writes what is
 * new, and fills daily weigh-ins only where none exists. Returns the same
 * numbers the plan promised, so the screen can repeat them truthfully.
 */
async function commitReadings(
  ctx: MutationCtx,
  user: Doc<"tm_users">,
  source: SyncSource,
  rows: MeasurementInput[],
  device: string | undefined,
): Promise<ImportReport> {
  if (rows.length === 0) throw new ConvexError("empty-import");
  if (rows.length > MAX_IMPORT_ROWS) throw new ConvexError("too-many-rows");

  const errors: string[] = [];
  const valid: MeasurementInput[] = [];
  for (const row of rows) {
    const rowErrors = validateMeasurement(row);
    if (rowErrors.length > 0) errors.push(`${row.date || "(no date)"}: ${rowErrors[0]}`);
    else valid.push(row);
  }

  const existing = await gatherReadings(ctx, user._id);
  const dayRows = await ctx.db
    .query("tm_days")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
    .take(MAX_DAYS_READ);
  const dayHasWeight = new Map(dayRows.map((d) => [d.date, d.weightKg !== undefined]));

  const plan = planImport(existing, valid, source, dayHasWeight);
  const deviceLabel = device?.trim().slice(0, 60) || undefined;
  const importedAt = Date.now();

  for (const reading of plan.toWrite) {
    await ctx.db.insert("tm_bodyMeasurements", {
      userId: user._id,
      ...reading,
      source,
      device: deviceLabel,
      importedAt,
    });
  }

  // First weight of each newly-written day fills the daily weigh-in the rest
  // of the file trends from — and only where nobody logged one. planImport
  // already refused every date that carries a typed weight.
  const fillWeight = new Map<string, number>();
  for (const reading of plan.toWrite) {
    if (reading.weightKg === undefined || !plan.fills.includes(reading.date)) continue;
    const current = fillWeight.get(reading.date);
    if (current === undefined) fillWeight.set(reading.date, reading.weightKg);
  }
  for (const date of plan.fills) {
    const weightKg = fillWeight.get(date);
    if (weightKg === undefined) continue;
    const day = dayRows.find((d) => d.date === date);
    if (day) {
      if (day.weightKg === undefined) await ctx.db.patch("tm_days", day._id, { weightKg });
    } else {
      await ctx.db.insert("tm_days", { userId: user._id, date, weightKg });
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

export const importMeasurements = mutation({
  args: {
    token: v.string(),
    source: importSourceArg,
    device: v.optional(v.string()),
    rows: v.array(measurementArg),
  },
  handler: async (ctx, { token, source, device, rows }): Promise<ImportReport> => {
    const user = await requireUser(ctx, token);
    return commitReadings(ctx, user, source, rows, device);
  },
});

/**
 * Raw rows for the caller's own file, for the client-side CSV builders in
 * logicSync.ts. Owner-scoped like everything else: the token names whose file
 * leaves, and only theirs.
 */
export const exportBundle = query({
  args: { token: v.string() },
  handler: async (
    ctx,
    { token },
  ): Promise<{
    days: ExportDayRow[];
    sets: ExportSetRow[];
    labs: ExportLabRow[];
    readings: ExistingReading[];
  }> => {
    const user = await requireUser(ctx, token);
    const days = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
      .take(MAX_DAYS_READ);
    const sets = await ctx.db
      .query("tm_setLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
      .take(MAX_SETS_READ);
    const labs = await ctx.db
      .query("tm_labResults")
      .withIndex("by_userId_and_marker", (q) => q.eq("userId", user._id))
      .take(MAX_LAB_RESULTS_READ);
    return {
      days: days
        .map((d) => ({ date: d.date, weightKg: d.weightKg, stress: d.stress, energy: d.energy }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      sets: sets
        .map((s) => ({
          date: s.date,
          exercise: s.exercise,
          setIndex: s.setIndex,
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      labs: labs
        .map((r) => ({
          date: r.date,
          marker: r.marker,
          value: r.value,
          unit: r.unit,
          refLow: r.refLow,
          refHigh: r.refHigh,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      readings: (await gatherReadings(ctx, user._id)).sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});

/* ===== the poller's half — internal only ===== */

/**
 * The Renpho poller's write path. Same commit as the screen's import — the
 * poller earns no shortcut around validation or dedupe — plus the user lookup,
 * because an action holds an env-named slug, never a session.
 */
export const commitFromPoller = internalMutation({
  args: {
    slug: v.string(),
    device: v.optional(v.string()),
    rows: v.array(measurementArg),
  },
  handler: async (ctx, { slug, device, rows }): Promise<ImportReport> => {
    const user = await ctx.db
      .query("tm_users")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!user) throw new ConvexError("unknown-user");
    return commitReadings(ctx, user, POLLER_SOURCE, rows, device);
  },
});

/** One line of the honesty trail, pruned to a short tail per source. */
export const recordRun = internalMutation({
  args: {
    source: v.string(),
    at: v.number(),
    ok: v.boolean(),
    reason: v.string(),
    fetched: v.number(),
    wrote: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tm_syncRuns", args);
    const runs = await ctx.db
      .query("tm_syncRuns")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .take(KEEP_RUNS * 3);
    if (runs.length > KEEP_RUNS) {
      for (const stale of runs.slice(0, runs.length - KEEP_RUNS)) {
        await ctx.db.delete("tm_syncRuns", stale._id);
      }
    }
    return null;
  },
});

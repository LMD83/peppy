import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireUser } from "./db";
import { markerByKey } from "./data/markers";
import {
  buildLabsView,
  type LabsView,
  type LabsViewInput,
  type RawLabPanel,
  type RawLabResult,
} from "./logicLabs";

/**
 * Labs — blood panels, reference intervals, trends.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and the panel a result attaches to is re-checked against
 * that userId before insertion. Nothing here reads another user's data, so
 * nothing here can reach the crew projection — bloods never leave your own file.
 */

const dateArg = v.string();

/** Bounds on a single request. A person does not have more history than this. */
const MAX_PANELS = 60;
const MAX_RESULTS = 1200;
const MAX_RESULTS_PER_PANEL = 80;

async function gather(ctx: QueryCtx, user: Doc<"tm_users">, date: string): Promise<LabsViewInput> {
  const panelRows = await ctx.db
    .query("tm_labPanels")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_PANELS);

  const resultRows = await ctx.db
    .query("tm_labResults")
    .withIndex("by_userId_and_marker", (q) => q.eq("userId", user._id))
    .take(MAX_RESULTS);

  const panels: RawLabPanel[] = panelRows.map((p) => ({
    id: p._id,
    date: p.date,
    name: p.name,
    lab: p.lab ?? null,
    fasted: p.fasted ?? null,
  }));

  const results: RawLabResult[] = resultRows.map((r) => ({
    panelId: r.panelId,
    date: r.date,
    marker: r.marker,
    value: r.value,
    unit: r.unit,
    refLow: r.refLow ?? null,
    refHigh: r.refHigh ?? null,
  }));

  return { mode: user.mode, date, panels, results };
}

export const get = query({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }): Promise<LabsView> => {
    const user = await requireUser(ctx, token);
    return buildLabsView(await gather(ctx, user, date));
  },
});

export const addPanel = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    name: v.string(),
    fasted: v.optional(v.boolean()),
    results: v.array(v.object({ marker: v.string(), value: v.number(), unit: v.string() })),
  },
  handler: async (ctx, { token, date, name, fasted, results }) => {
    const user = await requireUser(ctx, token);
    // A panel with no results is not a panel — it would only pollute the trend.
    if (results.length === 0) throw new ConvexError("empty-panel");
    if (results.length > MAX_RESULTS_PER_PANEL) throw new ConvexError("panel-too-large");
    for (const r of results) {
      // A typo becomes a marker with no reference interval forever — reject it here.
      if (!markerByKey(r.marker)) throw new ConvexError("unknown-marker");
      if (!Number.isFinite(r.value)) throw new ConvexError("bad-value");
    }

    const panelId = await ctx.db.insert("tm_labPanels", {
      userId: user._id,
      date,
      name: name.trim().slice(0, 80) || "Panel",
      fasted,
    });

    for (const r of results) {
      const def = markerByKey(r.marker);
      await ctx.db.insert("tm_labResults", {
        userId: user._id,
        panelId,
        date,
        marker: r.marker,
        value: r.value,
        unit: r.unit,
        // Record the interval the value was read against, so a later catalogue
        // change never silently re-flags an old draw.
        refLow: def?.refLow,
        refHigh: def?.refHigh,
      });
    }
    return null;
  },
});

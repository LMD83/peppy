import { v } from "convex/values";
import { query } from "../_generated/server";
import { addDays } from "./lib";
import { requireUser } from "./db";
import { buildTriggerMap, classifyEngine, findPeak, isWinterWindow } from "./logic";

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }) => {
    const user = await requireUser(ctx, token);

    // Trigger map — last 14 days of craving logs, hour × signal.
    const cravings = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(date, -i);
      const rows = await ctx.db
        .query("tm_cravings")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", d))
        .take(50);
      cravings.push(...rows);
    }
    const triggerMap = buildTriggerMap(cravings);
    const engine = classifyEngine(cravings);
    const peak = findPeak(triggerMap);
    const total = cravings.length;

    const experiments = await ctx.db.query("tm_experiments").take(20);
    const visibleExperiments = experiments
      .filter((e) => e.userId === undefined || e.userId === user._id)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((e) => ({
        code: e.code,
        name: e.name,
        hypothesis: e.hypothesis,
        protocol: e.protocol,
        durationDays: e.durationDays,
        metric: e.metric,
        status: e.status,
        startDate: e.startDate ?? null,
        note: e.note ?? null,
      }));

    // Disputed-marker ledger and labs are owner-only by construction (keyed to the session user).
    const markers = (
      await ctx.db
        .query("tm_markers")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(30)
    ).map((m) => ({
      gene: m.gene,
      csvCall: m.csvCall,
      reportCall: m.reportCall,
      status: m.status,
      resolvesVia: m.resolvesVia,
      resolvedDate: m.resolvedDate ?? null,
      method: m.method ?? null,
    }));

    const labs = (
      await ctx.db
        .query("tm_labs")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(50)
    ).map((l) => ({
      date: l.date,
      marker: l.marker,
      value: l.value,
      unit: l.unit,
      note: l.note ?? null,
      recheckDate: l.recheckDate ?? null,
      recheckInDays: l.recheckDate ? Math.max(0, Math.round((Date.parse(`${l.recheckDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000)) : null,
    }));

    // Seasonal layer (PER3 +/+): morning-light prompt Oct–Feb.
    const winterLayer = isWinterWindow(date);

    return { triggerMap, engine, peak, totalCravings: total, experiments: visibleExperiments, markers, labs, winterLayer };
  },
});

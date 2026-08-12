import { v } from "convex/values";
import { query } from "../_generated/server";
import { addDays, requireUser } from "./lib";

const SIGNALS = ["tired", "emotion", "cue", "bored", "hungry"] as const;

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
    const byHour = new Map<number, Record<string, number>>();
    const bySignal: Record<string, number> = {};
    for (const c of cravings) {
      const hour = Number(c.time.slice(0, 2));
      const bucket = byHour.get(hour) ?? {};
      bucket[c.signal] = (bucket[c.signal] ?? 0) + 1;
      byHour.set(hour, bucket);
      bySignal[c.signal] = (bySignal[c.signal] ?? 0) + 1;
    }
    const triggerMap = Array.from(byHour.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, counts]) => ({ hour, counts }));

    // Engine read-out: which craving engine dominates — the fix differs per engine.
    const total = cravings.length;
    let engine: "depletion" | "emotion" | "cue" | "mixed" | "insufficient" = "insufficient";
    if (total >= 6) {
      const depletion = bySignal["tired"] ?? 0;
      const emotion = bySignal["emotion"] ?? 0;
      const cue = (bySignal["cue"] ?? 0) + (bySignal["bored"] ?? 0);
      const top = Math.max(depletion, emotion, cue);
      if (top / total >= 0.5)
        engine = top === depletion ? "depletion" : top === emotion ? "emotion" : "cue";
      else engine = "mixed";
    }

    // Peak window finding.
    let peak: { fromHour: number; share: number; signal: string } | null = null;
    if (total > 0) {
      const best = [...triggerMap].sort(
        (a, b) =>
          Object.values(b.counts).reduce((s, n) => s + n, 0) -
          Object.values(a.counts).reduce((s, n) => s + n, 0),
      )[0];
      const hourTotal = Object.values(best.counts).reduce((s, n) => s + n, 0);
      const topSignal = SIGNALS.reduce((acc, s) =>
        (best.counts[s] ?? 0) > (best.counts[acc] ?? 0) ? s : acc,
      );
      peak = {
        fromHour: best.hour,
        share: Math.round(((best.counts[topSignal] ?? 0) / hourTotal) * 100),
        signal: topSignal,
      };
    }

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
    const month = Number(date.slice(5, 7));
    const winterLayer = month >= 10 || month <= 2;

    return { triggerMap, engine, peak, totalCravings: total, experiments: visibleExperiments, markers, labs, winterLayer };
  },
});

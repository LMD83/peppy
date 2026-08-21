import { v } from "convex/values";
import { query } from "../_generated/server";
import { adherenceStats, requireUser } from "./db";
import { projectGoal, targetKgFor } from "./logic";

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }) => {
    const user = await requireUser(ctx, token);

    const days = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(180);
    const weighIns = days
      .filter((d) => d.weightKg !== undefined)
      .map((d) => ({ date: d.date, kg: d.weightKg as number }))
      .reverse();

    const series = weighIns.map((w) => ({
      date: w.date,
      actual: w.kg,
      target: targetKgFor(user.startKg, user.startDate, w.date),
    }));

    const stats = await adherenceStats(ctx, user, date);
    const latestKg = weighIns.length > 0 ? weighIns[weighIns.length - 1].kg : user.startKg;
    const goalProjection = projectGoal(
      latestKg,
      user.goalKg,
      weighIns.map((w) => ({ date: w.date, weightKg: w.kg })),
    );

    return {
      series,
      ceilingKg: user.ceilingKg,
      goalKg: user.goalKg,
      startKg: user.startKg,
      mode: user.mode,
      wall: stats.wall,
      adherence7: stats.adherence7,
      streak: stats.streak,
      deltaKg: Math.round((latestKg - user.startKg) * 10) / 10,
      goalProjection,
    };
  },
});

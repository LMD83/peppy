import { v } from "convex/values";
import { query } from "../_generated/server";
import { CUT_RATE_KG_PER_WEEK, adherenceStats, daysBetween, requireUser } from "./lib";

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
      target:
        Math.round(
          (user.startKg - (daysBetween(user.startDate, w.date) / 7) * CUT_RATE_KG_PER_WEEK) * 10,
        ) / 10,
    }));

    const stats = await adherenceStats(ctx, user, date);
    const latestKg = weighIns.length > 0 ? weighIns[weighIns.length - 1].kg : user.startKg;

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
    };
  },
});

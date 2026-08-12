import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { daysBetween } from "./lib";
import { adherenceStats, requireUser } from "./db";

/**
 * The shared crew board. Privacy is enforced HERE, at the query level:
 * for each member this returns only the shared projection —
 * name, mode, streak, adherence, today's score and days-in-mode.
 * Weights, BP, labs and logs are unreadable by the other user by construction.
 */
export const board = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }) => {
    const viewer = await requireUser(ctx, token);
    const users = await ctx.db.query("tm_users").take(8);
    const members = [];
    for (const u of users) {
      const stats = await adherenceStats(ctx, u, date);
      members.push({
        slug: u.slug,
        name: u.name,
        isYou: u._id === viewer._id,
        mode: u.mode,
        modeSince: u.modeSince,
        reviewDate: u.reviewDate ?? null,
        daysInMode: daysBetween(u.modeSince, date),
        streak: stats.streak,
        adherence7: stats.adherence7,
        todayDone: stats.todayDone,
        todayTotal: stats.todayTotal,
      });
    }
    members.sort((a, b) => (a.isYou === b.isYou ? 0 : a.isYou ? -1 : 1));
    return members;
  },
});

export const feed = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireUser(ctx, token);
    const rows = await ctx.db.query("tm_crewFeed").order("desc").take(20);
    return rows
      .map((r) => ({ name: r.name, message: r.message, at: r._creationTime }))
      .reverse();
  },
});

export const nudge = mutation({
  args: { token: v.string(), message: v.string() },
  handler: async (ctx, { token, message }) => {
    const user = await requireUser(ctx, token);
    const trimmed = message.trim().slice(0, 200);
    if (!trimmed) throw new Error("Empty nudge");
    await ctx.db.insert("tm_crewFeed", { userId: user._id, name: user.name, message: trimmed });
    return null;
  },
});

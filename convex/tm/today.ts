import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { MODE_CHECKS, SESSION_PLAN, daysBetween } from "./lib";
import { adherenceStats, checksForDate, requireUser } from "./db";
import { overloadFlag, tripwireFor } from "./logic";

const dateArg = v.string();

export const get = query({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }) => {
    const user = await requireUser(ctx, token);
    const checks = await checksForDate(ctx, user._id, user.mode, date);
    const day = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();
    const cravingsToday = await ctx.db
      .query("tm_cravings")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(50);

    // Latest weight for the scoreboard (owner's own data — never crosses users).
    const days = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(60);
    const latestWeighed = days.find((d) => d.weightKg !== undefined);
    const latestKg = latestWeighed?.weightKg ?? user.startKg;

    const stats = await adherenceStats(ctx, user, date);

    // Session plan + overload flags (cut/maintain only).
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const plan = user.mode === "survival" ? null : SESSION_PLAN[weekday];
    const session =
      plan === null || plan === undefined
        ? null
        : {
            name: plan.name,
            exercises: await Promise.all(
              plan.exercises.map(async (ex) => {
                const recent = await ctx.db
                  .query("tm_lifts")
                  .withIndex("by_userId_and_exercise", (q) =>
                    q.eq("userId", user._id).eq("exercise", ex.name),
                  )
                  .order("desc")
                  .take(2);
                return {
                  ...ex,
                  lastKg: recent[0]?.topSetWeightKg ?? null,
                  flag: overloadFlag(recent),
                };
              }),
            ),
          };

    // Maintain-mode tripwires with pre-written responses.
    const tripwire = tripwireFor(user.mode, user.goalKg, latestWeighed?.weightKg);

    return {
      user: {
        slug: user.slug,
        name: user.name,
        mode: user.mode,
        protocolTitle: user.protocolTitle,
        kitchenClose: user.kitchenClose,
        ceilingKg: user.ceilingKg,
        goalKg: user.goalKg,
        startKg: user.startKg,
        reviewDate: user.reviewDate ?? null,
        modeSince: user.modeSince,
      },
      checks,
      day: {
        weightKg: day?.weightKg ?? null,
        stress: day?.stress ?? null,
        energy: day?.energy ?? null,
        ritualDone: day?.ritualDone ?? false,
      },
      latestKg,
      deltaKg: Math.round((latestKg - user.startKg) * 10) / 10,
      dayNumber: daysBetween(user.startDate, date) + 1,
      cravingsToday: cravingsToday.length,
      stats: {
        adherence7: stats.adherence7,
        streak: stats.streak,
        todayDone: stats.todayDone,
        todayTotal: stats.todayTotal,
      },
      session,
      tripwire,
    };
  },
});

export const toggleCheck = mutation({
  args: { token: v.string(), date: dateArg, key: v.string() },
  handler: async (ctx, { token, date, key }) => {
    const user = await requireUser(ctx, token);
    if (!MODE_CHECKS[user.mode].some((c) => c.key === key)) throw new Error("Unknown check");
    const existing = await ctx.db
      .query("tm_checks")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(16);
    const row = existing.find((r) => r.key === key);
    if (row) await ctx.db.patch("tm_checks", row._id, { done: !row.done });
    else await ctx.db.insert("tm_checks", { userId: user._id, date, key, done: true });
    return null;
  },
});

export const logWeight = mutation({
  args: { token: v.string(), date: dateArg, weightKg: v.number() },
  handler: async (ctx, { token, date, weightKg }) => {
    const user = await requireUser(ctx, token);
    const day = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();
    if (day) await ctx.db.patch("tm_days", day._id, { weightKg });
    else await ctx.db.insert("tm_days", { userId: user._id, date, weightKg });
    return null;
  },
});

export const logState = mutation({
  args: { token: v.string(), date: dateArg, stress: v.number(), energy: v.number() },
  handler: async (ctx, { token, date, stress, energy }) => {
    const user = await requireUser(ctx, token);
    const day = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();
    if (day) await ctx.db.patch("tm_days", day._id, { stress, energy });
    else await ctx.db.insert("tm_days", { userId: user._id, date, stress, energy });
    return null;
  },
});

export const markRitual = mutation({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }) => {
    const user = await requireUser(ctx, token);
    const day = await ctx.db
      .query("tm_days")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();
    if (day) await ctx.db.patch("tm_days", day._id, { ritualDone: true });
    else await ctx.db.insert("tm_days", { userId: user._id, date, ritualDone: true });
    return null;
  },
});

export const logCraving = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    time: v.string(),
    signal: v.union(
      v.literal("tired"),
      v.literal("emotion"),
      v.literal("cue"),
      v.literal("bored"),
      v.literal("hungry"),
    ),
    emotionWord: v.optional(v.string()),
    afterState: v.optional(
      v.union(v.literal("relief"), v.literal("guilt"), v.literal("numb"), v.literal("satisfied")),
    ),
    action: v.optional(v.union(v.literal("rode"), v.literal("substitute"), v.literal("ate"))),
  },
  handler: async (ctx, { token, ...entry }) => {
    const user = await requireUser(ctx, token);
    await ctx.db.insert("tm_cravings", { userId: user._id, ...entry });
    return null;
  },
});

export const logLift = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    exercise: v.string(),
    topSetWeightKg: v.number(),
    topSetReps: v.number(),
  },
  handler: async (ctx, { token, ...entry }) => {
    const user = await requireUser(ctx, token);
    await ctx.db.insert("tm_lifts", { userId: user._id, ...entry });
    return null;
  },
});

export const setMode = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    mode: v.union(v.literal("cut"), v.literal("maintain"), v.literal("survival")),
    reason: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
  },
  handler: async (ctx, { token, date, mode, reason, reviewDate }) => {
    const user = await requireUser(ctx, token);
    if (mode === user.mode) return null;
    const ceilingKg = mode === "survival" ? user.goalKg + 4 : user.ceilingKg;
    await ctx.db.patch("tm_users", user._id, {
      mode,
      modeSince: date,
      modeReason: reason,
      reviewDate,
      ceilingKg,
    });
    await ctx.db.insert("tm_modeEvents", {
      userId: user._id,
      date,
      mode,
      label: reason ?? `Switched to ${mode}`,
    });
    // Entering survival is logged as an executed decision, never a failure state.
    const message =
      mode === "survival"
        ? `Survival mode on — floor protocol active${reviewDate ? `, review ${reviewDate}` : ""}. Executed as designed.`
        : `Mode → ${mode}.`;
    await ctx.db.insert("tm_crewFeed", { userId: user._id, name: user.name, message });
    return null;
  },
});

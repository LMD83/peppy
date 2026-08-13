import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { adherenceStats, requireUser } from "./db";
import { instrumentByKey } from "./data/instruments";
import { addDays } from "./lib";
import { buildTriggerMap } from "./logic";
import {
  InstrumentInputError,
  buildMindView,
  scoreInstrument,
  type MindView,
  type MindViewInput,
  type RawAssessment,
  type RawIntention,
  type RawReflection,
} from "./logic-mind";

/**
 * Mind — validated self-report instruments, implementation intentions,
 * reflections and encouragement.
 *
 * Every handler is scoped to the caller: reads are index scans keyed on the
 * caller's own userId, and an intention is re-checked against that userId
 * before its win counter moves. Nothing here reads another user's rows, so
 * nothing here can reach the crew projection — questionnaire answers, safety
 * flags and reflections never leave your own file.
 *
 * Scores are computed server-side from the raw answers. A client-sent score is
 * never stored and never trusted.
 */

const dateArg = v.string();

/** Bounds on a single request. A person does not have more history than this. */
const MAX_ASSESSMENTS = 400;
const MAX_INTENTIONS = 60;
const MAX_REFLECTIONS = 60;
const MAX_CRAVINGS = 300;
const TRIGGER_WINDOW_DAYS = 14;

/** Field caps — these are notes to self, not documents. */
const MAX_TRIGGER_CHARS = 120;
const MAX_ACTION_CHARS = 160;
const MAX_RESPONSE_CHARS = 2000;
const MAX_WIN_CHARS = 160;
const MAX_ACTIVE_INTENTIONS = 12;

async function gather(ctx: QueryCtx, user: Doc<"tm_users">, date: string): Promise<MindViewInput> {
  const assessmentRows = await ctx.db
    .query("tm_assessments")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_ASSESSMENTS);

  const intentionRows = await ctx.db
    .query("tm_intentions")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(MAX_INTENTIONS);

  const reflectionRows = await ctx.db
    .query("tm_reflections")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(MAX_REFLECTIONS);

  // Suggestions come from this person's own trigger map — the trailing fortnight.
  const cravingRows = await ctx.db
    .query("tm_cravings")
    .withIndex("by_userId_and_date", (q) =>
      q.eq("userId", user._id).gte("date", addDays(date, -(TRIGGER_WINDOW_DAYS - 1))).lte("date", date),
    )
    .take(MAX_CRAVINGS);

  const stats = await adherenceStats(ctx, user, date);
  const yesterday = addDays(date, -1);
  const yesterdayRow = stats.wall.find((d) => d.date === yesterday);
  const missedYesterday = yesterdayRow !== undefined && yesterdayRow.done < yesterdayRow.total;

  const assessments: RawAssessment[] = assessmentRows.map((a) => ({
    date: a.date,
    instrument: a.instrument,
    answers: a.answers,
    score: a.score,
    band: a.band,
  }));

  const intentions: RawIntention[] = intentionRows.map((i) => ({
    id: i._id,
    trigger: i.trigger,
    action: i.action,
    active: i.active,
    createdDate: i.createdDate,
    wins: i.wins,
  }));

  const reflections: RawReflection[] = reflectionRows.map((r) => ({
    date: r.date,
    prompt: r.prompt,
    response: r.response,
    win: r.win ?? null,
  }));

  return {
    mode: user.mode,
    date,
    assessments,
    intentions,
    reflections,
    triggerMap: buildTriggerMap(cravingRows),
    streak: stats.streak,
    adherence7: stats.adherence7,
    missedYesterday,
  };
}

export const get = query({
  args: { token: v.string(), date: dateArg },
  handler: async (ctx, { token, date }): Promise<MindView> => {
    const user = await requireUser(ctx, token);
    return buildMindView(await gather(ctx, user, date));
  },
});

export const submitAssessment = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    instrument: v.string(),
    answers: v.array(v.number()),
  },
  handler: async (ctx, { token, date, instrument, answers }) => {
    const user = await requireUser(ctx, token);
    const def = instrumentByKey(instrument);
    if (!def) throw new ConvexError("unknown-instrument");

    // Scored here, from the raw answers. A client-sent total is never accepted.
    let scored;
    try {
      scored = scoreInstrument(def, answers);
    } catch (err) {
      if (err instanceof InstrumentInputError) throw new ConvexError(err.code);
      throw err;
    }

    // Re-taking on the same day corrects the entry rather than adding a second
    // point — two totals from one afternoon would be a fake trend.
    const sameInstrument = await ctx.db
      .query("tm_assessments")
      .withIndex("by_userId_and_instrument", (q) =>
        q.eq("userId", user._id).eq("instrument", def.key),
      )
      .take(MAX_ASSESSMENTS);
    const existing = sameInstrument.find((row) => row.date === date);

    if (existing) {
      await ctx.db.patch("tm_assessments", existing._id, {
        answers: [...answers],
        score: scored.score,
        band: scored.band,
      });
    } else {
      await ctx.db.insert("tm_assessments", {
        userId: user._id,
        date,
        instrument: def.key,
        answers: [...answers],
        score: scored.score,
        band: scored.band,
      });
    }
    return null;
  },
});

export const addIntention = mutation({
  args: { token: v.string(), date: dateArg, trigger: v.string(), action: v.string() },
  handler: async (ctx, { token, date, trigger, action }) => {
    const user = await requireUser(ctx, token);
    const t = trigger.trim().slice(0, MAX_TRIGGER_CHARS);
    const a = action.trim().slice(0, MAX_ACTION_CHARS);
    // A half-written plan is worse than none — it reads as a rule you broke.
    if (t.length === 0 || a.length === 0) throw new ConvexError("empty-intention");

    const existing = await ctx.db
      .query("tm_intentions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_INTENTIONS);
    if (existing.filter((row) => row.active).length >= MAX_ACTIVE_INTENTIONS) {
      throw new ConvexError("too-many-intentions");
    }

    await ctx.db.insert("tm_intentions", {
      userId: user._id,
      trigger: t,
      action: a,
      active: true,
      createdDate: date,
      wins: 0,
    });
    return null;
  },
});

export const markIntentionWin = mutation({
  args: { token: v.string(), intentionId: v.id("tm_intentions") },
  handler: async (ctx, { token, intentionId }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db.get("tm_intentions", intentionId);
    // Ownership is verified before the counter moves — an id from elsewhere is
    // indistinguishable from a row that does not exist.
    if (!row || row.userId !== user._id) throw new ConvexError("not-found");
    await ctx.db.patch("tm_intentions", intentionId, { wins: row.wins + 1 });
    return null;
  },
});

export const saveReflection = mutation({
  args: {
    token: v.string(),
    date: dateArg,
    prompt: v.string(),
    response: v.string(),
    win: v.optional(v.string()),
  },
  handler: async (ctx, { token, date, prompt, response, win }) => {
    const user = await requireUser(ctx, token);
    const text = response.trim().slice(0, MAX_RESPONSE_CHARS);
    if (text.length === 0) throw new ConvexError("empty-reflection");
    const winText = win?.trim().slice(0, MAX_WIN_CHARS);

    const sameDay = await ctx.db
      .query("tm_reflections")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(4);
    const existing = sameDay[0];

    // One reflection per day, edited in place. The log is a record, not a feed.
    if (existing) {
      await ctx.db.patch("tm_reflections", existing._id, {
        prompt: prompt.trim().slice(0, MAX_RESPONSE_CHARS),
        response: text,
        win: winText && winText.length > 0 ? winText : undefined,
      });
    } else {
      await ctx.db.insert("tm_reflections", {
        userId: user._id,
        date,
        prompt: prompt.trim().slice(0, MAX_RESPONSE_CHARS),
        response: text,
        win: winText && winText.length > 0 ? winText : undefined,
      });
    }
    return null;
  },
});

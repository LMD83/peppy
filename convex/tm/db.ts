import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MODE_CHECKS, addDays, type TmMode } from "./lib";
import { computeStreakAndAdherence, type WallDay } from "./logic";

export async function requireUser(ctx: QueryCtx, token: string): Promise<Doc<"tm_users">> {
  const session = await ctx.db
    .query("tm_sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session) throw new Error("Not signed in");
  const user = await ctx.db.get("tm_users", session.userId);
  if (!user) throw new Error("Not signed in");
  return user;
}

export async function checksForDate(
  ctx: QueryCtx,
  userId: Id<"tm_users">,
  mode: TmMode,
  date: string,
): Promise<{ key: string; label: string; done: boolean }[]> {
  const rows = await ctx.db
    .query("tm_checks")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .take(16);
  const doneByKey = new Map(rows.map((r) => [r.key, r.done]));
  return MODE_CHECKS[mode].map((c) => ({ ...c, done: doneByKey.get(c.key) ?? false }));
}

/** Adherence + streak over the trailing 14-day window, from per-day check rows. */
export async function adherenceStats(ctx: QueryCtx, user: Doc<"tm_users">, today: string) {
  const total = MODE_CHECKS[user.mode].length;
  const wall: WallDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const checks = await checksForDate(ctx, user._id, user.mode, date);
    wall.push({ date, done: checks.filter((c) => c.done).length, total });
  }
  return { ...computeStreakAndAdherence(wall, today), wall };
}

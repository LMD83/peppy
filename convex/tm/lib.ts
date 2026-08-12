import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type TmMode = "cut" | "maintain" | "survival";

export const MODE_CHECKS: Record<TmMode, { key: string; label: string }[]> = {
  cut: [
    { key: "session", label: "Session done" },
    { key: "plan", label: "Ate on plan" },
    { key: "salt", label: "Salt under 2 g" },
    { key: "steps", label: "8k+ steps" },
    { key: "supps", label: "Supps taken" },
  ],
  maintain: [
    { key: "kitchen", label: "Kitchen closed" },
    { key: "protein", label: "Protein hit" },
    { key: "steps", label: "Steps" },
    { key: "weighin", label: "Weigh-in logged" },
  ],
  survival: [
    { key: "protein", label: "Protein hit" },
    { key: "steps", label: "Steps" },
    { key: "kitchen", label: "Kitchen closed 20:30" },
  ],
};

// Weekly training template. Static config, not user data.
export const SESSION_PLAN: Record<number, { name: string; exercises: { name: string; repRange: string }[] } | null> = {
  1: {
    name: "Upper · push",
    exercises: [
      { name: "Bench press", repRange: "8–12" },
      { name: "Overhead press", repRange: "8–12" },
      { name: "Incline DB press", repRange: "10–12" },
      { name: "Triceps pushdown", repRange: "12–15" },
    ],
  },
  2: {
    name: "Lower",
    exercises: [
      { name: "Squat", repRange: "6–10" },
      { name: "Romanian deadlift", repRange: "8–12" },
      { name: "Leg press", repRange: "10–12" },
      { name: "Calf raise", repRange: "12–15" },
    ],
  },
  3: null,
  4: {
    name: "Upper · pull",
    exercises: [
      { name: "Barbell row", repRange: "8–12" },
      { name: "Lat pulldown", repRange: "8–12" },
      { name: "Face pull", repRange: "12–15" },
      { name: "Curl", repRange: "10–12" },
    ],
  },
  5: {
    name: "Full body",
    exercises: [
      { name: "Deadlift", repRange: "5–8" },
      { name: "DB bench", repRange: "8–12" },
      { name: "Barbell row", repRange: "8–12" },
      { name: "Curl", repRange: "10–12" },
    ],
  },
  6: null,
  0: null,
};

export const OVERLOAD_REPS = 12;
export const OVERLOAD_INCREMENT_KG = 2.5;
export const CUT_RATE_KG_PER_WEEK = 0.5;
export const SOFT_TRIPWIRE_KG = 2;
export const HARD_TRIPWIRE_KG = 3.5;
export const SURVIVAL_CEILING_OFFSET_KG = 4;

const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
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

/** Adherence + streak over the trailing window, computed from per-day check rows. */
export async function adherenceStats(
  ctx: QueryCtx,
  user: Doc<"tm_users">,
  today: string,
): Promise<{ adherence7: number; streak: number; todayDone: number; todayTotal: number; wall: { date: string; done: number; total: number }[] }> {
  const total = MODE_CHECKS[user.mode].length;
  const wall: { date: string; done: number; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const checks = await checksForDate(ctx, user._id, user.mode, date);
    wall.push({ date, done: checks.filter((c) => c.done).length, total });
  }
  const last7 = wall.slice(-7);
  const adherence7 = Math.round(
    (last7.reduce((s, d) => s + d.done, 0) / Math.max(1, last7.reduce((s, d) => s + d.total, 0))) * 100,
  );
  let streak = 0;
  for (let i = wall.length - 1; i >= 0; i--) {
    const d = wall[i];
    if (d.done >= d.total) streak++;
    else if (d.date === today) continue; // today still in play — don't break the streak yet
    else break;
  }
  const todayRow = wall[wall.length - 1];
  return { adherence7, streak, todayDone: todayRow.done, todayTotal: todayRow.total, wall };
}

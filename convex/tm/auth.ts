import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { randomToken, sha256Hex } from "./lib";
import { requireUser } from "./db";

const MAX_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60_000;

// Failures are returned, not thrown: a throw would roll back the transaction
// and erase the recorded failed attempt, defeating the lockout. Error codes
// also survive production error redaction this way.
export const login = mutation({
  args: { slug: v.string(), passcode: v.string() },
  handler: async (
    ctx,
    { slug, passcode },
  ): Promise<
    | { ok: true; token: string; slug: string; name: string }
    | { ok: false; code: "wrong-passcode" | "unknown-user" | "too-many-attempts" }
  > => {
    const now = Date.now();
    const attempts = await ctx.db
      .query("tm_loginAttempts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .order("desc")
      .take(MAX_FAILURES);
    const recent = attempts.filter((a) => now - a.at < LOCKOUT_WINDOW_MS);
    if (recent.length >= MAX_FAILURES) return { ok: false, code: "too-many-attempts" };

    const user = await ctx.db
      .query("tm_users")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const hash = user ? await sha256Hex(user.passcodeSalt + passcode) : "";
    if (!user || hash !== user.passcodeHash) {
      await ctx.db.insert("tm_loginAttempts", { slug, at: now });
      return { ok: false, code: user ? "wrong-passcode" : "unknown-user" };
    }
    for (const a of attempts) await ctx.db.delete("tm_loginAttempts", a._id);
    const token = randomToken();
    await ctx.db.insert("tm_sessions", { userId: user._id, token });
    return { ok: true, token, slug: user.slug, name: user.name };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("tm_sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) await ctx.db.delete("tm_sessions", session._id);
    return null;
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    return { slug: user.slug, name: user.name, mode: user.mode };
  },
});

export const roster = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("tm_users").take(8);
    return users.map((u) => ({ slug: u.slug, name: u.name }));
  },
});

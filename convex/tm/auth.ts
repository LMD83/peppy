import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { randomToken, sha256Hex } from "./lib";
import { requireUser } from "./db";

export const login = mutation({
  args: { slug: v.string(), passcode: v.string() },
  handler: async (ctx, { slug, passcode }) => {
    const user = await ctx.db
      .query("tm_users")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!user) throw new Error("Unknown user");
    const hash = await sha256Hex(user.passcodeSalt + passcode);
    if (hash !== user.passcodeHash) throw new Error("Wrong passcode");
    const token = randomToken();
    await ctx.db.insert("tm_sessions", { userId: user._id, token });
    return { token, slug: user.slug, name: user.name };
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

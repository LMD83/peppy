import { query } from "./_generated/server";
import { v } from "convex/values";

// Login-free batch lookup — the core trust feature.
export const lookup = query({
  args: { verifyId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("verifications")
      .withIndex("by_verifyId", (q) => q.eq("verifyId", args.verifyId.toUpperCase()))
      .first();
    if (!row) return { found: false as const };
    const product = await ctx.db
      .query("products").withIndex("by_slug", (q) => q.eq("slug", row.productSlug)).unique();
    return { found: true as const, batch: row.batch, product, coaUrl: row.coaUrl, firstScannedAt: row.firstScannedAt };
  },
});

// A user's personal authentication ledger — every batch they've ever bought.
export const myVerifications = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    ctx.db.query("verifications").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
});

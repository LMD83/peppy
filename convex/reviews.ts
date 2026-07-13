import { v } from "convex/values";
import { query } from "./_generated/server";

export const byProduct = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) =>
    ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productHandle", handle))
      .collect(),
});

export const ratingSummary = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productHandle", handle))
      .collect();
    if (reviews.length === 0) return { rating: 0, count: 0 };
    const rating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return { rating: Math.round(rating * 10) / 10, count: reviews.length };
  },
});

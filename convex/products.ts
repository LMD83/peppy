import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("products").collect(),
});

export const getByHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) =>
    ctx.db
      .query("products")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique(),
});

export const byCollection = query({
  args: { collection: v.string() },
  handler: async (ctx, { collection }) =>
    ctx.db
      .query("products")
      .withIndex("by_collection", (q) => q.eq("collection", collection))
      .collect(),
});

export const bestsellers = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    return all.filter((p) => p.bestseller);
  },
});

/** Suggested cross-sell: other products, prioritising bestsellers. */
export const related = query({
  args: { handle: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { handle, limit }) => {
    const all = await ctx.db.query("products").collect();
    return all
      .filter((p) => p.handle !== handle)
      .sort((a, b) => Number(b.bestseller ?? false) - Number(a.bestseller ?? false))
      .slice(0, limit ?? 3);
  },
});

import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("articles").collect();
    return all.sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("articles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
});

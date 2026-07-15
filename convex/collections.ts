import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("collections").collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("collections")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
});

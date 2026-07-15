import { v } from "convex/values";
import { query } from "./_generated/server";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("pages")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
});

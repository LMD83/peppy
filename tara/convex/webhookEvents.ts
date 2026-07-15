import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Audit trail + replay-dedupe for inbound webhooks. SumUp's callback design
// (see SUMUP.md) means we never trust its body regardless of delivery
// count, so it doesn't call this — this is currently Resend-only.
export const recordEvent = internalMutation({
  args: {
    source: v.union(v.literal("sumup"), v.literal("resend")),
    eventKey: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_source_key", (q) => q.eq("source", args.source).eq("eventKey", args.eventKey))
      .unique();
    if (existing) return; // already recorded — Svix may redeliver
    await ctx.db.insert("webhookEvents", { ...args, receivedAt: Date.now() });
  },
});

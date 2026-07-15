import { query } from "./_generated/server";
import { v } from "convex/values";

// Loyalty codes available to a user (repeat-customer rewards, etc.).
export const myCodes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    ctx.db
      .query("loyalty")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("used"), false))
      .collect(),
});

// NOTE: the automatic 2-vial/3-vial volume discount is CART-LEVEL and needs no login.
// It lives in pricing.ts (volumePercent) and is applied in orders.createOrder.
// This module is only for account-bound rewards (repeat-customer, referral, etc.).

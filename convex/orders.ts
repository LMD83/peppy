import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { shippingFor } from "../src/lib/checkout";

export const place = mutation({
  args: { sessionId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { sessionId, email }) => {
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    const lines = cart?.lines ?? [];
    if (lines.length === 0) {
      throw new Error("Cannot place an order with an empty cart");
    }
    const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    const shipping = shippingFor(subtotal);
    const total = subtotal + shipping;

    const orderId = await ctx.db.insert("orders", {
      sessionId,
      lines,
      subtotal,
      shipping,
      total,
      email,
      status: "placed",
    });

    if (cart) {
      await ctx.db.patch(cart._id, { lines: [] });
    }

    return orderId;
  },
});

export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) =>
    ctx.db
      .query("orders")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect(),
});

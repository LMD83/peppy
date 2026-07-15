import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { priceOrder, verifyIdFromBatch } from "./pricing";

// Create an order (called when the SumUp checkout is created, status "pending").
export const createOrder = mutation({
  args: {
    userId: v.optional(v.id("users")),
    email: v.string(),
    shipTo: v.object({
      name: v.string(), addr: v.string(), city: v.string(),
      post: v.string(), country: v.string(),
    }),
    items: v.array(v.object({
      productSlug: v.string(), name: v.string(), variantLabel: v.string(),
      batch: v.string(), unitPriceCents: v.number(), qty: v.number(),
    })),
    promoPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const totals = priceOrder(
      args.items.map((i) => ({ unitPriceCents: i.unitPriceCents, qty: i.qty })),
      args.promoPercent ?? 0
    );
    const year = new Date().getFullYear();
    const seq = 1000 + Math.floor(Math.random() * 9000);

    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      orderNo: `TARA-${year}-${seq}`,
      invoiceNo: `INV-${year}-${seq + 380}`,
      status: "pending",
      email: args.email,
      shipTo: args.shipTo,
      ...totals,
      createdAt: Date.now(),
    });

    for (const it of args.items) {
      const verifyId = verifyIdFromBatch(it.batch);
      await ctx.db.insert("orderItems", { orderId, verifyId, ...it });
      // record verification rows tied to the buyer for "My Verifications"
      await ctx.db.insert("verifications", {
        verifyId, batch: it.batch, productSlug: it.productSlug, userId: args.userId,
      });
    }
    return orderId;
  },
});

// Confirm payment (called by the SumUp webhook — see SUMUP.md).
export const markPaid = mutation({
  args: { orderNo: v.string(), sumupCheckoutId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders").withIndex("by_orderNo", (q) => q.eq("orderNo", args.orderNo)).unique();
    if (!order) throw new Error("order not found");
    await ctx.db.patch(order._id, { status: "paid", sumupCheckoutId: args.sumupCheckoutId });

    // Issue a repeat-customer reward on the user's SECOND+ paid order (optional loyalty).
    if (order.userId) {
      const paid = await ctx.db
        .query("orders").withIndex("by_user", (q) => q.eq("userId", order.userId!))
        .filter((q) => q.eq(q.field("status"), "paid")).collect();
      if (paid.length >= 1) {
        await ctx.db.insert("loyalty", {
          userId: order.userId, code: `TARA-RPT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          percent: 10, reason: "repeat-customer", used: false, createdAt: Date.now(),
        });
      }
    }
    // TODO: trigger invoice PDF + confirmation email action here.
    return order._id;
  },
});

export const listMyOrders = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders").withIndex("by_user", (q) => q.eq("userId", args.userId)).order("desc").collect();
    return Promise.all(orders.map(async (o) => ({
      ...o,
      items: await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", o._id)).collect(),
    })));
  },
});

// One-click reorder: returns the line items of a past order to repopulate the cart.
export const reorder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) =>
    ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", args.orderId)).collect(),
});

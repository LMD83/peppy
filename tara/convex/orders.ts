import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { priceOrder, verifyIdFromBatch } from "./pricing";

// Create an order (status "pending") — called right before a SumUp checkout
// is created for it. If the caller is signed in, the order is linked to
// their account; guest checkout stays fully supported.
export const createOrder = mutation({
  args: {
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
    if (args.items.length === 0) throw new Error("Cannot create an order with no items");
    const userId = await getAuthUserId(ctx);

    const totals = priceOrder(
      args.items.map((i) => ({ unitPriceCents: i.unitPriceCents, qty: i.qty })),
      args.promoPercent ?? 0
    );
    const year = new Date().getFullYear();

    // orderNo now backs a live client-facing status lookup (getOrderStatus)
    // as well as the SumUp checkout_reference, so a collision is a real
    // correctness bug, not just cosmetic — check before inserting.
    let seq = 0;
    let orderNo = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      seq = 1000 + Math.floor(Math.random() * 9000);
      orderNo = `TARA-${year}-${seq}`;
      const existing = await ctx.db.query("orders").withIndex("by_orderNo", (q) => q.eq("orderNo", orderNo)).unique();
      if (!existing) break;
    }

    const orderId = await ctx.db.insert("orders", {
      userId: userId ?? undefined,
      orderNo,
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
      await ctx.db.insert("verifications", {
        verifyId, batch: it.batch, productSlug: it.productSlug, userId: userId ?? undefined,
      });
    }
    return { orderId, orderNo };
  },
});

export const getOrderInternal = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => ctx.db.get(args.orderId),
});

// Called only from convex/sumup.ts right after a checkout is created there.
export const attachSumupCheckout = internalMutation({
  args: { orderId: v.id("orders"), sumupCheckoutId: v.string(), sumupCheckoutReference: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      sumupCheckoutId: args.sumupCheckoutId,
      sumupCheckoutReference: args.sumupCheckoutReference,
    });
  },
});

// The ONLY path that flips an order to "paid". Never callable from the
// client directly — reached exclusively via convex/sumup.ts, which itself
// only calls this after independently re-fetching the checkout's status
// from SumUp's API with our server-side secret key (see SUMUP.md: we never
// trust a webhook body or client claim of "paid" on its own).
// Idempotent: a duplicate webhook delivery or a client-triggered re-check
// racing the webhook both no-op once the order is already paid.
export const markPaidInternal = internalMutation({
  args: { sumupCheckoutId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders").withIndex("by_sumupCheckoutId", (q) => q.eq("sumupCheckoutId", args.sumupCheckoutId)).unique();
    if (!order) throw new Error(`No order found for SumUp checkout ${args.sumupCheckoutId}`);
    if (order.status !== "pending") return order._id; // already resolved — idempotent no-op

    await ctx.db.patch(order._id, { status: "paid" });

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

    await ctx.scheduler.runAfter(0, internal.emailActions.sendOrderConfirmation, { orderId: order._id });
    return order._id;
  },
});

export const markFailedInternal = internalMutation({
  args: { sumupCheckoutId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders").withIndex("by_sumupCheckoutId", (q) => q.eq("sumupCheckoutId", args.sumupCheckoutId)).unique();
    if (!order || order.status !== "pending") return;
    await ctx.db.patch(order._id, { status: "failed" });
  },
});

export const markConfirmationEmailSent = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { confirmationEmailSentAt: Date.now() });
  },
});

export const getOrderForEmail = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    const items = await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
    return { order, items };
  },
});

// Minimal, non-sensitive status the client polls after a SumUp widget
// callback — no shipping address or line items, just enough to update the
// checkout UI. Guest checkout has no session to authorize against, so this
// intentionally exposes only what the buyer already knows (their own
// order number, handed back at checkout creation time).
export const getOrderStatus = query({
  args: { orderNo: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db.query("orders").withIndex("by_orderNo", (q) => q.eq("orderNo", args.orderNo)).unique();
    if (!order) return null;
    return { status: order.status, orderNo: order.orderNo, totalCents: order.totalCents };
  },
});

export const listMyOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const orders = await ctx.db
      .query("orders").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").collect();
    return Promise.all(orders.map(async (o) => ({
      ...o,
      items: await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", o._id)).collect(),
    })));
  },
});

// One-click reorder: returns the line items of a past order to repopulate the cart.
// Scoped to the signed-in owner of the order — never trust a bare orderId from the client alone.
export const reorder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to reorder");
    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) {
      throw new Error("Order not found");
    }
    return ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", args.orderId)).collect();
  },
});

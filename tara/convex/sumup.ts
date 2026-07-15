import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { rateLimiter } from "./rateLimiter";

// See convex/SUMUP.md for the full flow and rationale. Short version: we
// never trust a webhook body or a client's claim that payment succeeded —
// every confirmation re-fetches the checkout from SumUp's API with our
// server-side secret key first. SumUp's amount field is DECIMAL MAJOR UNITS
// (e.g. 10.99 for €10.99), the opposite of our cents-based storage — convert
// carefully, once, right here.

const SUMUP_API_BASE = "https://api.sumup.com";

type SumupCheckout = {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  checkout_reference: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required Convex environment variable: ${name}`);
  return value;
}

function centsToMajorUnits(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

// Create a SumUp checkout for a pending order, and persist the checkout id.
// Called from the client immediately after `orders.createOrder`.
export const createCheckout = action({
  args: { orderId: v.id("orders"), rateLimitKey: v.string() },
  handler: async (ctx, args): Promise<{ checkoutId: string }> => {
    const limit = await rateLimiter.limit(ctx, "checkoutCreate", { key: args.rateLimitKey });
    if (!limit.ok) throw new Error("Too many checkout attempts — please wait a moment and try again.");

    const order = await ctx.runQuery(internal.orders.getOrderInternal, { orderId: args.orderId });
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("This order is no longer pending");

    const secretKey = requireEnv("SUMUP_SECRET_KEY");
    const merchantCode = requireEnv("SUMUP_MERCHANT_CODE");
    const siteUrl = requireEnv("SITE_URL");
    const convexSiteUrl = requireEnv("CONVEX_SITE_URL");

    // Globally unique regardless of the (small, random) orderNo collision
    // window — SumUp rejects a duplicate checkout_reference with 409.
    const checkoutReference = `${order.orderNo}-${order._id}`.slice(0, 90);

    const res = await fetch(`${SUMUP_API_BASE}/v0.1/checkouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        checkout_reference: checkoutReference,
        amount: centsToMajorUnits(order.totalCents),
        currency: "EUR",
        merchant_code: merchantCode,
        description: `TARA order ${order.orderNo}`,
        // Server-to-server notification only — embeds the order id so the
        // webhook never has to trust an unconfirmed payload shape to know
        // which order it's for (see SUMUP.md).
        return_url: `${convexSiteUrl}/sumup/webhook/${order._id}`,
        // Browser redirect after APM/3DS flows land back on our own site.
        redirect_url: `${siteUrl.replace(/\/$/, "")}/checkout?order=${order.orderNo}`,
      }),
    });

    if (res.status === 409) {
      throw new Error("A checkout already exists for this order — refresh and try again.");
    }
    if (!res.ok) {
      throw new Error(`SumUp checkout creation failed (${res.status}): ${await res.text()}`);
    }
    const checkout: SumupCheckout = await res.json();

    await ctx.runMutation(internal.orders.attachSumupCheckout, {
      orderId: args.orderId,
      sumupCheckoutId: checkout.id,
      sumupCheckoutReference: checkout.checkout_reference,
    });

    return { checkoutId: checkout.id };
  },
});

// The single source of truth for "did this payment actually succeed."
// Re-fetches the checkout from SumUp directly rather than trusting the
// caller — reached from both the webhook (convex/http.ts) and the
// client-triggered fallback below, so either path (or both, racing) is
// safe: `markPaidInternal`/`markFailedInternal` are idempotent.
export const confirmCheckout = internalAction({
  args: { checkoutId: v.string() },
  handler: async (ctx, args) => {
    const secretKey = requireEnv("SUMUP_SECRET_KEY");
    const res = await fetch(`${SUMUP_API_BASE}/v0.1/checkouts/${args.checkoutId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) throw new Error(`SumUp status check failed (${res.status}): ${await res.text()}`);
    const checkout: SumupCheckout = await res.json();

    if (checkout.status === "PAID") {
      await ctx.runMutation(internal.orders.markPaidInternal, { sumupCheckoutId: checkout.id });
    } else if (checkout.status === "FAILED" || checkout.status === "EXPIRED") {
      await ctx.runMutation(internal.orders.markFailedInternal, { sumupCheckoutId: checkout.id });
    }
    // PENDING: no-op — a later webhook delivery or client re-check resolves it.
    return { status: checkout.status };
  },
});

// Public fallback: the client calls this once after the SumUp Payment
// Widget reports a successful card auth, in case the webhook is slow or
// never arrives. Same rate-limited, re-verify-first path as the webhook —
// this endpoint cannot be used to mark an order paid without SumUp itself
// confirming it first.
export const confirmCheckoutFromClient = action({
  args: { checkoutId: v.string(), rateLimitKey: v.string() },
  handler: async (ctx, args): Promise<{ status: string }> => {
    const limit = await rateLimiter.limit(ctx, "checkoutCreate", { key: args.rateLimitKey });
    if (!limit.ok) throw new Error("Too many status checks — please wait a moment.");
    const result: { status: string } = await ctx.runAction(internal.sumup.confirmCheckout, {
      checkoutId: args.checkoutId,
    });
    return result;
  },
});

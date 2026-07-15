import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { rateLimiter } from "./rateLimiter";
import { Resend as ResendAPI } from "resend";

const http = httpRouter();

auth.addHttpRoutes(http);

function clientIp(request: Request): string {
  // Convex sits behind its own edge — trust its forwarded-for header; fall
  // back to a shared bucket key rather than crashing if it's ever absent.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// SumUp's server-to-server payment notification. We deliberately do NOT
// trust this request's body or headers as proof of payment — see
// convex/SUMUP.md and convex/sumup.ts. The order id is embedded in the
// path (set when we created the checkout), so this handler's only real
// job is: figure out which order, then ask SumUp directly what its status
// actually is.
const sumupWebhook = httpAction(async (ctx, request) => {
  const ip = clientIp(request);
  const limit = await rateLimiter.limit(ctx, "sumupWebhook", { key: ip });
  if (!limit.ok) return new Response("Too many requests", { status: 429 });

  const orderId = new URL(request.url).pathname.replace(/^\/sumup\/webhook\//, "");
  // Drain the body even though we don't trust it, so SumUp sees a clean 200
  // and doesn't retry unnecessarily.
  await request.text().catch(() => undefined);

  let order;
  try {
    order = await ctx.runQuery(internal.orders.getOrderInternal, {
      orderId: orderId as unknown as Id<"orders">,
    });
  } catch {
    return new Response("Unknown order", { status: 400 });
  }
  if (!order || !order.sumupCheckoutId) {
    return new Response("Unknown order", { status: 400 });
  }

  await ctx.runAction(internal.sumup.confirmCheckout, { checkoutId: order.sumupCheckoutId });
  return new Response(null, { status: 200 });
});

http.route({ pathPrefix: "/sumup/webhook/", method: "POST", handler: sumupWebhook });

// Resend delivery events (bounces/complaints/etc.) — audit trail only.
// Verified via Resend's Svix-backed signature; see convex/RESEND.md.
const resendWebhook = httpAction(async (ctx, request) => {
  const ip = clientIp(request);
  const limit = await rateLimiter.limit(ctx, "resendWebhook", { key: ip });
  if (!limit.ok) return new Response("Too many requests", { status: 429 });

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const resend = new ResendAPI(process.env.RESEND_API_KEY ?? "");
  let event: { type: string; data: unknown };
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: secret,
    }) as { type: string; data: unknown };
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  await ctx.runMutation(internal.webhookEvents.recordEvent, {
    source: "resend",
    eventKey: svixId,
    payload: JSON.stringify(event),
  });

  return new Response(null, { status: 200 });
});

http.route({ path: "/resend/webhook", method: "POST", handler: resendWebhook });

export default http;

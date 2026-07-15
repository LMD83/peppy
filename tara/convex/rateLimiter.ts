import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Convex Auth's own Password/OTP flows already rate-limit failed
// verification attempts internally (see convex/auth.md) — these cover the
// surfaces we own directly: checkout creation and the two inbound webhooks.
// `components.rateLimiter` comes from our hand-written `_generated/api.ts`
// stand-in (see dataModel.ts) — it's an untyped proxy, not the strongly
// typed component API real `npx convex dev` codegen would produce, hence
// the cast. Functionally identical once a real deployment regenerates it.
export const rateLimiter = new RateLimiter(components.rateLimiter as never, {
  // A shopper (or bot) creating SumUp checkouts — keyed by session/user.
  checkoutCreate: { kind: "token bucket", rate: 8, period: MINUTE, capacity: 8 },
  // Inbound webhook calls, keyed by source IP — blunts volumetric abuse
  // before we do any signature-verification work.
  sumupWebhook: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60, shards: 4 },
  resendWebhook: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60, shards: 4 },
});

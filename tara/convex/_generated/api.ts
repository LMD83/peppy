/**
 * Generated `api` utility.
 *
 * Hand-written stand-in — see dataModel.ts for why. Run `npx convex dev`
 * once you have a TARA deployment to regenerate this file for real.
 *
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";
import type * as auth from "../auth.js";
import type * as emailActions from "../emailActions.js";
import type * as loyalty from "../loyalty.js";
import type * as orders from "../orders.js";
import type * as pricing from "../pricing.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as sumup from "../sumup.js";
import type * as verifications from "../verifications.js";
import type * as webhookEvents from "../webhookEvents.js";

const fullApi: ApiFromModules<{
  auth: typeof auth;
  emailActions: typeof emailActions;
  loyalty: typeof loyalty;
  orders: typeof orders;
  pricing: typeof pricing;
  rateLimiter: typeof rateLimiter;
  sumup: typeof sumup;
  verifications: typeof verifications;
  webhookEvents: typeof webhookEvents;
}> = anyApi as any;

export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;
export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;

// Components registered in convex.config.ts (currently: the rate limiter).
// `componentsGeneric()` is the same untyped-proxy mechanism `anyApi` uses —
// `components.rateLimiter.<fn>` resolves at runtime against the real
// deployment; `npx convex dev` regenerates this with full types.
export const components = componentsGeneric();

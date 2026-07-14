/**
 * Generated `api` utility.
 *
 * Hand-written stand-in — see dataModel.ts for why. Run `npx convex dev`
 * once you have a TARA deployment to regenerate this file for real.
 *
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
import type * as loyalty from "../loyalty.js";
import type * as orders from "../orders.js";
import type * as pricing from "../pricing.js";
import type * as verifications from "../verifications.js";

const fullApi: ApiFromModules<{
  loyalty: typeof loyalty;
  orders: typeof orders;
  pricing: typeof pricing;
  verifications: typeof verifications;
}> = anyApi as any;

export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;
export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;

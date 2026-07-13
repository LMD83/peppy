/**
 * Generated `api` utility.
 *
 * Hand-written stand-in — see dataModel.ts for why. Run `npx convex dev` from
 * a machine with network access to regenerate this file for real.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 *
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi } from "convex/server";
import type * as articles from "../articles.js";
import type * as cart from "../cart.js";
import type * as collections from "../collections.js";
import type * as orders from "../orders.js";
import type * as pages from "../pages.js";
import type * as products from "../products.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";

const fullApi: ApiFromModules<{
  articles: typeof articles;
  cart: typeof cart;
  collections: typeof collections;
  orders: typeof orders;
  pages: typeof pages;
  products: typeof products;
  reviews: typeof reviews;
  seed: typeof seed;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 */
export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> =
  anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

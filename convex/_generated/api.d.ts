/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as tm_auth from "../tm/auth.js";
import type * as tm_crew from "../tm/crew.js";
import type * as tm_db from "../tm/db.js";
import type * as tm_fixtures from "../tm/fixtures.js";
import type * as tm_lib from "../tm/lib.js";
import type * as tm_logic from "../tm/logic.js";
import type * as tm_progress from "../tm/progress.js";
import type * as tm_research from "../tm/research.js";
import type * as tm_seed from "../tm/seed.js";
import type * as tm_today from "../tm/today.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "tm/auth": typeof tm_auth;
  "tm/crew": typeof tm_crew;
  "tm/db": typeof tm_db;
  "tm/fixtures": typeof tm_fixtures;
  "tm/lib": typeof tm_lib;
  "tm/logic": typeof tm_logic;
  "tm/progress": typeof tm_progress;
  "tm/research": typeof tm_research;
  "tm/seed": typeof tm_seed;
  "tm/today": typeof tm_today;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

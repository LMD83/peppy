/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as tm_auth from "../tm/auth.js";
import type * as tm_crew from "../tm/crew.js";
import type * as tm_data_compounds from "../tm/data/compounds.js";
import type * as tm_data_exerciseCatalogue from "../tm/data/exerciseCatalogue.js";
import type * as tm_data_exercises from "../tm/data/exercises.js";
import type * as tm_data_foods from "../tm/data/foods.js";
import type * as tm_data_foodsBank from "../tm/data/foodsBank.js";
import type * as tm_data_instruments from "../tm/data/instruments.js";
import type * as tm_data_markers from "../tm/data/markers.js";
import type * as tm_data_menus from "../tm/data/menus.js";
import type * as tm_data_products from "../tm/data/products.js";
import type * as tm_data_retailers from "../tm/data/retailers.js";
import type * as tm_db from "../tm/db.js";
import type * as tm_fixtures from "../tm/fixtures.js";
import type * as tm_fixtures_consent from "../tm/fixtures/consent.js";
import type * as tm_fixtures_fuel from "../tm/fixtures/fuel.js";
import type * as tm_fixtures_labs from "../tm/fixtures/labs.js";
import type * as tm_fixtures_mind from "../tm/fixtures/mind.js";
import type * as tm_fixtures_shop from "../tm/fixtures/shop.js";
import type * as tm_fixtures_stack from "../tm/fixtures/stack.js";
import type * as tm_fixtures_supply from "../tm/fixtures/supply.js";
import type * as tm_fixtures_train from "../tm/fixtures/train.js";
import type * as tm_fuel from "../tm/fuel.js";
import type * as tm_ingest from "../tm/ingest.js";
import type * as tm_labs from "../tm/labs.js";
import type * as tm_lib from "../tm/lib.js";
import type * as tm_logic from "../tm/logic.js";
import type * as tm_logicCapture from "../tm/logicCapture.js";
import type * as tm_logicConsent from "../tm/logicConsent.js";
import type * as tm_logicEasy from "../tm/logicEasy.js";
import type * as tm_logicEmail from "../tm/logicEmail.js";
import type * as tm_logicFuel from "../tm/logicFuel.js";
import type * as tm_logicIngest from "../tm/logicIngest.js";
import type * as tm_logicLabs from "../tm/logicLabs.js";
import type * as tm_logicMind from "../tm/logicMind.js";
import type * as tm_logicPush from "../tm/logicPush.js";
import type * as tm_logicRemind from "../tm/logicRemind.js";
import type * as tm_logicShop from "../tm/logicShop.js";
import type * as tm_logicStack from "../tm/logicStack.js";
import type * as tm_logicSupply from "../tm/logicSupply.js";
import type * as tm_logicTrain from "../tm/logicTrain.js";
import type * as tm_mind from "../tm/mind.js";
import type * as tm_progress from "../tm/progress.js";
import type * as tm_push from "../tm/push.js";
import type * as tm_remind from "../tm/remind.js";
import type * as tm_research from "../tm/research.js";
import type * as tm_seed from "../tm/seed.js";
import type * as tm_shop from "../tm/shop.js";
import type * as tm_stack from "../tm/stack.js";
import type * as tm_supply from "../tm/supply.js";
import type * as tm_today from "../tm/today.js";
import type * as tm_train from "../tm/train.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  "tm/auth": typeof tm_auth;
  "tm/crew": typeof tm_crew;
  "tm/data/compounds": typeof tm_data_compounds;
  "tm/data/exerciseCatalogue": typeof tm_data_exerciseCatalogue;
  "tm/data/exercises": typeof tm_data_exercises;
  "tm/data/foods": typeof tm_data_foods;
  "tm/data/foodsBank": typeof tm_data_foodsBank;
  "tm/data/instruments": typeof tm_data_instruments;
  "tm/data/markers": typeof tm_data_markers;
  "tm/data/menus": typeof tm_data_menus;
  "tm/data/products": typeof tm_data_products;
  "tm/data/retailers": typeof tm_data_retailers;
  "tm/db": typeof tm_db;
  "tm/fixtures": typeof tm_fixtures;
  "tm/fixtures/consent": typeof tm_fixtures_consent;
  "tm/fixtures/fuel": typeof tm_fixtures_fuel;
  "tm/fixtures/labs": typeof tm_fixtures_labs;
  "tm/fixtures/mind": typeof tm_fixtures_mind;
  "tm/fixtures/shop": typeof tm_fixtures_shop;
  "tm/fixtures/stack": typeof tm_fixtures_stack;
  "tm/fixtures/supply": typeof tm_fixtures_supply;
  "tm/fixtures/train": typeof tm_fixtures_train;
  "tm/fuel": typeof tm_fuel;
  "tm/ingest": typeof tm_ingest;
  "tm/labs": typeof tm_labs;
  "tm/lib": typeof tm_lib;
  "tm/logic": typeof tm_logic;
  "tm/logicCapture": typeof tm_logicCapture;
  "tm/logicConsent": typeof tm_logicConsent;
  "tm/logicEasy": typeof tm_logicEasy;
  "tm/logicEmail": typeof tm_logicEmail;
  "tm/logicFuel": typeof tm_logicFuel;
  "tm/logicIngest": typeof tm_logicIngest;
  "tm/logicLabs": typeof tm_logicLabs;
  "tm/logicMind": typeof tm_logicMind;
  "tm/logicPush": typeof tm_logicPush;
  "tm/logicRemind": typeof tm_logicRemind;
  "tm/logicShop": typeof tm_logicShop;
  "tm/logicStack": typeof tm_logicStack;
  "tm/logicSupply": typeof tm_logicSupply;
  "tm/logicTrain": typeof tm_logicTrain;
  "tm/mind": typeof tm_mind;
  "tm/progress": typeof tm_progress;
  "tm/push": typeof tm_push;
  "tm/remind": typeof tm_remind;
  "tm/research": typeof tm_research;
  "tm/seed": typeof tm_seed;
  "tm/shop": typeof tm_shop;
  "tm/stack": typeof tm_stack;
  "tm/supply": typeof tm_supply;
  "tm/today": typeof tm_today;
  "tm/train": typeof tm_train;
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

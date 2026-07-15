/**
 * Generated utilities for implementing server-side Convex query and mutation
 * functions.
 *
 * Hand-written stand-in — see dataModel.ts for why. Run `npx convex dev` from
 * a machine with network access to regenerate this file for real.
 *
 * @module
 */

import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";
import type {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

/**
 * Define a query in this Convex app's public API.
 */
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;

/**
 * Define a query that is only accessible from other Convex functions.
 */
export const internalQuery: QueryBuilder<DataModel, "internal"> =
  internalQueryGeneric;

/**
 * Define a mutation in this Convex app's public API.
 */
export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;

/**
 * Define a mutation that is only accessible from other Convex functions.
 */
export const internalMutation: MutationBuilder<DataModel, "internal"> =
  internalMutationGeneric;

/**
 * Define an action in this Convex app's public API.
 */
export const action: ActionBuilder<DataModel, "public"> = actionGeneric;

/**
 * Define an action that is only accessible from other Convex functions.
 */
export const internalAction: ActionBuilder<DataModel, "internal"> =
  internalActionGeneric;

/**
 * Define an HTTP action.
 */
export const httpAction: HttpActionBuilder = httpActionGeneric;

/**
 * A set of services for use within Convex query functions.
 */
export type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * A set of services for use within Convex mutation functions.
 */
export type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * A set of services for use within Convex action functions.
 */
export type ActionCtx = GenericActionCtx<DataModel>;

/**
 * An interface to read from the database within Convex query functions.
 */
export type DatabaseReader = GenericDatabaseReader<DataModel>;

/**
 * An interface to read from and write to the database within Convex
 * mutation functions.
 */
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;

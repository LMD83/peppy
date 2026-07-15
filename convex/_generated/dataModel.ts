/**
 * Generated data model types.
 *
 * Hand-written stand-in: this environment's network policy blocks outbound
 * access to convex.dev/convex.cloud, so `npx convex dev` could not be run
 * here to generate this file for real. Run `npx convex dev` once from a
 * machine with network access to the Convex deployment — it will overwrite
 * this file with the genuine generated output (functionally equivalent).
 *
 * @module
 */

import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 */
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

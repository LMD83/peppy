/**
 * Generated data model types.
 *
 * Hand-written stand-in: no TARA Convex deployment credentials were
 * available in this session, so `npx convex dev` could not be run to
 * generate this file for real. Run `npx convex dev` once you have a
 * deployment — it will overwrite this file with the genuine generated
 * output (functionally equivalent).
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

export type TableNames = TableNamesInDataModel<DataModel>;

export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;

export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

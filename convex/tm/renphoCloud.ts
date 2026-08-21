"use node";

import { createCipheriv, createDecipheriv } from "node:crypto";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
  MAX_IMPORT_ROWS,
  mapRenphoCloudRecord,
  type ImportReport,
  type MeasurementInput,
} from "./logicSync";

/**
 * The Renpho poller — the half of Connect that touches someone else's cloud.
 *
 * A separate module from convex/tm/sync.ts for the same reason push.ts is
 * separate from remind.ts: AES here comes from node:crypto, so this file
 * carries `"use node";` and may export actions only. What is *decided* here:
 * nothing. Which rows are plausible, which are new and which daily weigh-ins
 * they fill is settled by the same logicSync plan and the same
 * sync.commitFromPoller mutation the on-screen import uses — the poller earns
 * no shortcut around validation.
 *
 * ## The terms, accepted honestly (docs/research/INTEGRATIONS.md)
 *
 * Renpho publishes no API. This speaks the app's own protocol, ported from
 * the reverse-engineered danvaneijck/renpho-api client: AES-128-ECB envelopes
 * with a key extracted from the app, a login that carries the account
 * password, and endpoints that can change without notice. It stores a Renpho
 * *password* (not a revocable token) in Convex env, and it can break the day
 * Renpho ships an update. The CSV import is the same parser with none of
 * these terms, which is why it was built first and why this writes through
 * the identical path.
 *
 * ## When it cannot run
 *
 * Without RENPHO_EMAIL and RENPHO_PASSWORD this does nothing, loudly, and
 * writes nothing — not even a run row. A deployment that never attempted a
 * sync must never grow a history claiming it did. The Connect screen reads
 * the missing configuration from the deployment itself and says so.
 *
 * Run one sweep by hand (the smoke test for this whole pipe):
 *   npx convex run tm/renphoCloud:sweep --prod
 */

const API_BASE_URL = "https://cloud.renpho.com";
/** AES-128 key the Renpho app itself uses — transport obfuscation, not secrecy. */
const ENCRYPTION_KEY = "ed*wijdi$h6fe3ew";
const APP_VERSION = "6.6.0";
const PLATFORM = "android";

const ENDPOINTS = {
  login: "renpho-aggregation/user/login",
  deviceInfo: "renpho-aggregation/device/count",
  bodyComposition: "RenphoHealth/scale/queryBodyCompositionMeasureData",
  measurements: "RenphoHealth/scale/queryAllMeasureDataList",
} as const;

const BODY_WEIGHT_SCALES = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "0A",
  "0B", "0C", "0D", "0E", "0F", "10", "11", "12", "13", "14",
];

const SUCCESS_CODES = new Set<unknown>([0, "0", 101, "101", 200, "200", 20000, "20000"]);

const PAGE_SIZE = 50;
/** Enough pages to cover a first sync of a year of weigh-ins; dedupe absorbs re-reads. */
const MAX_PAGES_PER_TABLE = 10;

/* ===== the AES envelope ===== */

function aesEncrypt(plaintext: string): string {
  const cipher = createCipheriv("aes-128-ecb", Buffer.from(ENCRYPTION_KEY, "utf8"), null);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
}

function aesDecrypt(encryptedB64: string): string {
  const decipher = createDecipheriv("aes-128-ecb", Buffer.from(ENCRYPTION_KEY, "utf8"), null);
  return Buffer.concat([decipher.update(encryptedB64, "base64"), decipher.final()]).toString("utf8");
}

function encryptRequest(payload: unknown): { encryptData: string } {
  return { encryptData: aesEncrypt(JSON.stringify(payload)) };
}

/** Some endpoints want an encrypted empty byte array rather than "{}". */
function encryptEmptyBytes(): { encryptData: string } {
  const cipher = createCipheriv("aes-128-ecb", Buffer.from(ENCRYPTION_KEY, "utf8"), null);
  return {
    encryptData: Buffer.concat([cipher.update(Buffer.alloc(0)), cipher.final()]).toString("base64"),
  };
}

function decryptResponse(data: string): unknown {
  return JSON.parse(aesDecrypt(data)) as unknown;
}

/* ===== the client ===== */

class RenphoError extends Error {
  constructor(
    readonly context: string,
    readonly kind: "auth" | "api" | "transport",
    message: string,
  ) {
    super(`${context}: ${message}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

type ApiEnvelope = { code?: unknown; msg?: unknown; data?: unknown };

async function post(
  endpoint: string,
  body: { encryptData: string },
  auth: { token: string; userId: string } | null,
): Promise<ApiEnvelope> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    headers.token = auth.token;
    headers.userId = auth.userId;
    headers.appVersion = APP_VERSION;
    headers.platform = PLATFORM;
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new RenphoError(endpoint, "transport", error instanceof Error ? error.message : String(error));
  }
  if (!response.ok) throw new RenphoError(endpoint, "api", `HTTP ${response.status}`);
  const parsed = asRecord((await response.json()) as unknown);
  if (!parsed) throw new RenphoError(endpoint, "api", "response is not an object");
  return parsed;
}

function checkEnvelope(result: ApiEnvelope, context: string): void {
  const msg = typeof result.msg === "string" ? result.msg : "";
  if (msg.toLowerCase() === "success" || SUCCESS_CODES.has(result.code)) return;
  const kind = /password|account|email|credential/i.test(msg) ? "auth" : "api";
  throw new RenphoError(context, kind, `code=${String(result.code)} msg=${msg}`);
}

async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const payload = {
    questionnaire: {},
    login: {
      password,
      areaCode: "US",
      appRevision: APP_VERSION,
      cellphoneType: "ConvexAction",
      systemType: "11",
      email,
      platform: PLATFORM,
    },
    bindingList: { deviceTypes: BODY_WEIGHT_SCALES },
  };
  const result = await post(ENDPOINTS.login, encryptRequest(payload), null);
  checkEnvelope(result, "login");
  if (typeof result.data !== "string") throw new RenphoError("login", "api", "no data in response");
  const decrypted = asRecord(decryptResponse(result.data));
  const loginInfo = asRecord(decrypted?.login);
  const token = typeof loginInfo?.token === "string" ? loginInfo.token : null;
  const userId = loginInfo?.id;
  if (!token || (typeof userId !== "number" && typeof userId !== "string")) {
    throw new RenphoError("login", "auth", "no token in login response");
  }
  return { token, userId: String(userId) };
}

type ScaleTable = { tableName: string; userId: string };

async function deviceTables(auth: { token: string; userId: string }): Promise<ScaleTable[]> {
  let result: ApiEnvelope;
  try {
    result = await post(ENDPOINTS.deviceInfo, encryptEmptyBytes(), auth);
  } catch {
    // The app itself falls back to an encrypted "{}" when the bytes form 400s.
    result = await post(ENDPOINTS.deviceInfo, encryptRequest({}), auth);
  }
  checkEnvelope(result, "device/count");
  if (typeof result.data !== "string") return [];
  const decrypted = asRecord(decryptResponse(result.data));
  const scales = Array.isArray(decrypted?.scale) ? decrypted.scale : [];
  const tables: ScaleTable[] = [];
  for (const scale of scales) {
    const row = asRecord(scale);
    const tableName = typeof row?.tableName === "string" ? row.tableName : null;
    if (!tableName) continue;
    const userIds = Array.isArray(row?.userIds) ? row.userIds : [];
    const uid = userIds.length > 0 && !userIds.includes(auth.userId) ? userIds[0] : auth.userId;
    tables.push({ tableName, userId: String(uid) });
  }
  return tables;
}

function extractRecords(page: unknown): unknown[] {
  if (Array.isArray(page)) return page;
  const row = asRecord(page);
  if (!row) return [];
  for (const key of ["list", "data", "records", "measurements"]) {
    const value = row[key];
    if (Array.isArray(value)) return value;
  }
  return "weight" in row ? [row] : [];
}

async function tableRecords(
  auth: { token: string; userId: string },
  table: ScaleTable,
): Promise<unknown[]> {
  const all: unknown[] = [];
  // Impedance scales answer on the body-composition endpoint; weight-only
  // scales on the legacy one. Try in that order, page until a short page.
  for (const endpoint of [ENDPOINTS.bodyComposition, ENDPOINTS.measurements]) {
    for (let page = 1; page <= MAX_PAGES_PER_TABLE; page++) {
      const body = encryptRequest({
        pageNum: page,
        pageSize: PAGE_SIZE,
        userIds: [table.userId],
        tableName: table.tableName,
      });
      const result = await post(endpoint, body, auth);
      checkEnvelope(result, endpoint);
      if (typeof result.data !== "string") break;
      const records = extractRecords(decryptResponse(result.data));
      if (records.length === 0) break;
      all.push(...records);
      if (records.length < PAGE_SIZE) break;
    }
    if (all.length > 0) break;
  }
  return all;
}

/* ===== the sweep ===== */

export type RenphoSweepReport = {
  reason:
    | "no-credentials"
    | "imported"
    | "no-new-data"
    | "no-scales"
    | "auth-failed"
    | "api-error"
    | "network-error";
  fetched: number;
  wrote: number;
  detail?: string;
};

export const sweep = internalAction({
  args: { user: v.optional(v.string()) },
  handler: async (ctx, args): Promise<RenphoSweepReport> => {
    const email = (process.env.RENPHO_EMAIL ?? "").trim();
    const password = (process.env.RENPHO_PASSWORD ?? "").trim();
    const slug = args.user ?? (process.env.RENPHO_USER ?? "liam").trim();
    const zone = (process.env.RENPHO_TZ ?? "Europe/Dublin").trim();

    if (email === "" || password === "") {
      console.warn(
        "[timento connect] Renpho sync skipped: RENPHO_EMAIL / RENPHO_PASSWORD are not set. " +
          "Nothing was fetched and nothing was recorded — the CSV import path is unaffected.",
      );
      return { reason: "no-credentials", fetched: 0, wrote: 0 };
    }

    const record = async (ok: boolean, reason: string, fetched: number, wrote: number) => {
      await ctx.runMutation(internal.tm.sync.recordRun, {
        source: "renpho-cloud",
        at: Date.now(),
        ok,
        reason,
        fetched,
        wrote,
      });
    };

    try {
      const auth = await login(email, password);
      const tables = await deviceTables(auth);
      if (tables.length === 0) {
        await record(false, "no-scales", 0, 0);
        return { reason: "no-scales", fetched: 0, wrote: 0 };
      }

      const readings: MeasurementInput[] = [];
      let fetched = 0;
      for (const table of tables) {
        const records = await tableRecords(auth, table);
        fetched += records.length;
        for (const raw of records) {
          const reading = mapRenphoCloudRecord(raw, zone);
          if (reading) readings.push(reading);
        }
      }

      // Newest first, capped to what one commit accepts — the next sweep
      // re-reads and the dedupe plan absorbs the overlap.
      readings.sort((a, b) =>
        a.date === b.date ? (b.time ?? "").localeCompare(a.time ?? "") : b.date.localeCompare(a.date),
      );
      const batch = readings.slice(0, MAX_IMPORT_ROWS);

      if (batch.length === 0) {
        await record(true, "no-new-data", fetched, 0);
        return { reason: "no-new-data", fetched, wrote: 0 };
      }

      const report: ImportReport = await ctx.runMutation(internal.tm.sync.commitFromPoller, {
        slug,
        device: "Renpho scale",
        rows: batch,
      });
      const reason = report.wrote > 0 ? "imported" : "no-new-data";
      await record(true, reason, fetched, report.wrote);
      return { reason, fetched, wrote: report.wrote };
    } catch (error) {
      const kind = error instanceof RenphoError ? error.kind : "transport";
      const reason =
        kind === "auth" ? "auth-failed" : kind === "transport" ? "network-error" : "api-error";
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[timento connect] Renpho sync failed (${reason}): ${detail}`);
      await record(false, reason, 0, 0);
      return { reason, fetched: 0, wrote: 0, detail };
    }
  },
});

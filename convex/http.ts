import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { IngestResult } from "./tm/ingest";
import type { DoseTakenResult } from "./tm/remind";

/**
 * Hands-free ingest over plain HTTPS.
 *
 * This exists so "Hey Siri, took my morning tablets" works from a locked phone
 * or an Apple Watch with no native app and no Swift: an iOS Shortcut POSTs a
 * sentence here, and the same parsing and the same writes the app uses do the
 * rest.
 *
 * Rules these endpoints keep:
 *
 *  - **Never a session token.** A Shortcut lives on a phone and cannot hold a
 *    session, so it carries an opaque ingest token from `tm_ingestTokens` —
 *    a separate credential that can log doses and food and nothing else, and
 *    that the Hands-free tab can revoke on its own. The service worker's
 *    "Taken" button rides the same credential through `/ingest/dose-taken`,
 *    so one revocation kills the Shortcut and the button together.
 *  - **The body is `unknown`.** Every field is narrowed before it is used, and
 *    anything malformed is a 400 before a database is touched.
 *  - **No database access here.** `httpAction` has no `ctx.db` by design; the
 *    work is delegated to internal mutations so the whole write is one
 *    transaction and the arithmetic never forks.
 *  - **A parse that is not certain writes nothing.** Ambiguity comes back as
 *    `alternatives` with HTTP 200 so the Shortcut can speak them aloud, rather
 *    than as an error that Shortcuts would swallow as a failed automation.
 */

const http = httpRouter();

/** Shortcuts sends whatever it likes. Nothing is trusted until it is narrowed. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > max) return null;
  return trimmed;
}

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Slot = (typeof SLOTS)[number];

function asSlot(value: unknown): Slot | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const found = SLOTS.find((s) => s === value.toLowerCase());
  return found ?? null;
}

function asDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

/**
 * Open CORS is safe here and necessary: the Hands-free tab's "test it now"
 * button calls this from the app's own origin, which is a different host from
 * `.convex.site`. These endpoints carry no cookies and no ambient session — the
 * only credential is the ingest token inside the body — so a permissive origin
 * grants a browser nothing it could not already do with `curl`.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS }));

/** One reply shape for every outcome, so a Shortcut can speak `spoken` blindly. */
function reply(result: IngestResult): Response {
  switch (result.status) {
    case "unauthorized":
      return json({ ok: false, status: "unauthorized", spoken: "That log-in token is not valid." }, 401);
    case "ok":
      return json({ ok: true, status: "ok", wrote: result.wrote, spoken: `Logged ${result.summary}.`, heard: result.heard }, 200);
    case "ambiguous":
      return json(
        {
          ok: false,
          status: "ambiguous",
          heard: result.heard,
          alternatives: result.alternatives,
          spoken: `I heard "${result.heard}" and could not tell which one you meant. Nothing was logged.`,
        },
        200,
      );
    case "no-timing":
      return json(
        {
          ok: false,
          status: "no-timing",
          heard: result.heard,
          alternatives: result.alternatives,
          spoken: `I heard "${result.heard}" but not which time of day. Nothing was logged.`,
        },
        200,
      );
    default:
      return json(
        {
          ok: false,
          status: "no-match",
          heard: result.heard,
          alternatives: result.alternatives,
          spoken: `I heard "${result.heard}" but nothing on your file matches it. Nothing was logged.`,
        },
        200,
      );
  }
}

/** Shared narrowing: a token and a sentence, both required, both bounded. */
function readCommon(
  body: Record<string, unknown>,
): { token: string; text: string } | { error: string } {
  const token = asString(body.token, 200);
  if (token === null) return { error: "token must be a non-empty string" };
  const text = asString(body.text, 400);
  if (text === null) return { error: "text must be a non-empty string of at most 400 characters" };
  return { token, text };
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    // Deliberately typed as unknown — a parsed body is input, not a contract.
    const parsed: unknown = await req.json();
    return asRecord(parsed);
  } catch {
    return null;
  }
}

http.route({
  path: "/ingest/dose",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await readBody(req);
    if (body === null) return json({ ok: false, error: "body must be a JSON object" }, 400);
    const common = readCommon(body);
    if ("error" in common) return json({ ok: false, error: common.error }, 400);

    const date = asDate(body.date);
    if (date === null) return json({ ok: false, error: "date must be YYYY-MM-DD" }, 400);
    const timing = body.timing === undefined || body.timing === null ? undefined : asString(body.timing, 40);
    if (timing === null) return json({ ok: false, error: "timing must be a short string" }, 400);

    const args: { ingestToken: string; text: string; date?: string; timing?: string } = {
      ingestToken: common.token,
      text: common.text,
    };
    if (date !== undefined) args.date = date;
    if (timing !== undefined) args.timing = timing;

    const result: IngestResult = await ctx.runMutation(internal.tm.ingest.commitDose, args);
    return reply(result);
  }),
});

http.route({
  path: "/ingest/food",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await readBody(req);
    if (body === null) return json({ ok: false, error: "body must be a JSON object" }, 400);
    const common = readCommon(body);
    if ("error" in common) return json({ ok: false, error: common.error }, 400);

    const date = asDate(body.date);
    if (date === null) return json({ ok: false, error: "date must be YYYY-MM-DD" }, 400);
    const slot = asSlot(body.slot);
    if (slot === null) return json({ ok: false, error: "slot must be breakfast, lunch, dinner or snack" }, 400);

    const args: { ingestToken: string; text: string; date?: string; slot?: Slot } = {
      ingestToken: common.token,
      text: common.text,
    };
    if (date !== undefined) args.date = date;
    if (slot !== undefined) args.slot = slot;

    const result: IngestResult = await ctx.runMutation(internal.tm.ingest.commitFood, args);
    return reply(result);
  }),
});

/** Ceiling on doses one "Taken" tap may log — mirrors MAX_TAKEN_DOSES in remind.ts. */
const MAX_TAKEN = 20;

/** Exact itemId+timing pairs, all of them well-formed, or nothing at all. */
function asDoses(value: unknown): { itemId: string; timing: string }[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TAKEN) return null;
  const out: { itemId: string; timing: string }[] = [];
  for (const raw of value) {
    const o = asRecord(raw);
    if (o === null) return null;
    const itemId = asString(o.itemId, 64);
    const timing = asString(o.timing, 40);
    if (itemId === null || timing === null) return null;
    out.push({ itemId, timing });
  }
  return out;
}

/**
 * The notification's "Taken" button. It logs ONLY the exact doses the
 * notification named — an itemId and a timing each, matched precisely in the
 * mutation — never a sentence to parse and never a guess. Anything less than a
 * valid, live token is a 401, which tells the worker to open the app instead.
 */
http.route({
  path: "/ingest/dose-taken",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await readBody(req);
    if (body === null) return json({ ok: false, error: "body must be a JSON object" }, 400);
    const token = asString(body.token, 200);
    if (token === null) return json({ ok: false, error: "token must be a non-empty string" }, 400);
    const date = asDate(body.date);
    if (date === null || date === undefined) {
      return json({ ok: false, error: "date must be YYYY-MM-DD" }, 400);
    }
    const doses = asDoses(body.doses);
    if (doses === null) {
      return json({ ok: false, error: `doses must be 1–${MAX_TAKEN} exact itemId+timing pairs` }, 400);
    }

    const result: DoseTakenResult = await ctx.runMutation(internal.tm.remind.doseTaken, {
      ingestToken: token,
      date,
      doses,
    });
    if (!result.ok) return json({ ok: false, status: "unauthorized" }, 401);
    return json({ ok: true, wrote: result.wrote }, 200);
  }),
});

http.route({ path: "/ingest/dose", method: "OPTIONS", handler: preflight });
http.route({ path: "/ingest/food", method: "OPTIONS", handler: preflight });
http.route({ path: "/ingest/dose-taken", method: "OPTIONS", handler: preflight });

export default http;

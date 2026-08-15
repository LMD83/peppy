import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireUser } from "./db";
import { addDays } from "./lib";
import { FOODS, foodByKey } from "./data/foods";
import { timingLabel } from "./logic-stack";
import {
  MAX_GRAMS,
  TOKEN_BYTES,
  TOKEN_PREFIX,
  buildHandsFreeView,
  parseDoseUtterance,
  parseFoodUtterance,
  type DoseCandidate,
  type HandsFreeView,
  type IngestRecentRow,
  type IngestTokenRow,
} from "./logic-ingest";

/**
 * Hands-free — logging without typing.
 *
 * Two audiences, one set of rules. The app calls `get`, `createToken` and
 * `revokeToken` with a session token like every other slice. A phone Shortcut
 * cannot hold a session, so it calls the HTTP endpoints in convex/http.ts with
 * an opaque *ingest* token instead — a different credential, in a different
 * table, that can do exactly two things and can be revoked from the tab without
 * touching the session.
 *
 * Both paths converge on `commitDose` / `commitFood`, which parse with the pure
 * logic in ./logic-ingest and then write the same rows the Stack and Fuel tabs
 * write. No arithmetic forks off here, and nothing is written on a guess: an
 * unclear phrase comes back as alternatives, never as a dose.
 */

const MAX_TOKENS = 50;
const MAX_ITEMS = 200;
const MAX_ROWS_PER_DAY = 60;
/** How far back `recent` looks. Bounded scans, not a history. */
const RECENT_DAYS = 3;
const MAX_LABEL = 60;

const slotArg = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("snack"),
);

/* ===== the credential ===== */

/**
 * An opaque, URL-safe secret. Not derived from the user, not guessable, and
 * never a session token — a Shortcut lives on a phone, so what it holds must be
 * revocable on its own.
 */
function mintToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  const b64 = btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${TOKEN_PREFIX}${b64}`;
}

/** The base URL the HTTP actions are served from. Empty when unconfigured. */
function siteUrl(): string {
  const url = process.env.CONVEX_SITE_URL;
  return typeof url === "string" && url !== "" ? url.replace(/\/+$/, "") : "";
}

/* ===== the view ===== */

async function protocolItems(ctx: QueryCtx, userId: Doc<"tm_users">["_id"]) {
  return await ctx.db
    .query("tm_protocolItems")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_ITEMS);
}

/**
 * The last few days of dose and food rows — the two tables hands-free writes
 * into. Provenance is not recorded anywhere, so this is honestly labelled as
 * recent entries rather than dressed up as a hands-free audit log.
 */
async function recentWrites(
  ctx: QueryCtx,
  user: Doc<"tm_users">,
  date: string,
): Promise<IngestRecentRow[]> {
  const items = await protocolItems(ctx, user._id);
  const nameById = new Map(items.map((i) => [i._id as string, i.name]));
  const out: IngestRecentRow[] = [];

  for (let i = 0; i < RECENT_DAYS; i++) {
    const day = addDays(date, -i);
    const doses = await ctx.db
      .query("tm_doseLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", day))
      .take(MAX_ROWS_PER_DAY);
    for (const d of doses) {
      if (!d.taken) continue;
      out.push({
        id: d._id,
        kind: "dose",
        label: nameById.get(d.itemId) ?? "Item",
        detail: timingLabel(d.timing),
        date: d.date,
        at: d._creationTime,
      });
    }

    const meals = await ctx.db
      .query("tm_mealEntries")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", day))
      .take(MAX_ROWS_PER_DAY);
    for (const m of meals) {
      if (m.planned && !m.eaten) continue;
      out.push({
        id: m._id,
        kind: "food",
        label: foodByKey(m.foodKey)?.name ?? m.foodKey,
        detail: `${m.grams} g · ${m.slot}`,
        date: m.date,
        at: m._creationTime,
      });
    }
  }
  return out;
}

export const get = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }): Promise<HandsFreeView> => {
    const user = await requireUser(ctx, token);

    const tokenRows = await ctx.db
      .query("tm_ingestTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_TOKENS);

    const tokens: IngestTokenRow[] = tokenRows.map((t) => {
      const row: IngestTokenRow = {
        id: t._id,
        token: t.token,
        label: t.label,
        createdDate: t.createdDate,
        revoked: t.revoked,
      };
      if (t.lastUsedAt !== undefined) row.lastUsedAt = t.lastUsedAt;
      return row;
    });

    const items = await protocolItems(ctx, user._id);
    const timings = [...new Set(items.filter((i) => i.active).flatMap((i) => i.timings))].sort();

    return buildHandsFreeView({
      mode: user.mode,
      date,
      endpoint: siteUrl(),
      tokens,
      recent: await recentWrites(ctx, user, date),
      timings,
    });
  },
});

export const createToken = mutation({
  args: { token: v.string(), date: v.string(), label: v.string() },
  handler: async (ctx, { token, date, label }) => {
    const user = await requireUser(ctx, token);
    const trimmed = label.trim().slice(0, MAX_LABEL);
    if (trimmed === "") throw new ConvexError("bad-label");

    const existing = await ctx.db
      .query("tm_ingestTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_TOKENS);
    // A ceiling on live credentials: every one of these is a key to the file.
    if (existing.filter((t) => !t.revoked).length >= 8) throw new ConvexError("too-many-tokens");

    await ctx.db.insert("tm_ingestTokens", {
      userId: user._id,
      token: mintToken(),
      label: trimmed,
      createdDate: date,
      revoked: false,
    });
    return null;
  },
});

/**
 * Revocation is the whole point of a separate credential, so it is one call,
 * it is immediate, and it keeps the row — a revoked key stays visible as
 * history rather than quietly disappearing.
 */
export const revokeToken = mutation({
  args: { token: v.string(), tokenId: v.id("tm_ingestTokens") },
  handler: async (ctx, { token, tokenId }) => {
    const user = await requireUser(ctx, token);
    const row = await ctx.db.get("tm_ingestTokens", tokenId);
    // An id is not authority — the row must be this caller's own.
    if (!row || row.userId !== user._id) throw new ConvexError("not-your-token");
    if (!row.revoked) await ctx.db.patch("tm_ingestTokens", tokenId, { revoked: true });
    return null;
  },
});

/* ===== the ingest path ===== */

export type IngestResult =
  | { status: "unauthorized" }
  | { status: "ok"; wrote: number; summary: string; heard: string }
  | { status: "ambiguous"; heard: string; alternatives: string[] }
  | { status: "no-match"; heard: string; alternatives: string[] }
  | { status: "no-timing"; heard: string; alternatives: string[] };

/**
 * Authenticate an ingest token and stamp it. A revoked token is no token, and a
 * token whose user is gone is no token either.
 */
async function authIngest(
  ctx: MutationCtx,
  ingestToken: string,
): Promise<Doc<"tm_users"> | null> {
  if (ingestToken === "") return null;
  const row = await ctx.db
    .query("tm_ingestTokens")
    .withIndex("by_token", (q) => q.eq("token", ingestToken))
    .unique();
  if (!row || row.revoked) return null;
  const user = await ctx.db.get("tm_users", row.userId);
  if (!user) return null;
  // Stamped on every accepted call, not only on a successful write — "when did
  // this key last speak" is the question a revocation decision needs answered.
  await ctx.db.patch("tm_ingestTokens", row._id, { lastUsedAt: Date.now() });
  return user;
}

/** UTC fallback for a Shortcut that did not send its own local date. */
function todayUtc(): string {
  return new Date(Date.now()).toISOString().slice(0, 10);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const commitDose = internalMutation({
  args: {
    ingestToken: v.string(),
    text: v.string(),
    date: v.optional(v.string()),
    timing: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const user = await authIngest(ctx, args.ingestToken);
    if (!user) return { status: "unauthorized" };

    const date = args.date !== undefined && isDate(args.date) ? args.date : todayUtc();
    const rows = await ctx.db
      .query("tm_protocolItems")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_ITEMS);

    const candidates: DoseCandidate[] = rows.map((r) => ({
      id: r._id,
      name: r.name,
      timings: r.timings,
      active: r.active,
    }));
    const parsed = parseDoseUtterance(args.text, candidates, args.timing);

    if (parsed.match === null) {
      // Nothing is written on a maybe. The candidates go back so the phone can
      // read them out and the person can pick.
      const status =
        parsed.reason === "ambiguous"
          ? ("ambiguous" as const)
          : parsed.reason === "no-timing"
            ? ("no-timing" as const)
            : ("no-match" as const);
      return {
        status,
        heard: parsed.heard,
        alternatives: parsed.alternatives.map((a) => `${a.name} · ${timingLabel(a.timing)}`),
      };
    }

    const match = parsed.match;
    const byId = new Map(rows.map((r) => [r._id as string, r]));
    const sameDay = await ctx.db
      .query("tm_doseLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
      .take(MAX_ITEMS);

    let wrote = 0;
    for (const itemId of match.itemIds) {
      const item = byId.get(itemId);
      // Only a timing the item actually carries can be logged against it.
      if (!item || !item.active || !item.timings.includes(match.timing)) continue;
      const existing = sameDay.find((r) => r.itemId === item._id && r.timing === match.timing);
      if (existing) {
        if (!existing.taken) await ctx.db.patch("tm_doseLogs", existing._id, { taken: true });
      } else {
        await ctx.db.insert("tm_doseLogs", {
          userId: user._id,
          date,
          itemId: item._id,
          timing: match.timing,
          taken: true,
        });
      }
      wrote += 1;
    }

    if (wrote === 0) {
      return { status: "no-match", heard: parsed.heard, alternatives: [] };
    }
    return {
      status: "ok",
      wrote,
      summary: `${match.scope === "all" ? `${wrote} logged` : match.name} · ${timingLabel(match.timing)}`,
      heard: parsed.heard,
    };
  },
});

export const commitFood = internalMutation({
  args: {
    ingestToken: v.string(),
    text: v.string(),
    date: v.optional(v.string()),
    slot: v.optional(slotArg),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const user = await authIngest(ctx, args.ingestToken);
    if (!user) return { status: "unauthorized" };

    const date = args.date !== undefined && isDate(args.date) ? args.date : todayUtc();
    const parsed = parseFoodUtterance(args.text, FOODS, args.slot);

    if (parsed.match === null) {
      const status = parsed.reason === "ambiguous" ? ("ambiguous" as const) : ("no-match" as const);
      return {
        status,
        heard: parsed.heard,
        alternatives: parsed.alternatives.map((a) => `${a.name} · ${a.grams} g`),
      };
    }

    const match = parsed.match;
    const food = foodByKey(match.foodKey);
    if (!food) return { status: "no-match", heard: parsed.heard, alternatives: [] };
    const grams = Math.round(match.grams);
    if (!Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) {
      return { status: "no-match", heard: parsed.heard, alternatives: [] };
    }

    await ctx.db.insert("tm_mealEntries", {
      userId: user._id,
      date,
      slot: match.slot,
      foodKey: match.foodKey,
      grams,
      planned: false,
      eaten: true,
    });

    const assumed = match.portionAssumed ? " (one portion)" : "";
    return {
      status: "ok",
      wrote: 1,
      summary: `${food.name} · ${grams} g · ${match.slot}${assumed}`,
      heard: parsed.heard,
    };
  },
});

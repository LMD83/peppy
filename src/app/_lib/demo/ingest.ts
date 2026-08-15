import { foodByKey } from "@convex/tm/data/foods";
import { addDays } from "@convex/tm/lib";
import { timingLabel } from "@convex/tm/logic-stack";
import {
  TOKEN_BYTES,
  TOKEN_PREFIX,
  buildHandsFreeView,
  type IngestRecentRow,
  type IngestTokenRow,
} from "@convex/tm/logic-ingest";
import type { DemoDb } from "../demo-db";
import type { HandsFreeData } from "../types";

/**
 * Demo mirror of convex/tm/ingest.ts. Same tokens, same masking, same shared
 * view builder — the view type is derived from the Convex query, so any drift
 * is a build error.
 *
 * The one honest difference: there is no HTTP endpoint without a deployment, so
 * `endpoint` is empty and the tab says so rather than printing an address that
 * would fail. Everything else — creating a key, the single reveal window,
 * revoking — behaves exactly as it does against Convex.
 */

const RECENT_DAYS = 3;
const MAX_LIVE_TOKENS = 8;

/** Same alphabet and length as the Convex mint; the demo just needs a value. */
function mintToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  const b64 = btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${TOKEN_PREFIX}${b64}`;
}

/**
 * The demo store has no creation timestamps, so ordering is derived from the
 * row's date plus its position — stable, deterministic, and enough to put the
 * newest entry at the top.
 */
function orderKey(date: string, index: number): number {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return (Number.isFinite(parsed) ? parsed : 0) + index;
}

function recentWrites(db: DemoDb, slug: string, date: string): IngestRecentRow[] {
  const days = new Set<string>();
  for (let i = 0; i < RECENT_DAYS; i++) days.add(addDays(date, -i));

  const nameById = new Map(
    db.protocolItems.filter((p) => p.userSlug === slug).map((p) => [p.id, p.name]),
  );

  const out: IngestRecentRow[] = [];
  db.doseLogs.forEach((d, i) => {
    if (d.userSlug !== slug || !d.taken || !days.has(d.date)) return;
    out.push({
      id: `dose:${d.date}:${d.itemId}:${d.timing}`,
      kind: "dose",
      label: nameById.get(d.itemId) ?? "Item",
      detail: timingLabel(d.timing),
      date: d.date,
      at: orderKey(d.date, i),
    });
  });
  db.mealEntries.forEach((m, i) => {
    if (m.userSlug !== slug || !days.has(m.date)) return;
    if (m.planned && !m.eaten) return;
    out.push({
      id: `food:${m.id}`,
      kind: "food",
      label: foodByKey(m.foodKey)?.name ?? m.foodKey,
      detail: `${m.grams} g · ${m.slot}`,
      date: m.date,
      at: orderKey(m.date, i),
    });
  });
  return out;
}

export function view(db: DemoDb, slug: string, date: string): HandsFreeData {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const tokens: IngestTokenRow[] = db.ingestTokens
    .filter((t) => t.userSlug === slug)
    .map((t) => {
      const row: IngestTokenRow = {
        id: t.id,
        token: t.token,
        label: t.label,
        createdDate: t.createdDate,
        revoked: t.revoked,
      };
      if (t.lastUsedAt !== undefined) row.lastUsedAt = t.lastUsedAt;
      return row;
    });

  const timings = [
    ...new Set(
      db.protocolItems.filter((p) => p.userSlug === slug && p.active).flatMap((p) => p.timings),
    ),
  ].sort();

  return buildHandsFreeView({
    mode: user.modeMut,
    date,
    // No deployment, no endpoint. The tab explains that rather than printing a
    // URL that could not possibly answer.
    endpoint: "",
    tokens,
    recent: recentWrites(db, slug, date),
    timings,
  });
}

export function createToken(db: DemoDb, slug: string, date: string, label: string): void {
  const trimmed = label.trim().slice(0, 60);
  if (trimmed === "") throw new Error("bad-label");
  const live = db.ingestTokens.filter((t) => t.userSlug === slug && !t.revoked).length;
  // A ceiling on live credentials: every one of these is a key to the file.
  if (live >= MAX_LIVE_TOKENS) throw new Error("too-many-tokens");

  db.ingestTokens.push({
    id: db.newId("ing"),
    userSlug: slug,
    token: mintToken(),
    label: trimmed,
    createdDate: date,
    revoked: false,
  });
}

export function revokeToken(db: DemoDb, tokenId: string): void {
  const row = db.ingestTokens.find((t) => t.id === tokenId);
  if (!row) throw new Error("not-your-token");
  // Revocation keeps the row — a revoked key stays visible as history.
  row.revoked = true;
}

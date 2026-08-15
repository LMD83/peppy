import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { daysBetween } from "./lib";
import { adherenceStats, requireUser } from "./db";
import {
  EMPTY_LINK_STATE,
  activeScopesFor,
  checkInvite,
  counterpartsFor,
  daysCover,
  linkStateFor,
  parseScopes,
  projectMember,
  sortBoard,
  supplyState,
  type ConsentLink,
  type CrewBoard,
  type MemberFacts,
  type Scope,
  type SupplyCover,
} from "./logic-consent";

/**
 * The crew board — a consented projection, not a shared table.
 *
 * The old version read every user row and returned everyone's mode, streak and
 * adherence to anyone signed in. Adherence is health data; that was a leak held
 * shut only by there being two users who had agreed in person. It is now a
 * per-scope grant: the caller sees their own row in full, plus the rows of
 * people who hold an *active* link naming them as viewer, each squeezed through
 * `projectMember` in convex/tm/logic-consent.ts.
 *
 * Two rules hold everywhere in this file:
 *   1. No user row is read without a link that justifies reading it.
 *   2. Nothing about another user leaves a handler except via `projectMember`
 *      (or, for a pending invitation, their name — which is what the invitation
 *      is about, and is already public on the login screen).
 */

const MAX_LINKS = 64;
const MAX_SUPPLY = 200;
const MAX_ITEMS = 200;
const MAX_FEED = 20;
const MAX_FEED_SCAN = 40;
const MAX_ROSTER = 8;

/* ===== links ===== */

function toLink(row: Doc<"tm_crewLinks">): ConsentLink {
  const link: ConsentLink = {
    id: row._id,
    owner: row.ownerId,
    viewer: row.viewerId,
    scopes: row.scopes,
    status: row.status,
    invitedDate: row.invitedDate,
  };
  if (row.respondedDate !== undefined) link.respondedDate = row.respondedDate;
  if (row.revokedDate !== undefined) link.revokedDate = row.revokedDate;
  return link;
}

/** Every link touching this user, from both indexes. Never a table scan. */
async function linksFor(ctx: QueryCtx, userId: Id<"tm_users">): Promise<ConsentLink[]> {
  const owned = await ctx.db
    .query("tm_crewLinks")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
    .take(MAX_LINKS);
  const viewed = await ctx.db
    .query("tm_crewLinks")
    .withIndex("by_viewerId", (q) => q.eq("viewerId", userId))
    .take(MAX_LINKS);
  const byId = new Map<string, ConsentLink>();
  for (const row of [...owned, ...viewed]) byId.set(row._id, toLink(row));
  return [...byId.values()];
}

/* ===== facts, gathered only as far as a scope reaches ===== */

/** Supply cover for one user, joined to their own items. Yields one word. */
async function supplyStateFor(ctx: QueryCtx, userId: Id<"tm_users">) {
  const rows = await ctx.db
    .query("tm_supply")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_SUPPLY);
  if (rows.length === 0) return supplyState([]);
  const items = await ctx.db
    .query("tm_protocolItems")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_ITEMS);
  const byId = new Map(items.map((i) => [i._id as string, i]));
  const covers: SupplyCover[] = [];
  for (const r of rows) {
    const item = byId.get(r.itemId);
    // A paused item has no schedule to run out of.
    if (!item || !item.active) continue;
    covers.push({
      daysCover: daysCover(r.onHand, r.unitsPerDose, item.timings.length),
      reorderLeadDays: r.reorderLeadDays,
    });
  }
  return supplyState(covers);
}

/**
 * Gather only what the granted scopes cover. The placeholders standing in for
 * ungranted scopes are dropped by `projectMember` before anything is returned —
 * they exist so an ungranted scope costs no reads at all.
 */
async function factsFor(
  ctx: QueryCtx,
  user: Doc<"tm_users">,
  isYou: boolean,
  scopes: readonly Scope[],
  date: string,
): Promise<MemberFacts> {
  const stats = scopes.includes("adherence")
    ? await adherenceStats(ctx, user, date)
    : { streak: 0, adherence7: 0, todayDone: 0, todayTotal: 0 };
  return {
    slug: user.slug,
    name: user.name,
    isYou,
    mode: user.mode,
    modeSince: user.modeSince,
    reviewDate: user.reviewDate ?? null,
    daysInMode: daysBetween(user.modeSince, date),
    streak: stats.streak,
    adherence7: stats.adherence7,
    todayDone: stats.todayDone,
    todayTotal: stats.todayTotal,
    supplyState: scopes.includes("supply") ? await supplyStateFor(ctx, user._id) : "none",
  };
}

/* ===== the board ===== */

export const board = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, { token, date }): Promise<CrewBoard> => {
    const viewer = await requireUser(ctx, token);
    const links = await linksFor(ctx, viewer._id);

    // Your own row, in full — plus the roster, so an invitation is one tap.
    // Names and slugs only: the login screen already lists exactly this much.
    const roster = await ctx.db.query("tm_users").take(MAX_ROSTER);
    const own = activeScopesFor(links, viewer._id, viewer._id);
    const you = projectMember(await factsFor(ctx, viewer, true, own, date), own);
    const rows: CrewBoard = [
      {
        ...you,
        link: {
          ...EMPTY_LINK_STATE,
          candidates: roster
            .filter((u) => u._id !== viewer._id)
            .map((u) => ({ slug: u.slug, name: u.name })),
        },
      },
    ];

    // Everyone with a live link either way. A pending link buys a name and
    // nothing else: `activeScopesFor` returns [] and the projection empties.
    for (const otherId of counterpartsFor(links, viewer._id)) {
      const other = await ctx.db.get("tm_users", otherId as Id<"tm_users">);
      if (!other) continue;
      const scopes = activeScopesFor(links, other._id, viewer._id);
      rows.push({
        ...projectMember(await factsFor(ctx, other, false, scopes, date), scopes),
        link: linkStateFor(links, viewer._id, other._id),
      });
    }

    return sortBoard(rows);
  },
});

/* ===== the feed ===== */

export const feed = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    const links = await linksFor(ctx, user._id);
    // You, plus the people you actually share with. Not the table.
    const allowed = [user._id, ...counterpartsFor(links, user._id)] as Id<"tm_users">[];
    const rows: { name: string; message: string; at: number }[] = [];
    for (const id of allowed) {
      const own = await ctx.db
        .query("tm_crewFeed")
        .withIndex("by_userId", (q) => q.eq("userId", id))
        .order("desc")
        .take(MAX_FEED_SCAN);
      for (const r of own) rows.push({ name: r.name, message: r.message, at: r._creationTime });
    }
    return rows.sort((a, b) => a.at - b.at).slice(-MAX_FEED);
  },
});

export const nudge = mutation({
  args: { token: v.string(), message: v.string() },
  handler: async (ctx, { token, message }) => {
    const user = await requireUser(ctx, token);
    const trimmed = message.trim().slice(0, 200);
    if (!trimmed) throw new ConvexError("empty-nudge");
    // A nudge is posted to your own file. Who reads it is decided by `feed`,
    // which is decided by who holds a link with you.
    await ctx.db.insert("tm_crewFeed", { userId: user._id, name: user.name, message: trimmed });
    return null;
  },
});

/* ===== consent: offer, answer, withdraw ===== */

/**
 * Offer *your own* file to someone else. The caller is always the owner: there
 * is no way to invite yourself to somebody else's data.
 */
export const invite = mutation({
  args: { token: v.string(), date: v.string(), slug: v.string(), scopes: v.array(v.string()) },
  handler: async (ctx, { token, date, slug, scopes }) => {
    const owner = await requireUser(ctx, token);
    const parsed = parseScopes(scopes);
    if (!parsed) throw new ConvexError("unknown-scope");

    const target = await ctx.db
      .query("tm_users")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!target) throw new ConvexError("unknown-user");

    const links = await linksFor(ctx, owner._id);
    const verdict = checkInvite(links, owner._id, target._id, parsed);
    if (verdict !== "ok") throw new ConvexError(verdict);

    await ctx.db.insert("tm_crewLinks", {
      ownerId: owner._id,
      viewerId: target._id,
      scopes: parsed,
      status: "pending",
      invitedDate: date,
    });
    return null;
  },
});

/** Only the person named as viewer may answer. Declining revokes on the spot. */
export const respondToInvite = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    linkId: v.id("tm_crewLinks"),
    accept: v.boolean(),
  },
  handler: async (ctx, { token, date, linkId, accept }) => {
    const user = await requireUser(ctx, token);
    const link = await ctx.db.get("tm_crewLinks", linkId);
    // An id is not authority — the invitation must be addressed to this caller.
    if (!link || link.viewerId !== user._id) throw new ConvexError("not-your-invite");
    if (link.status !== "pending") throw new ConvexError("already-answered");
    const patch: { status: "active" | "revoked"; respondedDate: string; revokedDate?: string } = {
      status: accept ? "active" : "revoked",
      respondedDate: date,
    };
    if (!accept) patch.revokedDate = date;
    await ctx.db.patch("tm_crewLinks", linkId, patch);
    return null;
  },
});

/**
 * Either party, at any time, immediately. The owner can stop sharing; the viewer
 * can hand back access they no longer want. Revoking never deletes the history
 * behind it — it stops the projection.
 */
export const revokeLink = mutation({
  args: { token: v.string(), date: v.string(), linkId: v.id("tm_crewLinks") },
  handler: async (ctx, { token, date, linkId }) => {
    const user = await requireUser(ctx, token);
    const link = await ctx.db.get("tm_crewLinks", linkId);
    if (!link || (link.ownerId !== user._id && link.viewerId !== user._id)) {
      throw new ConvexError("not-your-link");
    }
    if (link.status === "revoked") return null;
    await ctx.db.patch("tm_crewLinks", linkId, { status: "revoked", revokedDate: date });
    return null;
  },
});

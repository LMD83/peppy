import { MODE_CHECKS, addDays, daysBetween } from "@convex/tm/lib";
import { computeStreakAndAdherence, type WallDay } from "@convex/tm/logic";
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
  supersededGrantIds,
  supplyState,
  type ConsentLink,
  type MemberFacts,
  type ProjectedMember,
  type Relationship,
  type Scope,
  type SupplyCover,
} from "@convex/tm/logic-consent";
import type { DemoDb } from "../demo-db";
import type { CrewData } from "../types";

/**
 * Demo mirror of convex/tm/crew.ts. Same links, same scopes, same chokepoint —
 * the view type is derived from the Convex query, so any drift is a build error.
 *
 * Identities here are slugs where Convex uses document ids; the pure logic in
 * logic-consent.ts treats both as opaque strings, so the rules are shared, not
 * reimplemented.
 */

type DemoUser = DemoDb["users"][number];

/**
 * The stored row plus its relationship. The row contract in demo/rows-wave1.ts
 * mirrors the table, where `relationship` is optional; reading it through this
 * type keeps a pre-carer row (no field at all) working as "crew" rather than
 * failing, which is exactly how the Convex side reads it.
 */
type StoredLink = DemoDb["crewLinks"][number] & { relationship?: Relationship };

/** Every link in the demo store, in the shape the pure logic expects. */
export function allLinks(db: DemoDb): ConsentLink[] {
  return db.crewLinks.map((row) => {
    const r = row as StoredLink;
    const link: ConsentLink = {
      id: r.id,
      owner: r.ownerSlug,
      viewer: r.viewerSlug,
      scopes: r.scopes,
      status: r.status,
      invitedDate: r.invitedDate,
    };
    if (r.relationship !== undefined) link.relationship = r.relationship;
    if (r.respondedDate !== undefined) link.respondedDate = r.respondedDate;
    if (r.revokedDate !== undefined) link.revokedDate = r.revokedDate;
    return link;
  });
}

/** The live grants touching one person, in either direction. */
export function activeLinksFor(db: DemoDb, slug: string): ConsentLink[] {
  return allLinks(db).filter(
    (l) => l.status === "active" && (l.owner === slug || l.viewer === slug),
  );
}

function user(db: DemoDb, slug: string): DemoUser {
  const u = db.users.find((x) => x.slug === slug);
  if (!u) throw new Error("Unknown user");
  return u;
}

function statsFor(db: DemoDb, u: DemoUser, date: string) {
  const checks = MODE_CHECKS[u.modeMut];
  const wall: WallDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(date, -i);
    const rows = db.checks.filter((c) => c.userSlug === u.slug && c.date === day);
    const doneByKey = new Map(rows.map((r) => [r.key, r.done]));
    wall.push({
      date: day,
      done: checks.filter((c) => doneByKey.get(c.key) ?? false).length,
      total: checks.length,
    });
  }
  return computeStreakAndAdherence(wall, date);
}

function supplyStateFor(db: DemoDb, slug: string) {
  const rows = db.supplyRows.filter((r) => r.userSlug === slug);
  if (rows.length === 0) return supplyState([]);
  const covers: SupplyCover[] = [];
  for (const r of rows) {
    const item = db.protocolItems.find((i) => i.id === r.itemId && i.userSlug === slug);
    if (!item || !item.active) continue;
    covers.push({
      daysCover: daysCover(r.onHand, r.unitsPerDose, item.timings.length),
      reorderLeadDays: r.reorderLeadDays,
    });
  }
  return supplyState(covers);
}

function factsFor(
  db: DemoDb,
  u: DemoUser,
  isYou: boolean,
  scopes: readonly Scope[],
  date: string,
): MemberFacts {
  // Ungranted scopes cost nothing to gather and are dropped by projectMember.
  const stats = scopes.includes("adherence")
    ? statsFor(db, u, date)
    : { streak: 0, adherence7: 0, todayDone: 0, todayTotal: 0 };
  return {
    slug: u.slug,
    name: u.name,
    isYou,
    mode: u.modeMut,
    modeSince: u.modeSinceMut,
    reviewDate: u.reviewDateMut ?? null,
    daysInMode: daysBetween(u.modeSinceMut, date),
    streak: stats.streak,
    adherence7: stats.adherence7,
    todayDone: stats.todayDone,
    todayTotal: stats.todayTotal,
    supplyState: scopes.includes("supply") ? supplyStateFor(db, u.slug) : "none",
  };
}

/** What `viewerSlug` may see of `ownerSlug`, and nothing besides. */
export function projectFor(
  db: DemoDb,
  viewerSlug: string,
  ownerSlug: string,
  date: string,
): ProjectedMember {
  const scopes = activeScopesFor(allLinks(db), ownerSlug, viewerSlug);
  const isYou = ownerSlug === viewerSlug;
  return projectMember(factsFor(db, user(db, ownerSlug), isYou, scopes, date), scopes);
}

/** The board: your own row in full, plus everyone who has granted you something. */
export function view(db: DemoDb, viewerSlug: string, date: string): CrewData {
  const links = allLinks(db);
  const rows: CrewData = [
    {
      ...projectFor(db, viewerSlug, viewerSlug, date),
      link: {
        ...EMPTY_LINK_STATE,
        candidates: db.users
          .filter((u) => u.slug !== viewerSlug)
          .map((u) => ({ slug: u.slug, name: u.name })),
      },
    },
  ];
  for (const otherSlug of counterpartsFor(links, viewerSlug)) {
    if (!db.users.some((u) => u.slug === otherSlug)) continue;
    // Same order as Convex: project first, then hand the *projected* member to
    // the link state, which is all a carer view is ever built from.
    const projected = projectFor(db, viewerSlug, otherSlug, date);
    rows.push({ ...projected, link: linkStateFor(links, viewerSlug, otherSlug, projected) });
  }
  return sortBoard(rows);
}

/* ===== mutations ===== */

export function invite(
  db: DemoDb,
  slug: string,
  date: string,
  targetSlug: string,
  scopes: string[],
  relationship: Relationship = "crew",
): void {
  const parsed = parseScopes(scopes);
  if (!parsed) throw new Error("unknown-scope");
  if (!db.users.some((u) => u.slug === targetSlug)) throw new Error("unknown-user");
  // Same verdict function as Convex, so an over-broad carer invite is refused
  // in demo mode too — not merely hidden by a shorter checkbox list.
  const verdict = checkInvite(allLinks(db), slug, targetSlug, parsed, relationship);
  if (verdict !== "ok") throw new Error(verdict);
  const row: StoredLink = {
    id: db.newId("cl"),
    ownerSlug: slug,
    viewerSlug: targetSlug,
    scopes: parsed,
    relationship,
    status: "pending",
    invitedDate: date,
  };
  db.crewLinks.push(row);
}

export function respond(
  db: DemoDb,
  slug: string,
  date: string,
  linkId: string,
  accept: boolean,
): void {
  const row = db.crewLinks.find((l) => l.id === linkId);
  // An id is not authority — the invitation must be addressed to this caller.
  if (!row || row.viewerSlug !== slug) throw new Error("not-your-invite");
  if (row.status !== "pending") throw new Error("already-answered");
  row.status = accept ? "active" : "revoked";
  row.respondedDate = date;
  if (!accept) row.revokedDate = date;
  if (!accept) return;
  // Accepting replaces what that person held before — one grant per direction,
  // so one "stop sharing" is always the whole answer.
  const superseded = supersededGrantIds(allLinks(db), row.ownerSlug, row.viewerSlug, row.id);
  for (const old of db.crewLinks) {
    if (!superseded.includes(old.id)) continue;
    old.status = "revoked";
    old.revokedDate = date;
  }
}

export function revoke(db: DemoDb, slug: string, date: string, linkId: string): void {
  const row = db.crewLinks.find((l) => l.id === linkId);
  if (!row || (row.ownerSlug !== slug && row.viewerSlug !== slug)) {
    throw new Error("not-your-link");
  }
  if (row.status === "revoked") return;
  row.status = "revoked";
  row.revokedDate = date;
}

import type { TmMode } from "./lib";

/**
 * Pure consent logic — who may see what of whom, and what survives the cut.
 *
 * Sharing adherence is sharing health data. Nothing about another person's file
 * leaves the backend except through `projectMember`, and `projectMember` copies
 * only the fields a named, active, revocable scope covers. Anything not named by
 * a scope is dropped by default: a new field added to `MemberFacts` is invisible
 * until someone deliberately lists it in `SCOPE_FIELDS`.
 *
 * Shared verbatim between convex/tm/crew.ts and src/app/_lib/demo/consent.ts, so
 * both backends leak — or refuse to leak — exactly the same things.
 *
 * Deterministic: no Date.now(), no Math.random(). Dates arrive as arguments.
 */

/* ===== scopes ===== */

/** The only projections a grant can cover. Not a menu of tables — a menu of sentences. */
export const SCOPES = ["adherence", "mode", "supply"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<Scope, string> = {
  adherence: "Your checks",
  mode: "Your mode",
  supply: "Running low",
};

/** One line of plain English each, written for the person giving the consent. */
export const SCOPE_DESCRIPTIONS: Record<Scope, string> = {
  adherence: "how often you hit your checks",
  mode: "which mode you're in, and how long you've been in it",
  supply: "that something needs reordering — never what it is",
};

/** The floor under every grant, stated on the same line as the grant itself. */
export const NEVER_SHARED = "Not your weight, not your medicines, nothing you write down.";

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

/** Unknown or empty scope lists are rejected outright, not silently narrowed. */
export function parseScopes(input: readonly string[]): Scope[] | null {
  if (input.length === 0) return null;
  for (const s of input) if (!isScope(s)) return null;
  return orderScopes(input);
}

/** Canonical order, deduped — so two equal grants always read the same. */
export function orderScopes(input: readonly string[]): Scope[] {
  return SCOPES.filter((s) => input.includes(s));
}

/** "Conor can see: how often you hit your checks. Not your weight, not your medicines." */
export function sharedLine(name: string, scopes: readonly Scope[]): string {
  if (scopes.length === 0) return `${name} can see nothing of yours.`;
  const parts = orderScopes(scopes).map((s) => SCOPE_DESCRIPTIONS[s]);
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${name} can see: ${list}. ${NEVER_SHARED}`;
}

/* ===== links ===== */

export type LinkStatus = "pending" | "active" | "revoked";

/**
 * One directional grant. `owner` is whose file it is; `viewer` is who may look.
 * The two identifiers are opaque strings — Convex passes document ids, the demo
 * backend passes slugs, and neither is treated as authority by itself.
 */
export type ConsentLink = {
  id: string;
  owner: string;
  viewer: string;
  scopes: string[];
  status: LinkStatus;
  invitedDate: string;
  respondedDate?: string;
  revokedDate?: string;
};

/** The one active grant from owner to viewer, if there is one. */
export function activeGrant(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
): ConsentLink | null {
  return (
    links.find((l) => l.status === "active" && l.owner === owner && l.viewer === viewer) ?? null
  );
}

/**
 * The scopes `viewer` currently holds over `owner`'s file.
 * A pending link grants nothing. A revoked link grants nothing. You always hold
 * every scope over your own file.
 */
export function activeScopesFor(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
): Scope[] {
  if (owner === viewer) return [...SCOPES];
  const link = activeGrant(links, owner, viewer);
  return link ? orderScopes(link.scopes) : [];
}

export function canSee(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
  scope: Scope,
): boolean {
  return activeScopesFor(links, owner, viewer).includes(scope);
}

/** Invitations waiting on this viewer's answer. */
export function pendingFor(links: readonly ConsentLink[], viewer: string): ConsentLink[] {
  return links.filter((l) => l.status === "pending" && l.viewer === viewer);
}

/** Invitations this owner has sent and not yet had answered. */
export function outgoingFor(links: readonly ConsentLink[], owner: string): ConsentLink[] {
  return links.filter((l) => l.status === "pending" && l.owner === owner);
}

/** Everyone this user has any live relationship with, in either direction. */
export function counterpartsFor(links: readonly ConsentLink[], user: string): string[] {
  const out: string[] = [];
  for (const l of links) {
    if (l.status === "revoked") continue;
    const other = l.owner === user ? l.viewer : l.viewer === user ? l.owner : null;
    if (other && other !== user && !out.includes(other)) out.push(other);
  }
  return out;
}

export type InviteCheck = "ok" | "self-invite" | "duplicate-invite";

/**
 * You may widen what you share. You may not send the same invitation twice, and
 * you may not re-offer what the other person can already see.
 */
export function checkInvite(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
  scopes: readonly Scope[],
): InviteCheck {
  if (owner === viewer) return "self-invite";
  if (outgoingFor(links, owner).some((l) => l.viewer === viewer)) return "duplicate-invite";
  const held = activeScopesFor(links, owner, viewer);
  if (scopes.every((s) => held.includes(s))) return "duplicate-invite";
  return "ok";
}

/* ===== supply — a flag, never a name ===== */

export type SupplyState = "ok" | "order-due" | "none";

export type SupplyCover = { daysCover: number; reorderLeadDays: number };

/** Days of cover left. No dose-per-day means no schedule to run out of. */
export function daysCover(onHand: number, unitsPerDose: number, dosesPerDay: number): number {
  const perDay = unitsPerDose * dosesPerDay;
  if (perDay <= 0) return Number.POSITIVE_INFINITY;
  return onHand / perDay;
}

/**
 * The whole supply projection: one word. "order-due" the moment any tracked item
 * is inside its own reorder lead time — which is a nudge, not a diagnosis, and
 * never says which item.
 */
export function supplyState(rows: readonly SupplyCover[]): SupplyState {
  if (rows.length === 0) return "none";
  return rows.some((r) => r.daysCover <= r.reorderLeadDays) ? "order-due" : "ok";
}

/* ===== the projection chokepoint ===== */

/** Everything the backend knows about a crew member. Never returned as-is. */
export type MemberFacts = {
  slug: string;
  name: string;
  isYou: boolean;
  mode: TmMode;
  modeSince: string;
  reviewDate: string | null;
  daysInMode: number;
  streak: number;
  adherence7: number;
  todayDone: number;
  todayTotal: number;
  supplyState: SupplyState;
};

/** Identity is not a scope: a name is what a consent conversation is *about*. */
export const IDENTITY_FIELDS = ["slug", "name", "isYou"] as const;

/** The single map from scope to field. A field absent here can never be sent. */
export const SCOPE_FIELDS = {
  adherence: ["streak", "adherence7", "todayDone", "todayTotal"],
  mode: ["mode", "modeSince", "reviewDate", "daysInMode"],
  supply: ["supplyState"],
} as const satisfies Record<Scope, readonly (keyof MemberFacts)[]>;

/** What leaves the backend. Every field past identity is optional by design. */
export type ProjectedMember = {
  slug: string;
  name: string;
  isYou: boolean;
  mode?: TmMode;
  modeSince?: string;
  reviewDate?: string | null;
  daysInMode?: number;
  streak?: number;
  adherence7?: number;
  todayDone?: number;
  todayTotal?: number;
  supplyState?: SupplyState;
};

/**
 * Strip everything the scopes do not cover. Written as an allowlist with one
 * branch per scope rather than a delete-list, so the failure mode of forgetting
 * a field is that it disappears, not that it leaks.
 */
export function projectMember(
  member: MemberFacts,
  scopes: readonly Scope[],
): ProjectedMember {
  const granted = new Set<Scope>(scopes);
  const out: ProjectedMember = { slug: member.slug, name: member.name, isYou: member.isYou };
  if (granted.has("adherence")) {
    out.streak = member.streak;
    out.adherence7 = member.adherence7;
    out.todayDone = member.todayDone;
    out.todayTotal = member.todayTotal;
  }
  if (granted.has("mode")) {
    out.mode = member.mode;
    out.modeSince = member.modeSince;
    out.reviewDate = member.reviewDate;
    out.daysInMode = member.daysInMode;
  }
  if (granted.has("supply")) {
    out.supplyState = member.supplyState;
  }
  return out;
}

/* ===== the board row ===== */

export type InviteView = { linkId: string; scopes: Scope[]; invitedDate: string };

/**
 * The consent state between you and one other person, carried on their row so
 * the UI never has to guess who a grant belongs to.
 */
export type LinkState = {
  /** What you may see of them, right now. */
  youSee: Scope[];
  /** What they may see of you, right now. */
  theySee: Scope[];
  /** Your grant to them — revoke this to stop them seeing you. */
  yourGrantId: string | null;
  /** Their grant to you — either party may revoke, so this is revocable too. */
  theirGrantId: string | null;
  /** They offered; you have not answered. */
  incoming: InviteView | null;
  /** You offered; they have not answered. */
  outgoing: InviteView | null;
  /** Self row only: people you could invite. Names only — same as the login list. */
  candidates: { slug: string; name: string }[];
};

export type CrewMember = ProjectedMember & { link: LinkState };
export type CrewBoard = CrewMember[];

export const EMPTY_LINK_STATE: LinkState = {
  youSee: [],
  theySee: [],
  yourGrantId: null,
  theirGrantId: null,
  incoming: null,
  outgoing: null,
  candidates: [],
};

/** Assemble the consent state between `viewer` and `other` from the raw links. */
export function linkStateFor(
  links: readonly ConsentLink[],
  viewer: string,
  other: string,
): LinkState {
  const theirGrant = activeGrant(links, other, viewer);
  const yourGrant = activeGrant(links, viewer, other);
  const incoming = pendingFor(links, viewer).find((l) => l.owner === other) ?? null;
  const outgoing = outgoingFor(links, viewer).find((l) => l.viewer === other) ?? null;
  return {
    youSee: theirGrant ? orderScopes(theirGrant.scopes) : [],
    theySee: yourGrant ? orderScopes(yourGrant.scopes) : [],
    yourGrantId: yourGrant?.id ?? null,
    theirGrantId: theirGrant?.id ?? null,
    incoming: incoming ? toInviteView(incoming) : null,
    outgoing: outgoing ? toInviteView(outgoing) : null,
    candidates: [],
  };
}

export function toInviteView(link: ConsentLink): InviteView {
  return { linkId: link.id, scopes: orderScopes(link.scopes), invitedDate: link.invitedDate };
}

/** Self first, then alphabetical — the board is a file, not a leaderboard. */
export function sortBoard(rows: CrewBoard): CrewBoard {
  return rows
    .slice()
    .sort((a, b) => (a.isYou === b.isYou ? a.name.localeCompare(b.name) : a.isYou ? -1 : 1));
}

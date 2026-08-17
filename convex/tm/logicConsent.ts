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

/* ===== relationships — a carer is not a peer ===== */

/**
 * A peer in the crew, or someone helping from outside it. The distinction is
 * not a label on a card: it decides, below, what a grant may ever cover.
 */
export const RELATIONSHIPS = ["crew", "carer"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

/**
 * What a carer may ever be granted, written out one by one.
 *
 * This list is deliberately NOT `SCOPES`. It is the whole safety property: a
 * scope added to `SCOPES` tomorrow reaches crew and stops dead here, so
 * widening the carer seat takes an edit to this line and the test that pins it.
 * Craving entries, assessment answers and anything else a person writes down
 * have no scope at all and must not acquire one to satisfy a carer's curiosity.
 */
export const CARER_SCOPES = ["adherence", "mode", "supply"] as const satisfies readonly Scope[];

export const ALLOWED_SCOPES: Record<Relationship, readonly Scope[]> = {
  crew: SCOPES,
  carer: CARER_SCOPES,
};

export function isRelationship(value: string): value is Relationship {
  return (RELATIONSHIPS as readonly string[]).includes(value);
}

export function allowedScopesFor(relationship: Relationship): readonly Scope[] {
  return ALLOWED_SCOPES[relationship];
}

/** A link written before relationships existed is a peer link, not a carer one. */
export function relationshipOf(link: ConsentLink): Relationship {
  return link.relationship && isRelationship(link.relationship) ? link.relationship : "crew";
}

/** The requested scopes this relationship may not hold. Empty means allowed. */
export function refusedScopes(
  relationship: Relationship,
  scopes: readonly string[],
): string[] {
  const allowed = allowedScopesFor(relationship) as readonly string[];
  return scopes.filter((s) => !allowed.includes(s));
}

/** Parse *and* permission-check in one step, for callers building an offer. */
export function parseScopesFor(
  relationship: Relationship,
  input: readonly string[],
): Scope[] | null {
  const parsed = parseScopes(input);
  if (!parsed) return null;
  return refusedScopes(relationship, parsed).length === 0 ? parsed : null;
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

/**
 * The same three scopes, said the way you would say them to someone who is
 * helping you rather than training beside you. No jargon, no percentages, no
 * "adherence" — a tired person at a kitchen table has to be able to read this
 * once and know what they just agreed to.
 */
export const CARER_SCOPE_PLAIN: Record<Scope, string> = {
  adherence: "whether today's checks got done",
  mode: "which mode you're in",
  supply: "whether anything is running out",
};

/** What a carer never sees, spelled out rather than implied. */
export const CARER_NEVER = "which medicines, your weight, or anything you write down";

/**
 * Two sentences, both about a named person, both in the second person:
 * "Mary will see whether today's checks got done and whether anything is
 *  running out. Mary will not see which medicines, your weight, or anything you
 *  write down."
 */
export function carerSentence(name: string, scopes: readonly Scope[]): string {
  const parts = orderScopes(scopes).map((s) => CARER_SCOPE_PLAIN[s]);
  const seen =
    parts.length === 0
      ? "nothing at all"
      : parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${name} will see ${seen}. ${name} will not see ${CARER_NEVER}.`;
}

/** The same disclosure, read from the carer's side of the table. */
export function carerSeatSentence(name: string, scopes: readonly Scope[]): string {
  const parts = orderScopes(scopes).map((s) => CARER_SCOPE_PLAIN[s]);
  const seen =
    parts.length === 0
      ? "nothing at all"
      : parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `You can see ${seen.replace("you're in", `${name} is in`)}. You cannot see which medicines, ${name}'s weight, or anything ${name} writes down.`;
}

/** One line per relationship, so a card never has to guess which to print. */
export function grantSentence(
  name: string,
  scopes: readonly Scope[],
  relationship: Relationship,
): string {
  return relationship === "carer" ? carerSentence(name, scopes) : sharedLine(name, scopes);
}

/** "Artur can see: how often you hit your checks. Not your weight, not your medicines." */
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
  /** Absent on links written before the carer seat existed — read as "crew". */
  relationship?: string;
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
 * What one link actually covers: its scopes, minus anything its relationship
 * may not hold. A stored row is not authority — a carer row naming a scope
 * outside `CARER_SCOPES` (a legacy row, a hand-edited document) covers nothing
 * extra, here or anywhere downstream.
 */
export function grantScopes(link: ConsentLink): Scope[] {
  const allowed = allowedScopesFor(relationshipOf(link));
  return orderScopes(link.scopes).filter((s) => allowed.includes(s));
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
  return link ? grantScopes(link) : [];
}

/** How `viewer` holds `owner`'s file right now, or null if they do not. */
export function activeRelationship(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
): Relationship | null {
  const link = activeGrant(links, owner, viewer);
  return link ? relationshipOf(link) : null;
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

export type InviteCheck = "ok" | "self-invite" | "duplicate-invite" | "scope-not-allowed";

/**
 * You may widen what you share, and you may change what someone is to you. You
 * may not send the same invitation twice, you may not re-offer what the other
 * person can already see on the same footing — and you may not offer a carer
 * more than a carer may ever hold.
 *
 * The last one is the point of this function existing rather than a comment in
 * the UI: an over-broad carer invitation cannot be *created*, so there is no
 * window in which a row exists that a projection then has to remember to trim.
 */
export function checkInvite(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
  scopes: readonly Scope[],
  relationship: Relationship = "crew",
): InviteCheck {
  if (owner === viewer) return "self-invite";
  if (refusedScopes(relationship, scopes).length > 0) return "scope-not-allowed";
  if (outgoingFor(links, owner).some((l) => l.viewer === viewer)) return "duplicate-invite";
  const held = activeScopesFor(links, owner, viewer);
  const heldAs = activeRelationship(links, owner, viewer);
  // Same footing, nothing new: a repeat. A different footing is a real change,
  // even at identical scopes — a carer seat is not a peer's view of you.
  if (heldAs === relationship && scopes.every((s) => held.includes(s))) return "duplicate-invite";
  return "ok";
}

/**
 * Accepting an invitation replaces whatever that person held before, so a pair
 * never accumulates two live grants in one direction. Without this, "stop
 * sharing" would revoke one row and leave another standing — the one failure
 * mode a revoke button must not have.
 */
export function supersededGrantIds(
  links: readonly ConsentLink[],
  owner: string,
  viewer: string,
  keepId: string,
): string[] {
  return links
    .filter(
      (l) => l.status === "active" && l.owner === owner && l.viewer === viewer && l.id !== keepId,
    )
    .map((l) => l.id);
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

/* ===== the carer seat ===== */

/**
 * What a carer needs on a bad day, in the order they need it: is anything
 * running out, was today's floor held, is there anything to do.
 *
 * Derived from a member who has *already* been through `projectMember`, not
 * from the raw facts. That is the whole design: the carer view cannot name a
 * medicine, a weight or an entry because it never has one to name — it can only
 * narrow what the projection already let through.
 */
export type CarerStep = "reorder-due" | "checks-outstanding" | "nothing-needed" | "nothing-shared";

export type CarerView = {
  /** The coarse flag, never the thing. */
  supply: SupplyState;
  checksDone: number | null;
  checksTotal: number | null;
  /** Today's floor: held, not held, or not shared with you. */
  floorHeld: boolean | null;
  mode: TmMode | null;
  daysInMode: number | null;
  /** The one thing worth doing, if there is one. */
  step: CarerStep;
};

export function carerViewFrom(member: ProjectedMember): CarerView {
  const checksDone = member.todayDone ?? null;
  const checksTotal = member.todayTotal ?? null;
  const floorHeld =
    checksDone !== null && checksTotal !== null && checksTotal > 0 ? checksDone >= checksTotal : null;
  const supply = member.supplyState ?? "none";
  const step: CarerStep =
    supply === "order-due"
      ? "reorder-due"
      : floorHeld === false
        ? "checks-outstanding"
        : floorHeld === null && supply === "none"
          ? "nothing-shared"
          : "nothing-needed";
  return {
    supply,
    checksDone,
    checksTotal,
    floorHeld,
    mode: member.mode ?? null,
    daysInMode: member.daysInMode ?? null,
    step,
  };
}

/* ===== the board row ===== */

export type InviteView = {
  linkId: string;
  scopes: Scope[];
  relationship: Relationship;
  invitedDate: string;
};

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
  /** What they are on your file: a peer, or a carer. Null if they hold nothing. */
  theyAre: Relationship | null;
  /** What you are on theirs. Null if you hold nothing. */
  youAre: Relationship | null;
  /** Present only when `youAre` is "carer" — the helping-from-outside view. */
  carerView: CarerView | null;
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
  theyAre: null,
  youAre: null,
  carerView: null,
  incoming: null,
  outgoing: null,
  candidates: [],
};

/**
 * Assemble the consent state between `viewer` and `other` from the raw links.
 *
 * `projected` is the *already projected* other member. Pass it and a carer gets
 * their view; withhold it and they get null. Nothing else is read from it, and
 * nothing unprojected can be passed in its place.
 */
export function linkStateFor(
  links: readonly ConsentLink[],
  viewer: string,
  other: string,
  projected?: ProjectedMember,
): LinkState {
  const theirGrant = activeGrant(links, other, viewer);
  const yourGrant = activeGrant(links, viewer, other);
  const incoming = pendingFor(links, viewer).find((l) => l.owner === other) ?? null;
  const outgoing = outgoingFor(links, viewer).find((l) => l.viewer === other) ?? null;
  const youAre = theirGrant ? relationshipOf(theirGrant) : null;
  return {
    youSee: theirGrant ? grantScopes(theirGrant) : [],
    theySee: yourGrant ? grantScopes(yourGrant) : [],
    yourGrantId: yourGrant?.id ?? null,
    theirGrantId: theirGrant?.id ?? null,
    theyAre: yourGrant ? relationshipOf(yourGrant) : null,
    youAre,
    carerView: youAre === "carer" && projected ? carerViewFrom(projected) : null,
    incoming: incoming ? toInviteView(incoming) : null,
    outgoing: outgoing ? toInviteView(outgoing) : null,
    candidates: [],
  };
}

export function toInviteView(link: ConsentLink): InviteView {
  return {
    linkId: link.id,
    // An invitation promises no more than the relationship can hold.
    scopes: grantScopes(link),
    relationship: relationshipOf(link),
    invitedDate: link.invitedDate,
  };
}

/** Self first, then alphabetical — the board is a file, not a leaderboard. */
export function sortBoard(rows: CrewBoard): CrewBoard {
  return rows
    .slice()
    .sort((a, b) => (a.isYou === b.isYou ? a.name.localeCompare(b.name) : a.isYou ? -1 : 1));
}

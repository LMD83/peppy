import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  ALLOWED_SCOPES,
  CARER_NEVER,
  CARER_SCOPES,
  IDENTITY_FIELDS,
  NEVER_SHARED,
  SCOPES,
  SCOPE_FIELDS,
  activeGrant,
  activeRelationship,
  activeScopesFor,
  allowedScopesFor,
  canSee,
  carerSeatSentence,
  carerSentence,
  carerViewFrom,
  checkInvite,
  counterpartsFor,
  daysCover,
  grantScopes,
  grantSentence,
  isScope,
  linkStateFor,
  orderScopes,
  outgoingFor,
  parseScopes,
  parseScopesFor,
  pendingFor,
  projectMember,
  refusedScopes,
  relationshipOf,
  sharedLine,
  sharedScopes,
  supersededGrantIds,
  supplyState,
  type ConsentLink,
  type MemberFacts,
  type Scope,
} from "../convex/tm/logicConsent";
import { buildConsentFixtures } from "../convex/tm/fixtures/consent";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13";

const FACTS: MemberFacts = {
  slug: "artur",
  name: "Artur",
  isYou: false,
  mode: "survival",
  modeSince: addDays(TODAY, -12),
  reviewDate: addDays(TODAY, 2),
  daysInMode: 12,
  streak: 4,
  adherence7: 86,
  todayDone: 3,
  todayTotal: 3,
  supplyState: "order-due",
};

function link(over: Partial<ConsentLink> = {}): ConsentLink {
  return {
    id: "cl_1",
    owner: "artur",
    viewer: "liam",
    scopes: ["adherence", "mode", "supply"],
    status: "active",
    invitedDate: addDays(TODAY, -40),
    ...over,
  };
}

/** Every field on the board is either identity or named by exactly one scope. */
describe("the projection chokepoint", () => {
  it("names every fact under exactly one scope — nothing rides along by default", () => {
    const named = SCOPES.flatMap((s) => [...SCOPE_FIELDS[s]]);
    expect(new Set(named).size).toBe(named.length);
    const covered = new Set<string>([...IDENTITY_FIELDS, ...named]);
    for (const key of Object.keys(FACTS)) expect(covered.has(key)).toBe(true);
    expect(covered.size).toBe(Object.keys(FACTS).length);
  });

  it("gives an adherence-only viewer no mode and no supply", () => {
    const projected = projectMember(FACTS, ["adherence"]);
    expect(Object.keys(projected).sort()).toEqual(
      ["slug", "name", "isYou", "streak", "adherence7", "todayDone", "todayTotal"].sort(),
    );
    expect("mode" in projected).toBe(false);
    expect("modeSince" in projected).toBe(false);
    expect("daysInMode" in projected).toBe(false);
    expect("reviewDate" in projected).toBe(false);
    expect("supplyState" in projected).toBe(false);
    // Not merely undefined — absent, so it cannot be serialised back into view.
    expect(JSON.stringify(projected)).not.toContain("survival");
  });

  it("gives a mode-only viewer no adherence numbers", () => {
    const projected = projectMember(FACTS, ["mode"]);
    expect(projected.mode).toBe("survival");
    expect(projected.daysInMode).toBe(12);
    expect("streak" in projected).toBe(false);
    expect("adherence7" in projected).toBe(false);
    expect("todayDone" in projected).toBe(false);
  });

  it("reduces to a name when no scope is granted", () => {
    const projected = projectMember(FACTS, []);
    expect(projected).toEqual({ slug: "artur", name: "Artur", isYou: false });
  });

  it("shares the supply flag without ever naming the thing", () => {
    const projected = projectMember(FACTS, ["supply"]);
    expect(projected.supplyState).toBe("order-due");
    expect(Object.keys(projected)).toHaveLength(4);
  });
});

describe("grants", () => {
  it("gives a pending link nothing at all", () => {
    const links = [link({ status: "pending" })];
    expect(activeScopesFor(links, "artur", "liam")).toEqual([]);
    expect(canSee(links, "artur", "liam", "adherence")).toBe(false);
    expect(projectMember(FACTS, activeScopesFor(links, "artur", "liam"))).toEqual({
      slug: "artur",
      name: "Artur",
      isYou: false,
    });
  });

  it("gives a revoked link nothing at all, from the moment it is revoked", () => {
    const links = [link({ status: "revoked", revokedDate: TODAY })];
    expect(activeScopesFor(links, "artur", "liam")).toEqual([]);
    expect(activeGrant(links, "artur", "liam")).toBeNull();
    expect(canSee(links, "artur", "liam", "mode")).toBe(false);
  });

  it("is directional — Artur's grant to Liam is not Liam's grant to Artur", () => {
    const links = [link()];
    expect(activeScopesFor(links, "artur", "liam")).toEqual(["adherence", "mode", "supply"]);
    expect(activeScopesFor(links, "liam", "artur")).toEqual([]);
  });

  it("always shows you your own row in full", () => {
    expect(activeScopesFor([], "liam", "liam")).toEqual([...SCOPES]);
    const mine = projectMember({ ...FACTS, isYou: true }, activeScopesFor([], "liam", "liam"));
    expect(mine.adherence7).toBe(86);
    expect(mine.mode).toBe("survival");
    expect(mine.supplyState).toBe("order-due");
  });

  it("ignores an unknown scope smuggled onto a stored link", () => {
    const links = [link({ scopes: ["adherence", "weights", "labs"] })];
    expect(activeScopesFor(links, "artur", "liam")).toEqual(["adherence"]);
  });

  it("keeps counterparts to people with a live link", () => {
    const links = [link(), link({ id: "cl_2", owner: "liam", viewer: "sam", status: "revoked" })];
    expect(counterpartsFor(links, "liam")).toEqual(["artur"]);
  });
});

describe("invitations", () => {
  it("rejects unknown and empty scope lists outright", () => {
    expect(parseScopes([])).toBeNull();
    expect(parseScopes(["adherence", "weight"])).toBeNull();
    expect(parseScopes(["labs"])).toBeNull();
    expect(parseScopes(["supply", "adherence"])).toEqual(["adherence", "supply"]);
    expect(orderScopes(["supply", "supply", "mode"])).toEqual(["mode", "supply"]);
  });

  it("refuses a self-invite and a repeat invite, but allows widening", () => {
    const links = [link({ owner: "liam", viewer: "artur", scopes: ["adherence"] })];
    expect(checkInvite(links, "liam", "liam", ["adherence"])).toBe("self-invite");
    expect(checkInvite(links, "liam", "artur", ["adherence"])).toBe("duplicate-invite");
    expect(checkInvite(links, "liam", "artur", ["adherence", "supply"])).toBe("ok");
    const pending = [...links, link({ id: "cl_2", owner: "liam", viewer: "artur", status: "pending" })];
    expect(checkInvite(pending, "liam", "artur", ["adherence", "supply"])).toBe("duplicate-invite");
  });

  it("routes a pending link to the viewer's inbox and the owner's outbox", () => {
    const links = [link({ status: "pending" })];
    expect(pendingFor(links, "liam").map((l) => l.id)).toEqual(["cl_1"]);
    expect(pendingFor(links, "artur")).toEqual([]);
    expect(outgoingFor(links, "artur").map((l) => l.id)).toEqual(["cl_1"]);
    expect(outgoingFor(links, "liam")).toEqual([]);
  });
});

describe("link state on a board row", () => {
  it("separates what you see from what they see, and offers both revokes", () => {
    const links = [
      link({ id: "cl_a", owner: "artur", viewer: "liam", scopes: ["adherence"] }),
      link({ id: "cl_b", owner: "liam", viewer: "artur", scopes: ["adherence", "mode"] }),
      link({ id: "cl_c", owner: "artur", viewer: "liam", status: "pending" }),
    ];
    const state = linkStateFor(links, "liam", "artur");
    expect(state.youSee).toEqual(["adherence"]);
    expect(state.theySee).toEqual(["adherence", "mode"]);
    expect(state.theirGrantId).toBe("cl_a");
    expect(state.yourGrantId).toBe("cl_b");
    expect(state.incoming?.linkId).toBe("cl_c");
    expect(state.outgoing).toBeNull();
    expect(state.candidates).toEqual([]);
  });
});

describe("copy", () => {
  it("says what is shared and what never is, in plain words", () => {
    expect(sharedLine("Artur", ["adherence"])).toBe(
      `Artur can see: how often you hit your checks. ${NEVER_SHARED}`,
    );
    expect(sharedLine("Artur", ["mode", "adherence"])).toMatch(
      /^Artur can see: how often you hit your checks and which mode/,
    );
    expect(sharedLine("Artur", [])).toBe("Artur can see nothing of yours.");
    expect(NEVER_SHARED).toMatch(/not your medicines/i);
  });

  /**
   * The floor is a promise, and a promise printed on every card is read on
   * none of them — it belongs once per screen, where someone is deciding to
   * grant something. So the grant and the floor are two calls, and the caller
   * says which it needs; `sharedLine` remains both together.
   */
  it("separates the grant from the floor, so a screen can state the floor once", () => {
    expect(sharedScopes("Artur", ["adherence"])).toBe(
      "Artur can see: how often you hit your checks.",
    );
    expect(sharedScopes("Artur", ["adherence"])).not.toContain(NEVER_SHARED);
    expect(sharedScopes("Artur", [])).toBe("Artur can see nothing of yours.");
    expect(grantSentence("Artur", ["adherence"], "crew")).toBe(sharedLine("Artur", ["adherence"]));
    expect(grantSentence("Artur", ["adherence"], "crew", false)).toBe(
      sharedScopes("Artur", ["adherence"]),
    );
    // A carer's second sentence names what that carer will not see. It is
    // disclosure about a person, not the standing floor, so it never drops.
    expect(grantSentence("Mary", ["adherence"], "carer", false)).toContain(CARER_NEVER);
  });
});

describe("supply is one word", () => {
  it("flags a reorder inside the lead time and nothing else", () => {
    expect(supplyState([])).toBe("none");
    expect(supplyState([{ daysCover: 30, reorderLeadDays: 7 }])).toBe("ok");
    expect(
      supplyState([
        { daysCover: 30, reorderLeadDays: 7 },
        { daysCover: 5, reorderLeadDays: 7 },
      ]),
    ).toBe("order-due");
    expect(daysCover(60, 1, 2)).toBe(30);
    expect(daysCover(60, 1, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("fixtures", () => {
  const fx = buildConsentFixtures(TODAY);
  const links: ConsentLink[] = fx.crewLinks.map((r) => ({
    id: r.id,
    owner: r.ownerSlug,
    viewer: r.viewerSlug,
    scopes: r.scopes,
    relationship: r.relationship,
    status: r.status,
    invitedDate: r.invitedDate,
  }));

  it("pairs the two of them with real, revocable paperwork", () => {
    expect(activeScopesFor(links, "liam", "artur")).toEqual(["adherence", "mode", "supply"]);
    expect(activeScopesFor(links, "artur", "liam")).toEqual(["adherence", "mode"]);
  });

  it("leaves Liam one pending invite to answer, granting nothing meanwhile", () => {
    const inbox = pendingFor(links, "liam");
    expect(inbox).toHaveLength(1);
    expect(inbox[0].scopes).toContain("supply");
    // The pending widen has not landed: Liam still cannot see Artur's supply.
    expect(canSee(links, "artur", "liam", "supply")).toBe(false);
    const projected = projectMember(FACTS, activeScopesFor(links, "artur", "liam"));
    expect("supplyState" in projected).toBe(false);
    expect(projected.adherence7).toBe(86);
  });

  it("keeps the board free of anything a scope does not name", () => {
    const scopes: Scope[] = activeScopesFor(links, "artur", "liam");
    const serialised = JSON.stringify(projectMember(FACTS, scopes));
    for (const banned of ["kcal", "weightKg", "dose", "value", "score", "marker"]) {
      expect(serialised).not.toContain(banned);
    }
  });
});

/* ===== Wave 3: the carer seat ===== */

/**
 * The scope that must never exist. Cravings, assessment answers and anything
 * else a person writes down have no scope today, and the machinery below has to
 * refuse them anyway — a guard that only works while the list is short is not a
 * guard, it is a coincidence.
 */
const FUTURE_SCOPE = "craving" as Scope;

describe("a carer is not a peer", () => {
  it("pins the carer allowlist, and does not let it track SCOPES", () => {
    expect(allowedScopesFor("carer")).toEqual(["adherence", "mode", "supply"]);
    expect([...CARER_SCOPES].every((s) => (SCOPES as readonly string[]).includes(s))).toBe(true);
    // Crew follows the scope list; a carer's list is written out by hand, so a
    // scope added tomorrow reaches peers and stops dead at the carer seat.
    expect(ALLOWED_SCOPES.crew).toBe(SCOPES);
    expect(ALLOWED_SCOPES.carer).not.toBe(SCOPES);
  });

  it("has no scope at all for cravings, assessments or anything written down", () => {
    for (const banned of [
      "craving",
      "cravings",
      "assessment",
      "assessments",
      "phq9",
      "gad7",
      "reflection",
      "intentions",
      "notes",
      "entries",
      "weight",
      "labs",
      "doses",
    ]) {
      expect(isScope(banned)).toBe(false);
      expect(parseScopes([banned])).toBeNull();
      expect(parseScopesFor("carer", [banned])).toBeNull();
    }
  });

  it("refuses an over-broad carer invite even when the caller asks for it", () => {
    // The caller asks for a scope outside the carer set. It is refused at the
    // point of creation, so no over-broad carer row is ever written.
    expect(checkInvite([], "artur", "mary", ["adherence", FUTURE_SCOPE], "carer")).toBe(
      "scope-not-allowed",
    );
    expect(refusedScopes("carer", [FUTURE_SCOPE])).toEqual([FUTURE_SCOPE]);
    expect(parseScopesFor("carer", ["adherence", FUTURE_SCOPE])).toBeNull();
    // The same three, on the carer footing, are fine.
    expect(checkInvite([], "artur", "mary", ["adherence", "mode", "supply"], "carer")).toBe("ok");
  });

  it("clamps a stored carer row that names more than a carer may hold", () => {
    const rogue = link({
      owner: "artur",
      viewer: "mary",
      relationship: "carer",
      scopes: ["adherence", "mode", "supply", FUTURE_SCOPE],
    });
    expect(grantScopes(rogue)).toEqual(["adherence", "mode", "supply"]);
    expect(activeScopesFor([rogue], "artur", "mary")).not.toContain(FUTURE_SCOPE);
    expect(canSee([rogue], "artur", "mary", FUTURE_SCOPE)).toBe(false);
  });

  it("reads a link written before carers existed as a peer link", () => {
    expect(relationshipOf(link())).toBe("crew");
    expect(relationshipOf(link({ relationship: "carer" }))).toBe("carer");
    expect(relationshipOf(link({ relationship: "auditor" }))).toBe("crew");
    expect(activeRelationship([link({ relationship: "carer" })], "artur", "liam")).toBe("carer");
    expect(activeRelationship([], "artur", "liam")).toBeNull();
  });

  it("treats a change of footing as a real offer, not a repeat", () => {
    const held = [link({ owner: "liam", viewer: "artur", scopes: ["adherence", "mode"] })];
    expect(checkInvite(held, "liam", "artur", ["adherence", "mode"], "crew")).toBe(
      "duplicate-invite",
    );
    expect(checkInvite(held, "liam", "artur", ["adherence", "mode"], "carer")).toBe("ok");
  });

  it("replaces the old grant when a new one is accepted, so one revoke is the whole answer", () => {
    const links = [
      link({ id: "old", owner: "artur", viewer: "liam", scopes: ["adherence"] }),
      link({ id: "new", owner: "artur", viewer: "liam", relationship: "carer" }),
      link({ id: "other", owner: "liam", viewer: "artur" }),
    ];
    expect(supersededGrantIds(links, "artur", "liam", "new")).toEqual(["old"]);
    expect(supersededGrantIds(links, "artur", "liam", "old")).toEqual(["new"]);
  });
});

describe("the carer view", () => {
  it("answers the three questions and carries nothing else", () => {
    const view = carerViewFrom(projectMember(FACTS, ["adherence", "mode", "supply"]));
    expect(Object.keys(view).sort()).toEqual(
      ["supply", "checksDone", "checksTotal", "floorHeld", "mode", "daysInMode", "step"].sort(),
    );
    expect(view.supply).toBe("order-due");
    expect(view.floorHeld).toBe(true);
    expect(view.step).toBe("reorder-due");
  });

  it("is built from the projection, so an ungranted fact is not merely hidden", () => {
    const supplyOnly = carerViewFrom(projectMember(FACTS, ["supply"]));
    expect(supplyOnly.supply).toBe("order-due");
    expect(supplyOnly.checksDone).toBeNull();
    expect(supplyOnly.floorHeld).toBeNull();
    expect(supplyOnly.mode).toBeNull();
    expect(JSON.stringify(supplyOnly)).not.toContain("survival");

    const adherenceOnly = carerViewFrom(projectMember(FACTS, ["adherence"]));
    expect(adherenceOnly.supply).toBe("none");
    expect(adherenceOnly.floorHeld).toBe(true);
    expect(adherenceOnly.step).toBe("nothing-needed");

    // Granted nothing: the view says so rather than implying all is well.
    expect(carerViewFrom(projectMember(FACTS, [])).step).toBe("nothing-shared");
  });

  it("puts an unheld floor above a comfortable one, and a reorder above both", () => {
    const short = { ...FACTS, todayDone: 1, todayTotal: 3, supplyState: "ok" as const };
    expect(carerViewFrom(projectMember(short, ["adherence", "supply"])).step).toBe(
      "checks-outstanding",
    );
    expect(carerViewFrom(projectMember(short, ["adherence"])).floorHeld).toBe(false);
    expect(carerViewFrom(projectMember(FACTS, ["adherence", "supply"])).step).toBe("reorder-due");
  });

  it("rides on the link, and only for a carer", () => {
    const projected = projectMember(FACTS, ["adherence", "mode", "supply"]);
    const asCarer = [link({ relationship: "carer" })];
    expect(linkStateFor(asCarer, "liam", "artur", projected).carerView).not.toBeNull();
    expect(linkStateFor(asCarer, "liam", "artur", projected).youAre).toBe("carer");
    expect(linkStateFor([link()], "liam", "artur", projected).carerView).toBeNull();
    expect(linkStateFor(asCarer, "liam", "artur").carerView).toBeNull();
  });
});

describe("carer copy", () => {
  it("says what she will and will not see, in one breath each", () => {
    expect(carerSentence("Mary", ["adherence", "supply"])).toBe(
      "Mary will see whether today's checks got done and whether anything is running out. " +
        `Mary will not see ${CARER_NEVER}.`,
    );
    expect(carerSentence("Mary", [])).toContain("Mary will see nothing at all.");
    expect(CARER_NEVER).toMatch(/medicines/);
    expect(CARER_NEVER).toMatch(/anything you write down/);
  });

  it("says the same thing from the carer's side of the table", () => {
    const line = carerSeatSentence("Artur", ["adherence", "mode", "supply"]);
    expect(line).toContain("You can see");
    expect(line).toContain("which mode Artur is in");
    expect(line).toContain("You cannot see which medicines, Artur's weight");
  });
});

describe("the carer fixture", () => {
  const fx = buildConsentFixtures(TODAY);
  const links: ConsentLink[] = fx.crewLinks.map((r) => ({
    id: r.id,
    owner: r.ownerSlug,
    viewer: r.viewerSlug,
    scopes: r.scopes,
    relationship: r.relationship,
    status: r.status,
    invitedDate: r.invitedDate,
  }));

  it("offers a carer seat that is pending, and therefore worth nothing", () => {
    const invite = pendingFor(links, "liam")[0];
    expect(relationshipOf(invite)).toBe("carer");
    expect(activeRelationship(links, "artur", "liam")).toBe("crew");
    expect(activeScopesFor(links, "artur", "liam")).toEqual(["adherence", "mode"]);
    const state = linkStateFor(links, "liam", "artur", projectMember(FACTS, ["adherence", "mode"]));
    expect(state.incoming?.relationship).toBe("carer");
    expect(state.carerView).toBeNull();
    expect(state.youSee).not.toContain("supply");
  });

  it("never offers a carer more than a carer may hold", () => {
    for (const row of fx.crewLinks) {
      if (row.relationship !== "carer") continue;
      expect(refusedScopes("carer", row.scopes)).toEqual([]);
    }
  });
});

/* ===== at the query boundary ===== */

const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api"),
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./tm/auth.ts": () => import("../convex/tm/auth"),
  "./tm/crew.ts": () => import("../convex/tm/crew"),
  "./tm/fixtures.ts": () => import("../convex/tm/fixtures"),
  "./tm/db.ts": () => import("../convex/tm/db"),
  "./tm/lib.ts": () => import("../convex/tm/lib"),
  "./tm/logic.ts": () => import("../convex/tm/logic"),
  "./tm/seed.ts": () => import("../convex/tm/seed"),
};

const SEED_DAY = "2026-08-13";

type TestHarness = ReturnType<typeof convexTest>;

async function login(t: TestHarness, slug: string, passcode: string): Promise<string> {
  const res = await t.mutation(api.tm.auth.login, { slug, passcode });
  if (!res.ok) throw new Error(`login failed: ${res.code}`);
  return res.token;
}

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.tm.seed.run, { today: SEED_DAY });
  return { t, liam: await login(t, "liam", "2580"), artur: await login(t, "artur", "1379") };
}

/** Artur's row on Liam's board. */
async function arturRow(t: TestHarness, liam: string) {
  const board = await t.query(api.tm.crew.board, { token: liam, date: SEED_DAY });
  const row = board.find((m) => !m.isYou);
  if (!row) throw new Error("no counterpart on the board");
  return row;
}

describe("the carer seat at the query boundary", () => {
  it("discloses nothing while the invitation is pending", async () => {
    const { t, liam } = await seeded();
    const row = await arturRow(t, liam);
    expect(row.link.incoming?.relationship).toBe("carer");
    // A pending carer invite buys a name, a date and a sentence. No facts.
    expect(row.link.carerView).toBeNull();
    expect(row.link.youAre).toBe("crew");
    expect("supplyState" in row).toBe(false);
  });

  it("hands the carer the coarse flag and never a medicine", async () => {
    const { t, liam } = await seeded();
    const pending = (await arturRow(t, liam)).link.incoming;
    await t.mutation(api.tm.crew.respondToInvite, {
      token: liam,
      date: SEED_DAY,
      linkId: pending!.linkId as never,
      accept: true,
    });

    const row = await arturRow(t, liam);
    expect(row.link.youAre).toBe("carer");
    const view = row.link.carerView;
    expect(view).not.toBeNull();
    expect(["ok", "order-due"]).toContain(view!.supply);
    expect(view!.checksTotal).toBeGreaterThan(0);

    // Artur's file carries Levothyroxine and Vitamin D3 with doses and counts.
    // None of it is nameable from here, because none of it is here.
    const board = await t.query(api.tm.crew.board, { token: liam, date: SEED_DAY });
    const serialised = JSON.stringify(board);
    for (const banned of ["evothyrox", "itamin", "reatine", "onHand", "dose", "packSize", "mg"]) {
      expect(serialised).not.toContain(banned);
    }
  });

  it("replaces the peer grant rather than stacking a second one on it", async () => {
    const { t, liam, artur } = await seeded();
    const pending = (await arturRow(t, liam)).link.incoming;
    await t.mutation(api.tm.crew.respondToInvite, {
      token: liam,
      date: SEED_DAY,
      linkId: pending!.linkId as never,
      accept: true,
    });

    // One tap on the owner's side, and the whole grant is gone — not one of two.
    const grantId = (await arturRow(t, liam)).link.theirGrantId;
    expect(grantId).toBe(pending!.linkId);
    await t.mutation(api.tm.crew.revokeLink, {
      token: artur,
      date: SEED_DAY,
      linkId: grantId as never,
    });

    const row = await arturRow(t, liam);
    expect(row.link.youSee).toEqual([]);
    expect(row.link.carerView).toBeNull();
    expect(row.link.theirGrantId).toBeNull();
    expect(Object.keys(row).sort()).toEqual(["slug", "name", "isYou", "link"].sort());
  });

  it("lets the carer hand the seat back, immediately, from their own side", async () => {
    const { t, liam } = await seeded();
    const pending = (await arturRow(t, liam)).link.incoming;
    await t.mutation(api.tm.crew.respondToInvite, {
      token: liam,
      date: SEED_DAY,
      linkId: pending!.linkId as never,
      accept: true,
    });
    await t.mutation(api.tm.crew.revokeLink, {
      token: liam,
      date: SEED_DAY,
      linkId: pending!.linkId as never,
    });
    const row = await arturRow(t, liam);
    expect(row.link.carerView).toBeNull();
    expect(row.link.youSee).toEqual([]);
  });

  it("refuses to write a carer grant naming anything outside the carer set", async () => {
    const { t, liam } = await seeded();
    await expect(
      t.mutation(api.tm.crew.invite, {
        token: liam,
        date: SEED_DAY,
        slug: "artur",
        scopes: ["craving"],
        relationship: "carer",
      }),
    ).rejects.toThrow(/unknown-scope/);
    // And the same offer on a peer footing is refused too: there is no such
    // scope for anyone. The carer allowlist is the second lock, not the first.
    await expect(
      t.mutation(api.tm.crew.invite, {
        token: liam,
        date: SEED_DAY,
        slug: "artur",
        scopes: ["assessment"],
      }),
    ).rejects.toThrow(/unknown-scope/);
  });
});

import { describe, expect, it } from "vitest";
import {
  IDENTITY_FIELDS,
  NEVER_SHARED,
  SCOPES,
  SCOPE_FIELDS,
  activeGrant,
  activeScopesFor,
  canSee,
  checkInvite,
  counterpartsFor,
  daysCover,
  linkStateFor,
  orderScopes,
  outgoingFor,
  parseScopes,
  pendingFor,
  projectMember,
  sharedLine,
  supplyState,
  type ConsentLink,
  type MemberFacts,
  type Scope,
} from "../convex/tm/logic-consent";
import { buildConsentFixtures } from "../convex/tm/fixtures/consent";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13";

const FACTS: MemberFacts = {
  slug: "conor",
  name: "Conor",
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
    owner: "conor",
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
    expect(projected).toEqual({ slug: "conor", name: "Conor", isYou: false });
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
    expect(activeScopesFor(links, "conor", "liam")).toEqual([]);
    expect(canSee(links, "conor", "liam", "adherence")).toBe(false);
    expect(projectMember(FACTS, activeScopesFor(links, "conor", "liam"))).toEqual({
      slug: "conor",
      name: "Conor",
      isYou: false,
    });
  });

  it("gives a revoked link nothing at all, from the moment it is revoked", () => {
    const links = [link({ status: "revoked", revokedDate: TODAY })];
    expect(activeScopesFor(links, "conor", "liam")).toEqual([]);
    expect(activeGrant(links, "conor", "liam")).toBeNull();
    expect(canSee(links, "conor", "liam", "mode")).toBe(false);
  });

  it("is directional — Conor's grant to Liam is not Liam's grant to Conor", () => {
    const links = [link()];
    expect(activeScopesFor(links, "conor", "liam")).toEqual(["adherence", "mode", "supply"]);
    expect(activeScopesFor(links, "liam", "conor")).toEqual([]);
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
    expect(activeScopesFor(links, "conor", "liam")).toEqual(["adherence"]);
  });

  it("keeps counterparts to people with a live link", () => {
    const links = [link(), link({ id: "cl_2", owner: "liam", viewer: "sam", status: "revoked" })];
    expect(counterpartsFor(links, "liam")).toEqual(["conor"]);
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
    const links = [link({ owner: "liam", viewer: "conor", scopes: ["adherence"] })];
    expect(checkInvite(links, "liam", "liam", ["adherence"])).toBe("self-invite");
    expect(checkInvite(links, "liam", "conor", ["adherence"])).toBe("duplicate-invite");
    expect(checkInvite(links, "liam", "conor", ["adherence", "supply"])).toBe("ok");
    const pending = [...links, link({ id: "cl_2", owner: "liam", viewer: "conor", status: "pending" })];
    expect(checkInvite(pending, "liam", "conor", ["adherence", "supply"])).toBe("duplicate-invite");
  });

  it("routes a pending link to the viewer's inbox and the owner's outbox", () => {
    const links = [link({ status: "pending" })];
    expect(pendingFor(links, "liam").map((l) => l.id)).toEqual(["cl_1"]);
    expect(pendingFor(links, "conor")).toEqual([]);
    expect(outgoingFor(links, "conor").map((l) => l.id)).toEqual(["cl_1"]);
    expect(outgoingFor(links, "liam")).toEqual([]);
  });
});

describe("link state on a board row", () => {
  it("separates what you see from what they see, and offers both revokes", () => {
    const links = [
      link({ id: "cl_a", owner: "conor", viewer: "liam", scopes: ["adherence"] }),
      link({ id: "cl_b", owner: "liam", viewer: "conor", scopes: ["adherence", "mode"] }),
      link({ id: "cl_c", owner: "conor", viewer: "liam", status: "pending" }),
    ];
    const state = linkStateFor(links, "liam", "conor");
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
    expect(sharedLine("Conor", ["adherence"])).toBe(
      `Conor can see: how often you hit your checks. ${NEVER_SHARED}`,
    );
    expect(sharedLine("Conor", ["mode", "adherence"])).toMatch(
      /^Conor can see: how often you hit your checks and which mode/,
    );
    expect(sharedLine("Conor", [])).toBe("Conor can see nothing of yours.");
    expect(NEVER_SHARED).toMatch(/not your medicines/i);
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
    status: r.status,
    invitedDate: r.invitedDate,
  }));

  it("pairs the two of them with real, revocable paperwork", () => {
    expect(activeScopesFor(links, "liam", "conor")).toEqual(["adherence", "mode", "supply"]);
    expect(activeScopesFor(links, "conor", "liam")).toEqual(["adherence", "mode"]);
  });

  it("leaves Liam one pending invite to answer, granting nothing meanwhile", () => {
    const inbox = pendingFor(links, "liam");
    expect(inbox).toHaveLength(1);
    expect(inbox[0].scopes).toContain("supply");
    // The pending widen has not landed: Liam still cannot see Conor's supply.
    expect(canSee(links, "conor", "liam", "supply")).toBe(false);
    const projected = projectMember(FACTS, activeScopesFor(links, "conor", "liam"));
    expect("supplyState" in projected).toBe(false);
    expect(projected.adherence7).toBe(86);
  });

  it("keeps the board free of anything a scope does not name", () => {
    const scopes: Scope[] = activeScopesFor(links, "conor", "liam");
    const serialised = JSON.stringify(projectMember(FACTS, scopes));
    for (const banned of ["kcal", "weightKg", "dose", "value", "score", "marker"]) {
      expect(serialised).not.toContain(banned);
    }
  });
});

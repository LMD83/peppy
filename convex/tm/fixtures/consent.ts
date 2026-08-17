import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";

/**
 * Crew consent fixtures — the paperwork behind a board that used to have none.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows-wave1.ts,
 * which is the contract.
 */

export type CrewLinkRow = {
  id: string;
  ownerSlug: string;
  viewerSlug: string;
  scopes: string[];
  /** A peer in the crew, or someone helping from outside it. Absent reads as "crew". */
  relationship?: "crew" | "carer";
  status: "pending" | "active" | "revoked";
  invitedDate: string;
  respondedDate?: string;
  revokedDate?: string;
};

export type ConsentFixtures = { crewLinks: CrewLinkRow[] };

export function buildConsentFixtures(today: string): ConsentFixtures {
  // The pairing predates the file: they agreed in person, six weeks ago.
  const agreed = addDays(today, -42);

  return {
    crewLinks: [
      // Liam shares everything with Artur, peer to peer.
      {
        id: "cl_liam_artur",
        ownerSlug: "liam",
        viewerSlug: "artur",
        scopes: ["adherence", "mode", "supply"],
        relationship: "crew",
        status: "active",
        invitedDate: agreed,
        respondedDate: agreed,
      },
      // Artur shares his checks and his mode — which is exactly what Liam's
      // board showed before consent existed, so the demo reads unchanged.
      {
        id: "cl_artur_liam",
        ownerSlug: "artur",
        viewerSlug: "liam",
        scopes: ["adherence", "mode"],
        relationship: "crew",
        status: "active",
        invitedDate: agreed,
        respondedDate: agreed,
      },
      // …and yesterday, on the floor and running low, he asked Liam to take a
      // carer seat instead: the same checks and mode, plus the coarse "running
      // out" flag, and nothing else — a carer cannot be offered more than that.
      // Liam has not answered. A pending invitation discloses nothing: until he
      // accepts, it buys a name, a date and a sentence, and no facts at all.
      {
        id: "cl_artur_liam_carer",
        ownerSlug: "artur",
        viewerSlug: "liam",
        scopes: ["adherence", "mode", "supply"],
        relationship: "carer",
        status: "pending",
        invitedDate: addDays(today, -1),
      },
    ],
  };
}

/** Slugs resolve to ids here; the rest of the row goes in verbatim. */
export async function seedConsent(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: ConsentFixtures,
): Promise<void> {
  for (const { id: _id, ownerSlug, viewerSlug, ...row } of fx.crewLinks) {
    await ctx.db.insert("tm_crewLinks", {
      ownerId: uid(ownerSlug),
      viewerId: uid(viewerSlug),
      ...row,
    });
  }
}

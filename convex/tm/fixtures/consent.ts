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
      // Liam shares everything with Conor.
      {
        id: "cl_liam_conor",
        ownerSlug: "liam",
        viewerSlug: "conor",
        scopes: ["adherence", "mode", "supply"],
        status: "active",
        invitedDate: agreed,
        respondedDate: agreed,
      },
      // Conor shares his checks and his mode — which is exactly what Liam's
      // board showed before consent existed, so the demo reads unchanged.
      {
        id: "cl_conor_liam",
        ownerSlug: "conor",
        viewerSlug: "liam",
        scopes: ["adherence", "mode"],
        status: "active",
        invitedDate: agreed,
        respondedDate: agreed,
      },
      // …and yesterday, on the floor and running low, he offered the supply
      // flag as well. Liam has not answered: pending grants nothing.
      {
        id: "cl_conor_liam_supply",
        ownerSlug: "conor",
        viewerSlug: "liam",
        scopes: ["adherence", "mode", "supply"],
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

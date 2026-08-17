import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";

/**
 * Supply fixtures — what is actually in the house, and who to ring when it runs
 * out.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows-wave1.ts,
 * which is the contract.
 *
 * The spread is deliberate. Liam has one item comfortably stocked, one that
 * crosses its order-by date exactly today, and one prescription with no repeats
 * left — the case where ringing the pharmacy achieves nothing and only the
 * practice can move it. Artur, at his floor, has his single med with plenty
 * left, so his supply surface stays silent.
 */

export type SupplyRow = {
  id: string;
  userSlug: string;
  itemId: string;
  onHand: number;
  unitsPerDose: number;
  packSize: number;
  lastCountedDate: string;
  reorderLeadDays: number;
  scriptExpiryDate?: string;
  repeatsRemaining?: number;
};

export type ContactRow = {
  id: string;
  userSlug: string;
  kind: "gp" | "pharmacy";
  name: string;
  phone: string;
  note?: string;
};

export type SupplyFixtures = { supplyRows: SupplyRow[]; contacts: ContactRow[] };

export function buildSupplyFixtures(today: string): SupplyFixtures {
  const supplyRows: SupplyRow[] = [
    {
      // 5 g a day out of a 500 g tub, counted a fortnight ago. Nothing to do.
      id: "sp_liam_creatine",
      userSlug: "liam",
      itemId: "pi_liam_creatine",
      onHand: 320,
      unitsPerDose: 5,
      packSize: 500,
      lastCountedDate: addDays(today, -14),
      reorderLeadDays: 7,
    },
    {
      // A full 90-tablet tub opened a week ago. Comfortably stocked.
      id: "sp_liam_vitd",
      userSlug: "liam",
      itemId: "pi_liam_vitd",
      onHand: 90,
      unitsPerDose: 1,
      packSize: 90,
      lastCountedDate: addDays(today, -7),
      reorderLeadDays: 5,
    },
    {
      // Two 200 mg capsules a night. 28 counted ten days ago leaves eight —
      // five days of cover against a five-day lead, so the order-by date is
      // today. No script involved: this one is on him to buy.
      id: "sp_liam_magnesium",
      userSlug: "liam",
      itemId: "pi_liam_magnesium",
      onHand: 28,
      unitsPerDose: 2,
      packSize: 60,
      lastCountedDate: addDays(today, -10),
      reorderLeadDays: 5,
    },
    {
      // The statin. Fifteen counted twelve days ago leaves three — and the
      // script has no repeats on it, so the pharmacy cannot help.
      id: "sp_liam_statin",
      userSlug: "liam",
      itemId: "pi_liam_statin",
      onHand: 15,
      unitsPerDose: 1,
      packSize: 28,
      lastCountedDate: addDays(today, -12),
      reorderLeadDays: 7,
      scriptExpiryDate: addDays(today, 40),
      repeatsRemaining: 0,
    },
    {
      // Artur's levothyroxine. Never skipped, and never close to running out.
      id: "sp_artur_levo",
      userSlug: "artur",
      itemId: "pi_artur_levo",
      onHand: 84,
      unitsPerDose: 1,
      packSize: 84,
      lastCountedDate: addDays(today, -9),
      reorderLeadDays: 7,
      scriptExpiryDate: addDays(today, 200),
      repeatsRemaining: 4,
    },
  ];

  const contacts: ContactRow[] = [
    {
      id: "ct_liam_gp",
      userSlug: "liam",
      kind: "gp",
      name: "Rathgar Family Practice",
      phone: "01 497 8820",
      note: "Dr. Nuala Byrne — repeat reviews Tue/Thu, 09:00–11:00.",
    },
    {
      id: "ct_liam_pharmacy",
      userSlug: "liam",
      kind: "pharmacy",
      name: "Ashfield Pharmacy, Ranelagh",
      phone: "01 496 3145",
      note: "They text when it is bagged; collect after 16:00.",
    },
    {
      id: "ct_artur_gp",
      userSlug: "artur",
      kind: "gp",
      name: "Clontarf Road Medical",
      phone: "01 833 6274",
    },
    {
      id: "ct_artur_pharmacy",
      userSlug: "artur",
      kind: "pharmacy",
      name: "Vernon Pharmacy, Clontarf",
      phone: "01 853 4419",
    },
  ];

  return { supplyRows, contacts };
}

/** Only the fields the seeder needs off the stack fixtures. */
type SeedFixtures = SupplyFixtures & {
  protocolItems: { id: string; userSlug: string; name: string }[];
};

/**
 * Supply rows point at protocol items, which `seedStack` inserted under real
 * ids. Resolve them the only way that survives a reseed: by the user's own
 * items, matched on name. A row whose item did not land is dropped rather than
 * pointed somewhere wrong.
 */
export async function seedSupply(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: SeedFixtures,
): Promise<void> {
  const fixtureItemById = new Map(fx.protocolItems.map((i) => [i.id, i]));
  const itemsByUser = new Map<string, Map<string, Id<"tm_protocolItems">>>();

  const itemsFor = async (slug: string) => {
    const cached = itemsByUser.get(slug);
    if (cached) return cached;
    const rows = await ctx.db
      .query("tm_protocolItems")
      .withIndex("by_userId", (q) => q.eq("userId", uid(slug)))
      .take(200);
    const byName = new Map(rows.map((r) => [r.name, r._id]));
    itemsByUser.set(slug, byName);
    return byName;
  };

  for (const { id: _id, userSlug, itemId, ...row } of fx.supplyRows) {
    const fixtureItem = fixtureItemById.get(itemId);
    if (!fixtureItem) continue;
    const realId = (await itemsFor(userSlug)).get(fixtureItem.name);
    if (!realId) continue;
    await ctx.db.insert("tm_supply", { userId: uid(userSlug), itemId: realId, ...row });
  }

  for (const { id: _id, userSlug, ...row } of fx.contacts) {
    await ctx.db.insert("tm_contacts", { userId: uid(userSlug), ...row });
  }
}

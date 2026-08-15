/**
 * Wave 1 row shapes for the demo backend — crew consent, medication supply,
 * and the GP/pharmacy contacts a refill needs.
 *
 * Same contract as ./rows.ts: these mirror the `tm_*` tables one-for-one, keyed
 * by user *slug* instead of a document id, with generated ids as plain strings.
 */

export type CrewLinkRow = {
  id: string;
  ownerSlug: string;
  viewerSlug: string;
  scopes: string[];
  relationship?: "crew" | "carer";
  status: "pending" | "active" | "revoked";
  invitedDate: string;
  respondedDate?: string;
  revokedDate?: string;
};

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

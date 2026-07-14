// TARA pricing rules — ported from the design handoff's convex/pricing.ts so the
// UI and the (future) Convex backend share identical logic. All prices are
// VAT-inclusive cents (Irish VAT 23%) — never add VAT at the end.

export const VAT_RATE = 0.23;
export const FREE_SHIP_THRESHOLD_CENTS = 15000; // €150 net goods
export const FLAT_SHIP_CENTS = 995; // €9.95
export const PROMO_CODE = "TARA15";
export const PROMO_RATE = 0.15;

export function volumePercent(totalQty: number): number {
  if (totalQty >= 3) return 0.1; // buy 3+ -> 10%
  if (totalQty === 2) return 0.05; // buy 2 -> 5%
  return 0;
}

export interface CartLine {
  unitPriceCents: number;
  qty: number;
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  discountLabel: string;
  shippingCents: number;
  vatCents: number;
  totalCents: number;
}

export function priceOrder(lines: CartLine[], promoCode?: string | null): OrderTotals {
  const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.qty, 0);
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const vPct = volumePercent(totalQty);
  const promoApplied = promoCode?.trim().toUpperCase() === PROMO_CODE;
  const promoPercent = promoApplied ? PROMO_RATE : 0;

  // Never stack: take the better of volume vs promo.
  const bestPct = Math.max(vPct, promoPercent);
  const discountCents = Math.round(subtotalCents * bestPct);
  const discountLabel =
    promoPercent >= vPct && promoPercent > 0
      ? `First-order −${Math.round(promoPercent * 100)}%`
      : vPct > 0
        ? `Volume ${totalQty} vials · −${Math.round(vPct * 100)}%`
        : "";

  const netGoods = subtotalCents - discountCents;
  const shippingCents =
    subtotalCents === 0 || netGoods >= FREE_SHIP_THRESHOLD_CENTS ? 0 : FLAT_SHIP_CENTS;
  const totalCents = netGoods + shippingCents; // VAT already inside
  const vatCents = Math.round(totalCents - totalCents / (1 + VAT_RATE));

  return { subtotalCents, discountCents, discountLabel, shippingCents, vatCents, totalCents };
}

/** What to tell the customer to nudge them toward the next volume tier. */
export function volumeNudge(qty: number): string | null {
  if (qty === 1) return "Add 1 more vial to unlock 5% off";
  if (qty === 2) return "Add 1 more vial to unlock 10% off";
  return null;
}

/** Deterministic verify ID from a batch number — mirrors the design reference's `vidFor`. */
export function verifyIdFromBatch(batch: string): string {
  const d = (batch || "").replace(/\D/g, "").padEnd(6, "0");
  return `TV-${d.slice(0, 4)}-${d.slice(4, 6)}K${d.slice(0, 2)}-${d.slice(2, 4)}V${d.slice(4, 6)}`;
}

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

export function formatCents(cents: number): string {
  return EUR.format(cents / 100);
}

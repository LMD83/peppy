// TARA pricing rules — shared by client and server. Keep this the single source of truth.
// All prices are VAT-INCLUSIVE cents (Irish VAT 23%).

export const VAT_RATE = 0.23;
export const FREE_SHIP_THRESHOLD_CENTS = 15000; // €150 net goods
export const FLAT_SHIP_CENTS = 995; // €9.95

export function volumePercent(totalQty: number): number {
  if (totalQty >= 3) return 0.1; // buy 3+ → 10%
  if (totalQty === 2) return 0.05; // buy 2 → 5%
  return 0;
}

export type CartLine = { unitPriceCents: number; qty: number };

export function priceOrder(lines: CartLine[], promoPercent = 0) {
  const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.qty, 0);
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const vPct = volumePercent(totalQty);

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
    subtotalCents === 0 || netGoods >= FREE_SHIP_THRESHOLD_CENTS
      ? 0
      : FLAT_SHIP_CENTS;
  const totalCents = netGoods + shippingCents; // VAT already inside
  const vatCents = Math.round(totalCents - totalCents / (1 + VAT_RATE));

  return { subtotalCents, discountCents, discountLabel, shippingCents, vatCents, totalCents };
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

// Deterministic verify ID from a batch number (mirror of the design reference).
export function verifyIdFromBatch(batch: string): string {
  const d = (batch || "").replace(/\D/g, "").padEnd(6, "0");
  return `TV-${d.slice(0, 4)}-${d.slice(4, 6)}K${d.slice(0, 2)}-${d.slice(2, 4)}V${d.slice(4, 6)}`;
}

// Volume-tier + promo pricing. Shared, pure logic — safe to call from a
// server component, a client component, or (once wired) a Convex function.
// The two discount mechanisms never stack: whichever gives the customer the
// better price applies, so we never accidentally over-discount an order.

export const PROMO_CODE = "TARA15";
export const PROMO_RATE = 0.15;

export function volumeDiscountRate(qty: number): number {
  if (qty >= 3) return 0.1;
  if (qty >= 2) return 0.05;
  return 0;
}

export interface DiscountResult {
  rate: number;
  label: string;
  source: "volume" | "promo" | "none";
}

export function resolveDiscount(qty: number, promoCode?: string | null): DiscountResult {
  const volumeRate = volumeDiscountRate(qty);
  const promoApplied = promoCode?.trim().toUpperCase() === PROMO_CODE;
  const promoRate = promoApplied ? PROMO_RATE : 0;

  if (promoRate > volumeRate) {
    return { rate: promoRate, label: `${PROMO_CODE} promo code`, source: "promo" };
  }
  if (volumeRate > 0) {
    const label = qty >= 3 ? "Volume discount — 3+ vials" : "Volume discount — 2 vials";
    return { rate: volumeRate, label, source: "volume" };
  }
  return { rate: 0, label: "", source: "none" };
}

/** What to tell the customer to nudge them toward the next volume tier. */
export function volumeNudge(qty: number): string | null {
  if (qty === 1) return "Add 1 more vial to unlock 5% off";
  if (qty === 2) return "Add 1 more vial to unlock 10% off";
  return null;
}

export interface PriceBreakdown {
  unitPrice: number;
  qty: number;
  subtotal: number;
  discount: DiscountResult;
  discountAmount: number;
  total: number;
}

export function priceForQty(
  unitPrice: number,
  qty: number,
  promoCode?: string | null
): PriceBreakdown {
  const discount = resolveDiscount(qty, promoCode);
  const subtotal = unitPrice * qty;
  const discountAmount = subtotal * discount.rate;
  return {
    unitPrice,
    qty,
    subtotal,
    discount,
    discountAmount,
    total: subtotal - discountAmount,
  };
}

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

export function formatPrice(value: number): string {
  return EUR.format(value);
}

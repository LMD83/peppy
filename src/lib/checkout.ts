// Shared order maths for the cart and checkout.

/** Orders at/above this (EUR) ship free across Ireland. */
export const FREE_SHIPPING_THRESHOLD = 50

/** Flat next-day Irish delivery fee below the free threshold. */
export const STANDARD_SHIPPING = 4.95

export function shippingFor(subtotal: number): number {
  if (subtotal <= 0) return 0
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING
}

/** Amount remaining to unlock free shipping, or 0 if already there. */
export function amountToFreeShipping(subtotal: number): number {
  return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
}

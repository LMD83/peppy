// Deterministic mock batch numbers, standing in for the real batch-release
// system (see the handoff's convex/verifications.ts). Same product + variant
// always yields the same batch, so the same demo item verifies consistently
// whether it's in the catalogue, the cart, or an order confirmation.

export function mockBatch(slug: string, variantLabel: string): string {
  let h = 0;
  const s = `${slug}${variantLabel}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(100000 + (h % 900000));
}

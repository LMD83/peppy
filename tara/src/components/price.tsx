"use client";

import NumberFlow from "@number-flow/react";

/** Animated EUR price — smoothly rolls between values (qty/variant/promo changes). */
export function Price({ cents, className }: { cents: number; className?: string }) {
  return (
    <NumberFlow
      value={cents / 100}
      format={{ style: "currency", currency: "EUR" }}
      locales="en-IE"
      className={className}
    />
  );
}

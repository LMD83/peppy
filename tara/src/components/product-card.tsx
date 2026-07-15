"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { fromPriceCents, hasMultipleVariants, isSupply, type Product } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

function stockLabel(p: Product): string {
  if (p.stock === "low") return "Low stock";
  if (p.stock === "out") return "Out of stock";
  return "In stock — ships today";
}

export function ProductCard({
  product,
  showActions = true,
}: {
  product: Product;
  showActions?: boolean;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const variants = product.variants.map((v) => v.label).join(" · ");
  const supply = isSupply(product);

  function handleAdd() {
    const cheapest = [...product.variants].sort((a, b) => a.priceCents - b.priceCents)[0];
    if (!cheapest) return;
    add({
      slug: product.slug,
      name: product.name,
      variantLabel: cheapest.label,
      unitPriceCents: cheapest.priceCents,
      qty: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-[0_8px_30px_-16px_rgba(13,27,42,0.35)]">
      <div className="h-1.5 w-full shrink-0" style={{ background: product.accent }} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/products/${product.slug}`} className="font-serif text-lg font-semibold leading-tight text-foreground hover:text-primary">
            {product.name}
          </Link>
          {!supply && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-primary/40 bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
              <ShieldCheck className="size-3" /> VERIFIED
            </span>
          )}
        </div>

        <p className="text-[12.5px] font-semibold text-[#B87333]">
          {variants} · {product.format}
        </p>

        {!supply ? (
          <dl className="space-y-1.5 border-t border-muted pt-3 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Purity</dt>
              <dd className="font-medium text-foreground">
                {product.purity} · {product.method}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Batch</dt>
              <dd className="font-mono text-[12px] text-[#1565C0]">{product.batch}</dd>
            </div>
          </dl>
        ) : (
          <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">{product.plain}</p>
        )}

        <p className={cn("text-[12px] font-semibold", product.stock === "in" ? "text-primary" : "text-[#7a531d]")}>
          {product.stock === "in" && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />}
          {stockLabel(product)}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="font-mono text-sm text-muted-foreground">
            {hasMultipleVariants(product) && "from "}
            <span className="font-serif text-lg font-semibold text-foreground">
              {formatCents(fromPriceCents(product))}
            </span>
          </p>
          {showActions && (
            <div className="flex items-center gap-2">
              <Link
                href={`/products/${product.slug}`}
                className="inline-flex h-8 items-center rounded-sm border border-input px-3 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
              >
                Details
              </Link>
              <button
                type="button"
                onClick={handleAdd}
                disabled={product.stock === "out"}
                className="inline-flex h-8 items-center rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {added ? "Added" : "Add"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

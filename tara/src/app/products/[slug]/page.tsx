"use client";

import { useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Calculator } from "lucide-react";

import { getProduct } from "@/lib/products";
import { formatCents, verifyIdFromBatch } from "@/lib/pricing";
import { mockBatch } from "@/lib/mock-batch";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const product = getProduct(params.slug);
  const { add } = useCart();
  const [variantLabel, setVariantLabel] = useState(product?.variants[0]?.label ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => product?.variants.find((v) => v.label === variantLabel) ?? product?.variants[0],
    [product, variantLabel]
  );

  if (!product || !variant) return notFound();

  const batch = mockBatch(product.slug, variant.label);
  const verifyId = verifyIdFromBatch(batch);

  function handleAdd() {
    if (!product || !variant) return;
    add({
      slug: product.slug,
      name: product.name,
      variantLabel: variant.label,
      unitPriceCents: variant.priceCents,
      qty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/catalogue" className="hover:text-foreground">
          Catalogue
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div
          className="flex aspect-square items-center justify-center rounded-md"
          style={{ background: product.accent }}
        >
          <span className="font-serif text-2xl font-semibold tracking-[0.2em] text-white/90">
            TARA
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {product.category}
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold">{product.name}</h1>
            <p className="mt-2 text-muted-foreground">{product.plain}</p>
          </div>

          {product.variants.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Strength</span>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setVariantLabel(v.label)}
                    className={`h-9 rounded-sm border px-4 text-sm font-semibold ${
                      v.label === variant.label
                        ? "border-primary bg-accent text-primary"
                        : "border-input bg-card text-foreground"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-baseline gap-3">
            <span className="font-serif text-3xl font-semibold">{formatCents(variant.priceCents)}</span>
            <span className="text-xs text-muted-foreground">includes VAT (23%)</span>
            <Badge variant={product.stock === "out" ? "outline" : "default"}>
              {product.stock === "out" ? "Out of stock" : "In stock"}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-sm border border-input">
              <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </Button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">{qty}</span>
              <Button variant="ghost" size="icon" onClick={() => setQty((q) => q + 1)}>
                +
              </Button>
            </div>
            <Button
              className="flex-1"
              size="lg"
              onClick={handleAdd}
              disabled={product.stock === "out"}
            >
              {added ? "Added" : "Add to order"}
            </Button>
          </div>

          <Link
            href="/calculator"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Calculator className="size-4" />
            Work out the reconstitution for this compound
          </Link>

          <div className="mt-2 flex items-start gap-3 rounded-md border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold">Batch {batch}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                Verify ID: {verifyId}
              </p>
              <Link href={`/verify?id=${verifyId}`} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">
                Check this batch on TARA Verify →
              </Link>
            </div>
          </div>

          <p className="text-xs font-medium text-muted-foreground">
            For laboratory research use only. Not for human or veterinary use.
          </p>
        </div>
      </div>
    </div>
  );
}

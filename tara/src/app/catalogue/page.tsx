"use client";

import { useState } from "react";
import { Minus, Plus, Tag } from "lucide-react";

import { peptides } from "@/lib/peptides";
import { priceForQty, volumeNudge, formatPrice, PROMO_CODE } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CataloguePage() {
  const [promoCode, setPromoCode] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function qtyFor(id: string) {
    return quantities[id] ?? 1;
  }

  function setQty(id: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-6 max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Catalogue</h1>
        <p className="mt-2 text-muted-foreground">
          Buy 2 vials of any compound and save 5%, or 3+ and save 10% — automatically, no code
          needed. Discounts don&apos;t stack: if a promo code beats the volume discount, we use
          whichever saves you more.
        </p>
      </header>

      <div className="mb-8 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Tag className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder={`Promo code (try ${PROMO_CODE})`}
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {peptides.map((p) => {
          const qty = qtyFor(p.id);
          const breakdown = priceForQty(p.price, qty, promoCode);
          const nudge = volumeNudge(qty);

          return (
            <div key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-tight">{p.name}</h2>
                <Badge variant="outline">{p.vialMg} mg</Badge>
              </div>
              <p className="mb-4 flex-1 text-sm text-muted-foreground">{p.summary}</p>

              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-border">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Decrease quantity"
                    onClick={() => setQty(p.id, qty - 1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-7 text-center text-sm font-medium tabular-nums">{qty}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Increase quantity"
                    onClick={() => setQty(p.id, qty + 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                <div className="text-right">
                  {breakdown.discount.rate > 0 && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatPrice(breakdown.subtotal)}
                    </p>
                  )}
                  <p className="font-semibold tabular-nums">{formatPrice(breakdown.total)}</p>
                </div>
              </div>

              {breakdown.discount.rate > 0 ? (
                <p className="text-xs font-medium text-primary">
                  {breakdown.discount.label} · −{Math.round(breakdown.discount.rate * 100)}%
                </p>
              ) : nudge ? (
                <p className="text-xs text-muted-foreground">{nudge}</p>
              ) : (
                <p className="text-xs text-muted-foreground">&nbsp;</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

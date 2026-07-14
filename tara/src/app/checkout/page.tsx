"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";

import { useCart } from "@/lib/cart-context";
import {
  priceOrder,
  volumeNudge,
  formatCents,
  verifyIdFromBatch,
  FREE_SHIP_THRESHOLD_CENTS,
} from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CheckoutPage() {
  const { lines, count, clear } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [declared, setDeclared] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNo, setOrderNo] = useState("");

  const totals = useMemo(
    () => priceOrder(lines.map((l) => ({ unitPriceCents: l.unitPriceCents, qty: l.qty })), promoCode),
    [lines, promoCode]
  );
  const nudge = volumeNudge(count);
  const toFreeShip = Math.max(0, FREE_SHIP_THRESHOLD_CENTS - (totals.subtotalCents - totals.discountCents));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!declared) return;
    setSubmitting(true);
    // ── SumUp integration point ─────────────────────────────────────────────
    // Production flow (see convex/SUMUP.md): a Convex action creates a SumUp
    // checkout server-side, the SumUp Payment Widget collects card details,
    // and a webhook confirms payment before this order is marked paid. This
    // demo places the order directly.
    // ─────────────────────────────────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, 500));
    const year = new Date().getFullYear();
    setOrderNo(`TARA-${year}-${1000 + Math.floor(Math.random() * 9000)}`);
    clear();
    setPlaced(true);
    setSubmitting(false);
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h1 className="font-serif text-3xl font-semibold">Thank you — your order is placed.</h1>
        <p className="text-muted-foreground">
          Order <span className="font-mono text-foreground">{orderNo}</span>. Every line on your
          invoice carries its batch number and a unique TARA Verify ID. (Demo checkout — no
          payment was taken.)
        </p>
        <Link href="/catalogue" className="mt-2">
          <Button size="lg">Continue browsing</Button>
        </Link>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Your order is empty</h1>
        <Link href="/catalogue">
          <Button size="lg">Browse the catalogue</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 font-serif text-3xl font-semibold">Review your order</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {lines.map((line) => {
              const verifyId = verifyIdFromBatch(line.batch);
              return (
                <li key={line.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {line.name} <span className="text-muted-foreground">— {line.variantLabel}</span>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Qty {line.qty} · Batch {line.batch} · {verifyId}
                    </p>
                  </div>
                  <p className="font-mono font-semibold">
                    {formatCents(line.unitPriceCents * line.qty)}
                  </p>
                </li>
              );
            })}
          </ul>

          <fieldset className="space-y-3 rounded-md border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold">Delivery details</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="name" label="Full name" autoComplete="name" />
              <Field id="email" label="Email" type="email" autoComplete="email" />
            </div>
            <Field id="addr" label="Address" autoComplete="address-line1" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id="city" label="Town / City" autoComplete="address-level2" />
              <Field id="post" label="Eircode" autoComplete="postal-code" />
              <Field id="country" label="Country" autoComplete="country-name" defaultValue="Ireland" />
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-md border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold">Payment</legend>
            <div className="flex items-start gap-3 rounded-sm border border-dashed border-input bg-muted/40 p-4">
              <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                Card and wallet payment is processed securely via SumUp at the next step. This
                demo build places the order without taking payment — connect a SumUp secret key
                server-side to go live.
              </p>
            </div>
            <label className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                checked={declared}
                onChange={(e) => setDeclared(e.target.checked)}
                required
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-[13px] leading-relaxed text-muted-foreground">
                I confirm these materials are for <strong className="text-foreground">laboratory research use only</strong>,
                not for human or veterinary use, and that I am a qualified researcher purchasing
                in that capacity.
              </span>
            </label>
          </fieldset>
        </div>

        <aside className="h-fit space-y-4 rounded-md border border-border bg-card p-5">
          <h2 className="font-semibold">Order summary</h2>

          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Promo code"
              className="h-9"
            />
          </div>

          {nudge && totals.discountCents === 0 && (
            <p className="text-xs text-muted-foreground">{nudge}</p>
          )}
          {toFreeShip > 0 ? (
            <p className="text-xs text-muted-foreground">
              Add {formatCents(toFreeShip)} more for free delivery.
            </p>
          ) : (
            <p className="text-xs text-primary">You&apos;ve unlocked free delivery.</p>
          )}

          <dl className="space-y-2 border-t border-border pt-3 text-sm">
            <Row label="Subtotal" value={formatCents(totals.subtotalCents)} />
            {totals.discountCents > 0 && (
              <Row label={totals.discountLabel} value={`−${formatCents(totals.discountCents)}`} accent />
            )}
            <Row
              label="Shipping"
              value={totals.shippingCents === 0 ? "Free" : formatCents(totals.shippingCents)}
            />
            <Row label="Includes VAT (23%)" value={formatCents(totals.vatCents)} muted />
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCents(totals.totalCents)}</span>
            </div>
          </dl>

          <Button type="submit" size="lg" className="w-full" disabled={!declared || submitting}>
            {submitting ? "Placing order…" : `Place order · ${formatCents(totals.totalCents)}`}
          </Button>
        </aside>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} name={id} type={type} required autoComplete={autoComplete} defaultValue={defaultValue} />
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className={muted ? "text-xs text-muted-foreground" : "text-muted-foreground"}>{label}</dt>
      <dd className={`font-mono ${accent ? "text-primary" : muted ? "text-xs text-muted-foreground" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

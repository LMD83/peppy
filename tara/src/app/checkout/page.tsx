"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useAction, useQuery } from "convex/react";
import { CheckCircle2, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import { useCart } from "@/lib/cart-context";
import {
  priceOrder,
  volumeNudge,
  formatCents,
  verifyIdFromBatch,
  volumePercent,
  PROMO_CODE,
  PROMO_RATE,
  VAT_RATE,
  FREE_SHIP_THRESHOLD_CENTS,
  FLAT_SHIP_CENTS,
} from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/price";
import { SumUpWidget } from "@/components/sumup-widget";

type Stage = "form" | "payment";

// Included reconstitution kit — the July 2026 update's Standard/Premium
// tier selector, ported from the design reference (all prices in cents).
const BAC_EACH_CENTS = 349;
const NEEDLE_EACH_CENTS = 35;
const HOLDER_CENTS = 490;
const PEN_CENTS = 690;

type KitTier = "standard" | "premium";

function kitLinesFor(tier: KitTier, vialCount: number) {
  if (vialCount === 0) return { lines: [] as { name: string; detail: string; amountLabel: string }[], totalCents: 0 };
  const needlesCents = NEEDLE_EACH_CENTS * 10 * vialCount;
  const bacCents = BAC_EACH_CENTS * vialCount;
  const premium = tier === "premium";
  const lines = [
    { name: "Bacteriostatic water 3 mL", detail: `1 per vial · ${vialCount} total`, amountLabel: formatCents(bacCents) },
    premium
      ? { name: "3D-printed 5-well holder", detail: "presentation holder", amountLabel: formatCents(HOLDER_CENTS) }
      : { name: "Die-cut cardboard insert", detail: "holds your vials", amountLabel: "Free" },
    premium
      ? { name: "Reusable injection pen", detail: "click-dial injector", amountLabel: formatCents(PEN_CENTS) }
      : null,
    { name: premium ? "Pen needles 32G" : "Insulin needles", detail: `10 per vial · ${10 * vialCount} total`, amountLabel: formatCents(needlesCents) },
    { name: "Alcohol swabs", detail: `10 per vial · on us`, amountLabel: "Free" },
  ].filter((l): l is { name: string; detail: string; amountLabel: string } => l != null);
  const totalCents = premium ? bacCents + HOLDER_CENTS + PEN_CENTS + needlesCents : bacCents + needlesCents;
  return { lines, totalCents };
}

export default function CheckoutPage() {
  const { lines, count, clear } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [orderNo, setOrderNo] = useState("");
  const [kitTier, setKitTier] = useState<KitTier>("standard");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");

  const createOrder = useMutation(api.orders.createOrder);
  const createCheckout = useAction(api.sumup.createCheckout);
  const confirmCheckoutFromClient = useAction(api.sumup.confirmCheckoutFromClient);
  const orderStatus = useQuery(api.orders.getOrderStatus, orderNo ? { orderNo } : "skip");

  const kit = useMemo(() => kitLinesFor(kitTier, count), [kitTier, count]);

  const totals = useMemo(() => {
    const base = priceOrder(lines.map((l) => ({ unitPriceCents: l.unitPriceCents, qty: l.qty })), promoCode);
    // Fold the kit cost into the same discount rate as the rest of the order
    // (kit qty never counts toward the volume tier itself — see vialCount).
    const promoApplied = promoCode.trim().toUpperCase() === PROMO_CODE;
    const bestPct = Math.max(volumePercent(count), promoApplied ? PROMO_RATE : 0);
    const kitDiscountCents = Math.round(kit.totalCents * bestPct);
    const subtotalCents = base.subtotalCents + kit.totalCents;
    const discountCents = base.discountCents + kitDiscountCents;
    const netGoods = subtotalCents - discountCents;
    const shippingCents = subtotalCents === 0 || netGoods >= FREE_SHIP_THRESHOLD_CENTS ? 0 : FLAT_SHIP_CENTS;
    const totalCents = netGoods + shippingCents;
    const vatCents = Math.round(totalCents - totalCents / (1 + VAT_RATE));
    return { ...base, subtotalCents, discountCents, shippingCents, vatCents, totalCents };
  }, [lines, promoCode, kit.totalCents, count]);
  const nudge = volumeNudge(count);
  const toFreeShip = Math.max(0, FREE_SHIP_THRESHOLD_CENTS - (totals.subtotalCents - totals.discountCents));

  // Live-reactive: the moment the SumUp webhook (or the client fallback
  // below) flips the order to "paid" server-side, this query re-renders —
  // no manual polling required. Derived directly from the query rather than
  // synced into state, so there's no setState-in-effect cascade; clearing
  // the cart is the one real side effect, guarded to fire exactly once.
  const isPaid = orderStatus?.status === "paid";
  const clearedRef = useRef(false);
  useEffect(() => {
    if (isPaid && !clearedRef.current) {
      clearedRef.current = true;
      clear();
    }
  }, [isPaid, clear]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!declared || submitting) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const promoPercent = promoCode.trim().toUpperCase() === PROMO_CODE ? PROMO_RATE : 0;

    try {
      const { orderId, orderNo: newOrderNo } = await createOrder({
        email,
        shipTo: {
          name: String(formData.get("name") ?? ""),
          addr: String(formData.get("addr") ?? ""),
          city: String(formData.get("city") ?? ""),
          post: String(formData.get("post") ?? ""),
          country: String(formData.get("country") ?? ""),
        },
        items: lines.map((l) => ({
          productSlug: l.slug,
          name: l.name,
          variantLabel: l.variantLabel,
          batch: l.batch,
          unitPriceCents: l.unitPriceCents,
          qty: l.qty,
        })),
        promoPercent,
      });

      const { checkoutId: id } = await createCheckout({ orderId, rateLimitKey: email });
      setBuyerEmail(email);
      setOrderNo(newOrderNo);
      setCheckoutId(id);
      setStage("payment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWidgetResponse(type: "success" | "error" | "invalid" | "expired") {
    if (type !== "success" || !checkoutId) {
      if (type !== "success") toast.error("Payment didn't go through — please try again.");
      return;
    }
    try {
      await confirmCheckoutFromClient({ checkoutId, rateLimitKey: buyerEmail });
    } catch {
      // Best-effort fallback only — the webhook is the primary confirmation
      // path and the live query above will pick it up regardless.
    }
  }

  if (isPaid) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h1 className="font-serif text-3xl font-semibold">Thank you — your order is placed.</h1>
        <p className="text-muted-foreground">
          Order <span className="font-mono text-foreground">{orderNo}</span>. Every line on your
          invoice carries its batch number and a unique TARA Verify ID. A confirmation email is on
          its way.
        </p>
        <Link href="/catalogue" className="mt-2">
          <Button size="lg">Continue browsing</Button>
        </Link>
      </div>
    );
  }

  if (stage === "payment") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <h1 className="font-serif text-2xl font-semibold">Payment</h1>
        {orderStatus?.status === "failed" ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
            <XCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              That payment didn&apos;t succeed. No charge was made — go back and try again.
            </p>
            <Button variant="outline" onClick={() => setStage("form")}>
              Back to details
            </Button>
          </div>
        ) : checkoutId ? (
          <SumUpWidget checkoutId={checkoutId} onResponse={handleWidgetResponse} />
        ) : null}
        <p className="text-center font-mono text-lg font-semibold">{formatCents(totals.totalCents)}</p>
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

          <fieldset className="space-y-4 rounded-md border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold">Reconstitution kit · included</legend>
            <div className="flex flex-wrap gap-2">
              {(["standard", "premium"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setKitTier(tier)}
                  className={`h-10 rounded-sm border px-4 text-sm font-semibold ${
                    kitTier === tier
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-foreground"
                  }`}
                >
                  {tier === "standard" ? "Standard kit" : "Premium kit"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {kitTier === "standard"
                ? "Cardboard insert · needles · swabs"
                : "3D-printed holder · reusable pen · pen needles · swabs"}
            </p>
            {kit.lines.length > 0 && (
              <ul className="divide-y divide-muted text-sm">
                {kit.lines.map((l) => (
                  <li key={l.name} className="flex items-center justify-between py-2">
                    <span>
                      {l.name} <span className="text-xs text-muted-foreground">— {l.detail}</span>
                    </span>
                    <span className="font-mono text-xs">{l.amountLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

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
                Card and wallet payment is processed securely via SumUp on the next step — card
                details never touch our servers.
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
              <Price cents={totals.totalCents} className="font-mono" />
            </div>
          </dl>

          <Button type="submit" size="lg" className="w-full" disabled={!declared || submitting}>
            {submitting ? "Preparing payment…" : `Continue to payment · ${formatCents(totals.totalCents)}`}
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

"use client"

import { useState } from "react"
import Link from "next/link"
import { Lock, CheckCircle2 } from "lucide-react"
import { useMutation } from "convex/react"

import { api } from "@convex/_generated/api"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"
import { shippingFor } from "@/lib/checkout"
import { formatPrice } from "@/lib/products"
import { cn } from "@/lib/utils"

const IRISH_COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry",
  "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth",
  "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary",
  "Waterford", "Westmeath", "Wexford", "Wicklow",
]

export default function CheckoutPage() {
  const { lines, subtotal, count, sessionId, loading } = useCart()
  const placeOrder = useMutation(api.orders.place)
  const [placed, setPlaced] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const shipping = shippingFor(subtotal)
  const total = subtotal + shipping

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sessionId) return
    setSubmitting(true)

    // ── Payment integration point ───────────────────────────────────────────
    // In production this is where we create a payment session and redirect:
    //
    //   const res = await fetch("/api/checkout", {
    //     method: "POST",
    //     body: JSON.stringify({ lines, email, shippingAddress }),
    //   })
    //   const { url } = await res.json()        // Stripe Checkout Session URL
    //   window.location.href = url
    //
    // That route (server-side) needs STRIPE_SECRET_KEY and a webhook to confirm
    // the order. Apple/Google Pay and Revolut Pay are enabled in the Stripe
    // dashboard. Until keys are configured we place the order directly, so it's
    // recorded in Convex without payment being taken.
    // ─────────────────────────────────────────────────────────────────────────
    const email = new FormData(e.currentTarget).get("email")
    await placeOrder({
      sessionId,
      email: typeof email === "string" ? email : undefined,
    })
    setPlaced(true)
    setSubmitting(false)
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Order confirmed</h1>
        <p className="text-muted-foreground">
          Thanks for your order. You&apos;ll get a confirmation email shortly and
          next-day tracking once it ships. (Demo checkout — no payment was taken.)
        </p>
        <Link href="/" className={cn(buttonVariants())}>
          Continue shopping
        </Link>
      </div>
    )
  }

  if (loading) return null

  if (count === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Nothing to check out</h1>
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link href="/collections/protein" className={cn(buttonVariants())}>
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <fieldset className="space-y-3">
            <legend className="text-lg font-semibold">Contact</legend>
            <Field id="email" label="Email" type="email" autoComplete="email" />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-lg font-semibold">Shipping address</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="firstName" label="First name" autoComplete="given-name" />
              <Field id="lastName" label="Last name" autoComplete="family-name" />
            </div>
            <Field id="address" label="Address" autoComplete="address-line1" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="city" label="Town / City" autoComplete="address-level2" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="county" className="text-sm font-medium">
                  County
                </label>
                <select
                  id="county"
                  name="county"
                  required
                  defaultValue=""
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="" disabled>
                    Select a county
                  </option>
                  {IRISH_COUNTIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Field id="eircode" label="Eircode" autoComplete="postal-code" />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-lg font-semibold">Payment</legend>
            <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/40 p-4">
              <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Secure payment</p>
                <p className="text-muted-foreground">
                  Card, Apple&nbsp;Pay, Google&nbsp;Pay and Revolut&nbsp;Pay are
                  processed securely at the next step. This demo build places the
                  order without taking payment — connect Stripe keys to go live.
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="h-fit rounded-xl border p-5">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {line.qty}× {line.name}
                  {line.subscribe && " (Sub)"}
                </span>
                <span>{formatPrice(line.unitPrice * line.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full"
            disabled={submitting}
          >
            {submitting ? "Placing order…" : `Place order · ${formatPrice(total)}`}
          </Button>
        </aside>
      </form>
    </div>
  )
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
}: {
  id: string
  label: string
  type?: string
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  )
}

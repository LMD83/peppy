"use client"

import Link from "next/link"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"
import {
  amountToFreeShipping,
  shippingFor,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/checkout"
import { formatPrice } from "@/lib/products"
import { cn } from "@/lib/utils"

export default function CartPage() {
  const { lines, subtotal, count, setQty, remove } = useCart()

  if (count === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Your cart is empty</h1>
        <p className="text-muted-foreground">
          Find your essentials and we&apos;ll get them to you next-day.
        </p>
        <Link href="/collections/protein" className={cn(buttonVariants())}>
          Start shopping
        </Link>
      </div>
    )
  }

  const shipping = shippingFor(subtotal)
  const toFree = amountToFreeShipping(subtotal)
  const total = subtotal + shipping

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Your cart</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <ul className="lg:col-span-2 divide-y rounded-xl border">
          {lines.map((line) => (
            <li key={line.id} className="flex gap-4 p-4">
              <div
                className="size-20 shrink-0 rounded-lg"
                style={{
                  backgroundImage: `linear-gradient(145deg, ${line.accent[0]}, ${line.accent[1]})`,
                }}
                aria-hidden="true"
              />
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-2">
                  <div>
                    <Link
                      href={`/products/${line.handle}`}
                      className="font-semibold hover:text-primary"
                    >
                      {line.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {line.flavour}
                      {line.subscribe && " · Subscribe & Save"}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatPrice(line.unitPrice * line.qty)}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-lg border">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Decrease quantity"
                      onClick={() => setQty(line.id, line.qty - 1)}
                    >
                      <Minus />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {line.qty}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Increase quantity"
                      onClick={() => setQty(line.id, line.qty + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(line.id)}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl border p-5">
          <h2 className="font-semibold">Order summary</h2>
          {toFree > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Spend {formatPrice(toFree)} more for free delivery.
            </p>
          ) : (
            <p className="mt-2 text-sm text-primary">
              You&apos;ve unlocked free next-day delivery.
            </p>
          )}
          <dl className="mt-4 space-y-2 text-sm">
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
          <Link
            href="/checkout"
            className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")}
          >
            Checkout
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Free delivery on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
        </aside>
      </div>
    </div>
  )
}

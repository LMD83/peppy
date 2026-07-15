"use client"

import { useState } from "react"
import { Minus, Plus, Check } from "lucide-react"

import type { Doc } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"
import { formatPrice, pricePerServing, SUBSCRIBE_DISCOUNT } from "@/lib/products"
import { cn } from "@/lib/utils"

export function ProductPurchase({ product }: { product: Doc<"products"> }) {
  const { add } = useCart()
  const [flavour, setFlavour] = useState(product.flavours[0])
  const [qty, setQty] = useState(1)
  const [subscribe, setSubscribe] = useState(false)
  const [added, setAdded] = useState(false)

  const unit = subscribe ? product.price * SUBSCRIBE_DISCOUNT : product.price
  const total = unit * qty

  function handleAdd() {
    add({
      handle: product.handle,
      name: product.name,
      flavour,
      subscribe,
      qty,
      basePrice: product.price,
      accent: product.accent,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatPrice(unit)}</span>
          {subscribe && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {pricePerServing(product)} / serving · {product.servings} servings ·{" "}
          {product.size}
        </p>
      </div>

      {product.flavours.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Flavour</legend>
          <div className="flex flex-wrap gap-2">
            {product.flavours.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={flavour === option}
                onClick={() => setFlavour(option)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  flavour === option
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-muted"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
          subscribe ? "border-primary bg-accent/50" : "border-border"
        )}
      >
        <input
          type="checkbox"
          checked={subscribe}
          onChange={(e) => setSubscribe(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span className="text-sm">
          <span className="font-medium">Subscribe &amp; Save 15%</span>
          <span className="block text-muted-foreground">
            Delivered on your schedule. Skip or cancel any time.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus />
          </Button>
          <span className="w-8 text-center text-sm font-medium" aria-live="polite">
            {qty}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => q + 1)}
          >
            <Plus />
          </Button>
        </div>
        <Button size="lg" className="flex-1" onClick={handleAdd}>
          {added ? (
            <>
              <Check /> Added
            </>
          ) : (
            <>Add to cart · {formatPrice(total)}</>
          )}
        </Button>
      </div>
    </div>
  )
}

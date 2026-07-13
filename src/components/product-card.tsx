import Link from "next/link"
import { fetchQuery } from "convex/nextjs"

import { api } from "@convex/_generated/api"
import type { Doc } from "@convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "@/components/icons"
import { ProductImage } from "@/components/product-image"
import { Stars } from "@/components/stars"
import { formatPrice, pricePerServing } from "@/lib/products"

export async function ProductCard({ product }: { product: Doc<"products"> }) {
  const { rating } = await fetchQuery(api.reviews.ratingSummary, {
    handle: product.handle,
  })
  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div
        className="relative flex aspect-square items-end p-4"
        style={{
          backgroundImage: `linear-gradient(145deg, color-mix(in oklch, ${product.accent[0]} 22%, white), color-mix(in oklch, ${product.accent[1]} 30%, white))`,
        }}
      >
        <ProductImage
          product={product}
          className="absolute inset-0 m-auto size-[78%] transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {product.bestseller && <Badge variant="secondary">Bestseller</Badge>}
          {product.vegan && <Badge variant="outline">Vegan</Badge>}
        </div>
        {product.informedSport && (
          <span className="relative inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
            <ShieldCheck className="size-3 text-primary" />
            Tested
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold leading-tight group-hover:text-primary">
          {product.name}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Stars rating={rating} size="size-3" />
          {rating.toFixed(1)}
        </div>
        <p className="text-sm text-muted-foreground">{product.tagline}</p>
        <div className="mt-auto pt-3">
          <p className="font-semibold">{formatPrice(product.price)}</p>
          <p className="text-xs text-muted-foreground">
            {pricePerServing(product)} / serving · {product.size}
          </p>
        </div>
      </div>
    </Link>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ProductPurchase } from "@/components/product-purchase"
import { ProductCard } from "@/components/product-card"
import { InformedSportBadge } from "@/components/informed-sport-badge"
import { ShieldCheck } from "@/components/icons"
import { Truck, BadgeEuro, Check } from "lucide-react"
import {
  getCollection,
  getProduct,
  products,
  relatedProducts,
} from "@/lib/products"

export function generateStaticParams() {
  return products.map((p) => ({ handle: p.handle }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const product = getProduct(handle)
  if (!product) return {}

  return {
    title: `${product.name} – ${product.tagline}`,
    description: `${product.name}: ${product.tagline}. Informed-Sport tested. Next-day delivery across Ireland. ${product.size}, ${product.servings} servings.`,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      title: `${product.name} | Peppy`,
      description: product.tagline,
    },
  }
}

const trustRow = [
  { icon: ShieldCheck, label: "Informed-Sport tested" },
  { icon: Truck, label: "Next-day Irish delivery" },
  { icon: BadgeEuro, label: "No customs charges" },
]

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const product = getProduct(handle)
  if (!product) notFound()

  const collection = getCollection(product.collection)
  const related = relatedProducts(product)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.tagline,
    brand: { "@type": "Brand", name: "Peppy" },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
      availability: "https://schema.org/InStock",
    },
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        {collection && (
          <>
            <Link
              href={`/collections/${collection.slug}`}
              className="hover:text-foreground"
            >
              {collection.name}
            </Link>{" "}
            /{" "}
          </>
        )}
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery placeholder */}
        <div
          className="aspect-square rounded-2xl"
          style={{
            backgroundImage: `linear-gradient(145deg, ${product.accent[0]}, ${product.accent[1]})`,
          }}
          aria-label={`${product.name} product image`}
          role="img"
        />

        {/* Buy box */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <InformedSportBadge className="self-start" />
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">{product.tagline}</p>
          </div>

          <ProductPurchase product={product} />

          <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-4">
            {trustRow.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-sm">
                <Icon className="size-4 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Details */}
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Why you&apos;ll like it</h2>
          <ul className="space-y-2">
            {product.benefits.map((benefit) => (
              <li key={benefit} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 mb-3 text-lg font-semibold">How to use</h2>
          <p className="text-sm text-muted-foreground">{product.howToUse}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Per serving</h2>
          <dl className="overflow-hidden rounded-xl border">
            {product.facts.map((fact, i) => (
              <div
                key={fact.label}
                className={`flex justify-between px-4 py-3 text-sm ${
                  i % 2 ? "bg-muted/40" : ""
                }`}
              >
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-muted-foreground">
            Food supplements should not be used as a substitute for a varied,
            balanced diet and a healthy lifestyle. Not intended to diagnose,
            treat, cure or prevent any disease.
          </p>
        </section>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">
            Complete your stack
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.handle} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

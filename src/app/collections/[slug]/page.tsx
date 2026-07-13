import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { fetchQuery } from "convex/nextjs"

import { api } from "@convex/_generated/api"
import { ProductCard } from "@/components/product-card"
import { InformedSportBadge } from "@/components/informed-sport-badge"

// Reads live Convex data — never prerender at build time.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const collection = await fetchQuery(api.collections.getBySlug, { slug })
  if (!collection) return {}

  return {
    title: collection.heading,
    description: collection.intro,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: {
      title: `${collection.heading} | Peppy`,
      description: collection.intro,
    },
  }
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const collection = await fetchQuery(api.collections.getBySlug, { slug })
  if (!collection) notFound()

  const items = await fetchQuery(api.products.byCollection, {
    collection: collection.slug,
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">{collection.name}</span>
      </nav>

      <header className="mb-8 max-w-2xl">
        <div className="mb-3">
          <InformedSportBadge />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {collection.heading}
        </h1>
        <p className="mt-3 text-muted-foreground">{collection.intro}</p>
      </header>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.handle} product={product} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          New products landing soon. Check back shortly.
        </p>
      )}
    </div>
  )
}

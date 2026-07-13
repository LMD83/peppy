import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { fetchQuery } from "convex/nextjs"

import { api } from "@convex/_generated/api"
import { buttonVariants } from "@/components/ui/button-variants"
import { TrustBar } from "@/components/trust-bar"
import { ProductCard } from "@/components/product-card"
import { InformedSportBadge } from "@/components/informed-sport-badge"
import { cn } from "@/lib/utils"

const goals = [
  { label: "Build muscle", href: "/collections/protein" },
  { label: "Boost energy", href: "/collections/pre-workout" },
  { label: "Recover faster", href: "/collections/recovery" },
  { label: "Daily strength", href: "/collections/creatine" },
]

export default async function Home() {
  const [featuredProducts, collections, allArticles] = await Promise.all([
    fetchQuery(api.products.bestsellers, {}),
    fetchQuery(api.collections.list, {}),
    fetchQuery(api.articles.list, {}),
  ])
  const featuredArticles = allArticles.slice(0, 3)
  return (
    <>
      {/* Hero */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col items-start gap-5">
            <InformedSportBadge />
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Irish-made sports nutrition,{" "}
              <span className="text-primary">tested and trusted</span>.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Informed-Sport tested protein, creatine and pre-workout at honest,
              transparent prices. Shipped next-day across Ireland — no customs,
              no waiting on the UK.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/collections/protein"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Shop protein
                <ArrowRight />
              </Link>
              <Link
                href="/collections/bundles"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" })
                )}
              >
                Browse bundles
              </Link>
            </div>
          </div>
          <div
            className="hidden aspect-[4/3] rounded-2xl lg:block"
            style={{
              backgroundImage:
                "linear-gradient(145deg, oklch(0.83 0.19 134), oklch(0.45 0.13 155))",
            }}
            aria-hidden="true"
          />
        </div>
      </section>

      <TrustBar />

      {/* Bestsellers */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Bestsellers</h2>
          <Link
            href="/collections/protein"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Shop all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.handle} product={product} />
          ))}
        </div>
      </section>

      {/* Shop by goal */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">
            Shop by goal
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {goals.map((goal) => (
              <Link
                key={goal.label}
                href={goal.href}
                className="group flex items-center justify-between rounded-xl border bg-card p-5 font-medium transition-colors hover:border-primary"
              >
                {goal.label}
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">
          Explore the range
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group relative flex h-40 flex-col justify-end overflow-hidden rounded-xl p-5 text-white"
              style={{
                backgroundImage: `linear-gradient(145deg, ${collection.accent[0]}, ${collection.accent[1]})`,
              }}
            >
              <h3 className="text-lg font-semibold drop-shadow">
                {collection.name}
              </h3>
              <span className="inline-flex items-center gap-1 text-sm font-medium drop-shadow">
                Shop now{" "}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Learn teaser */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight">
              Learn the basics
            </h2>
            <Link
              href="/learn"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              All guides <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {featuredArticles.map((article) => (
              <Link
                key={article.slug}
                href={`/learn/${article.slug}`}
                className="flex flex-col gap-2 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-medium text-primary">
                  {article.cluster}
                </span>
                <h3 className="font-semibold leading-snug">{article.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Email capture */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Get 10% off your first order
          </h2>
          <p className="max-w-md text-muted-foreground">
            Join the Peppy list for training tips, new flavours and
            members-only offers. No spam, unsubscribe any time.
          </p>
          <form className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.ie"
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <button
              type="submit"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Sign up
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

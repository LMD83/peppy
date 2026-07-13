import type { Metadata } from "next"
import Link from "next/link"
import { Clock } from "lucide-react"
import { fetchQuery } from "convex/nextjs"

import { api } from "@convex/_generated/api"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Learn — Sports Nutrition Guides",
  description:
    "Straightforward, evidence-based guides to protein, creatine, pre-workout and recovery for Irish athletes and gym-goers.",
  alternates: { canonical: "/learn" },
}

export default async function LearnPage() {
  const articles = await fetchQuery(api.articles.list, {})
  const [featured, ...rest] = articles

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Learn</h1>
        <p className="mt-3 text-muted-foreground">
          Straightforward, evidence-based guides to sports nutrition. No hype, no
          unrealistic promises — just what the research says and how to apply it.
          Every guide is reviewed by a registered dietitian.
        </p>
      </header>

      {featured && (
        <Link
          href={`/learn/${featured.slug}`}
          className="group mb-8 grid overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md sm:grid-cols-2"
        >
          <div
            className="hidden min-h-48 sm:block"
            style={{
              backgroundImage:
                "linear-gradient(145deg, oklch(0.83 0.19 134), oklch(0.45 0.13 155))",
            }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-3 p-6">
            <Badge variant="accent" className="w-fit">
              {featured.cluster}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight group-hover:text-primary">
              {featured.title}
            </h2>
            <p className="text-muted-foreground">{featured.excerpt}</p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-3.5" /> {featured.readingMinutes} min read
            </span>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((article) => (
          <Link
            key={article.slug}
            href={`/learn/${article.slug}`}
            className="flex flex-col gap-2 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <span className="text-xs font-medium text-primary">
              {article.cluster}
            </span>
            <h2 className="font-semibold leading-snug">{article.title}</h2>
            <p className="text-sm text-muted-foreground">{article.excerpt}</p>
            <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> {article.readingMinutes} min read
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        More guides are published regularly — this is the first batch of our
        50-article content plan.
      </p>
    </div>
  )
}

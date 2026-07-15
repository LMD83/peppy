import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Clock } from "lucide-react"
import { fetchQuery } from "convex/nextjs"

import { api } from "@convex/_generated/api"
import { buttonVariants } from "@/components/ui/button-variants"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Reads live Convex data — never prerender at build time.
export const dynamic = "force-dynamic"

const dateFmt = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await fetchQuery(api.articles.getBySlug, { slug })
  if (!article) return {}
  return {
    title: article.metaTitle,
    description: article.description,
    alternates: { canonical: `/learn/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      publishedTime: article.datePublished,
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await fetchQuery(api.articles.getBySlug, { slug })
  if (!article) notFound()

  const related = (
    await Promise.all(
      article.related.map((s) => fetchQuery(api.articles.getBySlug, { slug: s }))
    )
  ).filter((a): a is NonNullable<typeof a> => Boolean(a))

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    author: { "@type": "Organization", name: "Peppy" },
    reviewedBy: { "@type": "Person", name: article.reviewerName },
    publisher: { "@type": "Organization", name: "Peppy" },
  }

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/learn" className="hover:text-foreground">
          Learn
        </Link>{" "}
        / <span className="text-foreground">{article.cluster}</span>
      </nav>

      <header className="mb-8">
        <Badge variant="accent">{article.cluster}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{article.excerpt}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>By {article.authorName}</span>
          <span aria-hidden>·</span>
          <span>
            Reviewed by {article.reviewerName}, {article.reviewerRole}
          </span>
          <span aria-hidden>·</span>
          <time dateTime={article.datePublished}>
            {dateFmt.format(new Date(article.datePublished))}
          </time>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {article.readingMinutes} min read
          </span>
        </div>
      </header>

      <div className="space-y-4 text-[15px] leading-relaxed">
        {article.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {article.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="mb-3 text-xl font-bold tracking-tight">
            {section.heading}
          </h2>
          <div className="space-y-3 text-[15px] leading-relaxed">
            {section.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {section.list && (
              <ul className="ml-5 list-disc space-y-1.5">
                {section.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      {/* Key takeaways */}
      <aside className="mt-10 rounded-2xl border bg-muted/40 p-6">
        <h2 className="mb-3 text-lg font-semibold">Key takeaways</h2>
        <ul className="space-y-2 text-sm">
          {article.takeaways.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              {t}
            </li>
          ))}
        </ul>
      </aside>

      {/* Product CTA */}
      <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border bg-accent/40 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">Ready to put this into practice?</p>
        <Link href={article.ctaHref} className={cn(buttonVariants())}>
          {article.ctaLabel}
          <ArrowRight />
        </Link>
      </div>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold tracking-tight">
          Frequently asked questions
        </h2>
        <div className="divide-y rounded-xl border">
          {article.faqs.map((faq) => (
            <details key={faq.q} className="group p-4">
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                {faq.q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        This article is for general education and is not medical advice. Food
        supplements should not be used as a substitute for a varied, balanced
        diet and a healthy lifestyle. Not intended to diagnose, treat, cure or
        prevent any disease.
      </p>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Keep reading</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/learn/${r.slug}`}
                className="flex flex-col gap-2 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-medium text-primary">
                  {r.cluster}
                </span>
                <h3 className="font-semibold leading-snug">{r.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

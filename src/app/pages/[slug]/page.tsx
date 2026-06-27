import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { infoPages, getInfoPage } from "@/lib/pages"

export function generateStaticParams() {
  return infoPages.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getInfoPage(slug)
  if (!page) return {}
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/pages/${page.slug}` },
  }
}

export default async function InfoPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getInfoPage(slug)
  if (!page) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">{page.title}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      {page.intro && (
        <p className="mt-3 text-lg text-muted-foreground">{page.intro}</p>
      )}

      <div className="mt-8 space-y-8">
        {page.blocks.map((block, i) => (
          <section key={i}>
            {block.heading && (
              <h2 className="mb-2 text-lg font-semibold">{block.heading}</h2>
            )}
            {block.body?.map((para, j) => (
              <p key={j} className="mb-2 text-sm text-muted-foreground">
                {para}
              </p>
            ))}
            {block.list && (
              <ul className="ml-5 list-disc space-y-1.5 text-sm text-muted-foreground">
                {block.list.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {page.legal && (
        <p className="mt-10 rounded-lg border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
          This page is a starting template, not legal advice. Have it reviewed
          and completed by a qualified professional, and replace all
          placeholders, before going live.
        </p>
      )}
    </article>
  )
}

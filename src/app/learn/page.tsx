import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Learn — Sports Nutrition Guides",
  description:
    "Straightforward, evidence-based guides to protein, creatine, pre-workout and recovery for Irish athletes and gym-goers.",
  alternates: { canonical: "/learn" },
}

const clusters = [
  {
    title: "Protein",
    blurb: "Whey, vegan, dosing and timing — what actually matters.",
    href: "/collections/protein",
  },
  {
    title: "Creatine",
    blurb: "The most researched supplement in sport, explained simply.",
    href: "/collections/creatine",
  },
  {
    title: "Pre-Workout & Energy",
    blurb: "Ingredients, caffeine and stim-free options.",
    href: "/collections/pre-workout",
  },
  {
    title: "Recovery & Hydration",
    blurb: "Electrolytes, EAAs, soreness and sleep.",
    href: "/collections/recovery",
  },
  {
    title: "Beginners",
    blurb: "What you actually need when you're starting out.",
    href: "/collections/bundles",
  },
  {
    title: "Performance for Ireland",
    blurb: "GAA, running and training, tailored for Irish athletes.",
    href: "/collections/recovery",
  },
]

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Learn</h1>
        <p className="mt-3 text-muted-foreground">
          Straightforward, evidence-based guides to sports nutrition. No hype,
          no unrealistic promises — just what the research says and how to apply
          it. Full articles are on the way.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clusters.map((cluster) => (
          <Link
            key={cluster.title}
            href={cluster.href}
            className="flex flex-col gap-2 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold">{cluster.title}</h2>
            <p className="text-sm text-muted-foreground">{cluster.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

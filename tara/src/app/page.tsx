import Link from "next/link";
import { ArrowRight, HeartPulse, Flame, TrendingUp, Infinity as InfinityIcon, Brain, Sparkles } from "lucide-react";

import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { products, fromPriceCents } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { goals } from "@/lib/goals";

const trustItems = [
  "German-sourced",
  "Batch-documented",
  "QR-verified",
  "No login required",
  "For research use only",
];

const featured = products.filter((p) => p.stock === "in" && p.kind === "compound").slice(0, 4);

const GOAL_ICONS: Record<string, typeof HeartPulse> = {
  recovery: HeartPulse,
  fatloss: Flame,
  growth: TrendingUp,
  longevity: InfinityIcon,
  cognition: Brain,
  skin: Sparkles,
};

// TARA quality chain — from the design reference's `chainSteps`.
const chainSteps = [
  { num: "01", title: "German supplier", desc: "Sourced from audited manufacturers with documented provenance." },
  { num: "02", title: "Batch intake", desc: "Every lot logged with origin, quantity, and manufacture date." },
  { num: "03", title: "Analytical test", desc: "Identity and purity confirmed by HPLC; results recorded on the COA." },
  { num: "04", title: "Serialise", desc: "Each vial assigned a unique verification ID and QR code." },
  { num: "05", title: "Release", desc: "Batch released only after documentation review and sign-off." },
  { num: "06", title: "Dispatch", desc: "Cold-chain where required, tracked to the researcher." },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-5 text-xs font-semibold tracking-[0.18em] text-secondary">
              GERMAN-SOURCED · BATCH-DOCUMENTED · QR-VERIFIED
            </p>
            <h1 className="mb-6 max-w-xl font-serif text-5xl font-semibold leading-[1.12] text-balance">
              Research-grade transparency, verified.
            </h1>
            <p className="mb-9 max-w-lg text-lg leading-relaxed text-muted-foreground">
              German-sourced research compounds, supported by batch documentation, QR
              authentication, and scientific education. We explain — we do not persuade.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/verify">
                <Button size="lg">Verify a batch</Button>
              </Link>
              <Link href="/catalogue">
                <Button size="lg" variant="outline">
                  Explore research compounds
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden justify-self-center lg:block">
            <LogoMark className="h-56 w-56 opacity-90" />
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-5">
            {trustItems.map((t, i) => (
              <Reveal key={t} delay={i * 0.06} className="border-r border-border last:border-r-0">
                <span className="block px-4 py-4 text-center text-[13px] font-semibold">{t}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-2 text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-secondary">GUIDED FINDER</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold">What are you researching?</h2>
        </div>
        <div className="mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const Icon = GOAL_ICONS[g.key] ?? Sparkles;
            return (
              <Link
                key={g.key}
                href={`/finder?goal=${g.key}`}
                className="flex items-start gap-3 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-secondary" />
                <span>
                  <span className="block font-semibold">{g.label}</span>
                  <span className="block text-sm text-muted-foreground">{g.blurb}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#B87333]">
            TARA QUALITY CHAIN
          </p>
          <h2 className="mb-9 font-serif text-2xl font-semibold">
            From supplier to your bench — every step documented.
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {chainSteps.map((step) => (
              <div key={step.num} className="flex gap-4">
                <span className="font-serif text-2xl font-semibold text-muted-foreground/50">
                  {step.num}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-7 flex items-end justify-between">
          <h2 className="font-serif text-2xl font-semibold">Featured compounds</h2>
          <Link href="/catalogue" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View catalogue <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.08}>
              <Link
                href={`/products/${p.slug}`}
                className="group block overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="h-1.5 w-full" style={{ background: p.accent }} aria-hidden="true" />
                <div className="p-5">
                  <h3 className="font-semibold group-hover:text-primary">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.plain}</p>
                  <p className="mt-3 font-mono text-sm">
                    from <span className="font-semibold">{formatCents(fromPriceCents(p))}</span>
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <Reveal className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="font-serif text-2xl font-semibold">
            Reconstitution &amp; the syringe math, without the guesswork.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Search any compound, set the bacteriostatic water, and get the exact draw on a U-100
            syringe — logged for your session.
          </p>
          <Link href="/calculator" className="mt-6 inline-block">
            <Button size="lg">Open the calculator</Button>
          </Link>
        </Reveal>
      </section>
    </>
  );
}

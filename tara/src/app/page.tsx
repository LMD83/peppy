import Link from "next/link";
import {
  ArrowRight,
  HeartPulse,
  Flame,
  TrendingUp,
  Infinity as InfinityIcon,
  Brain,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { ProductCard } from "@/components/product-card";
import { getProductById } from "@/lib/products";
import { goals } from "@/lib/goals";
import { articles } from "@/lib/knowledge";

const trustItems = [
  "German sourcing",
  "Batch documentation",
  "QR verification",
  "Research use only",
  "Secure dispatch",
];

const GOAL_ICONS: Record<string, typeof HeartPulse> = {
  recovery: HeartPulse,
  fatloss: Flame,
  growth: TrendingUp,
  longevity: InfinityIcon,
  cognition: Brain,
  skin: Sparkles,
};

const chainSteps = [
  { num: "01", title: "German supplier", desc: "Sourced from audited manufacturers with documented provenance." },
  { num: "02", title: "Batch intake", desc: "Every lot logged with origin, quantity, and manufacture date." },
  { num: "03", title: "Analytical test", desc: "Identity and purity confirmed by HPLC; results recorded on the COA." },
  { num: "04", title: "Serialise", desc: "Each vial assigned a unique verification ID and QR code." },
  { num: "05", title: "Release", desc: "Batch released only after documentation review and sign-off." },
  { num: "06", title: "Dispatch", desc: "Cold-chain where required, tracked to the researcher." },
];

const featured = ["bpc157", "ipamorelin", "tesamorelin"]
  .map(getProductById)
  .filter((p) => p != null);

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-5 text-xs font-semibold tracking-[0.18em] text-secondary">
              GERMAN-SOURCED · BATCH-DOCUMENTED · QR-VERIFIED
            </p>
            <h1 className="mb-6 max-w-xl font-serif text-[3.4rem] font-semibold leading-[1.08] text-balance">
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
            <div className="flex h-72 w-72 flex-col items-center justify-center gap-4 rounded-lg border border-[#cfe3d6] bg-accent">
              <LogoMark className="h-28 w-28" filled />
              <div className="text-center">
                <p className="font-serif text-2xl font-bold tracking-[0.28em] text-primary">TARA</p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.3em] text-secondary">
                  PEPTIDES
                </p>
                <p className="mt-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                  ANCIENT WISDOM · MODERN SCIENCE
                </p>
              </div>
            </div>
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

      {/* Start with your goal */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#1565C0]">
              START WITH YOUR GOAL
            </p>
            <h2 className="max-w-2xl font-serif text-3xl font-semibold">
              Not sure where to begin? Tell us what you&apos;re researching.
            </h2>
          </div>
          <Link
            href="/finder"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open the guided finder →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {goals.map((g) => {
            const Icon = GOAL_ICONS[g.key] ?? Sparkles;
            return (
              <Link
                key={g.key}
                href={`/finder?goal=${g.key}`}
                className="flex flex-col gap-2.5 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <Icon className="size-5 text-secondary" />
                <span className="text-[13.5px] font-semibold leading-tight">{g.label}</span>
                <span className="text-[12px] leading-snug text-muted-foreground">{g.blurb}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quality chain */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#B87333]">
            TARA QUALITY CHAIN
          </p>
          <h2 className="mb-9 font-serif text-3xl font-semibold">
            Six steps between a German supplier and your bench.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {chainSteps.map((step, i) => (
              <Reveal
                key={step.num}
                delay={i * 0.05}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-5"
              >
                <span className="font-mono text-xs font-semibold text-secondary">{step.num}</span>
                <h3 className="text-[13.5px] font-semibold leading-tight">{step.title}</h3>
                <p className="text-[12px] leading-snug text-muted-foreground">{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured compounds */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#B87333]">
              FEATURED COMPOUNDS
            </p>
            <h2 className="font-serif text-3xl font-semibold">Identity, purity, batch. No claims.</h2>
          </div>
          <Link
            href="/catalogue"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            View all compounds <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.08}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Verify + Knowledge panels */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-lg bg-panel p-8 text-panel-foreground">
            <p className="text-xs font-semibold tracking-[0.18em] text-secondary">TARA VERIFY</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold leading-snug">
              Every vial carries a unique, publicly checkable identity.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-panel-muted">
              Scan the QR code on the label — or type the verification ID printed beside it — and
              the batch record, release status, and Certificate of Analysis appear in under a
              second. No login, no account.
            </p>
            <div className="mt-6 flex items-center justify-between gap-3 rounded-md border border-panel-border bg-[#12263A] px-4 py-3">
              <div>
                <p className="font-mono text-sm tracking-wide text-panel-foreground">
                  TV-8XQ4-KL92-M71P
                </p>
                <p className="mt-0.5 text-[11.5px] text-panel-muted">
                  Tesamorelin 5 mg · Batch G260701
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-secondary/20 px-2.5 py-1 text-[12px] font-bold text-secondary">
                <ShieldCheck className="size-3.5" /> AUTHENTIC
              </span>
            </div>
            <Link href="/verify?id=TV-8XQ4-KL92-M71P" className="mt-6">
              <span className="inline-flex h-11 items-center rounded-sm bg-secondary px-5 text-[13px] font-semibold text-panel hover:opacity-90">
                Try a sample verification →
              </span>
            </Link>
          </div>

          <div className="flex flex-col rounded-lg border border-border bg-card p-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#1565C0]">KNOWLEDGE CENTRE</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold">
              Written to be cited, not to convert.
            </h2>
            <ul className="mt-5 divide-y divide-border">
              {articles.slice(0, 5).map((a) => (
                <li key={a.title}>
                  <Link
                    href="/knowledge"
                    className="flex items-center justify-between gap-4 py-3 text-[14px] text-foreground hover:text-primary"
                  >
                    {a.title}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/knowledge"
              className="mt-5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Browse the Knowledge Centre
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

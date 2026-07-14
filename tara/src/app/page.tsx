import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { products, fromPriceCents } from "@/lib/products";
import { formatCents } from "@/lib/pricing";

const trustItems = [
  "German-sourced",
  "Batch-documented",
  "QR-verified",
  "No login required",
  "For research use only",
];

const featured = products.filter((p) => p.stock === "in").slice(0, 4);

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
            {trustItems.map((t) => (
              <span
                key={t}
                className="border-r border-border px-4 py-4 text-center text-[13px] font-semibold last:border-r-0"
              >
                {t}
              </span>
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
          {featured.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="group overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md"
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
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
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
        </div>
      </section>
    </>
  );
}

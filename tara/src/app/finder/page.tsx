"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HeartPulse, Flame, TrendingUp, Infinity as InfinityIcon, Brain, Sparkles } from "lucide-react";

import { goals, getGoal, type Goal } from "@/lib/goals";
import { getProductById, fromPriceCents, type Product } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof HeartPulse> = {
  recovery: HeartPulse,
  fatloss: Flame,
  growth: TrendingUp,
  longevity: InfinityIcon,
  cognition: Brain,
  skin: Sparkles,
};

function FinderView() {
  const searchParams = useSearchParams();
  const [selectedKey, setSelectedKey] = useState<string | null>(searchParams.get("goal"));

  const selected: Goal | undefined = selectedKey ? getGoal(selectedKey) : undefined;
  const results = useMemo<Product[]>(
    () =>
      selected
        ? selected.ids.map(getProductById).filter((p): p is Product => Boolean(p))
        : [],
    [selected]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-secondary">GUIDED FINDER</p>
      <h1 className="mb-3 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        What are you researching?
      </h1>
      <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Pick a research goal and we&apos;ll point you to the compounds studied for it — a starting
        point, not a recommendation.
      </p>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const Icon = ICONS[g.key] ?? Sparkles;
          const active = g.key === selectedKey;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setSelectedKey(g.key)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-md border p-6 text-left transition-colors",
                active ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40"
              )}
            >
              <Icon className={cn("size-7", active ? "text-primary" : "text-secondary")} />
              <span className="font-semibold">{g.label}</span>
              <span className="text-sm text-muted-foreground">{g.blurb}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div>
          <h2 className="mb-6 font-serif text-2xl font-semibold">{selected.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {results.map((p) => (
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
          <Link
            href="/stacks"
            className="mt-8 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Or browse researched stacks for {selected.label.toLowerCase()} →
          </Link>
        </div>
      )}

      <p className="mt-12 text-xs text-muted-foreground">
        For laboratory research use only. Not for human or veterinary use.
      </p>
    </div>
  );
}

export default function FinderPage() {
  return (
    <Suspense fallback={null}>
      <FinderView />
    </Suspense>
  );
}

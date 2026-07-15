"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { products, categories, fromPriceCents, type Product } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

type SortKey = "name" | "price";
type Filter = "all" | "supplies" | (string & {});

const compounds = products.filter((p) => p.kind === "compound");
const supplies = products.filter((p) => p.kind === "supply");

function sortList(list: Product[], sort: SortKey): Product[] {
  return [...list].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : fromPriceCents(a) - fromPriceCents(b)
  );
}

export default function CataloguePage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of compounds) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, []);

  // Grouped by category when "All compounds" is selected — this is the
  // "sort by grouping" browse mode; picking a chip narrows to one section.
  const sections = useMemo(() => {
    if (filter === "supplies") return [];
    const cats = filter === "all" ? categories : [filter];
    return cats
      .map((cat) => ({ category: cat, items: sortList(compounds.filter((p) => p.category === cat), sort) }))
      .filter((s) => s.items.length > 0);
  }, [filter, sort]);

  const supplyItems = useMemo(() => sortList(supplies, sort), [sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">The catalogue</h1>
        <p className="mt-2 text-muted-foreground">
          {compounds.length} research compounds, German-sourced and batch-documented, grouped by
          research area. For laboratory research use only.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All compounds ({compounds.length})
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {c} ({counts.get(c)})
            </Chip>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-sm border border-input bg-card px-2 text-sm text-foreground"
          >
            <option value="name">Name</option>
            <option value="price">Price</option>
          </select>
        </label>
      </div>

      <div className="mb-10 flex flex-wrap gap-2 border-t border-border pt-4">
        <Chip active={filter === "supplies"} onClick={() => setFilter("supplies")}>
          Lab supplies ({supplies.length})
        </Chip>
        <p className="flex items-center text-xs text-muted-foreground">
          Diluents, syringes and other consumables — not research compounds.
        </p>
      </div>

      {filter === "supplies" ? (
        <ProductGrid items={supplyItems} />
      ) : (
        <div className="flex flex-col gap-12">
          {sections.map(({ category, items }, i) => (
            <Reveal key={category} delay={i * 0.05}>
              <section>
                {filter === "all" && (
                  <h2 className="mb-4 font-serif text-xl font-semibold">{category}</h2>
                )}
                <ProductGrid items={items} />
              </section>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <Link
          key={p.slug}
          href={`/products/${p.slug}`}
          className="group flex flex-col overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md"
        >
          <div className="h-1.5 w-full" style={{ background: p.accent }} aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight group-hover:text-primary">{p.name}</h3>
              <StockBadge stock={p.stock} />
            </div>
            <p className="flex-1 text-sm text-muted-foreground">{p.plain}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-sm text-muted-foreground">
                from <span className="font-semibold text-foreground">{formatCents(fromPriceCents(p))}</span>
              </p>
              <span className="text-xs font-semibold text-primary">Details →</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-muted-foreground hover:border-primary hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

function StockBadge({ stock }: { stock: Product["stock"] }) {
  if (stock === "out") return <Badge variant="outline">Out of stock</Badge>;
  if (stock === "low") return <Badge variant="secondary">Low stock</Badge>;
  return <Badge>In stock</Badge>;
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { products, categories, fromPriceCents, type Product } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SortKey = "name" | "price";

export default function CataloguePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("name");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, []);

  const items = useMemo(() => {
    let list: Product[] = activeCategory
      ? products.filter((p) => p.category === activeCategory)
      : [...products];
    list = list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : fromPriceCents(a) - fromPriceCents(b)
    );
    return list;
  }, [activeCategory, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">The catalogue</h1>
        <p className="mt-2 text-muted-foreground">
          {products.length} research compounds, German-sourced and batch-documented. For
          laboratory research use only.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip active={activeCategory === null} onClick={() => setActiveCategory(null)}>
            All ({products.length})
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Link
            key={p.slug}
            href={`/products/${p.slug}`}
            className="group flex flex-col overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md"
          >
            <div
              className="h-1.5 w-full"
              style={{ background: p.accent }}
              aria-hidden="true"
            />
            <div className="flex flex-1 flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-tight group-hover:text-primary">{p.name}</h2>
                <StockBadge stock={p.stock} />
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p>
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

"use client";

import { useMemo, useState } from "react";

import { products, categories, fromPriceCents, type Product } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

type SortKey = "name" | "price" | "purity";
type Filter = "all" | "supplies" | (string & {});

const compounds = products.filter((p) => p.kind === "compound");
const supplies = products.filter((p) => p.kind === "supply");

function purityValue(p: Product): number {
  const n = parseFloat(p.purity);
  return Number.isFinite(n) ? n : 0;
}

function sortList(list: Product[], sort: SortKey): Product[] {
  return [...list].sort((a, b) => {
    if (sort === "price") return fromPriceCents(a) - fromPriceCents(b);
    if (sort === "purity") return purityValue(b) - purityValue(a);
    return a.name.localeCompare(b.name);
  });
}

export default function CataloguePage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of compounds) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, []);

  // Grouped by category when "All compounds" is selected; a chip narrows to one.
  const sections = useMemo(() => {
    if (filter === "supplies") return [];
    const cats = filter === "all" ? categories.filter((c) => c !== "Supplies") : [filter];
    return cats
      .map((cat) => ({ category: cat, items: sortList(compounds.filter((p) => p.category === cat), sort) }))
      .filter((s) => s.items.length > 0);
  }, [filter, sort]);

  const supplyItems = useMemo(() => sortList(supplies, sort), [sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#B87333]">
          RESEARCH COMPOUNDS
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">The catalogue</h1>
        <p className="mt-2 text-muted-foreground">
          {compounds.length} research compounds, German-sourced and batch-documented — every card a
          specification in miniature: purity, method, and batch, up front. For laboratory research
          use only.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All compounds ({compounds.length})
          </Chip>
          {categories
            .filter((c) => c !== "Supplies")
            .map((c) => (
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
            <option value="purity">Purity</option>
          </select>
        </label>
      </div>

      <div className="mb-10 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Chip active={filter === "supplies"} onClick={() => setFilter("supplies")}>
          Lab supplies ({supplies.length})
        </Chip>
        <p className="text-xs text-muted-foreground">
          Diluents, syringes and other consumables — not research compounds.
        </p>
      </div>

      {filter === "supplies" ? (
        <ProductGrid items={supplyItems} />
      ) : (
        <div className="flex flex-col gap-12">
          {sections.map(({ category, items }, i) => (
            <section key={category}>
              {filter === "all" && (
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="font-serif text-xl font-semibold">{category}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
              )}
              <Reveal delay={Math.min(i, 4) * 0.04}>
                <ProductGrid items={items} />
              </Reveal>
            </section>
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
        <ProductCard key={p.slug} product={p} />
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

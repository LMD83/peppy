"use client";

import { useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";

import { getProduct } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { verifyIdFromBatch } from "@/lib/verify";
import { useCart } from "@/lib/cart-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPPER = "#B87333";
const BLUE = "#1565C0";

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const product = getProduct(params.slug);
  const { add } = useCart();

  const [variantLabel, setVariantLabel] = useState(product?.variants[0]?.label ?? "");
  const [coaOpen, setCoaOpen] = useState(false);

  const selectedVariant = useMemo(
    () => product?.variants.find((v) => v.label === variantLabel) ?? product?.variants[0],
    [product, variantLabel]
  );

  if (!product || !selectedVariant) return notFound();

  const verifyId = verifyIdFromBatch(product.batch);

  const provenance = [
    { label: "German supplier", sub: "Lot received · Frankfurt", date: "2026-03-11", color: COPPER },
    { label: "Batch intake", sub: "Logged & quarantined", date: "2026-03-14", color: "#55606E" },
    { label: "HPLC test", sub: `${product.purity} · ${product.method}`, date: "2026-04-11", color: BLUE },
    { label: "Serialised", sub: "Unique QR per vial", date: "2026-04-13", color: "#6A1B9A" },
    { label: "Released", sub: "QA sign-off complete", date: "2026-04-16", color: "#1B5E20" },
    { label: "Dispatch ready", sub: "Cold-chain where required", date: "2026-04-17", color: "#009B72" },
  ];

  const coaRows = [
    { k: "Appearance", v: "White to off-white lyophilised powder", spec: "Conforms" },
    { k: "Identity (MS)", v: "Consistent with reference mass", spec: "Conforms" },
    { k: "Purity (HPLC)", v: product.purity, spec: "≥ 98.0%" },
    { k: "Single impurity (max)", v: "0.31%", spec: "≤ 1.0%" },
    { k: "Water content (KF)", v: "3.8%", spec: "≤ 6.0%" },
    { k: "Acetate content", v: "7.2%", spec: "Report" },
    { k: "Endotoxin (LAL)", v: "< 5 EU/mg", spec: "≤ 10 EU/mg" },
    { k: "Net peptide", v: selectedVariant.label, spec: "Label claim" },
  ];

  function handleAdd() {
    if (!product || !selectedVariant) return;
    add({
      slug: product.slug,
      name: product.name,
      variantLabel: selectedVariant.label,
      unitPriceCents: selectedVariant.priceCents,
      qty: 1,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/catalogue" className="hover:text-foreground">
          Catalogue
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* LEFT column */}
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COPPER }}>
              Research compound · Specification sheet
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight">{product.name}</h1>
            <p className="mt-2 text-lg font-medium" style={{ color: COPPER }}>
              {selectedVariant.label} · {product.format}
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-foreground">
              {product.plain}
            </p>
          </div>

          {/* STACKS callout */}
          <div className="flex items-center gap-3 rounded-md border border-border bg-accent px-4 py-3">
            <span className="rounded-sm border border-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Stacks
            </span>
            <span className="text-sm text-foreground">{product.stacks}</span>
          </div>

          {/* Spec table */}
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="h-1 w-full" style={{ background: product.accent }} />
            <dl className="divide-y divide-border">
              <SpecRow label="Purity (analytical method)">
                <span className="font-semibold text-foreground">
                  {product.purity} ({product.method})
                </span>
              </SpecRow>
              <SpecRow label="Net content">
                <span className="font-semibold text-foreground">
                  {selectedVariant.label}, {product.format}
                </span>
              </SpecRow>
              <SpecRow label="Current batch">
                <Link
                  href={`/verify?id=${verifyId}`}
                  className="font-mono text-sm text-primary hover:underline"
                >
                  {product.batch} — verify ↗
                </Link>
              </SpecRow>
              <SpecRow label="Supplier origin">
                <span className="font-semibold text-foreground">Germany</span>
              </SpecRow>
              <SpecRow label="Release status">
                <span className="rounded-sm border border-primary bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Released
                </span>
              </SpecRow>
              <SpecRow label="Certificate of Analysis">
                <button
                  type="button"
                  onClick={() => setCoaOpen((o) => !o)}
                  className="font-semibold text-primary hover:underline"
                >
                  View COA inline {coaOpen ? "↑" : "↓"}
                </button>
              </SpecRow>
            </dl>

            {coaOpen && (
              <div className="border-t border-border bg-muted/40 px-5 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Certificate of Analysis
                  </span>
                  <span className="rounded-sm border border-primary bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    All pass
                  </span>
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="border-b border-border py-2 pr-4 font-semibold">Parameter</th>
                      <th className="border-b border-border py-2 pr-4 font-semibold">Result</th>
                      <th className="border-b border-border py-2 font-semibold">Specification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaRows.map((row) => (
                      <tr key={row.k} className="align-top">
                        <td className="border-b border-border py-2 pr-4 text-foreground">{row.k}</td>
                        <td className="border-b border-border py-2 pr-4 text-muted-foreground">
                          {row.v}
                        </td>
                        <td className="border-b border-border py-2 font-mono text-xs text-foreground">
                          {row.spec}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Provenance card */}
          <div className="rounded-md border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold">Provenance</h2>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                Supplier → Bench
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-3">
              {provenance.map((node) => (
                <div key={node.label} className="flex flex-col">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: node.color }}
                    />
                    <span className="h-px flex-1" style={{ background: node.color, opacity: 0.4 }} />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{node.date}</span>
                  <span className="mt-1 text-sm font-semibold text-foreground">{node.label}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{node.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reconstitution calculator dark panel */}
          <div className="rounded-md bg-panel p-6 text-panel-foreground">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Reconstitution calculator
            </p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-panel-foreground">
              Work out BAC water volume, dose units on a U-100 syringe, and doses per vial — prefilled
              for {product.name}.
            </p>
            <Link
              href="/calculator"
              className={cn(buttonVariants({ variant: "secondary" }), "mt-5")}
            >
              Open calculator →
            </Link>
          </div>

          {/* Storage & handling */}
          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="font-serif text-2xl font-semibold">Storage &amp; handling</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: BLUE }}>
                  Lyophilised
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  Store at −20 °C, protected from light. Stable for 24 months from manufacture in the
                  original sealed vial.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: BLUE }}>
                  In solution
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  Store at 2–8 °C after reconstitution. Cold-chain dispatch available; see shipping
                  documentation.
                </p>
              </div>
            </div>
          </div>

          {/* Research-use-only bar */}
          <div className="rounded-md bg-panel px-6 py-4">
            <p className="text-sm font-semibold text-panel-foreground">
              For laboratory research use only. Not for human or veterinary use.
            </p>
          </div>
        </div>

        {/* RIGHT rail */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-md border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Strength
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const active = v.label === selectedVariant.label;
                return (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setVariantLabel(v.label)}
                    className={`flex min-w-[76px] flex-col items-start rounded-sm border px-3 py-2 text-left ${
                      active
                        ? "border-primary bg-accent"
                        : "border-input bg-card hover:border-primary"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground">{v.label}</span>
                    <span className="text-xs text-muted-foreground">{formatCents(v.priceCents)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-serif text-4xl font-semibold text-foreground">
                {formatCents(selectedVariant.priceCents)}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedVariant.label} · incl. VAT
              </span>
            </div>

            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <p>Documentation reviewed above · batch {product.batch}</p>
              <p>Dispatch within 24 h of batch confirmation</p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
              <span className="size-2 rounded-full bg-secondary" />
              {product.stock === "low" ? "Low stock" : "In stock — ships today"}
            </div>

            <Button className="mt-5 w-full" size="lg" onClick={handleAdd}>
              Add to order
            </Button>
          </div>

          <p className="mt-4 px-1 text-sm text-muted-foreground">
            Documentation precedes purchase on this page by design: the evidence comes before the buy
            button.
          </p>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

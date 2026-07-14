"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, Printer } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchProducts, type Product } from "@/lib/products";
import { DEFAULT_BAC_ML, calculate } from "@/lib/reconstitution";
import { useSessionLog } from "@/hooks/use-session-log";
import { cn } from "@/lib/utils";

const BAC_PRESETS = [1, 2, 3];

const dateFmt = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function CalculatorPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [variantLabel, setVariantLabel] = useState<string | null>(null);
  const [vialMg, setVialMg] = useState<number>(0);
  const [bacMl, setBacMl] = useState<number>(DEFAULT_BAC_ML);
  const [targetMcg, setTargetMcg] = useState<number>(0);

  const { rows, addRow, removeRow, clearLog } = useSessionLog();

  const results = useMemo(() => (selected ? [] : searchProducts(query)), [query, selected]);

  function pickProduct(p: Product) {
    setSelected(p);
    setQuery(p.name);
    const first = p.variants[0];
    setVariantLabel(first?.label ?? null);
    const mg = parseFloat(first?.label ?? "");
    setVialMg(Number.isFinite(mg) ? mg : 0);
    setBacMl(DEFAULT_BAC_ML);
  }

  function pickVariant(label: string) {
    setVariantLabel(label);
    const mg = parseFloat(label);
    if (Number.isFinite(mg)) setVialMg(mg);
  }

  function clearSelection() {
    setSelected(null);
    setVariantLabel(null);
    setQuery("");
    setVialMg(0);
    setBacMl(DEFAULT_BAC_ML);
    setTargetMcg(0);
  }

  const calc = calculate(vialMg, bacMl, targetMcg);

  function handleAddToLog() {
    if (!calc.valid) return;
    addRow({
      compound: selected?.name ?? "Custom compound",
      reconstitutionSpec: `${vialMg} mg / ${bacMl} mL`,
      units: calc.units,
      drawMl: calc.drawMl,
      drawsPerVial: calc.drawsPerVial,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-secondary">
        RECONSTITUTION CALCULATOR
      </p>
      <h1 className="mb-3 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        Reconstitution, without the guesswork.
      </h1>
      <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Search any compound to load its vial size, then set the bacteriostatic water —{" "}
        <strong className="text-foreground">we recommend 2&nbsp;mL</strong> — and the amount per
        draw. We return the draw on a U-100 syringe, the volume per draw, and draws per vial. Add
        several to build a session log below. A tool, not advice — for laboratory research use
        only.
      </p>

      <div className="grid gap-7 lg:grid-cols-2">
        {/* Inputs */}
        <div className="flex flex-col gap-6 rounded-md border border-border bg-card p-7">
          <div className="relative flex flex-col gap-2">
            <label htmlFor="compound-search" className="text-sm font-semibold">
              Search compound{" "}
              <span className="font-normal text-muted-foreground">— type to load its details</span>
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="compound-search"
                value={query}
                placeholder="Click to browse, or type to narrow…"
                className="pl-9"
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selected) setSelected(null);
                }}
              />
            </div>
            {results.length > 0 && (
              <ul className="absolute top-full z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-input bg-card shadow-lg">
                {results.map((p) => (
                  <li key={p.slug} className="border-b border-muted last:border-0">
                    <button
                      type="button"
                      onClick={() => pickProduct(p)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent"
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-sm"
                        style={{ background: p.accent }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.category} · {p.variants[0]?.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-primary">Load →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <div className="flex items-center gap-2 rounded-sm border border-[#cfe3d6] bg-accent px-3 py-2 text-[13px] text-accent-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Loaded: <strong>{selected.name}</strong>
                <button type="button" onClick={clearSelection} className="ml-auto text-xs underline">
                  Change
                </button>
              </div>
            )}
          </div>

          {selected && selected.variants.length > 1 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">
                Vial strength <span className="font-normal text-muted-foreground">— select an available size</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {selected.variants.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => pickVariant(v.label)}
                    className={cn(
                      "h-[38px] rounded-sm border px-4 text-[13.5px] font-semibold",
                      variantLabel === v.label
                        ? "border-primary bg-accent text-primary"
                        : "border-input bg-card text-foreground"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="vial-mg" className="text-sm font-semibold">
              Peptide in vial <span className="font-normal text-muted-foreground">(mg) — or enter manually</span>
            </label>
            <Input
              id="vial-mg"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              className="font-mono text-base"
              value={vialMg || ""}
              onChange={(e) => setVialMg(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="bac-ml" className="text-sm font-semibold">
              Bacteriostatic water added <span className="font-normal text-muted-foreground">(mL)</span>
            </label>
            <Input
              id="bac-ml"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              className="font-mono text-base"
              value={bacMl || ""}
              onChange={(e) => setBacMl(Number(e.target.value))}
            />
            <div className="mt-0.5 flex gap-2">
              {BAC_PRESETS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => setBacMl(ml)}
                  className="h-8 rounded-full border border-border bg-muted px-3 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {ml} mL
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="target-mcg" className="text-sm font-semibold">
              Amount per draw <span className="font-normal text-muted-foreground">(mcg)</span>
            </label>
            <Input
              id="target-mcg"
              type="number"
              min={0}
              step={25}
              inputMode="decimal"
              className="font-mono text-base"
              value={targetMcg || ""}
              onChange={(e) => setTargetMcg(Number(e.target.value))}
            />
          </div>

          <Button onClick={handleAddToLog} disabled={!calc.valid}>
            + Add to session log
          </Button>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-5">
          <div className="rounded-md bg-panel p-8 text-panel-foreground">
            <span className="text-xs font-semibold tracking-[0.14em] text-secondary">
              DRAW ON A U-100 SYRINGE
            </span>
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="font-serif text-6xl font-semibold leading-none">
                {calc.valid ? calc.units.toFixed(1) : "—"}
              </span>
              <span className="text-lg text-panel-muted">units</span>
            </div>
            <div className="mt-5 flex items-center gap-1.5">
              <div className="relative h-[26px] flex-1 overflow-hidden rounded-sm border border-panel-border bg-[#12263A]">
                <div
                  className="h-full bg-gradient-to-r from-secondary to-[#00b585] transition-[width]"
                  style={{ width: `${calc.fillPct}%` }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.5 font-mono text-[9px] text-panel-muted">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
              <div className="h-2.5 w-4 rounded-r-sm bg-panel-border" />
            </div>
            {calc.overfill && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#e0b44a]">
                Draw exceeds one full U-100 syringe. Add more bacteriostatic water to lower the
                draw, or split into two draws.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <StatCard label="VOLUME / DRAW" value={calc.valid ? `${calc.drawMl.toFixed(3)} mL` : "—"} />
            <StatCard
              label="CONCENTRATION"
              value={calc.valid ? calc.concentrationMcgPerMl.toFixed(0) : "—"}
              unit="mcg/mL"
            />
            <StatCard
              label="DRAWS / VIAL"
              value={calc.valid ? String(calc.drawsPerVial) : "—"}
              tone="primary"
            />
          </div>

          <div className="rounded-md bg-muted p-4 text-[12.5px] leading-relaxed text-muted-foreground">
            A U-100 syringe holds 100 units per mL, so 1 unit = 0.01 mL. Figures are arithmetic
            only and assume complete dissolution.
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-md border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/40 px-6 py-4">
            <span className="text-xs font-bold tracking-[0.1em]">SESSION LOG</span>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="size-3.5" />
                Print / Save PDF
              </Button>
              <button
                type="button"
                onClick={clearLog}
                className="text-xs font-semibold text-destructive hover:underline"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10.5px] tracking-[0.08em] text-muted-foreground">
                  <th className="px-6 py-2.5 font-medium">COMPOUND</th>
                  <th className="px-4 py-2.5 font-medium">RECONSTITUTION</th>
                  <th className="px-4 py-2.5 text-right font-medium">DRAW (U)</th>
                  <th className="px-4 py-2.5 text-right font-medium">VOL (mL)</th>
                  <th className="px-4 py-2.5 text-right font-medium">DRAWS</th>
                  <th className="px-6 py-2.5" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-muted last:border-0">
                    <td className="px-6 py-3 font-semibold">{row.compound}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.reconstitutionSpec}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-primary">
                      {row.units.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {row.drawMl.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {row.drawsPerVial}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        aria-label={`Remove ${row.compound}`}
                        className="text-destructive hover:underline"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-[11px] text-muted-foreground">
            Logged {rows.length > 0 && dateFmt.format(new Date(rows[0].createdAt))} · A U-100
            syringe holds 100 units per mL (1 unit = 0.01 mL). For laboratory research use only —
            not for human or veterinary use.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "primary";
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-5">
      <span className="text-[11.5px] font-semibold tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums",
          tone === "primary" ? "text-primary" : "text-foreground"
        )}
      >
        {value} {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, Beaker } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchPeptides, getPeptide, type Peptide } from "@/lib/peptides";
import {
  DEFAULT_RECONSTITUTION_ML,
  computeConcentration,
  drawTable,
} from "@/lib/reconstitution";
import { usePeptideLog } from "@/hooks/use-peptide-log";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function CalculatorPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vialMg, setVialMg] = useState(0);
  const [volumeMl, setVolumeMl] = useState(DEFAULT_RECONSTITUTION_ML);

  const { entries, addEntry, removeEntry } = usePeptideLog();

  const results = useMemo(() => (selectedId ? [] : searchPeptides(query)), [query, selectedId]);
  const selected: Peptide | undefined = selectedId ? getPeptide(selectedId) : undefined;

  function selectPeptide(p: Peptide) {
    setSelectedId(p.id);
    setVialMg(p.vialMg);
    setVolumeMl(DEFAULT_RECONSTITUTION_ML);
    setQuery(p.name);
  }

  function clearSelection() {
    setSelectedId(null);
    setQuery("");
    setVialMg(0);
    setVolumeMl(DEFAULT_RECONSTITUTION_ML);
  }

  const concentration = computeConcentration(vialMg, volumeMl);
  const table = volumeMl > 0 && vialMg > 0 ? drawTable(vialMg, volumeMl) : [];

  function handleAddToLog() {
    if (!selected || vialMg <= 0 || volumeMl <= 0) return;
    addEntry({
      peptideId: selected.id,
      peptideName: selected.name,
      vialMg,
      volumeMl,
      concentrationMgPerMl: concentration.concentrationMgPerMl,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Reconstitution calculator
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search a compound, set the reconstitution volume, and get the resulting solution
          concentration. We recommend 2&nbsp;mL of bacteriostatic water as a starting point for
          most vials — adjust to match your protocol.
        </p>
      </header>

      <div className="relative">
        <label htmlFor="peptide-search" className="sr-only">
          Search peptides
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="peptide-search"
            value={query}
            placeholder="Start typing a compound name — e.g. BPC-157"
            className="pl-9"
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedId) setSelectedId(null);
            }}
            autoComplete="off"
          />
        </div>

        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-md">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPeptide(p)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.category} · {p.vialMg} mg vial
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <Badge>{selected.category}</Badge>
              </div>
              <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{selected.summary}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Change compound
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">{selected.storage}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vial-mg" className="mb-1.5 block text-sm font-medium">
                Vial strength (mg)
              </label>
              <Input
                id="vial-mg"
                type="number"
                min={0}
                step={0.1}
                value={vialMg}
                onChange={(e) => setVialMg(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="volume-ml" className="mb-1.5 block text-sm font-medium">
                Reconstitution volume (mL of BAC water)
              </label>
              <Input
                id="volume-ml"
                type="number"
                min={0.1}
                step={0.1}
                value={volumeMl}
                onChange={(e) => setVolumeMl(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Default recommendation: {DEFAULT_RECONSTITUTION_ML} mL.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-muted/60 p-4">
            <div className="flex items-baseline gap-2">
              <Beaker className="size-4 text-primary" />
              <span className="text-lg font-semibold tabular-nums">
                {concentration.concentrationMgPerMl.toFixed(3)} mg/mL
              </span>
              <span className="text-sm text-muted-foreground">resulting concentration</span>
            </div>

            {table.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-4">Draw volume</th>
                      <th className="pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {table.map((row) => (
                      <tr key={row.drawMl} className="border-t border-border">
                        <td className="py-1.5 pr-4">{row.drawMl.toFixed(1)} mL</td>
                        <td className="py-1.5">{row.mcg.toLocaleString()} mcg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Button className="mt-5" onClick={handleAddToLog} disabled={vialMg <= 0 || volumeMl <= 0}>
            Add to research log
          </Button>
        </div>
      )}

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Research log</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet — configure a compound above and add it to your log.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{entry.peptideName}</p>
                  <p className={cn("text-xs text-muted-foreground", "tabular-nums")}>
                    {entry.vialMg} mg in {entry.volumeMl} mL ·{" "}
                    {entry.concentrationMgPerMl.toFixed(3)} mg/mL ·{" "}
                    {dateFmt.format(new Date(entry.createdAt))}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${entry.peptideName} from log`}
                  onClick={() => removeEntry(entry.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

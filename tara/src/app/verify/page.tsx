"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";

import { products } from "@/lib/products";
import { verifyIdFromBatch } from "@/lib/pricing";
import { mockBatch } from "@/lib/mock-batch";
import { Button } from "@/components/ui/button";

interface VerifyRecord {
  productName: string;
  batch: string;
  verifyId: string;
}

// Every catalogue item x its variants has a deterministic mock batch, so any
// of them can be "verified" here — standing in for the real verifications
// table in the handoff's convex/verifications.ts.
const REGISTRY: VerifyRecord[] = products.flatMap((p) =>
  p.variants.map((v) => {
    const batch = mockBatch(p.slug, v.label);
    return { productName: `${p.name} (${v.label})`, batch, verifyId: verifyIdFromBatch(batch) };
  })
);

function normalise(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

function lookup(input: string): VerifyRecord | null {
  const target = normalise(input);
  return REGISTRY.find((r) => normalise(r.verifyId) === target) ?? null;
}

function VerifyForm() {
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id");
  const [value, setValue] = useState(idFromUrl ?? "");
  const [manualSubmit, setManualSubmit] = useState<string | null>(null);

  const submitted = manualSubmit ?? idFromUrl;
  const result = submitted ? lookup(submitted) : null;
  const samples = REGISTRY.slice(0, 3);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualSubmit(value);
  }

  return (
    <div className="bg-panel">
      <div className="mx-auto max-w-2xl px-4 py-16 text-panel-foreground">
        <p className="mb-2.5 text-center text-xs font-semibold tracking-[0.2em] text-secondary">
          TARA VERIFY
        </p>
        <h1 className="mb-3.5 text-center font-serif text-4xl font-semibold text-balance">
          Is this vial genuine?
        </h1>
        <p className="mb-10 text-center text-[15.5px] leading-relaxed text-panel-muted">
          Enter the verification ID printed beside the QR code on your vial label. Works without
          login, on any device.
        </p>

        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-panel-border bg-[#12263A] p-8"
        >
          <label htmlFor="verify-id" className="mb-2 block text-sm font-semibold">
            Verification ID
          </label>
          <div className="flex gap-3">
            <input
              id="verify-id"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="TV-XXXX-XXXX-XXXX"
              spellCheck={false}
              className="h-12 flex-1 rounded-sm border border-panel-border bg-panel px-4 font-mono text-base tracking-wide text-panel-foreground outline-none placeholder:text-panel-muted"
            />
            <Button type="submit" className="h-12 bg-secondary px-7 text-panel hover:opacity-90">
              Verify
            </Button>
          </div>
          <p className="mt-2.5 text-xs text-panel-muted">
            Paste with any separators — we tidy it up. Four groups, like TV-XXXX-XXXX-XXXX.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-panel-muted">Try a sample:</span>
            {samples.map((s) => (
              <button
                key={s.verifyId}
                type="button"
                onClick={() => {
                  setValue(s.verifyId);
                  setManualSubmit(s.verifyId);
                }}
                className="rounded-sm border border-panel-border bg-panel px-2.5 py-1.5 font-mono text-[11.5px] text-panel-muted hover:border-secondary hover:text-panel-foreground"
              >
                {s.verifyId}
              </button>
            ))}
          </div>
        </form>

        {submitted && (
          <div className="animate-tara-rise mt-6 overflow-hidden rounded-md border border-panel-border bg-[#12263A]">
            <div className="flex items-center justify-between gap-4 border-b border-panel-border px-7 py-5">
              <span className="text-xs font-semibold tracking-[0.2em] text-panel-muted">
                T A R A · V E R I F Y
              </span>
              {result ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-secondary/20 px-3 py-1.5 text-[13px] font-bold tracking-wide text-secondary">
                  <ShieldCheck className="size-4" /> ALL PASS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-destructive/20 px-3 py-1.5 text-[13px] font-bold tracking-wide text-destructive">
                  <ShieldAlert className="size-4" /> NOT FOUND
                </span>
              )}
            </div>

            {result ? (
              <table className="w-full border-collapse text-[14.5px]">
                <tbody>
                  <Row label="Product" value={result.productName} strong />
                  <Row label="Batch" value={result.batch} mono shaded />
                  <Row label="Verify ID" value={result.verifyId} mono />
                  <Row label="Supplier origin" value="Germany" shaded />
                  <Row label="Release status" value="Released — passed QC" />
                  <Row label="Classification" value="Research use only" shaded />
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col gap-3 p-7">
                <p className="text-[15px] leading-relaxed">
                  This ID is not in our register. Label wear and transcription slips are common —
                  this is not necessarily a counterfeit.
                </p>
                <p className="text-sm leading-relaxed text-panel-muted">
                  Check the ID has four groups, like{" "}
                  <span className="font-mono text-panel-foreground">TV-XXXX-XXXX-XXXX</span>, or
                  email a photo of the label to{" "}
                  <span className="text-secondary">verify@tarapeptides.example</span> and we will
                  check it by hand.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 grid gap-4 text-[13px] leading-relaxed text-panel-muted sm:grid-cols-2">
          <div className="rounded-md border border-panel-border p-5">
            The first scan date and time is recorded and shown — a re-sold or re-labelled vial
            betrays itself.
          </div>
          <div className="rounded-md border border-panel-border p-5">
            A recalled or quarantined batch flips every verification page in that batch to its
            status instantly.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
  shaded,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  shaded?: boolean;
}) {
  return (
    <tr className={shaded ? "bg-[#101f31]" : undefined}>
      <td className="w-56 px-7 py-3 text-panel-muted">{label}</td>
      <td
        className={`px-7 py-3 text-panel-foreground ${mono ? "font-mono" : ""} ${
          strong ? "font-semibold" : ""
        }`}
      >
        {value}
      </td>
    </tr>
  );
}

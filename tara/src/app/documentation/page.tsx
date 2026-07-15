"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { products, isSupply, type Product } from "@/lib/products";
import { Button } from "@/components/ui/button";

const compounds = products.filter((p) => !isSupply(p));

function releasedDate(index: number): string {
  // Deterministic released date, rolling across months so it stays valid.
  const d = new Date(Date.UTC(2026, 2, 10 + index)); // base 2026-03-10 + index days
  return d.toISOString().slice(0, 10);
}

export default function DocumentationPage() {
  function handleDownload(product: Product) {
    toast.success(
      `Demo — the COA for ${product.name} (${product.batch}) would download as a PDF.`
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#1565C0]">DOCUMENTATION</p>
      <h1 className="mb-3 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        Every released batch, on the record.
      </h1>
      <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Each compound ships with a Certificate of Analysis tied to its batch number. Look any of
        them up below, or verify a specific vial from the Verify page.
      </p>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Compound
                </th>
                <th className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Batch
                </th>
                <th className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Purity
                </th>
                <th className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Released
                </th>
                <th className="px-5 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="sr-only">Certificate of Analysis</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {compounds.map((product, index) => (
                <tr key={product.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">
                    {product.name}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-muted-foreground">
                    {product.batch}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                    {product.purity} · {product.method}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-muted-foreground">
                    {releasedDate(index)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(product)}
                      className="text-primary hover:text-primary"
                    >
                      <Download className="size-4" />
                      Download COA
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Certificates are demonstration documents in this build. For laboratory research use only.
      </p>
    </div>
  );
}

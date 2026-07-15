// TARA Verify — login-free batch lookup. Sample records ported from the
// design reference's SAMPLES, plus a deterministic verify ID derived from any
// catalogue product's batch (vidFor in the source).

import { products, getProductById } from "@/lib/products";

export type VerifyStatus = "authentic" | "recalled" | "reused";

export interface VerifyRecord {
  verifyId: string;
  status: VerifyStatus;
  productName: string;
  batch: string;
  serial: string;
  release: string;
  firstScan: string;
  productId: string;
}

export const samples: VerifyRecord[] = [
  {
    verifyId: "TV-8XQ4-KL92-M71P",
    status: "authentic",
    productName: "Tesamorelin 5 mg",
    batch: "G260701",
    serial: "00427",
    release: "Released · 2026-04-12",
    firstScan: "2026-05-02 09:14 UTC",
    productId: "tesamorelin",
  },
  {
    verifyId: "TV-2RN7-BC55-Q80D",
    status: "authentic",
    productName: "Ipamorelin 5 mg",
    batch: "G260713",
    serial: "01180",
    release: "Released · 2026-04-19",
    firstScan: "2026-05-11 16:40 UTC",
    productId: "ipamorelin",
  },
  {
    verifyId: "TV-9WZ1-TT34-X02K",
    status: "recalled",
    productName: "BPC-157 10 mg",
    batch: "G260590",
    serial: "00061",
    release: "Quarantined · recall R-2026-03",
    firstScan: "2026-03-28 11:02 UTC",
    productId: "bpc157",
  },
  {
    verifyId: "TV-5HJ8-PP19-N44V",
    status: "reused",
    productName: "CJC-1295 2 mg",
    batch: "G260734",
    serial: "00902",
    release: "Released · 2026-04-22",
    firstScan: "2026-05-06 08:20 UTC",
    productId: "cjc1295",
  },
];

/** Deterministic verify ID from a batch number — mirrors `vidFor` in the source. */
export function verifyIdFromBatch(batch: string): string {
  const d = (batch || "").replace(/\D/g, "").padEnd(6, "0");
  return `TV-${d.slice(0, 4)}-${d.slice(4, 6)}K${d.slice(0, 2)}-${d.slice(2, 4)}V${d.slice(4, 6)}`;
}

function normalise(input: string): string {
  return input.trim().toUpperCase().replace(/[\s]+/g, "");
}

export function lookupVerify(input: string): VerifyRecord | null {
  const target = normalise(input);
  const sample = samples.find((s) => normalise(s.verifyId) === target);
  if (sample) return sample;
  // Otherwise, any catalogue product's derived verify ID resolves as authentic.
  const product = products.find((p) => normalise(verifyIdFromBatch(p.batch)) === target);
  if (product) {
    return {
      verifyId: verifyIdFromBatch(product.batch),
      status: "authentic",
      productName: `${product.name} ${product.variants[0]?.label ?? ""}`.trim(),
      batch: product.batch,
      serial: "0" + product.batch.replace(/\D/g, "").slice(-4),
      release: "Released · passed QC",
      firstScan: "—",
      productId: product.id,
    };
  }
  return null;
}

export function verifyProductName(record: VerifyRecord): string {
  return getProductById(record.productId)?.name ?? record.productName;
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    SumUpCard?: {
      mount: (options: {
        id: string;
        checkoutId: string;
        onResponse: (type: "success" | "error" | "invalid" | "expired", body: unknown) => void;
      }) => void;
      unmount: (id: string) => void;
    };
  }
}

const SDK_SRC = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";

function loadSumUpSdk(): Promise<void> {
  if (window.SumUpCard) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load SumUp SDK")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load SumUp SDK"));
    document.head.appendChild(script);
  });
}

export function SumUpWidget({
  checkoutId,
  onResponse,
}: {
  checkoutId: string;
  onResponse: (type: "success" | "error" | "invalid" | "expired", body: unknown) => void;
}) {
  const mountId = useId().replace(/[:]/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSumUpSdk()
      .then(() => {
        if (cancelled || !window.SumUpCard) return;
        window.SumUpCard.mount({ id: mountId, checkoutId, onResponse });
      })
      .catch(() => {
        if (!cancelled) setError("Card payment is temporarily unavailable — please try again shortly.");
      });
    return () => {
      cancelled = true;
      window.SumUpCard?.unmount(mountId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-mounting on every onResponse identity change would remount the card widget mid-input
  }, [checkoutId, mountId]);

  if (error) {
    return <p className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>;
  }

  return <div id={mountId} ref={containerRef} className="sumup-card-widget" />;
}

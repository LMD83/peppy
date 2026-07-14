"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { mockBatch } from "@/lib/mock-batch";

export interface CartLine {
  /** Stable identity: product slug + variant label. */
  id: string;
  slug: string;
  name: string;
  variantLabel: string;
  unitPriceCents: number;
  qty: number;
  /** Mock batch number — a real backend assigns this at fulfilment. */
  batch: string;
}

export interface AddToCartInput {
  slug: string;
  name: string;
  variantLabel: string;
  unitPriceCents: number;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  add: (input: AddToCartInput) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "tara-cart-v1";

function lineId(slug: string, variantLabel: string): string {
  return `${slug}__${variantLabel}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage hydration is a legitimate post-mount state sync
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      // Ignore malformed storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage may be unavailable (private mode); fail silently.
    }
  }, [lines, hydrated]);

  const add = useCallback((input: AddToCartInput) => {
    const id = lineId(input.slug, input.variantLabel);
    setLines((prev) => {
      const existing = prev.find((l) => l.id === id);
      if (existing) {
        return prev.map((l) => (l.id === id ? { ...l, qty: l.qty + input.qty } : l));
      }
      return [
        ...prev,
        {
          id,
          slug: input.slug,
          name: input.name,
          variantLabel: input.variantLabel,
          unitPriceCents: input.unitPriceCents,
          qty: input.qty,
          batch: mockBatch(input.slug, input.variantLabel),
        },
      ];
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? { ...l, qty } : l))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.qty, 0);
    const subtotalCents = lines.reduce((sum, l) => sum + l.qty * l.unitPriceCents, 0);
    return { lines, count, subtotalCents, add, setQty, remove, clear };
  }, [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

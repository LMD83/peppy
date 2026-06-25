"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { SUBSCRIBE_DISCOUNT } from "@/lib/products"

export interface CartLine {
  /** Stable identity for a configured line: handle + flavour + purchase type */
  id: string
  handle: string
  name: string
  flavour: string
  subscribe: boolean
  qty: number
  /** Unit price after any subscribe discount, in EUR */
  unitPrice: number
  /** oklch gradient stops for the line thumbnail */
  accent: [string, string]
}

export interface AddToCartInput {
  handle: string
  name: string
  flavour: string
  subscribe: boolean
  qty: number
  basePrice: number
  accent: [string, string]
}

interface CartContextValue {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (input: AddToCartInput) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = "peppy-cart-v1"

function lineId(handle: string, flavour: string, subscribe: boolean): string {
  return `${handle}__${flavour}__${subscribe ? "sub" : "one"}`
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Load persisted cart once on mount. Loading in an effect (rather than a lazy
  // useState initializer) is deliberate: server and client both first render an
  // empty cart, so there's no hydration mismatch — the stored cart is applied
  // immediately after hydration.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage hydration is a legitimate post-mount state sync
      if (raw) setLines(JSON.parse(raw) as CartLine[])
    } catch {
      // Ignore malformed storage.
    }
    setHydrated(true)
  }, [])

  // Persist on change (after initial hydration).
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Storage may be unavailable (private mode); fail silently.
    }
  }, [lines, hydrated])

  const add = useCallback((input: AddToCartInput) => {
    const id = lineId(input.handle, input.flavour, input.subscribe)
    const unitPrice = input.subscribe
      ? input.basePrice * SUBSCRIBE_DISCOUNT
      : input.basePrice
    setLines((prev) => {
      const existing = prev.find((l) => l.id === id)
      if (existing) {
        return prev.map((l) =>
          l.id === id ? { ...l, qty: l.qty + input.qty } : l
        )
      }
      return [
        ...prev,
        {
          id,
          handle: input.handle,
          name: input.name,
          flavour: input.flavour,
          subscribe: input.subscribe,
          qty: input.qty,
          unitPrice,
          accent: input.accent,
        },
      ]
    })
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, qty } : l))
    )
  }, [])

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.qty, 0)
    const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
    return { lines, count, subtotal, add, setQty, remove, clear }
  }, [lines, add, setQty, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}

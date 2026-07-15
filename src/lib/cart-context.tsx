"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useMutation, useQuery } from "convex/react"

import { api } from "@convex/_generated/api"

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
  accent: string[]
}

export interface AddToCartInput {
  handle: string
  name: string
  flavour: string
  subscribe: boolean
  qty: number
  basePrice: number
  accent: string[]
}

interface CartContextValue {
  lines: CartLine[]
  count: number
  subtotal: number
  loading: boolean
  sessionId: string | null
  add: (input: AddToCartInput) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = "peppy-session-id"

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, created)
  return created
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null)

  // The session id identifies this browser's cart in Convex. It's generated
  // client-side (no server cookie) so it must wait for mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session id read from localStorage is a legitimate post-mount state sync
    setSessionId(getOrCreateSessionId())
  }, [])

  const lines: CartLine[] | undefined = useQuery(
    api.cart.get,
    sessionId ? { sessionId } : "skip"
  )

  const addMutation = useMutation(api.cart.add)
  const setQtyMutation = useMutation(api.cart.setQty)
  const removeMutation = useMutation(api.cart.remove)
  const clearMutation = useMutation(api.cart.clear)

  const add = useCallback(
    (input: AddToCartInput) => {
      if (!sessionId) return
      void addMutation({ sessionId, ...input })
    },
    [sessionId, addMutation]
  )

  const setQty = useCallback(
    (id: string, qty: number) => {
      if (!sessionId) return
      void setQtyMutation({ sessionId, id, qty })
    },
    [sessionId, setQtyMutation]
  )

  const remove = useCallback(
    (id: string) => {
      if (!sessionId) return
      void removeMutation({ sessionId, id })
    },
    [sessionId, removeMutation]
  )

  const clear = useCallback(() => {
    if (!sessionId) return
    void clearMutation({ sessionId })
  }, [sessionId, clearMutation])

  const value = useMemo<CartContextValue>(() => {
    const resolved = lines ?? []
    const count = resolved.reduce((sum, l) => sum + l.qty, 0)
    const subtotal = resolved.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
    return {
      lines: resolved,
      count,
      subtotal,
      loading: lines === undefined,
      sessionId,
      add,
      setQty,
      remove,
      clear,
    }
  }, [lines, sessionId, add, setQty, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}

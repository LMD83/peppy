"use client"

import { ConvexClientProvider } from "@/components/convex-client-provider"
import { CartProvider } from "@/lib/cart-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <CartProvider>{children}</CartProvider>
    </ConvexClientProvider>
  )
}

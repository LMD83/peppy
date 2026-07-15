"use client";

import { Toaster } from "sonner";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { CommandPaletteProvider } from "@/components/command-palette";
import { SmoothScroll } from "@/components/smooth-scroll";
import { CartProvider } from "@/lib/cart-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <CartProvider>
        <CommandPaletteProvider>
          <SmoothScroll>{children}</SmoothScroll>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--card)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
              },
            }}
          />
        </CommandPaletteProvider>
      </CartProvider>
    </ConvexClientProvider>
  );
}

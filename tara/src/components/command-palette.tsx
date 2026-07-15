"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import {
  Beaker,
  Calculator,
  CalendarClock,
  ScanLine,
  ShoppingBag,
  Store,
} from "lucide-react";

import { products } from "@/lib/products";
import { formatCents } from "@/lib/pricing";
import { useCart } from "@/lib/cart-context";

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

const navigationItems = [
  { label: "Research Compounds", href: "/catalogue", icon: Store },
  { label: "Reconstitution Calculator", href: "/calculator", icon: Calculator },
  { label: "Verify a batch", href: "/verify", icon: ScanLine },
  { label: "Research Schedule", href: "/schedule", icon: CalendarClock },
];

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { count } = useCart();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  function go(href: string) {
    router.push(href);
    close();
  }

  const value = useMemo(() => ({ open, close, toggle }), [open, close, toggle]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        label="Search TARA"
        overlayClassName="fixed inset-0 z-[100] bg-panel/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out"
        contentClassName="fixed left-1/2 top-[18vh] z-[101] w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-md border border-border bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Beaker className="size-4 shrink-0 text-muted-foreground" />
          <CommandInput
            placeholder="Search compounds, or jump to a page…"
            className="h-14 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>
        <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
              No matches — try a compound name or category.
            </CommandEmpty>

            <CommandGroup heading="Navigate" className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1.5">
              {navigationItems.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => go(item.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <item.icon className="size-4 shrink-0 text-primary" />
                  {item.label}
                </CommandItem>
              ))}
              {count > 0 && (
                <CommandItem
                  value="Checkout order"
                  onSelect={() => go("/checkout")}
                  className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <ShoppingBag className="size-4 shrink-0 text-primary" />
                  Checkout · {count} item{count === 1 ? "" : "s"}
                </CommandItem>
              )}
            </CommandGroup>

            <CommandSeparator className="my-1 h-px bg-border" />

            <CommandGroup heading="Compounds" className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1.5">
              {products.filter((p) => p.kind === "compound").map((p) => (
                <CommandItem
                  key={p.slug}
                  value={`${p.name} ${p.category}`}
                  onSelect={() => go(`/products/${p.slug}`)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <span>
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatCents(p.variants[0]?.priceCents ?? 0)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator className="my-1 h-px bg-border" />

            <CommandGroup heading="Lab supplies" className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1.5">
              {products.filter((p) => p.kind === "supply").map((p) => (
                <CommandItem
                  key={p.slug}
                  value={`${p.name} ${p.category}`}
                  onSelect={() => go(`/products/${p.slug}`)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <span>
                    <span className="font-medium text-foreground">{p.name}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatCents(p.variants[0]?.priceCents ?? 0)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}

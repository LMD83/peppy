"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, ShoppingBag } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { PeppyMark } from "@/components/icons"
import { AnnouncementBar } from "@/components/announcement-bar"
import { useCart } from "@/lib/cart-context"
import { collections } from "@/lib/products"
import { cn } from "@/lib/utils"

const navLinks = [
  ...collections
    .filter((c) => c.slug !== "bundles")
    .map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
  { href: "/collections/bundles", label: "Bundles" },
  { href: "/learn", label: "Learn" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { count } = useCart()

  return (
    <header className="sticky top-0 z-50 bg-background">
      <AnnouncementBar />
      <div className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-lg font-bold tracking-tight"
          >
            <PeppyMark className="size-6 text-primary" />
            Peppy
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/cart"
              aria-label={`Cart${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "relative"
              )}
            >
              <ShoppingBag />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {open && (
          <nav className="border-t md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col px-4 py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}

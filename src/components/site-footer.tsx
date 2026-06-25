import Link from "next/link"

import { PeppyMark } from "@/components/icons"
import { collections } from "@/lib/products"

const footerNav = [
  {
    title: "Shop",
    links: collections.map((c) => ({
      href: `/collections/${c.slug}`,
      label: c.name,
    })),
  },
  {
    title: "Learn",
    links: [
      { href: "/learn", label: "Guides & articles" },
      { href: "/pages/quality", label: "Quality & testing" },
      { href: "/pages/about", label: "About Peppy" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/pages/shipping-returns", label: "Shipping & returns" },
      { href: "/pages/faq", label: "FAQ" },
      { href: "/pages/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/pages/terms", label: "Terms" },
      { href: "/pages/privacy", label: "Privacy" },
      { href: "/pages/disclaimer", label: "Disclaimer" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-lg font-bold tracking-tight"
            >
              <PeppyMark className="size-6 text-primary" />
              Peppy
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Irish-made sports nutrition. Informed-Sport tested, shipped
              next-day across Ireland.
            </p>
          </div>

          {footerNav.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Peppy. Irish-owned.</p>
          <p className="max-w-xl">
            Food supplements should not be used as a substitute for a varied,
            balanced diet and healthy lifestyle.
          </p>
        </div>
      </div>
    </footer>
  )
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { ShoppingBag, ScanLine, Command, User } from "lucide-react";
import { Authenticated, Unauthenticated } from "convex/react";

import { LogoLockup } from "@/components/logo-mark";
import { useCart } from "@/lib/cart-context";
import { useCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/catalogue", label: "Research Compounds" },
  { href: "/verify", label: "Verify" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/documentation", label: "Documentation" },
  { href: "/stacks", label: "Stacks" },
  { href: "/calculator", label: "Calculator" },
];

export function SiteHeader() {
  const { count } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const { open: openPalette } = useCommandPalette();
  const [verifyId, setVerifyId] = useState("");
  const [scrolled, setScrolled] = useState(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const activeEl = navRef.current?.querySelector<HTMLAnchorElement>('[data-active="true"]');
    if (activeEl) {
      setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
    } else {
      setIndicator(null);
    }
  }, [pathname]);

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const id = verifyId.trim();
    router.push(id ? `/verify?id=${encodeURIComponent(id)}` : "/verify");
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl transition-shadow duration-300",
        scrolled ? "border-border shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_8px_30px_-12px_rgba(13,27,42,0.15)]" : "border-transparent"
      )}
    >
      <div className="mx-auto flex min-h-[72px] max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" aria-label="TARA Peptides home" className="shrink-0">
          <LogoLockup />
        </Link>

        <nav
          ref={navRef}
          className="relative hidden flex-1 items-center justify-center gap-0.5 lg:flex"
        >
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={cn(
                  "flex h-10 items-center whitespace-nowrap px-2.5 text-[13.5px] font-medium transition-colors",
                  active ? "text-primary" : "text-foreground hover:text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {indicator && (
            <motion.span
              className="pointer-events-none absolute bottom-0 h-[2px] bg-primary"
              animate={{ left: indicator.left, width: indicator.width }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Search compounds"
          className="hidden size-9 items-center justify-center rounded-sm border border-input bg-muted/50 text-muted-foreground hover:border-primary hover:text-primary xl:inline-flex"
        >
          <Command className="size-4" />
        </button>

        <Authenticated>
          <Link
            href="/account"
            className="hidden h-9 items-center gap-1.5 rounded-sm px-2 text-sm font-medium text-foreground hover:text-primary sm:inline-flex"
          >
            <User className="size-4" />
            Account
          </Link>
        </Authenticated>
        <Unauthenticated>
          <Link
            href="/signin"
            className="hidden h-9 items-center px-2 text-sm font-medium text-foreground hover:text-primary sm:inline-flex"
          >
            Sign in
          </Link>
        </Unauthenticated>

        {count > 0 && (
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/checkout"
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-primary bg-accent px-4 text-[13px] font-semibold text-primary hover:bg-accent/70"
            >
              <ShoppingBag className="size-4" />
              Order · {count}
            </Link>
          </motion.div>
        )}

        <form
          onSubmit={handleVerify}
          className="hidden h-10 items-stretch overflow-hidden rounded-sm border border-primary bg-card sm:flex"
        >
          <span className="flex items-center pl-2.5 pr-1 text-primary">
            <ScanLine className="size-4" />
          </span>
          <input
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value)}
            placeholder="Verify a batch…"
            spellCheck={false}
            aria-label="Verify a batch by ID"
            className="w-[130px] bg-transparent px-2 font-mono text-xs text-foreground outline-none xl:w-[150px]"
          />
          <button
            type="submit"
            className="bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            Verify
          </button>
        </form>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { ShoppingBag, ScanLine, Command, User } from "lucide-react";
import { Authenticated, Unauthenticated } from "convex/react";

import { LogoMark } from "@/components/logo-mark";
import { useCart } from "@/lib/cart-context";
import { useCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/catalogue", label: "Research Compounds" },
  { href: "/verify", label: "Verify" },
  { href: "/calculator", label: "Calculator" },
  { href: "/schedule", label: "Schedule" },
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
      <div className="mx-auto flex min-h-[72px] max-w-6xl flex-wrap items-center gap-5 px-4 py-2">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark className="h-9 w-9 shrink-0" />
          <span className="flex flex-col items-start leading-none">
            <span className="font-serif text-lg font-semibold tracking-[0.22em] text-primary">
              TARA
            </span>
            <span className="mt-0.5 text-[9px] font-semibold tracking-[0.32em] text-muted-foreground">
              PEPTIDES
            </span>
          </span>
        </Link>

        <nav ref={navRef} className="relative flex flex-1 items-center gap-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={cn(
                  "flex h-10 items-center px-3 text-sm font-medium transition-colors",
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

        <button
          type="button"
          onClick={openPalette}
          className="hidden h-9 items-center gap-2 rounded-sm border border-input bg-muted/50 px-3 text-xs text-muted-foreground hover:border-primary hover:text-primary sm:inline-flex"
        >
          Search compounds…
          <span className="ml-1 inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
            <Command className="size-2.5" />K
          </span>
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
          className="flex h-11 items-stretch overflow-hidden rounded-sm border border-primary bg-card"
        >
          <span className="flex items-center pl-3 pr-1 text-primary">
            <ScanLine className="size-4" />
          </span>
          <input
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value)}
            placeholder="Verify a batch — TV-XXXX…"
            spellCheck={false}
            aria-label="Verify a batch by ID"
            className="w-[180px] bg-transparent px-2 font-mono text-xs text-foreground outline-none"
          />
          <button
            type="submit"
            className="bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            Verify
          </button>
        </form>
      </div>
    </header>
  );
}

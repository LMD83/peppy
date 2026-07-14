"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, ScanLine } from "lucide-react";

import { LogoMark } from "@/components/logo-mark";
import { useCart } from "@/lib/cart-context";

const nav = [
  { href: "/catalogue", label: "Research Compounds" },
  { href: "/verify", label: "Verify" },
  { href: "/calculator", label: "Calculator" },
];

export function SiteHeader() {
  const { count } = useCart();
  const router = useRouter();
  const [verifyId, setVerifyId] = useState("");

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const id = verifyId.trim();
    router.push(id ? `/verify?id=${encodeURIComponent(id)}` : "/verify");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
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

        <nav className="flex flex-1 items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="h-10 border-b-2 border-transparent px-3 text-sm font-medium text-foreground transition-colors hover:text-primary hover:border-primary/40 flex items-center"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {count > 0 && (
          <Link
            href="/checkout"
            className="inline-flex h-11 items-center gap-2 rounded-sm border border-primary bg-accent px-4 text-[13px] font-semibold text-primary hover:bg-accent/70"
          >
            <ShoppingBag className="size-4" />
            Order · {count}
          </Link>
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

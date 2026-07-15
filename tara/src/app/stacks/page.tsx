"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { getStacks } from "@/lib/stacks";
import { formatCents } from "@/lib/pricing";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";

export default function StacksPage() {
  const stacks = getStacks();
  const { add } = useCart();
  const router = useRouter();
  const [addedKey, setAddedKey] = useState<string | null>(null);

  function handleAddStack(stack: ReturnType<typeof getStacks>[number]) {
    for (const item of stack.items) {
      const variant = item.variants[0];
      if (!variant) continue;
      add({
        slug: item.slug,
        name: item.name,
        variantLabel: variant.label,
        unitPriceCents: variant.priceCents,
        qty: 1,
      });
    }
    setAddedKey(stack.key);
    setTimeout(() => router.push("/checkout"), 600);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-secondary">STACK LIBRARY</p>
      <h1 className="mb-3 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        Researched stacks, bundled.
      </h1>
      <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Six compound pairings researched together, at a bundle price — each about 8% below buying
        the items separately.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {stacks.map((stack) => (
          <div key={stack.key} className="overflow-hidden rounded-md border border-border bg-card">
            <div className="h-1.5 w-full" style={{ background: stack.accent }} aria-hidden="true" />
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold">{stack.name}</h2>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-muted-foreground">
                  {stack.tag}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{stack.note}</p>

              <ul className="space-y-1.5 text-sm">
                {stack.items.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/products/${item.slug}`} className="text-foreground hover:text-primary hover:underline">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-baseline gap-2 border-t border-border pt-4">
                <span className="font-mono text-sm text-muted-foreground line-through">
                  {formatCents(stack.rawCents)}
                </span>
                <span className="font-serif text-2xl font-semibold text-primary">
                  {formatCents(stack.bundleCents)}
                </span>
                <span className="text-xs text-muted-foreground">
                  save {formatCents(stack.saveCents)}
                </span>
              </div>

              <Button onClick={() => handleAddStack(stack)} className="w-full">
                {addedKey === stack.key ? (
                  <>
                    <CheckCircle2 className="size-4" /> Added — going to checkout…
                  </>
                ) : (
                  "Add stack to order"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Bundle price is computed live from current catalogue pricing (~8% off buying the items
        separately) — not a fixed, separately quoted price. For laboratory research use only.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

import { faqs } from "@/lib/faqs";

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-secondary">FAQ</p>
      <h1 className="mb-10 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        Frequently asked questions.
      </h1>

      <div className="divide-y divide-border rounded-md border border-border bg-card">
        {faqs.map((faq, i) => {
          const open = openIndex === i;
          return (
            <div key={faq.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-semibold">{faq.q}</span>
                {open ? (
                  <Minus className="size-4 shrink-0 text-primary" />
                ) : (
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {open && (
                <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

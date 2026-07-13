import Link from "next/link";
import { ArrowRight, FlaskConical, ShieldCheck, NotebookPen } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pillars = [
  {
    icon: ShieldCheck,
    title: "Verified by lot",
    body: "Every batch ships with a Certificate of Analysis you can look up before you open the box.",
  },
  {
    icon: FlaskConical,
    title: "Built for research",
    body: "Every product page states purity, molecular data and storage conditions — no vague claims.",
  },
  {
    icon: NotebookPen,
    title: "A calculator that remembers",
    body: "Reconstitute correctly, log every vial, and keep a running record across your research.",
  },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-5">
            <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Laboratory &amp; research use only
            </span>
            <h1 className="text-4xl font-serif font-semibold tracking-tight sm:text-5xl">
              Research peptides, handled properly.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Verified compounds, transparent documentation, and the reconstitution calculator
              researchers actually bookmark.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalogue" className={cn(buttonVariants({ size: "lg" }))}>
                Browse the catalogue
                <ArrowRight />
              </Link>
              <Link href="/calculator" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                Open the calculator
              </Link>
            </div>
          </div>
          <div className="hidden aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/25 to-secondary/20 lg:block" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <Icon className="mb-3 size-6 text-primary" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

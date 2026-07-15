import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";

const columns: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: "EXPLORE",
    links: [
      { label: "Research Compounds", href: "/catalogue" },
      { label: "Verify a batch", href: "/verify" },
      { label: "Knowledge Centre", href: "/knowledge" },
      { label: "Documentation", href: "/documentation" },
      { label: "Reconstitution calculator", href: "/calculator" },
      { label: "Find by goal", href: "/finder" },
      { label: "Stack library", href: "/stacks" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "TRUST",
    links: [
      { label: "German sourcing", href: "/knowledge" },
      { label: "Batch documentation", href: "/documentation" },
      { label: "QR verification", href: "/verify" },
      { label: "Cold-chain dispatch", href: "/documentation" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-panel text-panel-foreground">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <span className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8 shrink-0" />
              <span className="flex flex-col items-start leading-none">
                <span className="font-serif text-base font-bold tracking-[0.22em] text-panel-foreground">
                  TARA
                </span>
                <span className="mt-1 text-[8px] font-semibold tracking-[0.3em] text-panel-muted">
                  PEPTIDES
                </span>
              </span>
            </span>
            <p className="mt-4 font-serif text-[15px] italic text-panel-foreground">
              Ancient wisdom. Modern science.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-panel-muted">
              German-sourced research compounds, documented and verifiable. We explain; we do not
              persuade.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-panel-muted">
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] text-panel-foreground/85 transition-colors hover:text-secondary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-panel-muted">
              CONTACT
            </p>
            <ul className="space-y-2.5 text-[13.5px] text-panel-foreground/85">
              <li>verify@tara.ie</li>
              <li>support@tara.ie</li>
              <li>Ireland · EU dispatch</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-panel-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-[12px] text-panel-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 TARA Peptides. For laboratory research use only. Not for human or veterinary use.</p>
          <p className="font-mono tracking-wide">EU · ISO-aligned QA</p>
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TARA — Research Peptides, Handled Properly",
    template: "%s | TARA",
  },
  description:
    "TARA is a research-use peptide platform: verified compounds, a reconstitution calculator, and a research log — built for laboratory use, not consumer dosing.",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/calculator", label: "Calculator" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="flex min-h-screen flex-col font-sans">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-xl font-semibold tracking-tight">TARA</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                research-use peptides
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted-foreground">
            <p className="max-w-2xl">
              All products are sold for laboratory and research use only, are not for human or
              veterinary use, and are not drugs, dietary supplements, or cosmetics. Nothing on
              this site is dosing guidance.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

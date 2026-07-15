import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";
import { PageTransition } from "@/components/page-transition";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "TARA Peptides — Research-Grade Transparency, Verified",
    template: "%s | TARA Peptides",
  },
  description:
    "German-sourced research compounds, supported by batch documentation, QR authentication, and scientific education. For laboratory research use only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        className={`${playfair.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <body className="flex min-h-screen flex-col font-sans">
          <Providers>
            <SiteHeader />
            <main className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
            <footer className="border-t border-border bg-card">
              <div className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted-foreground">
                <p className="max-w-2xl font-medium">
                  For laboratory research use only. Not for human or veterinary use.
                </p>
                <p className="mt-2">© 2026 TARA Peptides.</p>
              </div>
            </footer>
          </Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}

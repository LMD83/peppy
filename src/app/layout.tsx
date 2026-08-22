import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const disp = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-tm-disp-var",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-tm-mono-var",
  display: "swap",
});
const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-tm-sans-var",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Peppy · performance file",
    template: "%s | Peppy",
  },
  description: "Two-person performance file: checks, modes, experiments, evidence.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1318" },
    { color: "#18201d" },
  ],
};

export default function TimentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE" className={`${disp.variable} ${mono.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-tm-paper font-tm-sans text-tm-ink antialiased">
        {children}
      </body>
    </html>
  );
}

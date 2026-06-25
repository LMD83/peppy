import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://peppy.ie"),
  title: {
    default: "Peppy | Irish-Made Sports Nutrition, Informed-Sport Tested",
    template: "%s | Peppy",
  },
  description:
    "Irish-made sports nutrition delivered next-day across Ireland. Informed-Sport tested protein, creatine and pre-workout at honest, transparent prices. No customs, no waiting.",
  keywords: [
    "sports nutrition Ireland",
    "protein powder Ireland",
    "whey protein Ireland",
    "creatine Ireland",
    "pre workout Ireland",
    "Informed Sport",
  ],
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "Peppy",
    title: "Peppy | Irish-Made Sports Nutrition",
    description:
      "Informed-Sport tested protein, creatine and pre-workout. Next-day delivery across Ireland.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IE"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

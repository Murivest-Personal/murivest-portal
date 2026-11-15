import type {Metadata, Viewport} from "next";
import {Playfair_Display, Inter} from "next/font/google";
import "./globals.css";
import {Toaster} from "@/components/ui/toaster";
import {COMPANY} from "@/lib/constants";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY.siteUrl),
  title: {
    default: "Murivest Private Capital Portal — Institutional & UHNWI Investment Workspace",
    template: "%s · Murivest Private Capital Portal",
  },
  description:
    "Murivest Group's private capital allocation platform for UHNWIs, family offices and institutional investors: off-market commercial real estate and alternative assets across East Africa, the UK and international markets, with institutional-grade underwriting, capital-structure analysis and mandate-only execution.",
  keywords: [
    "private commercial real estate investment",
    "off-market institutional opportunities",
    "capital allocation platform",
    "family office real estate",
    "UHNWI investment platform",
    "institutional investment briefs",
    "direct real estate investing",
    "co-investment alternative to private equity real estate",
    "Nairobi commercial property investment",
    "London commercial real estate",
    "East Africa Grade A assets",
    "Murivest Group",
  ],
  authors: [{name: COMPANY.legalName}],
  applicationName: "Murivest Private Capital Portal",
  robots: {index: true, follow: true},
  openGraph: {
    title: "Murivest Private Capital Portal",
    description:
      "Discover, analyse, structure and execute commercial real estate and alternative investments with institutional-grade intelligence and off-market access. Private, mandate-only, fiduciary standard.",
    url: COMPANY.siteUrl,
    siteName: "Murivest Group",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Murivest Private Capital Portal",
    description:
      "Private capital allocation workspace for UHNWIs, family offices and institutional investors.",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0E2A1C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

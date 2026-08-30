import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Absolute base for social image URLs.
 *
 * Without it Next resolves og:image against localhost and the share card is
 * dead everywhere but this machine. Vercel supplies the production host on its
 * own, and per-deployment previews get their own; NEXT_PUBLIC_SITE_URL wins so
 * the real domain can be set once it is pointed at the project.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Advanced React Three Fiber — PMNDRS workshop, Paris, Sep 8–9 2026",
  description:
    "Two days in Paris: one day learning React Three Fiber v10 and the pmndrs ecosystem, one day building with it. Thirty seats, at Gobelins, alongside three.js conf.",
  openGraph: {
    title: "Advanced React Three Fiber — PMNDRS workshop, Paris",
    description:
      "September 8 & 9, 2026 · Gobelins, Paris. One teaching day, one build day. Thirty seats.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Dark-only by design — there is no theme toggle, so the class is fixed.
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

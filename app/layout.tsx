import type { Metadata } from "next";
import { EB_Garamond, Shippori_Mincho } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-garamond",
  display: "swap",
});

const mincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mincho",
  display: "swap",
});

// Vercel injects the production domain at build time, so the social-card URLs
// stay correct without hard-coding a guess at the deploy hostname.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Erfolg — 読書記録",
  description: "羊皮紙に綴る、読書の記録。",
  openGraph: {
    title: "Erfolg — 読書記録",
    description: "羊皮紙に綴る、読書の記録。",
    type: "website",
    locale: "ja_JP",
    siteName: "Erfolg",
  },
  twitter: {
    card: "summary_large_image",
    title: "Erfolg — 読書記録",
    description: "羊皮紙に綴る、読書の記録。",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${garamond.variable} ${mincho.variable}`}>
      <body>{children}</body>
    </html>
  );
}

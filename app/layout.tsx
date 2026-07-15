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

export const metadata: Metadata = {
  title: "Erfolg — 読書記録",
  description: "羊皮紙に綴る、読書の記録。",
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

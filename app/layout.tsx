import type { Metadata } from "next";
import { EB_Garamond, Shippori_Mincho } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import {
  getAllBooks,
  getCategories,
  getTsundoku,
  getTsundokuCategories,
} from "@/lib/books";
import { getNoteCategories } from "@/lib/notes";
import { AppShell } from "@/components/AppShell";

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
  title: "Erfolg-Forge — 読書記録",
  description: "羊皮紙に綴る、読書の記録。",
  openGraph: {
    title: "Erfolg-Forge — 読書記録",
    description: "羊皮紙に綴る、読書の記録。",
    type: "website",
    locale: "ja_JP",
    siteName: "Erfolg-Forge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Erfolg-Forge — 読書記録",
    description: "羊皮紙に綴る、読書の記録。",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only the fields the sidebars render — passing whole Book objects would ship
  // every article body to the client on every page.
  const books = getAllBooks().map((b) => ({
    slug: b.slug,
    title: b.title,
    author: b.author,
    category: b.category,
    articles: b.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      dateRead: a.dateRead,
      rating: a.rating,
    })),
  }));

  // Same reasoning: only the fields the NOTEBOOK tree renders, never the bodies.
  const noteCategories = getNoteCategories().map((c) => ({
    name: c.name,
    notes: c.notes.map((n) => ({
      category: n.category,
      slug: n.slug,
      title: n.title,
      date: n.date,
    })),
  }));

  // 積読 is private (content/tsundoku.md is gitignored), so the right sidebar
  // exists only locally — and its data is never sent to a published page.
  const showTsundoku = process.env.NODE_ENV !== "production";

  // Authoring writes to the working tree — local dev only.
  const notesEditable = process.env.NODE_ENV !== "production";

  return (
    <html lang="ja" className={`${garamond.variable} ${mincho.variable}`}>
      <body>
        <AppShell
          books={books}
          categories={getCategories()}
          noteCategories={noteCategories}
          notesEditable={notesEditable}
          tsundoku={showTsundoku ? getTsundoku() : []}
          tsundokuCategories={showTsundoku ? getTsundokuCategories() : []}
          showTsundoku={showTsundoku}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

import Link from "next/link";
import { getAllBooks, getCategories, getTsundoku } from "@/lib/books";
import { TsundokuAuthor } from "@/components/TsundokuAuthor";

export const metadata = {
  title: "積んでる本 — Erfolg",
};

export default function TsundokuPage() {
  const books = getTsundoku();
  const categories = getCategories().map((c) => c.name);
  // Only the fields the form needs — not whole Book objects with their articles.
  const existingBooks = getAllBooks().map((b) => ({
    slug: b.slug,
    title: b.title,
    author: b.author,
    category: b.category,
  }));
  // Authoring writes files to the working tree — local dev only.
  const editable = process.env.NODE_ENV !== "production";

  return (
    <main className="container">
      <Link href="/" className="back-link">
        ← 一覧へ
      </Link>

      <h1 className="site-title" style={{ fontSize: "2.4rem" }}>
        積んでる本
      </h1>
      <p className="site-subtitle">To Read（{books.length}）</p>

      {editable && books.length > 0 && (
        <p className="tbr-hint">
          各本の「✎ 記事化」から読書記録を作成できます（ローカル環境のみ）。
        </p>
      )}

      <TsundokuAuthor
        books={books}
        existingBooks={existingBooks}
        categories={categories}
        editable={editable}
      />
    </main>
  );
}

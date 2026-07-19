import Link from "next/link";
import { getAllArticles, getAllBooks, getCategories, getTsundoku } from "@/lib/books";
import { BookTree } from "@/components/BookTree";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { TsundokuList } from "@/components/TsundokuList";
import { AddRecord } from "@/components/AddRecord";

export default function Home({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const active = searchParams.category;
  const categories = getCategories();
  const allBooks = getAllBooks();
  const books = allBooks.filter((b) => !active || b.category === active);
  const articles = getAllArticles();
  const tsundoku = getTsundoku();
  const editable = process.env.NODE_ENV !== "production";

  return (
    <main className="container">
      <h1 className="site-title">Erfolg</h1>
      <p className="site-subtitle">Reading Records</p>

      <AddRecord
        books={allBooks.map((b) => ({
          slug: b.slug,
          title: b.title,
          author: b.author,
          category: b.category,
        }))}
        categories={categories.map((c) => c.name)}
        editable={editable}
      />

      <ActivityHeatmap articles={articles} />

      <h2 className="section-title">CATEGORY</h2>
      <div className="categories">
        <Link href="/" className="chip" data-active={!active}>
          すべて
        </Link>
        {categories.map((c) => (
          <Link
            key={c.name}
            href={`/?category=${encodeURIComponent(c.name)}`}
            className="chip"
            data-active={active === c.name}
          >
            {c.name}（{c.count}）
          </Link>
        ))}
      </div>

      {/* Both counts, because a book can hold several articles — a single
          number here would contradict the heatmap's article total. */}
      <h2 className="section-title">
        {active ? active : "BOOKS"}（{books.length}冊 ・{" "}
        {books.reduce((n, b) => n + b.articles.length, 0)}記事）
      </h2>
      <BookTree books={books} />

      {tsundoku.length > 0 && (
        <>
          <h2 className="section-title">積んでる本（{tsundoku.length}）</h2>
          <TsundokuList books={tsundoku.slice(0, 6)} />
          <Link href="/tsundoku" className="see-all">
            すべて見る →
          </Link>
        </>
      )}
    </main>
  );
}

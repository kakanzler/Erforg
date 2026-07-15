import Link from "next/link";
import { getAllBooks, getCategories, getTsundoku } from "@/lib/books";
import { BookList } from "@/components/BookList";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { TsundokuList } from "@/components/TsundokuList";

export default function Home({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const active = searchParams.category;
  const categories = getCategories();
  const allBooks = getAllBooks();
  const books = allBooks.filter((b) => !active || b.category === active);
  const tsundoku = getTsundoku();

  return (
    <main className="container">
      <h1 className="site-title">Erfolg</h1>
      <p className="site-subtitle">Reading Records</p>

      <ActivityHeatmap books={allBooks} />

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

      <h2 className="section-title">
        {active ? active : "ALL RECORDS"}（{books.length}）
      </h2>
      <BookList books={books} />

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

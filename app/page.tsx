import Link from "next/link";
import { getAllBooks, getCategories } from "@/lib/books";
import { BookList } from "@/components/BookList";

export default function Home({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const active = searchParams.category;
  const categories = getCategories();
  const books = getAllBooks().filter(
    (b) => !active || b.category === active
  );

  return (
    <main className="container">
      <h1 className="site-title">Erfolg</h1>
      <p className="site-subtitle">Reading Records</p>

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
    </main>
  );
}

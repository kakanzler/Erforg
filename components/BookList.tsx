import Link from "next/link";
import type { Book } from "@/lib/books";
import { Stars } from "./Stars";
import { formatReadDate } from "@/lib/books";

export function BookList({ books }: { books: Book[] }) {
  if (books.length === 0) {
    return <p className="empty-note">まだ記録がありません。</p>;
  }
  return (
    <ul className="book-list">
      {books.map((b) => (
        <li key={b.slug} className="book-row">
          <div className="book-row-main">
            <Link href={`/books/${b.slug}`}>
              <div className="book-row-title">{b.title}</div>
            </Link>
            <div className="book-row-meta">
              {b.author} ・ {b.category}
              {b.dateRead ? ` ・ ${formatReadDate(b.dateRead)}` : ""}
            </div>
            {b.tags.length > 0 && (
              <div className="tags">
                {b.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Stars rating={b.rating} />
        </li>
      ))}
    </ul>
  );
}

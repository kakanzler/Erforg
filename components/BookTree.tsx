import Link from "next/link";
import type { Book } from "@/lib/books";
import { Stars } from "./Stars";

/** "2026-05-11" → "2026.05.11" (compact form for tree rows). */
function shortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Two-level tree: a book row, with its article rows nested beneath it. */
export function BookTree({ books }: { books: Book[] }) {
  if (books.length === 0) {
    return <p className="empty-note">まだ記録がありません。</p>;
  }

  return (
    <ul className="tree">
      {books.map((book) => (
        <li key={book.slug} className="tree-node">
          <Link href={`/books/${book.slug}`} className="tree-book">
            <span className="tree-book-mark" aria-hidden="true">
              ▸
            </span>
            <span className="tree-book-main">
              <span className="tree-book-title">{book.title}</span>
              <span className="tree-book-meta">
                {[book.author, book.category].filter(Boolean).join(" ・ ")}
              </span>
            </span>
          </Link>

          {book.articles.length === 0 ? (
            <p className="tree-empty">記事なし</p>
          ) : (
            <ul className="tree-articles">
              {book.articles.map((a, i) => (
                <li key={a.slug} className="tree-article-item">
                  <Link
                    href={`/books/${book.slug}/${a.slug}`}
                    className="tree-article"
                  >
                    <span className="tree-connector" aria-hidden="true">
                      {i === book.articles.length - 1 ? "└" : "├"}
                    </span>
                    <span className="tree-article-title">{a.title}</span>
                    <span className="tree-article-meta">
                      {shortDate(a.dateRead)}
                      {a.rating > 0 && <Stars rating={a.rating} />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

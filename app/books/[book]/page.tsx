import Link from "next/link";
import { notFound } from "next/navigation";
import { formatReadDate, getAllBooks, getBook } from "@/lib/books";
import { Stars } from "@/components/Stars";
import { MarkdownView } from "@/components/MarkdownView";

export function generateStaticParams() {
  return getAllBooks().map((b) => ({ book: b.slug }));
}

export function generateMetadata({ params }: { params: { book: string } }) {
  const book = getBook(params.book);
  return { title: book ? `${book.title} — Erfolg-Forge` : "Erfolg-Forge" };
}

export default function BookPage({ params }: { params: { book: string } }) {
  const book = getBook(params.book);
  if (!book) notFound();

  return (
    <main className="container">
      <Link href="/" className="back-link">
        ← 一覧へ
      </Link>

      <article className="record">
        <header className="record-header">
          <h1 className="record-title">{book.title}</h1>
          <div className="record-sub">
            {[book.author, book.category].filter(Boolean).join(" ・ ")}
          </div>
          {book.tags.length > 0 && (
            <div className="tags" style={{ justifyContent: "center" }}>
              {book.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        {book.content.trim() && (
          <div className="record-body">
            <MarkdownView>{book.content}</MarkdownView>
          </div>
        )}

        <h2 className="section-title">記事（{book.articles.length}）</h2>
        {book.articles.length === 0 ? (
          <p className="empty-note">まだ記事がありません。</p>
        ) : (
          <ul className="article-list">
            {book.articles.map((a) => (
              <li key={a.slug} className="article-row">
                <Link
                  href={`/books/${book.slug}/${a.slug}`}
                  className="article-row-main"
                >
                  <span className="article-row-title">{a.title}</span>
                  <span className="article-row-meta">
                    {formatReadDate(a.dateRead)}
                  </span>
                </Link>
                <Stars rating={a.rating} />
              </li>
            ))}
          </ul>
        )}
      </article>
    </main>
  );
}

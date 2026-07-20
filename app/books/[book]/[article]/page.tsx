import Link from "next/link";
import { notFound } from "next/navigation";
import { formatReadDate, getAllBooks, getArticle, getBook } from "@/lib/books";
import { Stars } from "@/components/Stars";
import { MarkdownView } from "@/components/MarkdownView";
import { EditRecord } from "@/components/EditRecord";

export function generateStaticParams() {
  return getAllBooks().flatMap((b) =>
    b.articles.map((a) => ({ book: b.slug, article: a.slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { book: string; article: string };
}) {
  const article = getArticle(params.book, params.article);
  return { title: article ? `${article.title} — Erfolg-Forge` : "Erfolg-Forge" };
}

export default function ArticlePage({
  params,
}: {
  params: { book: string; article: string };
}) {
  const book = getBook(params.book);
  const article = getArticle(params.book, params.article);
  if (!book || !article) notFound();

  // Editing writes to the working tree — local dev only.
  const editable = process.env.NODE_ENV !== "production";

  return (
    <main className="container">
      <Link href={`/books/${book.slug}`} className="back-link">
        ← {book.title}へ
      </Link>

      <article className="record">
        <header className="record-header">
          <div className="record-book">
            {[book.title, book.author].filter(Boolean).join(" ・ ")}
          </div>
          <h1 className="record-title">{article.title}</h1>
          <div className="record-sub">
            {book.category}
            {article.dateRead ? ` ・ ${formatReadDate(article.dateRead)}` : ""}
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <Stars rating={article.rating} />
          </div>
          {article.tags.length > 0 && (
            <div className="tags" style={{ justifyContent: "center" }}>
              {article.tags.map((t) => (
                <Link key={t} href={`/tags/${encodeURIComponent(t)}`} className="tag">
                  {t}
                </Link>
              ))}
            </div>
          )}
        </header>

        <EditRecord
          bookSlug={book.slug}
          articleSlug={article.slug}
          editable={editable}
        />

        <div className="record-body">
          <MarkdownView>{article.content}</MarkdownView>
        </div>
      </article>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllBooks, getArticle, getBook, getCategories } from "@/lib/books";
import { RecordForm } from "@/components/RecordForm";
import { buildReferences } from "../../../references";

export const metadata = {
  title: "記事を編集 — Erfolg-Forge",
};

/** 既存の読書記録の編集ページ。 */
export default function EditRecordPage({
  params,
}: {
  params: { book: string; article: string };
}) {
  // Authoring writes files into the working tree — local dev only.
  if (process.env.NODE_ENV === "production") notFound();

  // Japanese slugs arrive percent-encoded; the getters already match either form.
  const book = getBook(params.book);
  const article = getArticle(params.book, params.article);
  if (!book || !article) notFound();

  const href = `/books/${encodeURIComponent(book.slug)}/${encodeURIComponent(
    article.slug
  )}`;

  return (
    <main className="container-wide">
      <Link href={href} className="back-link">
        ← {article.title}へ
      </Link>

      <h1 className="edit-title">記事を編集</h1>
      <p className="edit-lead">
        {[book.title, book.author].filter(Boolean).join(" ・ ")}
      </p>

      <RecordForm
        books={getAllBooks().map((b) => ({
          slug: b.slug,
          title: b.title,
          author: b.author,
          category: b.category,
        }))}
        categories={getCategories().map((c) => c.name)}
        references={buildReferences()}
        editBookSlug={book.slug}
        editSlug={article.slug}
        initialTitle={article.title}
        initialAuthor={book.author}
        initialCategory={book.category}
        initialRating={article.rating}
        initialDateRead={article.dateRead}
        initialTags={article.tags.join(", ")}
        initialBody={article.content}
        cancelHref={href}
      />
    </main>
  );
}

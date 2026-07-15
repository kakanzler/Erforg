import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatReadDate, getAllBooks, getBook } from "@/lib/books";
import { Stars } from "@/components/Stars";

export function generateStaticParams() {
  return getAllBooks().map((b) => ({ slug: b.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const book = getBook(params.slug);
  return { title: book ? `${book.title} — Erfolg` : "Erfolg" };
}

export default function BookPage({ params }: { params: { slug: string } }) {
  const book = getBook(params.slug);
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
            {book.author} ・ {book.category}
            {book.dateRead ? ` ・ ${formatReadDate(book.dateRead)}` : ""}
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <Stars rating={book.rating} />
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

        <div className="record-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {book.content}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { formatReadDate } from "@/lib/books";
import { formatNoteDate } from "@/lib/notes";
import { getAllTags, getTagged } from "@/lib/tags";

export function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: t.name }));
}

/** The route param arrives percent-encoded for Japanese tags. */
function displayTag(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    // Keep the raw param when it is not valid percent-encoding.
    return param;
  }
}

export function generateMetadata({ params }: { params: { tag: string } }) {
  return { title: `${displayTag(params.tag)} — Erfolg-Forge` };
}

export default function TagPage({ params }: { params: { tag: string } }) {
  const { books, articles, notes } = getTagged(params.tag);
  if (books.length === 0 && articles.length === 0 && notes.length === 0) {
    notFound();
  }

  const tag = displayTag(params.tag);

  return (
    <main className="container">
      <Link href="/tags" className="back-link">
        ← タグ一覧へ
      </Link>

      <article className="record">
        <header className="record-header">
          <div className="record-book">TAG</div>
          <h1 className="record-title">{tag}</h1>
        </header>

        {books.length > 0 && (
          <>
            <h2 className="section-title">本（{books.length}）</h2>
            <ul className="article-list">
              {books.map((b) => (
                <li key={b.slug} className="article-row">
                  <Link href={`/books/${b.slug}`} className="article-row-main">
                    <span className="article-row-title">{b.title}</span>
                    <span className="article-row-meta">
                      {[b.author, b.category].filter(Boolean).join(" ・ ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {articles.length > 0 && (
          <>
            <h2 className="section-title">記事（{articles.length}）</h2>
            <ul className="article-list">
              {articles.map((a) => (
                <li key={`${a.bookSlug}/${a.slug}`} className="article-row">
                  <Link
                    href={`/books/${a.bookSlug}/${a.slug}`}
                    className="article-row-main"
                  >
                    <span className="article-row-title">{a.title}</span>
                    <span className="article-row-meta">
                      {[a.bookTitle, formatReadDate(a.dateRead)]
                        .filter(Boolean)
                        .join(" ・ ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {notes.length > 0 && (
          <>
            <h2 className="section-title">ノート（{notes.length}）</h2>
            <ul className="article-list">
              {notes.map((n) => (
                <li key={`${n.category}/${n.slug}`} className="article-row">
                  <Link
                    href={`/notes/${encodeURIComponent(
                      n.category
                    )}/${encodeURIComponent(n.slug)}`}
                    className="article-row-main"
                  >
                    <span className="article-row-title">{n.title}</span>
                    <span className="article-row-meta">
                      {[n.category, formatNoteDate(n.date)]
                        .filter(Boolean)
                        .join(" ・ ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </main>
  );
}

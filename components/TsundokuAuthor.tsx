"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { TbrBook } from "@/lib/books";
import { Modal } from "./Modal";

// The form pulls in react-markdown + KaTeX for its live preview; load it only
// when a book is actually being turned into a record (never on the public page).
const RecordForm = dynamic(
  () => import("./RecordForm").then((m) => m.RecordForm),
  { ssr: false }
);

// Below this many books the list is short enough to scan by eye.
const FILTER_THRESHOLD = 8;

/** Fold width and case so 「ﾊﾟｲｿﾝ」/「Python」/「python」 all match alike. */
function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/**
 * 積読リスト。ローカル開発時(editable)は各行から記事を作成でき、作成すると
 * その本は積読から消え、content/books にMDが生成される。
 */
export function TsundokuAuthor({
  books,
  categories,
  editable,
}: {
  books: TbrBook[];
  categories: string[];
  editable: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Keep each book's index in the *original* list — openIndex refers to that,
  // so filtering must not renumber the rows.
  const shown = useMemo(() => {
    const rows = books.map((book, index) => ({ book, index }));
    const q = norm(query.trim());
    if (!q) return rows;
    return rows.filter(
      ({ book }) =>
        norm(book.title).includes(q) || norm(book.author ?? "").includes(q)
    );
  }, [books, query]);

  if (books.length === 0) return null;

  const openBook = openIndex !== null ? books[openIndex] : null;
  const filtering = query.trim().length > 0;

  return (
    <>
      {books.length > FILTER_THRESHOLD && (
        <div className="tbr-filter">
          <input
            className="tbr-filter-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・著者で絞り込む"
            aria-label="積読を絞り込む"
          />
          <span className="tbr-count">
            {filtering ? `${books.length}件中 ${shown.length}件` : `${books.length}件`}
          </span>
        </div>
      )}

      <ul className="tbr-list">
        {shown.map(({ book: b, index: i }) => (
          <li key={`${b.title}-${i}`} className="tbr-item-wrap">
            <div className="tbr-item">
              <span className="tbr-title">{b.title}</span>
              {b.author && <span className="tbr-author">{b.author}</span>}
              {editable && (
                <button
                  className="tbr-create"
                  onClick={() => {
                    setCreated(null);
                    setOpenIndex(i);
                  }}
                >
                  ✎ 記事化
                </button>
              )}
            </div>
          </li>
        ))}

        {filtering && shown.length === 0 && (
          <li className="tbr-empty">該当する本がありません。</li>
        )}

        {editable && openBook && (
          <Modal onClose={() => setOpenIndex(null)}>
            <RecordForm
              initialTitle={openBook.title}
              initialAuthor={openBook.author}
              sourceTitle={openBook.title}
              categories={categories}
              onCancel={() => setOpenIndex(null)}
              onDone={(slug) => {
                setOpenIndex(null);
                setCreated(slug);
              }}
            />
          </Modal>
        )}

        {created && (
          <li className="tbr-created-note">
            記録を作成しました →{" "}
            <Link href={`/books/${created}`} className="see-all">
              {created} を見る
            </Link>
          </li>
        )}
      </ul>
    </>
  );
}

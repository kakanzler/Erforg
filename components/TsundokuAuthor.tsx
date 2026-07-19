"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TbrBook } from "@/lib/books";

// Below this many books the list is short enough to scan by eye.
const FILTER_THRESHOLD = 8;

/** Fold width and case so 「ﾊﾟｲｿﾝ」/「Python」/「python」 all match alike. */
function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/**
 * 積読リスト。ローカル開発時(editable)は各行から /edit/record へ移動して
 * 読書記録を書ける。保存するとその本は積読から消え、content/books にMDが生成される。
 */
export function TsundokuAuthor({
  books,
  editable,
}: {
  books: TbrBook[];
  editable: boolean;
}) {
  const [query, setQuery] = useState("");

  // Each row keeps its index in the *original* list, so filtering never
  // renumbers the rows.
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
                <Link
                  className="tbr-create"
                  href={`/edit/record?from=${encodeURIComponent(b.title)}`}
                >
                  ✎ 記事化
                </Link>
              )}
            </div>
          </li>
        ))}

        {filtering && shown.length === 0 && (
          <li className="tbr-empty">該当する本がありません。</li>
        )}
      </ul>
    </>
  );
}

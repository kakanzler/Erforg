"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { TbrBook } from "@/lib/books";

// The form pulls in react-markdown + KaTeX for its live preview; load it only
// when a book is actually being turned into a record (never on the public page).
const RecordForm = dynamic(
  () => import("./RecordForm").then((m) => m.RecordForm),
  { ssr: false }
);

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

  if (books.length === 0) return null;

  return (
    <ul className="tbr-list">
      {books.map((b, i) => (
        <li key={`${b.title}-${i}`} className="tbr-item-wrap">
          <div className="tbr-item">
            <span className="tbr-title">{b.title}</span>
            {b.author && <span className="tbr-author">{b.author}</span>}
            {editable && openIndex !== i && (
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
          {editable && openIndex === i && (
            <RecordForm
              initialTitle={b.title}
              initialAuthor={b.author}
              sourceTitle={b.title}
              categories={categories}
              onCancel={() => setOpenIndex(null)}
              onDone={(slug) => {
                setOpenIndex(null);
                setCreated(slug);
              }}
            />
          )}
        </li>
      ))}
      {created && (
        <li className="tbr-created-note">
          記録を作成しました →{" "}
          <Link href={`/books/${created}`} className="see-all">
            {created} を見る
          </Link>
        </li>
      )}
    </ul>
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import type { BookOption } from "./RecordForm";

// Loaded only when the form is opened, so the public bundle stays light.
const RecordForm = dynamic(
  () => import("./RecordForm").then((m) => m.RecordForm),
  { ssr: false }
);

/**
 * Per-record "edit" entry point on the book page.
 * Local dev only — the button and form never render in production.
 */
export function EditRecord({
  bookSlug,
  book,
  books,
  categories,
  editable,
}: {
  /** 編集中の記事が属している本の slug（フォルダ名）。 */
  bookSlug: string;
  /** 編集対象の記事。`slug` は記事の slug。 */
  book: {
    slug: string;
    title: string;
    author: string;
    category: string;
    rating: number;
    dateRead: string;
    tags: string[];
    content: string;
  };
  /** 既存の本の一覧。別の本へ付け替えるために渡す。 */
  books: BookOption[];
  categories: string[];
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!editable) return null;

  return (
    <div className="edit-record">
      <button className="add-record-btn" onClick={() => setOpen(true)}>
        ✎ 編集
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <RecordForm
            books={books}
            editBookSlug={bookSlug}
            editSlug={book.slug}
            initialTitle={book.title}
            initialAuthor={book.author}
            initialCategory={book.category}
            initialRating={book.rating}
            initialDateRead={book.dateRead}
            initialTags={book.tags.join(", ")}
            initialBody={book.content}
            categories={categories}
            onCancel={() => setOpen(false)}
            onDone={(r) => {
              setOpen(false);
              // RecordForm already called router.refresh(); a rename or a move to
              // another book changes the URL, so navigate to the new one.
              if (r.bookSlug !== bookSlug || r.slug !== book.slug) {
                router.push(`/books/${r.bookSlug}/${r.slug}`);
              } else {
                router.refresh();
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

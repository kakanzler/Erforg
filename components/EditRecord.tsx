"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

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
  book,
  categories,
  editable,
}: {
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
            onDone={(slug) => {
              setOpen(false);
              // RecordForm already called router.refresh(); a rename needs a move.
              if (slug !== book.slug) router.push(`/books/${slug}`);
              else router.refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

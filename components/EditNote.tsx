"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

// Loaded only when the form is opened, so the public bundle stays light.
const NoteForm = dynamic(() => import("./NoteForm").then((m) => m.NoteForm), {
  ssr: false,
});

/**
 * Per-note "edit" entry point on the note page.
 * Local dev only — the button and form never render in production.
 */
export function EditNote({
  categories,
  note,
  editable,
}: {
  /** 既存のノートカテゴリ一覧。別のカテゴリへ付け替えるために渡す。 */
  categories: string[];
  note: {
    category: string;
    slug: string;
    title: string;
    date: string;
    tags: string[];
    content: string;
  };
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
          <NoteForm
            categories={categories}
            editCategory={note.category}
            editSlug={note.slug}
            initialTitle={note.title}
            initialDate={note.date}
            initialTags={note.tags.join(", ")}
            initialBody={note.content}
            onCancel={() => setOpen(false)}
            onDone={(r) => {
              setOpen(false);
              // NoteForm already called router.refresh(); a rename or a move to
              // another category changes the URL, so navigate to the new one.
              if (r.category !== note.category || r.slug !== note.slug) {
                router.push(
                  `/notes/${encodeURIComponent(r.category)}/${encodeURIComponent(r.slug)}`
                );
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

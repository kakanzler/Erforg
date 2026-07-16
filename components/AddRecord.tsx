"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Modal } from "./Modal";

// Loaded only when the form is opened, so the (empty) public bundle stays light.
const RecordForm = dynamic(
  () => import("./RecordForm").then((m) => m.RecordForm),
  { ssr: false }
);

/**
 * Top-page "add a record" entry point for books not in the 積読 list.
 * Local dev only — the button and form never render in production.
 */
export function AddRecord({
  categories,
  editable,
}: {
  categories: string[];
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  if (!editable) return null;

  return (
    <div className="add-record">
      <button className="add-record-btn" onClick={() => { setCreated(null); setOpen(true); }}>
        ＋ 記事を追加
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <RecordForm
            categories={categories}
            onCancel={() => setOpen(false)}
            onDone={(slug) => {
              setOpen(false);
              setCreated(slug);
            }}
          />
        </Modal>
      )}
      {created && (
        <p className="tbr-created-note">
          記録を作成しました →{" "}
          <Link href={`/books/${created}`} className="see-all">
            {created} を見る
          </Link>
        </p>
      )}
    </div>
  );
}

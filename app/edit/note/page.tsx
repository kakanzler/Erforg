import Link from "next/link";
import { notFound } from "next/navigation";
import { getNoteCategories } from "@/lib/notes";
import { NoteForm } from "@/components/NoteForm";
import { buildReferences } from "../references";

export const metadata = {
  title: "ノートを作成 — Erfolg-Forge",
};

/** NOTEBOOK ノートの新規作成ページ。 */
export default function NewNotePage() {
  // Authoring writes files into the working tree — local dev only.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="container-wide">
      <Link href="/" className="back-link">
        ← 一覧へ
      </Link>

      <h1 className="edit-title">ノートを作成</h1>
      <p className="edit-lead">NOTEBOOK</p>

      <NoteForm
        categories={getNoteCategories().map((c) => c.name)}
        references={buildReferences()}
        cancelHref="/"
      />
    </main>
  );
}

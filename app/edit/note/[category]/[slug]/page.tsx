import Link from "next/link";
import { notFound } from "next/navigation";
import { getNote, getNoteCategories } from "@/lib/notes";
import { NoteForm } from "@/components/NoteForm";
import { buildReferences } from "../../../references";

export const metadata = {
  title: "ノートを編集 — Erfolg-Forge",
};

/** 既存の NOTEBOOK ノートの編集ページ。 */
export default function EditNotePage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  // Authoring writes files into the working tree — local dev only.
  if (process.env.NODE_ENV === "production") notFound();

  // Japanese categories/slugs arrive percent-encoded; getNote matches either form.
  const note = getNote(params.category, params.slug);
  if (!note) notFound();

  const href = `/notes/${encodeURIComponent(note.category)}/${encodeURIComponent(
    note.slug
  )}`;

  return (
    <main className="container-wide">
      <Link href={href} className="back-link">
        ← {note.title}へ
      </Link>

      <h1 className="edit-title">ノートを編集</h1>
      <p className="edit-lead">NOTEBOOK ・ {note.category}</p>

      <NoteForm
        categories={getNoteCategories().map((c) => c.name)}
        references={buildReferences()}
        editCategory={note.category}
        editSlug={note.slug}
        initialTitle={note.title}
        initialDate={note.date}
        initialTags={note.tags.join(", ")}
        initialBody={note.content}
        cancelHref={href}
      />
    </main>
  );
}

import { notFound } from "next/navigation";
import { formatNoteDate, getNote, getNoteCategories } from "@/lib/notes";
import { MarkdownView } from "@/components/MarkdownView";
import { EditNote } from "@/components/EditNote";

export function generateStaticParams() {
  return getNoteCategories().flatMap((c) =>
    c.notes.map((n) => ({ category: c.name, slug: n.slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const note = getNote(params.category, params.slug);
  return { title: note ? `${note.title} — Erfolg` : "Erfolg" };
}

export default function NotePage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const note = getNote(params.category, params.slug);
  if (!note) notFound();

  // Editing writes to the working tree — local dev only.
  const editable = process.env.NODE_ENV !== "production";

  return (
    <main className="container">
      <article className="record">
        <header className="record-header">
          <div className="record-book">NOTEBOOK</div>
          <h1 className="record-title">{note.title}</h1>
          <div className="record-sub">
            {note.category}
            {note.date ? ` ・ ${formatNoteDate(note.date)}` : ""}
          </div>
          {note.tags.length > 0 && (
            <div className="tags" style={{ justifyContent: "center" }}>
              {note.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        <EditNote
          categories={getNoteCategories().map((c) => c.name)}
          note={{
            category: note.category,
            slug: note.slug,
            title: note.title,
            date: note.date,
            tags: note.tags,
            content: note.content,
          }}
          editable={editable}
        />

        <div className="record-body">
          <MarkdownView>{note.content}</MarkdownView>
        </div>
      </article>
    </main>
  );
}

import { getAllBooks } from "@/lib/books";
import { getNoteCategories } from "@/lib/notes";
import type { ReferenceItem } from "@/components/EditSplit";

/**
 * Everything already written, as titles + ids for the 参照 picker: all articles
 * grouped under their book, then all notes grouped under their category.
 *
 * Deliberately body-free — the bodies are fetched one at a time from
 * /api/content, so an edit page does not ship the whole site to the client.
 */
export function buildReferences(): ReferenceItem[] {
  const records: ReferenceItem[] = getAllBooks().flatMap((b) =>
    b.articles.map((a) => ({
      id: `record:${b.slug}/${a.slug}`,
      kind: "record" as const,
      parent: b.slug,
      slug: a.slug,
      group: b.title,
      title: a.title,
      href: `/books/${encodeURIComponent(b.slug)}/${encodeURIComponent(a.slug)}`,
    }))
  );

  const notes: ReferenceItem[] = getNoteCategories().flatMap((c) =>
    c.notes.map((n) => ({
      id: `note:${c.name}/${n.slug}`,
      kind: "note" as const,
      parent: c.name,
      slug: n.slug,
      group: `NOTEBOOK ・ ${c.name}`,
      title: n.title,
      href: `/notes/${encodeURIComponent(c.name)}/${encodeURIComponent(n.slug)}`,
    }))
  );

  return [...records, ...notes];
}

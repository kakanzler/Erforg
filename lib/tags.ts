import { getAllBooks, type Article, type Book } from "@/lib/books";
import { getAllNotes, type Note } from "@/lib/notes";

/** Route params for non-ASCII tags can arrive percent-encoded; match either form. */
function tagMatches(candidate: string, param: string): boolean {
  if (candidate === param) return true;
  try {
    return candidate === decodeURIComponent(param);
  } catch {
    return false;
  }
}

export type TagCount = { name: string; count: number };

export type TaggedItems = {
  books: Book[];
  articles: Article[];
  notes: Note[];
};

/** Every tag-carrying item across the three sources, in one flat list. */
function allTagLists(): string[][] {
  const books = getAllBooks();
  return [
    ...books.map((b) => b.tags),
    ...books.flatMap((b) => b.articles.map((a) => a.tags)),
    ...getAllNotes().map((n) => n.tags),
  ];
}

/**
 * Distinct tags across books, articles and notes with the number of items
 * carrying each, most used first (ties broken by name).
 */
export function getAllTags(): TagCount[] {
  const counts = new Map<string, number>();
  for (const tags of allTagLists()) {
    // An item listing the same tag twice must still only count once.
    for (const tag of new Set(tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) =>
      b.count === a.count ? a.name.localeCompare(b.name, "ja") : b.count - a.count
    );
}

/** Every book, article and note carrying `tag` (which may be percent-encoded). */
export function getTagged(tag: string): TaggedItems {
  const books = getAllBooks();
  const has = (tags: string[]) => tags.some((t) => tagMatches(t, tag));

  return {
    books: books.filter((b) => has(b.tags)),
    // Newest read first, matching how articles are listed everywhere else.
    articles: books
      .flatMap((b) => b.articles)
      .filter((a) => has(a.tags))
      .sort((a, b) => (a.dateRead < b.dateRead ? 1 : -1)),
    notes: getAllNotes().filter((n) => has(n.tags)),
  };
}

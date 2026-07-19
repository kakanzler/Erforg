import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BOOKS_DIR = path.join(process.cwd(), "content", "books");
const TSUNDOKU_FILE = path.join(process.cwd(), "content", "tsundoku.md");

/** The `_book.md` inside a book folder holds the book-level metadata. */
const BOOK_META_FILE = "_book.md";

/** YAML may parse `2026-06-20` as a Date; normalize any value to YYYY-MM-DD. */
function normalizeDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Route params for non-ASCII slugs can arrive percent-encoded; match either form. */
function slugMatches(candidate: string, param: string): boolean {
  if (candidate === param) return true;
  try {
    return candidate === decodeURIComponent(param);
  } catch {
    return false;
  }
}

export type Article = {
  bookSlug: string;
  /** Denormalized from the parent book, so a flat article list can name it. */
  bookTitle: string;
  slug: string;
  title: string;
  dateRead: string; // ISO date, e.g. "2026-06-20"
  rating: number; // 0-5
  tags: string[];
  content: string; // markdown body
};

export type Book = {
  slug: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  content: string; // body of _book.md, may be ""
  articles: Article[]; // newest dateRead first
};

function toArticle(bookSlug: string, bookTitle: string, fileName: string): Article {
  const slug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(BOOKS_DIR, bookSlug, fileName), "utf8");
  const { data, content } = matter(raw);

  return {
    bookSlug,
    bookTitle,
    slug,
    title: String(data.title ?? slug),
    dateRead: normalizeDate(data.dateRead),
    rating: Number(data.rating ?? 0),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

function toBook(dirName: string): Book {
  const dir = path.join(BOOKS_DIR, dirName);
  const metaPath = path.join(dir, BOOK_META_FILE);

  // A folder without _book.md is still a book; fall back to the folder name.
  let title = dirName;
  let author = "";
  let category = "未分類";
  let tags: string[] = [];
  let content = "";

  if (fs.existsSync(metaPath)) {
    const parsed = matter(fs.readFileSync(metaPath, "utf8"));
    const data = parsed.data;
    title = String(data.title ?? dirName);
    author = data.author ? String(data.author) : "";
    category = data.category ? String(data.category) : "未分類";
    tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    content = parsed.content;
  }

  const articles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => toArticle(dirName, title, f))
    .sort((a, b) => (a.dateRead < b.dateRead ? 1 : -1));

  return { slug: dirName, title, author, category, tags, content, articles };
}

/** The newest dateRead among a book's articles, or "" when it has none. */
function latestRead(book: Book): string {
  return book.articles[0]?.dateRead ?? "";
}

/** All books, most recently read first; books with no articles sort last. */
export function getAllBooks(): Book[] {
  if (!fs.existsSync(BOOKS_DIR)) return [];
  return fs
    .readdirSync(BOOKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => toBook(e.name))
    .sort((a, b) => {
      const la = latestRead(a);
      const lb = latestRead(b);
      if (la === lb) return a.title.localeCompare(b.title, "ja");
      if (!la) return 1;
      if (!lb) return -1;
      return la < lb ? 1 : -1;
    });
}

/** Every article across all books, newest first — used by the activity heatmap. */
export function getAllArticles(): Article[] {
  return getAllBooks()
    .flatMap((b) => b.articles)
    .sort((a, b) => (a.dateRead < b.dateRead ? 1 : -1));
}

/** Format a YYYY-MM-DD string as "2026.06.20 読了". */
export function formatReadDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")} 読了`;
}

export function getBook(slug: string): Book | undefined {
  return getAllBooks().find((b) => slugMatches(b.slug, slug));
}

export function getArticle(
  bookSlug: string,
  articleSlug: string
): Article | undefined {
  return getBook(bookSlug)?.articles.find((a) => slugMatches(a.slug, articleSlug));
}

export type TbrBook = { title: string; author?: string; category: string };

/** A 積読 entry with no category of its own. */
const NO_CATEGORY = "未分類";

/**
 * Only a whitespace-padded delimiter separates fields, so a slash inside a
 * title (e.g. "Fate/stay night") is left intact.
 */
const TBR_DELIMITER = /\s+[/｜|]\s+/;

/**
 * The "積んでる本" (to-read) pile. Kept as a simple list in content/tsundoku.md:
 * one book per `- ` line, as `- タイトル / 著者 / カテゴリ`, `- タイトル / 著者`
 * or just `- タイトル` (｜ and | work as delimiters too).
 */
export function getTsundoku(): TbrBook[] {
  if (!fs.existsSync(TSUNDOKU_FILE)) return [];
  const raw = fs.readFileSync(TSUNDOKU_FILE, "utf8");
  const { content } = matter(raw);
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => {
      const parts = l
        .slice(2)
        .trim()
        .split(TBR_DELIMITER)
        .map((p) => p.trim());
      // A 4th field would be a delimiter inside the category; keep it whole
      // rather than dropping the tail silently.
      const category = parts.slice(2).join(" / ").trim();
      return {
        title: parts[0] ?? "",
        author: parts[1] || undefined,
        category: category || NO_CATEGORY,
      };
    })
    .filter((b) => b.title.length > 0);
}

/** Distinct 積読 categories with their counts, sorted by count desc. */
export function getTsundokuCategories(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of getTsundoku()) {
    counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Distinct categories with their book counts, sorted by count desc. */
export function getCategories(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of getAllBooks()) {
    counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

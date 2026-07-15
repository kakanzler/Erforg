import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BOOKS_DIR = path.join(process.cwd(), "content", "books");

/** YAML may parse `2026-06-20` as a Date; normalize any value to YYYY-MM-DD. */
function normalizeDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export type Book = {
  slug: string;
  title: string;
  author: string;
  category: string;
  rating: number; // 0-5
  dateRead: string; // ISO date, e.g. "2026-06-20"
  tags: string[];
  content: string; // markdown body
};

function toBook(fileName: string): Book {
  const slug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(BOOKS_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: String(data.title ?? slug),
    author: String(data.author ?? "不明"),
    category: String(data.category ?? "未分類"),
    rating: Number(data.rating ?? 0),
    dateRead: normalizeDate(data.dateRead),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

/** All books, newest read first. */
export function getAllBooks(): Book[] {
  if (!fs.existsSync(BOOKS_DIR)) return [];
  return fs
    .readdirSync(BOOKS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map(toBook)
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
  return getAllBooks().find((b) => b.slug === slug);
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

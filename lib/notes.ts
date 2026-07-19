import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const NOTES_DIR = path.join(process.cwd(), "content", "notes");

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

export type Note = {
  /** The folder name under content/notes — free-form, no fixed list. */
  category: string;
  slug: string;
  title: string;
  date: string; // ISO date, e.g. "2026-06-20"
  tags: string[];
  content: string; // markdown body
};

export type NoteCategory = {
  name: string;
  notes: Note[]; // newest date first
};

function toNote(category: string, fileName: string): Note {
  const slug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(NOTES_DIR, category, fileName), "utf8");
  const { data, content } = matter(raw);

  return {
    category,
    slug,
    title: String(data.title ?? slug),
    date: normalizeDate(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

function toCategory(dirName: string): NoteCategory {
  const notes = fs
    .readdirSync(path.join(NOTES_DIR, dirName))
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => toNote(dirName, f))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { name: dirName, notes };
}

/** The newest date among a category's notes, or "" when it has none. */
function latestNote(c: NoteCategory): string {
  return c.notes[0]?.date ?? "";
}

/** All note categories, most recently written first; empty ones sort last. */
export function getNoteCategories(): NoteCategory[] {
  if (!fs.existsSync(NOTES_DIR)) return [];
  return fs
    .readdirSync(NOTES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => toCategory(e.name))
    .sort((a, b) => {
      const la = latestNote(a);
      const lb = latestNote(b);
      if (la === lb) return a.name.localeCompare(b.name, "ja");
      if (!la) return 1;
      if (!lb) return -1;
      return la < lb ? 1 : -1;
    });
}

/**
 * Every note across all categories, newest first.
 * Deliberately NOT fed to the activity heatmap: a note is not a reading record.
 */
export function getAllNotes(): Note[] {
  return getNoteCategories()
    .flatMap((c) => c.notes)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** "2026-07-19" → "2026.07.19", matching how record dates are written. */
export function formatNoteDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function getNote(category: string, slug: string): Note | undefined {
  return getNoteCategories()
    .find((c) => slugMatches(c.name, category))
    ?.notes.find((n) => slugMatches(n.slug, slug));
}

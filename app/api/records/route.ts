import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const BOOKS_DIR = path.join(process.cwd(), "content", "books");
const TSUNDOKU_FILE = path.join(process.cwd(), "content", "tsundoku.md");

/** The `_book.md` inside a book folder holds the book-level metadata. */
const BOOK_META_FILE = "_book.md";

// This endpoint writes files to the working tree, so it only exists for local
// authoring (`npm run dev`). It is disabled on any production build (Vercel).
const ENABLED = process.env.NODE_ENV !== "production";

type Payload = {
  /** 記事が属する本のフォルダ名。 */
  bookSlug?: string;
  /** 編集時のみ。本の移動を検出するための編集前 bookSlug。 */
  originalBookSlug?: string;
  /** 本が新規のときだけ使う。既存の本のメタデータは決して書き換えない。 */
  bookTitle?: string;
  bookAuthor?: string;
  bookCategory?: string;
  bookTags?: string[];

  slug?: string;
  /** 編集時のみ。リネームを検出するための編集前 slug。 */
  originalSlug?: string;
  title?: string;
  rating?: number;
  dateRead?: string;
  tags?: string[];
  body?: string;
  // the exact 積読 entry to drop once the record exists
  originalTitle?: string;
  originalAuthor?: string;
};

function y(v: string): string {
  // JSON string literals are valid YAML double-quoted scalars — safe for any
  // title/author containing :, [], quotes, slashes, etc.
  return JSON.stringify(v ?? "");
}

/** True when the slug would escape BOOKS_DIR or produce an illegal filename. */
function badSlug(slug: string): boolean {
  return /[\\/:*?"<>|]/.test(slug) || slug.includes("..");
}

function yamlList(values: unknown): string {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return `[${list.map((t) => y(String(t).trim())).join(", ")}]`;
}

/**
 * Build the article markdown (frontmatter + body).
 * Shared by POST and PUT so the two can never drift.
 */
function buildArticle(data: Payload, title: string): string {
  const rating = Number.isFinite(data.rating)
    ? Math.max(0, Math.min(5, Number(data.rating)))
    : 0;
  const dateRead = (data.dateRead ?? "").trim();

  const frontmatter = [
    "---",
    `title: ${y(title)}`,
    `dateRead: ${y(dateRead)}`,
    `rating: ${rating}`,
    `tags: ${yamlList(data.tags)}`,
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${(data.body ?? "").trim()}\n`;
}

/** Build `_book.md` from the book-level fields. Only ever used for a new book. */
function buildBookMeta(data: Payload, fallbackTitle: string): string {
  return [
    "---",
    `title: ${y((data.bookTitle ?? "").trim() || fallbackTitle)}`,
    `author: ${y((data.bookAuthor ?? "").trim() || "不明")}`,
    `category: ${y((data.bookCategory ?? "").trim() || "未分類")}`,
    `tags: ${yamlList(data.bookTags)}`,
    "---",
    "",
  ].join("\n");
}

/**
 * Create the book folder, and `_book.md` only when it does not already exist.
 * An existing book's metadata is never rewritten through this endpoint.
 */
function ensureBook(bookSlug: string, data: Payload) {
  const dir = path.join(BOOKS_DIR, bookSlug);
  fs.mkdirSync(dir, { recursive: true });
  const metaPath = path.join(dir, BOOK_META_FILE);
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(metaPath, buildBookMeta(data, bookSlug), "utf8");
  }
}

/** Remove the first 積読 line whose parsed title matches. Local file only. */
function removeFromTsundoku(title: string) {
  if (!title || !fs.existsSync(TSUNDOKU_FILE)) return;
  const raw = fs.readFileSync(TSUNDOKU_FILE, "utf8");
  const lines = raw.split(/\r?\n/);
  let removed = false;
  const kept = lines.filter((l) => {
    if (removed || !l.trim().startsWith("- ")) return true;
    const body = l.trim().slice(2).trim();
    const m = body.match(/^(.*?)\s+[/｜|]\s+(.*)$/);
    const lineTitle = (m ? m[1] : body).trim();
    if (lineTitle === title.trim()) {
      removed = true;
      return false;
    }
    return true;
  });
  if (removed) fs.writeFileSync(TSUNDOKU_FILE, kept.join("\n"), "utf8");
}

const disabled = () =>
  NextResponse.json(
    { error: "この機能はローカル開発時のみ利用できます。" },
    { status: 403 }
  );

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

async function readPayload(req: Request): Promise<Payload | null> {
  try {
    return (await req.json()) as Payload;
  } catch {
    return null;
  }
}

/** Create a new article, creating its book folder (and `_book.md`) if needed. */
export async function POST(req: Request) {
  if (!ENABLED) return disabled();

  const data = await readPayload(req);
  if (!data) return badRequest("不正なリクエストです。");

  const bookSlug = (data.bookSlug ?? "").trim();
  const slug = (data.slug ?? "").trim();
  const title = (data.title ?? "").trim();
  if (!bookSlug || !slug || !title) {
    return badRequest("本の slug ・記事の slug ・タイトルは必須です。");
  }
  // guard against path traversal / illegal filename chars
  if (badSlug(bookSlug) || badSlug(slug)) {
    return badRequest("slug に使えない文字が含まれています。");
  }

  const filePath = path.join(BOOKS_DIR, bookSlug, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `${bookSlug}/${slug}.md はすでに存在します。別の slug にしてください。` },
      { status: 409 }
    );
  }

  try {
    ensureBook(bookSlug, data);
    fs.writeFileSync(filePath, buildArticle(data, title), "utf8");
    // move the book out of the 積読 pile (local only)
    removeFromTsundoku(
      data.originalTitle?.trim() || data.bookTitle?.trim() || title
    );
  } catch (e) {
    return NextResponse.json(
      { error: `書き込みに失敗しました: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, bookSlug, slug });
}

/**
 * Update an existing article. A changed slug renames the file; a changed
 * bookSlug re-parents it into another book.
 * Never touches the 積読 list — editing is not "finishing" a book.
 */
export async function PUT(req: Request) {
  if (!ENABLED) return disabled();

  const data = await readPayload(req);
  if (!data) return badRequest("不正なリクエストです。");

  const originalBookSlug = (data.originalBookSlug ?? "").trim();
  const originalSlug = (data.originalSlug ?? "").trim();
  const bookSlug = (data.bookSlug ?? "").trim();
  const slug = (data.slug ?? "").trim();
  const title = (data.title ?? "").trim();
  if (!originalBookSlug || !originalSlug || !bookSlug || !slug || !title) {
    return badRequest("本の slug ・記事の slug ・タイトルは必須です。");
  }
  if (
    badSlug(originalBookSlug) ||
    badSlug(originalSlug) ||
    badSlug(bookSlug) ||
    badSlug(slug)
  ) {
    return badRequest("slug に使えない文字が含まれています。");
  }

  const oldPath = path.join(BOOKS_DIR, originalBookSlug, `${originalSlug}.md`);
  if (!fs.existsSync(oldPath)) {
    return NextResponse.json(
      { error: "編集対象の記事が見つかりません。" },
      { status: 404 }
    );
  }

  const newPath = path.join(BOOKS_DIR, bookSlug, `${slug}.md`);
  const moved = newPath !== oldPath;
  if (moved && fs.existsSync(newPath)) {
    return NextResponse.json(
      { error: `${bookSlug}/${slug}.md はすでに存在します。別の slug にしてください。` },
      { status: 409 }
    );
  }

  try {
    // Re-parenting into a book that does not exist yet still needs its folder.
    ensureBook(bookSlug, data);
    fs.writeFileSync(newPath, buildArticle(data, title), "utf8");
    // Only drop the old file once the new one is safely on disk.
    if (moved) fs.unlinkSync(oldPath);
  } catch (e) {
    return NextResponse.json(
      { error: `書き込みに失敗しました: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, bookSlug, slug });
}

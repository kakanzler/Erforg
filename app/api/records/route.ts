import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const BOOKS_DIR = path.join(process.cwd(), "content", "books");
const TSUNDOKU_FILE = path.join(process.cwd(), "content", "tsundoku.md");

// This endpoint writes files to the working tree, so it only exists for local
// authoring (`npm run dev`). It is disabled on any production build (Vercel).
const ENABLED = process.env.NODE_ENV !== "production";

type Payload = {
  slug?: string;
  /** 編集時のみ。リネームを検出するための編集前 slug。 */
  originalSlug?: string;
  title?: string;
  author?: string;
  category?: string;
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

/**
 * Build the full markdown file contents (frontmatter + body).
 * Shared by POST and PUT so the two can never drift.
 */
function buildRecord(data: Payload, title: string): string {
  const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
  const rating = Number.isFinite(data.rating)
    ? Math.max(0, Math.min(5, Number(data.rating)))
    : 0;
  const dateRead = (data.dateRead ?? "").trim();

  const frontmatter = [
    "---",
    `title: ${y(title)}`,
    `author: ${y((data.author ?? "").trim() || "不明")}`,
    `category: ${y((data.category ?? "").trim() || "未分類")}`,
    `rating: ${rating}`,
    `dateRead: ${y(dateRead)}`,
    `tags: [${tags.map((t) => y(String(t).trim())).join(", ")}]`,
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${(data.body ?? "").trim()}\n`;
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

export async function POST(req: Request) {
  if (!ENABLED) {
    return NextResponse.json(
      { error: "この機能はローカル開発時のみ利用できます。" },
      { status: 403 }
    );
  }

  let data: Payload;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const slug = (data.slug ?? "").trim();
  const title = (data.title ?? "").trim();
  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug とタイトルは必須です。" },
      { status: 400 }
    );
  }
  // guard against path traversal / illegal filename chars
  if (badSlug(slug)) {
    return NextResponse.json(
      { error: "slug に使えない文字が含まれています。" },
      { status: 400 }
    );
  }

  const filePath = path.join(BOOKS_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `${slug}.md はすでに存在します。別の slug にしてください。` },
      { status: 409 }
    );
  }

  const contents = buildRecord(data, title);

  try {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    // move the book out of the 積読 pile (local only)
    removeFromTsundoku(data.originalTitle?.trim() || title);
  } catch (e) {
    return NextResponse.json(
      { error: `書き込みに失敗しました: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, slug });
}

/**
 * Update an existing record. A changed slug renames the file.
 * Never touches the 積読 list — editing is not "finishing" a book.
 */
export async function PUT(req: Request) {
  if (!ENABLED) {
    return NextResponse.json(
      { error: "この機能はローカル開発時のみ利用できます。" },
      { status: 403 }
    );
  }

  let data: Payload;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const originalSlug = (data.originalSlug ?? "").trim();
  const slug = (data.slug ?? "").trim();
  const title = (data.title ?? "").trim();
  if (!originalSlug || !slug || !title) {
    return NextResponse.json(
      { error: "slug とタイトルは必須です。" },
      { status: 400 }
    );
  }
  if (badSlug(originalSlug) || badSlug(slug)) {
    return NextResponse.json(
      { error: "slug に使えない文字が含まれています。" },
      { status: 400 }
    );
  }

  const oldPath = path.join(BOOKS_DIR, `${originalSlug}.md`);
  if (!fs.existsSync(oldPath)) {
    return NextResponse.json(
      { error: "編集対象の記録が見つかりません。" },
      { status: 404 }
    );
  }

  const newPath = path.join(BOOKS_DIR, `${slug}.md`);
  if (slug !== originalSlug && fs.existsSync(newPath)) {
    return NextResponse.json(
      { error: `${slug}.md はすでに存在します。別の slug にしてください。` },
      { status: 409 }
    );
  }

  const contents = buildRecord(data, title);

  try {
    fs.writeFileSync(newPath, contents, "utf8");
    // Only drop the old file once the new one is safely on disk.
    if (slug !== originalSlug) fs.unlinkSync(oldPath);
  } catch (e) {
    return NextResponse.json(
      { error: `書き込みに失敗しました: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, slug });
}

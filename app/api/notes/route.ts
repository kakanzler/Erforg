import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const NOTES_DIR = path.join(process.cwd(), "content", "notes");

// This endpoint writes files to the working tree, so it only exists for local
// authoring (`npm run dev`). It is disabled on any production build (Vercel).
const ENABLED = process.env.NODE_ENV !== "production";

type Payload = {
  /** ノートが属するカテゴリ（content/notes 直下のフォルダ名）。 */
  category?: string;
  /** 編集時のみ。カテゴリ移動を検出するための編集前カテゴリ。 */
  originalCategory?: string;

  slug?: string;
  /** 編集時のみ。リネームを検出するための編集前 slug。 */
  originalSlug?: string;
  title?: string;
  date?: string;
  tags?: string[];
  body?: string;
};

function y(v: string): string {
  // JSON string literals are valid YAML double-quoted scalars — safe for any
  // title/category containing :, [], quotes, slashes, etc.
  return JSON.stringify(v ?? "");
}

/** True when the slug would escape NOTES_DIR or produce an illegal filename. */
function badSlug(slug: string): boolean {
  return /[\\/:*?"<>|]/.test(slug) || slug.includes("..");
}

function yamlList(values: unknown): string {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return `[${list.map((t) => y(String(t).trim())).join(", ")}]`;
}

/**
 * Build the note markdown (frontmatter + body).
 * Shared by POST and PUT so the two can never drift.
 */
function buildNote(data: Payload, title: string): string {
  const date = (data.date ?? "").trim();

  const frontmatter = [
    "---",
    `title: ${y(title)}`,
    `date: ${y(date)}`,
    `tags: ${yamlList(data.tags)}`,
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${(data.body ?? "").trim()}\n`;
}

/**
 * Drop a category folder that a move just emptied, so the sidebar stops
 * listing it. Best-effort: the note has already been re-filed successfully by
 * the time this runs, so a failure here must never fail the request.
 */
function removeIfEmptyCategory(category: string): void {
  try {
    const dir = path.join(NOTES_DIR, category);
    // Stay strictly inside content/notes, and never delete NOTES_DIR itself.
    if (path.dirname(dir) !== NOTES_DIR) return;
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    if (fs.readdirSync(dir).length !== 0) return;
    fs.rmdirSync(dir);
  } catch {
    // Leaving an empty folder behind is harmless; swallow and move on.
  }
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

/** Create a new note, creating its category folder if needed. */
export async function POST(req: Request) {
  if (!ENABLED) return disabled();

  const data = await readPayload(req);
  if (!data) return badRequest("不正なリクエストです。");

  const category = (data.category ?? "").trim();
  const slug = (data.slug ?? "").trim();
  const title = (data.title ?? "").trim();
  if (!category || !slug || !title) {
    return badRequest("カテゴリ ・ slug ・タイトルは必須です。");
  }
  // guard against path traversal / illegal filename chars
  if (badSlug(category) || badSlug(slug)) {
    return badRequest("カテゴリ / slug に使えない文字が含まれています。");
  }

  const filePath = path.join(NOTES_DIR, category, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `${category}/${slug}.md はすでに存在します。別の slug にしてください。` },
      { status: 409 }
    );
  }

  try {
    fs.mkdirSync(path.join(NOTES_DIR, category), { recursive: true });
    fs.writeFileSync(filePath, buildNote(data, title), "utf8");
  } catch (e) {
    return NextResponse.json(
      { error: `書き込みに失敗しました: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, category, slug });
}

/**
 * Update an existing note. A changed slug renames the file; a changed category
 * re-files it into another folder — that move is the only way to re-categorize.
 */
export async function PUT(req: Request) {
  if (!ENABLED) return disabled();

  const data = await readPayload(req);
  if (!data) return badRequest("不正なリクエストです。");

  const originalCategory = (data.originalCategory ?? "").trim();
  const originalSlug = (data.originalSlug ?? "").trim();
  const category = (data.category ?? "").trim();
  const slug = (data.slug ?? "").trim();
  const title = (data.title ?? "").trim();
  if (!originalCategory || !originalSlug || !category || !slug || !title) {
    return badRequest("カテゴリ ・ slug ・タイトルは必須です。");
  }
  if (
    badSlug(originalCategory) ||
    badSlug(originalSlug) ||
    badSlug(category) ||
    badSlug(slug)
  ) {
    return badRequest("カテゴリ / slug に使えない文字が含まれています。");
  }

  const oldPath = path.join(NOTES_DIR, originalCategory, `${originalSlug}.md`);
  if (!fs.existsSync(oldPath)) {
    return NextResponse.json(
      { error: "編集対象のノートが見つかりません。" },
      { status: 404 }
    );
  }

  const newPath = path.join(NOTES_DIR, category, `${slug}.md`);
  const moved = newPath !== oldPath;
  if (moved && fs.existsSync(newPath)) {
    return NextResponse.json(
      { error: `${category}/${slug}.md はすでに存在します。別の slug にしてください。` },
      { status: 409 }
    );
  }

  try {
    // Re-filing into a category that does not exist yet still needs its folder.
    fs.mkdirSync(path.join(NOTES_DIR, category), { recursive: true });
    fs.writeFileSync(newPath, buildNote(data, title), "utf8");
    // Only drop the old file once the new one is safely on disk.
    if (moved) fs.unlinkSync(oldPath);
  } catch (e) {
    return NextResponse.json(
      { error: `書き込みに失敗しました: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  // A category the note just left may now be empty — don't leave a ghost
  // category in the sidebar. Only the source, only on an actual change.
  if (moved && category !== originalCategory) {
    removeIfEmptyCategory(originalCategory);
  }

  return NextResponse.json({ ok: true, category, slug });
}

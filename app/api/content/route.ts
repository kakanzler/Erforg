import { NextResponse } from "next/server";
import { getArticle } from "@/lib/books";
import { getNote } from "@/lib/notes";

// Only the /edit pages read this, and those exist for local authoring only.
// Disabled on any production build (Vercel) so the deployed site keeps serving
// content exclusively through its statically generated pages.
const ENABLED = process.env.NODE_ENV !== "production";

/** True when the value would escape its content folder or name an illegal file. */
function badSlug(slug: string): boolean {
  return /[\\/:*?"<>|]/.test(slug) || slug.includes("..");
}

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

/**
 * One article or note as `{ title, body }`, for the 参照 pane of an /edit page.
 * The page itself only ships the *list* of what exists; a body crosses the wire
 * when the writer actually asks to read it.
 */
export function GET(req: Request) {
  if (!ENABLED) {
    return NextResponse.json(
      { error: "この機能はローカル開発時のみ利用できます。" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");

  if (kind === "record") {
    const book = (url.searchParams.get("book") ?? "").trim();
    const article = (url.searchParams.get("article") ?? "").trim();
    if (!book || !article) return badRequest("book と article は必須です。");
    if (badSlug(book) || badSlug(article)) {
      return badRequest("book / article に使えない文字が含まれています。");
    }
    const found = getArticle(book, article);
    if (!found) {
      return NextResponse.json({ error: "記事が見つかりません。" }, { status: 404 });
    }
    return NextResponse.json({ title: found.title, body: found.content });
  }

  if (kind === "note") {
    const category = (url.searchParams.get("category") ?? "").trim();
    const slug = (url.searchParams.get("slug") ?? "").trim();
    if (!category || !slug) return badRequest("category と slug は必須です。");
    if (badSlug(category) || badSlug(slug)) {
      return badRequest("category / slug に使えない文字が含まれています。");
    }
    const found = getNote(category, slug);
    if (!found) {
      return NextResponse.json({ error: "ノートが見つかりません。" }, { status: 404 });
    }
    return NextResponse.json({ title: found.title, body: found.content });
  }

  return badRequest("kind は record か note を指定してください。");
}

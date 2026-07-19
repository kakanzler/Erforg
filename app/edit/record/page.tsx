import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllBooks, getCategories, getTsundoku } from "@/lib/books";
import { RecordForm } from "@/components/RecordForm";
import { buildReferences } from "../references";

export const metadata = {
  title: "記事を作成 — Erfolg",
};

/**
 * 読書記録の新規作成ページ。`?from=<積読のタイトル>` で開くと、その積読の
 * タイトル・著者が新しい本に流し込まれ、保存時に積読からその行が消える。
 */
export default function NewRecordPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  // Authoring writes files into the working tree — it must not exist on the
  // deployed site at all.
  if (process.env.NODE_ENV === "production") notFound();

  const from = searchParams.from?.trim() || undefined;
  // Looked up server-side: only the matched entry crosses to the client, never
  // the whole (private) pile.
  const source = from ? getTsundoku().find((b) => b.title === from) : undefined;

  const books = getAllBooks().map((b) => ({
    slug: b.slug,
    title: b.title,
    author: b.author,
    category: b.category,
  }));

  return (
    <main className="container-wide">
      <Link href={source ? "/tsundoku" : "/"} className="back-link">
        {source ? "← 積んでる本へ" : "← 一覧へ"}
      </Link>

      <h1 className="edit-title">記事を作成</h1>
      {source && (
        <p className="edit-lead">
          積読「{source.title}」から作成します。保存すると積読から消えます。
        </p>
      )}

      <RecordForm
        books={books}
        categories={getCategories().map((c) => c.name)}
        references={buildReferences()}
        initialTitle={source?.title ?? ""}
        initialAuthor={source?.author ?? ""}
        // "未分類" is the absence of a category, not one worth prefilling.
        initialCategory={
          source && source.category !== "未分類" ? source.category : undefined
        }
        sourceTitle={source?.title}
        cancelHref={source ? "/tsundoku" : "/"}
      />
    </main>
  );
}

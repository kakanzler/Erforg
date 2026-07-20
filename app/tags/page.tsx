import Link from "next/link";
import { getAllTags } from "@/lib/tags";

export function generateMetadata() {
  return { title: "タグ — Erfolg-Forge" };
}

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <main className="container">
      <Link href="/" className="back-link">
        ← 一覧へ
      </Link>

      <h2 className="section-title">タグ（{tags.length}）</h2>

      {tags.length === 0 ? (
        <p className="empty-note">タグがありません。</p>
      ) : (
        <div className="categories">
          {tags.map((t) => (
            <Link
              key={t.name}
              href={`/tags/${encodeURIComponent(t.name)}`}
              className="chip"
            >
              {t.name}（{t.count}）
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

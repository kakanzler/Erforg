import Link from "next/link";
import { getAllArticles } from "@/lib/books";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { DraftList } from "@/components/DraftList";

// CATEGORY / BOOKS / 積読 live in the sidebars now (see components/AppShell),
// so they are reachable from every page instead of only this one.
export default function Home() {
  const articles = getAllArticles();
  const editable = process.env.NODE_ENV !== "production";

  return (
    <main className="container">
      <h1 className="site-title">Erfolg</h1>
      <p className="site-subtitle">Reading Records</p>

      <div className="top-actions">
        {/* Authoring lives on its own page now — /edit does not exist in
            production, so the link is only offered locally. */}
        {editable && (
          <div className="add-record">
            <Link href="/edit/record" className="add-record-btn">
              ＋ 記事を追加
            </Link>
          </div>
        )}
        <DraftList editable={editable} />
      </div>

      <ActivityHeatmap articles={articles} />
    </main>
  );
}


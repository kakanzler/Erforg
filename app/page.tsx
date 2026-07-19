import { getAllArticles, getAllBooks, getCategories } from "@/lib/books";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { AddRecord } from "@/components/AddRecord";
import { DraftList } from "@/components/DraftList";

// CATEGORY / BOOKS / 積読 live in the sidebars now (see components/AppShell),
// so they are reachable from every page instead of only this one.
export default function Home() {
  const categories = getCategories();
  const allBooks = getAllBooks();
  const articles = getAllArticles();
  const editable = process.env.NODE_ENV !== "production";

  return (
    <main className="container">
      <h1 className="site-title">Erfolg</h1>
      <p className="site-subtitle">Reading Records</p>

      <div className="top-actions">
        <AddRecord
          books={allBooks.map((b) => ({
            slug: b.slug,
            title: b.title,
            author: b.author,
            category: b.category,
          }))}
          categories={categories.map((c) => c.name)}
          editable={editable}
        />
        <DraftList editable={editable} />
      </div>

      <ActivityHeatmap articles={articles} />
    </main>
  );
}

import Link from "next/link";

/**
 * Per-record "edit" entry point on the article page — a link to the dedicated
 * /edit page. Local dev only: that page does not exist in production.
 */
export function EditRecord({
  bookSlug,
  articleSlug,
  editable,
}: {
  /** 編集する記事が属している本の slug（フォルダ名）。 */
  bookSlug: string;
  /** 編集する記事の slug（ファイル名）。 */
  articleSlug: string;
  editable: boolean;
}) {
  if (!editable) return null;

  return (
    <div className="edit-record">
      <Link
        href={`/edit/record/${encodeURIComponent(bookSlug)}/${encodeURIComponent(
          articleSlug
        )}`}
        className="add-record-btn"
      >
        ✎ 編集
      </Link>
    </div>
  );
}

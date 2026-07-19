import Link from "next/link";

/**
 * Per-note "edit" entry point on the note page — a link to the dedicated /edit
 * page. Local dev only: that page does not exist in production.
 */
export function EditNote({
  category,
  slug,
  editable,
}: {
  /** 編集するノートが属するカテゴリ（フォルダ名）。 */
  category: string;
  /** 編集するノートの slug（ファイル名）。 */
  slug: string;
  editable: boolean;
}) {
  if (!editable) return null;

  return (
    <div className="edit-record">
      <Link
        href={`/edit/note/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`}
        className="add-record-btn"
      >
        ✎ 編集
      </Link>
    </div>
  );
}

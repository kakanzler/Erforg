"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function slugify(title: string): string {
  const s = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[\s　]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return s || `record-${Date.now()}`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const BODY_TEMPLATE = `## 概要


## 印象に残った点

-

## 学び
`;

export function RecordForm({
  title,
  author,
  categories,
  onDone,
  onCancel,
}: {
  title: string;
  author?: string;
  categories: string[];
  onDone: (slug: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(() => slugify(title));
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState(4);
  const [dateRead, setDateRead] = useState(today());
  const [tags, setTags] = useState("");
  const [body, setBody] = useState(BODY_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          author,
          category,
          rating,
          dateRead,
          tags: tags
            .split(/[,、\s]+/)
            .map((t) => t.trim())
            .filter(Boolean),
          body,
          originalTitle: title,
          originalAuthor: author,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "作成に失敗しました。");
        setBusy(false);
        return;
      }
      router.refresh();
      onDone(json.slug);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="rf">
      <div className="rf-row">
        <label className="rf-label">タイトル</label>
        <div className="rf-static">{title}</div>
      </div>
      <div className="rf-row">
        <label className="rf-label">著者</label>
        <div className="rf-static">{author || "不明"}</div>
      </div>

      <div className="rf-row">
        <label className="rf-label" htmlFor="rf-slug">
          slug（ファイル名）
        </label>
        <input
          id="rf-slug"
          className="rf-input"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <div className="rf-grid">
        <div className="rf-row">
          <label className="rf-label" htmlFor="rf-cat">
            カテゴリ
          </label>
          <input
            id="rf-cat"
            className="rf-input"
            list="rf-cats"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="技術書 / 小説 …"
          />
          <datalist id="rf-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="rf-row">
          <label className="rf-label" htmlFor="rf-rating">
            評価
          </label>
          <select
            id="rf-rating"
            className="rf-input"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n) || "—"}
              </option>
            ))}
          </select>
        </div>
        <div className="rf-row">
          <label className="rf-label" htmlFor="rf-date">
            読了日
          </label>
          <input
            id="rf-date"
            type="date"
            className="rf-input"
            value={dateRead}
            onChange={(e) => setDateRead(e.target.value)}
          />
        </div>
      </div>

      <div className="rf-row">
        <label className="rf-label" htmlFor="rf-tags">
          タグ（カンマ区切り）
        </label>
        <input
          id="rf-tags"
          className="rf-input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="設計, 習慣"
        />
      </div>

      <div className="rf-row">
        <label className="rf-label" htmlFor="rf-body">
          本文（Markdown）
        </label>
        <textarea
          id="rf-body"
          className="rf-input rf-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
        />
      </div>

      {error && <p className="rf-error">{error}</p>}

      <div className="rf-actions">
        <button className="rf-btn rf-primary" onClick={submit} disabled={busy}>
          {busy ? "作成中…" : "記事を作成"}
        </button>
        <button className="rf-btn" onClick={onCancel} disabled={busy}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

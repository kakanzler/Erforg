"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorPane, type ReferenceItem } from "./EditSplit";
import { MarkdownEditor } from "./MarkdownEditor";
import { slugify } from "./RecordForm";

/**
 * Slug to show while the writer is still typing the title: empty until there
 * is actually a title, so a blank create page does not show `slugify("")`'s
 * timestamp fallback before anything has been entered.
 */
function autoSlug(title: string): string {
  return title.trim() ? slugify(title) : "";
}

const DRAFT_PREFIX = "erfolg:draft:note:";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // stale drafts stop nagging after 2 weeks

/** Sentinel `<option>` value for "this note goes into a brand-new category". */
const NEW_CATEGORY = "__new__";

/** Everything the form owns — snapshotted for draft save / restore. */
type FormState = {
  picked: string; // an existing category name, or NEW_CATEGORY
  newCategory: string;
  title: string;
  slug: string;
  slugTouched: boolean;
  date: string;
  tags: string;
  body: string;
};

type Draft = FormState & { savedAt: number };

/**
 * Rebuild a state object with a fixed key order, so two snapshots can be
 * compared by their JSON. Also normalizes a draft written by an older shape:
 * a missing field compares equal to the corresponding empty value.
 */
function snapshot(s: Partial<FormState>): FormState {
  return {
    picked: s.picked ?? NEW_CATEGORY,
    newCategory: s.newCategory ?? "",
    title: s.title ?? "",
    slug: s.slug ?? "",
    slugTouched: s.slugTouched ?? false,
    date: s.date ?? "",
    tags: s.tags ?? "",
    body: s.body ?? "",
  };
}

function sameState(a: Partial<FormState>, b: Partial<FormState>): boolean {
  return JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b));
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Authoring form for a NOTEBOOK note — a note that belongs to a free-form
 * category instead of a book. Local dev only; the API it posts to is disabled
 * on a production build.
 */
export function NoteForm({
  categories,
  editCategory,
  editSlug,
  initialTitle = "",
  initialDate,
  initialTags,
  initialBody,
  references,
  cancelHref,
}: {
  /** 既存のノートカテゴリ一覧。セレクトに出す。 */
  categories: string[];
  /** 編集モードのとき、ノートが属しているカテゴリ。 */
  editCategory?: string;
  /** 指定されると編集モードになる（編集前のノート slug）。 */
  editSlug?: string;
  initialTitle?: string;
  initialDate?: string;
  /** すでにカンマ区切りになったタグ文字列。 */
  initialTags?: string;
  initialBody?: string;
  /** 参照ペインに出す既存の記事・ノートの一覧（本文は含まない）。 */
  references: ReferenceItem[];
  /** キャンセル時の戻り先。編集ならノート、新規なら開いてきたページ。 */
  cancelHref: string;
}) {
  const isEdit = Boolean(editSlug);
  const router = useRouter();

  // Editing starts on the note's current category; creating starts on the
  // newest existing category, or on "new" when there are none yet.
  const [picked, setPicked] = useState<string>(() => {
    if (isEdit && editCategory) return editCategory;
    return categories[0] ?? NEW_CATEGORY;
  });
  const isNewCategory = picked === NEW_CATEGORY;
  const [newCategory, setNewCategory] = useState("");

  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(() => (isEdit ? editSlug! : autoSlug(initialTitle)));
  // In edit mode the slug must not follow the title — a rename is deliberate.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [date, setDate] = useState(initialDate ?? today());
  const [tags, setTags] = useState(initialTags ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable per-form draft key: keyed by the edited note's category *and* slug,
  // since two categories can hold the same slug.
  const draftKey = useMemo(
    () => (isEdit ? `${DRAFT_PREFIX}${editCategory ?? ""}/${editSlug}` : `${DRAFT_PREFIX}new`),
    [isEdit, editCategory, editSlug]
  );
  const [foundDraft, setFoundDraft] = useState<Draft | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The values the form opened with. Autosave only fires once something
  // actually differs from these, so merely opening a form can never overwrite
  // an existing draft. (Skipping "the first effect run" instead would not work:
  // React StrictMode double-invokes effects in dev, and the second run would
  // write back the untouched initial values, destroying the saved draft.)
  const current: FormState = {
    picked,
    newCategory,
    title,
    slug,
    slugTouched,
    date,
    tags,
    body,
  };
  const openedWith = useRef<FormState>(current);

  // Keep the slug in sync with the title until that slug is edited by hand.
  useEffect(() => {
    if (!slugTouched) setSlug(autoSlug(title));
  }, [title, slugTouched]);

  // On mount, look for a leftover draft and offer to restore it (never auto-applied).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      if (!draft || typeof draft.savedAt !== "number") return;
      if (Date.now() - draft.savedAt >= DRAFT_TTL_MS) return;

      // A draft identical to the form's opening values is just an echo, not
      // something worth surfacing — discard it silently.
      if (sameState(draft, openedWith.current)) {
        window.localStorage.removeItem(draftKey);
        return;
      }
      setFoundDraft(draft);
    } catch {
      // ignore parse/storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave of the current form state, skipped while the form still
  // holds exactly the values it opened with.
  useEffect(() => {
    if (sameState(current, openedWith.current)) return;

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      try {
        const draft: Draft = { savedAt: Date.now(), ...snapshot(current) };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // ignore quota/private-mode failures
      }
    }, 600);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
    // `current` is rebuilt every render; depend on its fields instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, picked, newCategory, title, slug, slugTouched, date, tags, body]);

  function restoreDraft() {
    if (!foundDraft) return;
    const d = snapshot(foundDraft);
    setPicked(d.picked);
    setNewCategory(d.newCategory);
    setTitle(d.title);
    setSlug(d.slug);
    setSlugTouched(d.slugTouched);
    setDate(d.date);
    setTags(d.tags);
    // MarkdownEditor sees a body it did not produce and restarts its own
    // undo history, so undo cannot walk back into the discarded text.
    setBody(d.body);
    setFoundDraft(null);
  }

  function discardDraft() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore storage errors
      }
    }
    setFoundDraft(null);
  }

  function formatDraftTime(savedAt: number): string {
    const d = new Date(savedAt);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const category = isNewCategory ? newCategory.trim() : picked;
      const res = await fetch("/api/notes", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          originalCategory: editCategory,
          // The slug field is left empty while the title is empty (see
          // `autoSlug`); fall back to `slugify`'s own default only now, at
          // the point something is actually submitted.
          slug: slug || slugify(title),
          originalSlug: editSlug,
          title,
          date,
          tags: tags
            .split(/[,、\s]+/)
            .map((t) => t.trim())
            .filter(Boolean),
          body,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? (isEdit ? "更新に失敗しました。" : "作成に失敗しました。"));
        setBusy(false);
        return;
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // ignore storage errors
        }
      }
      router.refresh();
      // Straight to the saved note — the edit page has done its job.
      router.push(
        `/notes/${encodeURIComponent(json.category)}/${encodeURIComponent(json.slug)}`
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="rf">
      {foundDraft && (
        <div className="rf-draft">
          下書きが残っています（<time>{formatDraftTime(foundDraft.savedAt)}</time>保存）
          <button type="button" className="rf-draft-btn" onClick={restoreDraft}>
            復元
          </button>
          <button type="button" className="rf-draft-btn" onClick={discardDraft}>
            破棄
          </button>
        </div>
      )}

      {/* Metadata first, across the full width — the split below belongs to the
          body alone. */}
      <div className="rf-grid">
        <div className="rf-row">
          <label className="rf-label" htmlFor="nf-category">
            カテゴリ
          </label>
          <select
            id="nf-category"
            className="rf-input"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value={NEW_CATEGORY}>＋ 新しいカテゴリ</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="rf-row">
          <label className="rf-label" htmlFor="nf-title">
            タイトル
          </label>
          <input
            id="nf-title"
            className="rf-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ノートのタイトル"
          />
        </div>

        <div className="rf-row">
          <label className="rf-label" htmlFor="nf-slug">
            slug（ファイル名）
          </label>
          <input
            id="nf-slug"
            className="rf-input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>

      {isNewCategory && (
        <div className="rf-grid">
          <div className="rf-row">
            <label className="rf-label" htmlFor="nf-new-category">
              新しいカテゴリ名（フォルダ名）
            </label>
            <input
              id="nf-new-category"
              className="rf-input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="数学 / 雑記 …"
            />
          </div>
        </div>
      )}

      <div className="rf-grid">
        <div className="rf-row">
          <label className="rf-label" htmlFor="nf-date">
            日付
          </label>
          <input
            id="nf-date"
            type="date"
            className="rf-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="rf-row">
          <label className="rf-label" htmlFor="nf-tags">
            タグ（カンマ区切り）
          </label>
          <input
            id="nf-tags"
            className="rf-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="メモ, 数学"
          />
        </div>
      </div>

      <MarkdownEditor
        value={body}
        onChange={setBody}
        id="nf-body"
        rightPane={<EditorPane body={body} references={references} />}
      />

      {error && <p className="rf-error">{error}</p>}

      <div className="rf-actions">
        <button className="rf-btn rf-primary" onClick={submit} disabled={busy}>
          {isEdit
            ? busy
              ? "更新中…"
              : "ノートを更新"
            : busy
              ? "作成中…"
              : "ノートを作成"}
        </button>
        <button
          className="rf-btn"
          onClick={() => router.push(cancelHref)}
          disabled={busy}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

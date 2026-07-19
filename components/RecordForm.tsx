"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorPane, type ReferenceItem } from "./EditSplit";
import { MarkdownEditor } from "./MarkdownEditor";

const DRAFT_PREFIX = "erfolg:draft:";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // stale drafts stop nagging after 2 weeks

/** Sentinel `<option>` value for "this article belongs to a brand-new book". */
const NEW_BOOK = "__new__";

/** Everything the form owns — snapshotted for draft save / restore. */
type FormState = {
  parent: string; // an existing book slug, or NEW_BOOK
  bookTitle: string;
  bookAuthor: string;
  bookCategory: string;
  bookSlug: string;
  bookSlugTouched: boolean;
  title: string;
  slug: string;
  slugTouched: boolean;
  rating: number;
  dateRead: string;
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
    parent: s.parent ?? NEW_BOOK,
    bookTitle: s.bookTitle ?? "",
    bookAuthor: s.bookAuthor ?? "",
    bookCategory: s.bookCategory ?? "",
    bookSlug: s.bookSlug ?? "",
    bookSlugTouched: s.bookSlugTouched ?? false,
    title: s.title ?? "",
    slug: s.slug ?? "",
    slugTouched: s.slugTouched ?? false,
    rating: s.rating ?? 0,
    dateRead: s.dateRead ?? "",
    tags: s.tags ?? "",
    body: s.body ?? "",
  };
}

function sameState(a: Partial<FormState>, b: Partial<FormState>): boolean {
  return JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b));
}

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

/**
 * Slug to show while the writer is still typing the title: empty until there
 * is actually a title, so a blank create page does not show `slugify("")`'s
 * timestamp fallback before anything has been entered.
 */
function autoSlug(title: string): string {
  return title.trim() ? slugify(title) : "";
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

export type BookOption = {
  slug: string;
  title: string;
  author: string;
  category: string;
};

export function RecordForm({
  books,
  initialTitle = "",
  initialAuthor = "",
  sourceTitle,
  editBookSlug,
  editSlug,
  initialCategory,
  initialRating,
  initialDateRead,
  initialTags,
  initialBody,
  categories,
  references,
  cancelHref,
}: {
  /** 既存の本の一覧。親の本を選ぶセレクトに出す。 */
  books: BookOption[];
  initialTitle?: string;
  initialAuthor?: string;
  /** 積読から開いた場合の元タイトル。作成後にその行を積読から消すのに使う。 */
  sourceTitle?: string;
  /** 編集モードのとき、記事が属している本の slug。 */
  editBookSlug?: string;
  /** 指定されると編集モードになる（編集前の記事 slug）。 */
  editSlug?: string;
  initialCategory?: string;
  initialRating?: number;
  initialDateRead?: string;
  /** すでにカンマ区切りになったタグ文字列。 */
  initialTags?: string;
  initialBody?: string;
  categories: string[];
  /** 参照ペインに出す既存の記事・ノートの一覧（本文は含まない）。 */
  references: ReferenceItem[];
  /** キャンセル時の戻り先。編集なら記事、新規なら開いてきたページ。 */
  cancelHref: string;
}) {
  const isEdit = Boolean(editSlug);
  const router = useRouter();

  // Parent book. Editing starts on the article's current book; every other
  // entry point (積読 / top page) starts on a brand-new book.
  const [parent, setParent] = useState<string>(() =>
    isEdit && editBookSlug ? editBookSlug : NEW_BOOK
  );
  const isNewBook = parent === NEW_BOOK;
  const selectedBook = books.find((b) => b.slug === parent);

  // New-book fields. Ignored by the API whenever the parent already exists.
  const [bookTitle, setBookTitle] = useState(initialTitle);
  const [bookAuthor, setBookAuthor] = useState(initialAuthor);
  const [bookCategory, setBookCategory] = useState(initialCategory ?? "");
  const [bookSlug, setBookSlug] = useState(() => autoSlug(initialTitle));
  const [bookSlugTouched, setBookSlugTouched] = useState(false);

  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(() => (isEdit ? editSlug! : autoSlug(initialTitle)));
  // In edit mode the slug must not follow the title — a rename is deliberate.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [rating, setRating] = useState(initialRating ?? 4);
  const [dateRead, setDateRead] = useState(initialDateRead ?? today());
  const [tags, setTags] = useState(initialTags ?? "");
  const [body, setBody] = useState(initialBody ?? BODY_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable per-form draft key: keyed by the edited article's *book and* slug —
  // two articles of the same book would otherwise share one draft — or by the
  // 積読 source title in create mode, so reopening the same form finds it again.
  const draftKey = useMemo(
    () =>
      isEdit
        ? `${DRAFT_PREFIX}edit:${editBookSlug ?? ""}/${editSlug}`
        : `${DRAFT_PREFIX}new:${sourceTitle ?? ""}`,
    [isEdit, editBookSlug, editSlug, sourceTitle]
  );
  const [foundDraft, setFoundDraft] = useState<Draft | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The values the form opened with. Autosave only fires once something
  // actually differs from these, so merely opening a form can never overwrite
  // an existing draft. (Skipping "the first effect run" instead would not work:
  // React StrictMode double-invokes effects in dev, and the second run would
  // write back the untouched initial values, destroying the saved draft.)
  const current: FormState = {
    parent,
    bookTitle,
    bookAuthor,
    bookCategory,
    bookSlug,
    bookSlugTouched,
    title,
    slug,
    slugTouched,
    rating,
    dateRead,
    tags,
    body,
  };
  const openedWith = useRef<FormState>(current);

  // Keep each slug in sync with its title until that slug is edited by hand.
  useEffect(() => {
    if (!slugTouched) setSlug(autoSlug(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (!bookSlugTouched) setBookSlug(autoSlug(bookTitle));
  }, [bookTitle, bookSlugTouched]);

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
  }, [
    draftKey,
    parent,
    bookTitle,
    bookAuthor,
    bookCategory,
    bookSlug,
    bookSlugTouched,
    title,
    slug,
    slugTouched,
    rating,
    dateRead,
    tags,
    body,
  ]);

  function restoreDraft() {
    if (!foundDraft) return;
    const d = snapshot(foundDraft);
    setParent(d.parent);
    setBookTitle(d.bookTitle);
    setBookAuthor(d.bookAuthor);
    setBookCategory(d.bookCategory);
    setBookSlug(d.bookSlug);
    setBookSlugTouched(d.bookSlugTouched);
    setTitle(d.title);
    setSlug(d.slug);
    setSlugTouched(d.slugTouched);
    setRating(d.rating);
    setDateRead(d.dateRead);
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
      // The slug fields are left empty while their title is empty (see
      // `autoSlug`); fall back to `slugify`'s own default only now, at the
      // point something is actually submitted.
      const targetBookSlug = isNewBook ? bookSlug || slugify(bookTitle) : parent;
      const res = await fetch("/api/records", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookSlug: targetBookSlug,
          originalBookSlug: editBookSlug,
          // Only honoured when the target book does not exist yet.
          bookTitle,
          bookAuthor,
          bookCategory,
          slug: slug || slugify(title),
          originalSlug: editSlug,
          title,
          rating,
          dateRead,
          tags: tags
            .split(/[,、\s]+/)
            .map((t) => t.trim())
            .filter(Boolean),
          body,
          originalTitle: sourceTitle,
          originalAuthor: initialAuthor,
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
      // Straight to the saved article — the edit page has done its job, and the
      // sidebars there already show where it landed.
      router.push(
        `/books/${encodeURIComponent(json.bookSlug)}/${encodeURIComponent(json.slug)}`
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
          <label className="rf-label" htmlFor="rf-parent">
            親の本
          </label>
          <select
            id="rf-parent"
            className="rf-input"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value={NEW_BOOK}>＋ 新しい本</option>
            {books.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.title}
                {b.author ? `（${b.author}）` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="rf-row">
          <label className="rf-label" htmlFor="rf-title">
            記事タイトル
          </label>
          <input
            id="rf-title"
            className="rf-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="記事のタイトル"
          />
        </div>

        <div className="rf-row">
          <label className="rf-label" htmlFor="rf-slug">
            記事の slug（ファイル名）
          </label>
          <input
            id="rf-slug"
            className="rf-input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>

      {isNewBook ? (
        <>
          <div className="rf-grid">
            <div className="rf-row">
              <label className="rf-label" htmlFor="rf-book-title">
                本のタイトル
              </label>
              <input
                id="rf-book-title"
                className="rf-input"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="本のタイトル"
              />
            </div>
            <div className="rf-row">
              <label className="rf-label" htmlFor="rf-book-author">
                著者
              </label>
              <input
                id="rf-book-author"
                className="rf-input"
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                placeholder="著者名"
              />
            </div>
            <div className="rf-row">
              <label className="rf-label" htmlFor="rf-book-cat">
                カテゴリ
              </label>
              <input
                id="rf-book-cat"
                className="rf-input"
                list="rf-cats"
                value={bookCategory}
                onChange={(e) => setBookCategory(e.target.value)}
                placeholder="技術書 / 小説 …"
              />
              <datalist id="rf-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="rf-grid">
            <div className="rf-row">
              <label className="rf-label" htmlFor="rf-book-slug">
                本の slug（フォルダ名）
              </label>
              <input
                id="rf-book-slug"
                className="rf-input"
                value={bookSlug}
                onChange={(e) => {
                  setBookSlugTouched(true);
                  setBookSlug(e.target.value);
                }}
              />
            </div>
          </div>
        </>
      ) : (
        // An existing book's metadata is not editable here: the API deliberately
        // ignores the book fields for a book that already exists, so inputs
        // would silently do nothing.
        <div className="rf-row">
          <span className="rf-label">この本の情報</span>
          <p className="rf-static">
            {[selectedBook?.title, selectedBook?.author, selectedBook?.category]
              .filter(Boolean)
              .join(" ・ ")}
          </p>
        </div>
      )}

      <div className="rf-grid">
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
      </div>

      <MarkdownEditor
        value={body}
        onChange={setBody}
        rightPane={<EditorPane body={body} references={references} />}
      />

      {error && <p className="rf-error">{error}</p>}

      <div className="rf-actions">
        <button className="rf-btn rf-primary" onClick={submit} disabled={busy}>
          {isEdit ? (busy ? "更新中…" : "記事を更新") : busy ? "作成中…" : "記事を作成"}
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

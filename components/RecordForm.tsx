"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownView } from "./MarkdownView";

const DRAFT_PREFIX = "erfolg:draft:";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // stale drafts stop nagging after 2 weeks

type Draft = {
  savedAt: number;
  title: string;
  author: string;
  slug: string;
  slugTouched: boolean;
  category: string;
  rating: number;
  dateRead: string;
  tags: string;
  body: string;
};

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

// Toolbar insertions. `toggle` markers (bold/italic/underline/strike) are removed
// when the same button is pressed again on an already-wrapped selection.
type Tool = {
  sym: string;
  title: string;
  before: string;
  after: string;
  ph: string;
  toggle?: boolean;
};
const TOOLS: Tool[] = [
  { sym: "∫", title: "積分", before: "$\\int ", after: " \\, dx$", ph: "f(x)" },
  { sym: "a⁄b", title: "分数", before: "$\\frac{", after: "}{b}$", ph: "a" },
  { sym: "√", title: "平方根", before: "$\\sqrt{", after: "}$", ph: "x" },
  { sym: "∑", title: "総和", before: "$\\sum_{i=1}^{n} ", after: "$", ph: "a_i" },
  { sym: "log", title: "log", before: "$\\log ", after: "$", ph: "x" },
  { sym: "nCr", title: "組み合わせ", before: "${}_{n}\\mathrm{C}_{k}$", after: "", ph: "" },
  { sym: "nHr", title: "重複組み合わせ", before: "${}_{n}\\mathrm{H}_{k}$", after: "", ph: "" },
  { sym: "xⁿ", title: "上付き", before: "<sup>", after: "</sup>", ph: "2" },
  { sym: "xₙ", title: "下付き", before: "<sub>", after: "</sub>", ph: "2" },
  { sym: "小", title: "小文字", before: "<small>", after: "</small>", ph: "テキスト" },
  { sym: "B", title: "太字（再度で解除）", before: "**", after: "**", ph: "太字", toggle: true },
  { sym: "I", title: "イタリック（再度で解除）", before: "*", after: "*", ph: "斜体", toggle: true },
  { sym: "U", title: "下線（再度で解除）", before: "<u>", after: "</u>", ph: "下線", toggle: true },
  { sym: "S", title: "取り消し線（再度で解除）", before: "~~", after: "~~", ph: "取り消し", toggle: true },
];

export function RecordForm({
  initialTitle = "",
  initialAuthor = "",
  sourceTitle,
  editSlug,
  initialCategory,
  initialRating,
  initialDateRead,
  initialTags,
  initialBody,
  categories,
  onDone,
  onCancel,
}: {
  initialTitle?: string;
  initialAuthor?: string;
  /** 積読から開いた場合の元タイトル。作成後にその行を積読から消すのに使う。 */
  sourceTitle?: string;
  /** 指定されると編集モードになる（編集前の slug）。 */
  editSlug?: string;
  initialCategory?: string;
  initialRating?: number;
  initialDateRead?: string;
  /** すでにカンマ区切りになったタグ文字列。 */
  initialTags?: string;
  initialBody?: string;
  categories: string[];
  onDone: (slug: string) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(editSlug);
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState(initialAuthor);
  const [slug, setSlug] = useState(() => (isEdit ? editSlug! : slugify(initialTitle)));
  // In edit mode the slug must not follow the title — a rename is deliberate.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [rating, setRating] = useState(initialRating ?? 4);
  const [dateRead, setDateRead] = useState(initialDateRead ?? today());
  const [tags, setTags] = useState(initialTags ?? "");
  const [body, setBody] = useState(initialBody ?? BODY_TEMPLATE);
  const [color, setColor] = useState("#b3271e");
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);

  // Stable per-form draft key: keyed by the edit slug, or by the 積読 source
  // title in create mode, so reopening the same form finds the same draft.
  const draftKey = useMemo(
    () => (isEdit ? `${DRAFT_PREFIX}edit:${editSlug}` : `${DRAFT_PREFIX}new:${sourceTitle ?? ""}`),
    [isEdit, editSlug, sourceTitle]
  );
  const [foundDraft, setFoundDraft] = useState<Draft | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The values the form opened with. Autosave only fires once something
  // actually differs from these, so merely opening a form can never overwrite
  // an existing draft. (Skipping "the first effect run" instead would not work:
  // React StrictMode double-invokes effects in dev, and the second run would
  // write back the untouched initial values, destroying the saved draft.)
  const openedWith = useRef({
    title,
    author,
    slug,
    slugTouched,
    category,
    rating,
    dateRead,
    tags,
    body,
  });

  // Undo/redo history (covers toolbar insertions, which the native textarea
  // undo stack misses). Typing is coalesced via a short debounce.
  // Seed with the body actually loaded, so the first undo in edit mode does not
  // wipe the article back to the template.
  const hist = useRef<{ stack: string[]; index: number }>({
    stack: [initialBody ?? BODY_TEMPLATE],
    index: 0,
  });
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingSel.current && taRef.current) {
      const [a, b] = pendingSel.current;
      taRef.current.focus();
      taRef.current.setSelectionRange(a, b);
      pendingSel.current = null;
    }
  }, [body]);

  // Keep slug in sync with the title until the user edits the slug by hand.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
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
      const isEcho =
        draft.title === title &&
        draft.author === author &&
        draft.slug === slug &&
        draft.slugTouched === slugTouched &&
        draft.category === category &&
        draft.rating === rating &&
        draft.dateRead === dateRead &&
        draft.tags === tags &&
        draft.body === body;
      if (isEcho) {
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
    const o = openedWith.current;
    const untouched =
      title === o.title &&
      author === o.author &&
      slug === o.slug &&
      slugTouched === o.slugTouched &&
      category === o.category &&
      rating === o.rating &&
      dateRead === o.dateRead &&
      tags === o.tags &&
      body === o.body;
    if (untouched) return;

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      try {
        const draft: Draft = {
          savedAt: Date.now(),
          title,
          author,
          slug,
          slugTouched,
          category,
          rating,
          dateRead,
          tags,
          body,
        };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // ignore quota/private-mode failures
      }
    }, 600);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [draftKey, title, author, slug, slugTouched, category, rating, dateRead, tags, body]);

  function restoreDraft() {
    if (!foundDraft) return;
    setTitle(foundDraft.title);
    setAuthor(foundDraft.author);
    setSlug(foundDraft.slug);
    setSlugTouched(foundDraft.slugTouched);
    setCategory(foundDraft.category);
    setRating(foundDraft.rating);
    setDateRead(foundDraft.dateRead);
    setTags(foundDraft.tags);
    setBody(foundDraft.body);
    hist.current = { stack: [foundDraft.body], index: 0 };
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

  function record(value: string) {
    const h = hist.current;
    if (value === h.stack[h.index]) return;
    const stack = h.stack.slice(0, h.index + 1);
    stack.push(value);
    if (stack.length > 200) stack.shift();
    hist.current = { stack, index: stack.length - 1 };
  }

  function clearTimer() {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
  }

  function onBodyChange(value: string) {
    setBody(value);
    clearTimer();
    typingTimer.current = setTimeout(() => record(value), 350);
  }

  // Apply a programmatic edit (toolbar) and record it immediately.
  function commitNow(value: string, sel: [number, number]) {
    clearTimer();
    pendingSel.current = sel;
    setBody(value);
    record(value);
  }

  function undo() {
    clearTimer();
    const h = hist.current;
    if (body !== h.stack[h.index]) record(body); // flush pending typed state
    const cur = hist.current;
    if (cur.index > 0) {
      cur.index -= 1;
      const v = cur.stack[cur.index];
      pendingSel.current = [v.length, v.length];
      setBody(v);
    }
  }

  function redo() {
    clearTimer();
    const h = hist.current;
    if (h.index < h.stack.length - 1) {
      h.index += 1;
      const v = h.stack[h.index];
      pendingSel.current = [v.length, v.length];
      setBody(v);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      redo();
    }
  }

  function sel(): [number, number] {
    const ta = taRef.current;
    return ta ? [ta.selectionStart, ta.selectionEnd] : [body.length, body.length];
  }

  function surround(before: string, after: string, placeholder: string) {
    const [start, end] = sel();
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    const from = start + before.length;
    commitNow(next, [from, from + selected.length]);
  }

  // Wrap, or unwrap if the selection is already wrapped (toggle off).
  function toggleWrap(before: string, after: string, placeholder: string) {
    const [start, end] = sel();
    const selected = body.slice(start, end);

    // markers included inside the selection
    if (
      selected.length >= before.length + after.length &&
      selected.startsWith(before) &&
      selected.endsWith(after)
    ) {
      const inner = selected.slice(before.length, selected.length - after.length);
      const next = body.slice(0, start) + inner + body.slice(end);
      commitNow(next, [start, start + inner.length]);
      return;
    }
    // markers sitting just outside the selection
    const os = start - before.length;
    const oe = end + after.length;
    if (os >= 0 && body.slice(os, start) === before && body.slice(end, oe) === after) {
      const next = body.slice(0, os) + selected + body.slice(oe);
      commitNow(next, [os, os + selected.length]);
      return;
    }
    // otherwise wrap
    const s = selected || placeholder;
    const next = body.slice(0, start) + before + s + after + body.slice(end);
    const from = start + before.length;
    commitNow(next, [from, from + s.length]);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/records", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          originalSlug: editSlug,
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
      onDone(json.slug);
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
      <div className="rf-row">
        <label className="rf-label" htmlFor="rf-title">
          タイトル
        </label>
        <input
          id="rf-title"
          className="rf-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="本のタイトル"
        />
      </div>
      <div className="rf-row">
        <label className="rf-label" htmlFor="rf-author">
          著者
        </label>
        <input
          id="rf-author"
          className="rf-input"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="著者名"
        />
      </div>

      <div className="rf-row">
        <label className="rf-label" htmlFor="rf-slug">
          slug（ファイル名）
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
        <div className="rf-bodyhead">
          <label className="rf-label" htmlFor="rf-body">
            本文（Markdown ・ 数式は $…$ ・ Ctrl+Z / Ctrl+Shift+Z）
          </label>
          <button
            type="button"
            className="rf-preview-toggle"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "編集に戻る" : "プレビュー"}
          </button>
        </div>

        {!showPreview && (
          <div className="rf-toolbar">
            {TOOLS.map((t) => (
              <button
                key={t.title}
                type="button"
                className="rf-tool"
                title={t.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  t.toggle
                    ? toggleWrap(t.before, t.after, t.ph)
                    : surround(t.before, t.after, t.ph)
                }
              >
                {t.sym}
              </button>
            ))}
            <span className="rf-tool-color">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="文字色を選択"
                aria-label="文字色"
              />
              <button
                type="button"
                className="rf-tool"
                title="文字色"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  surround(`<span style="color:${color}">`, "</span>", "テキスト")
                }
              >
                A
              </button>
            </span>
          </div>
        )}

        {showPreview ? (
          <div className="rf-preview record-body">
            <MarkdownView>{body}</MarkdownView>
          </div>
        ) : (
          <textarea
            id="rf-body"
            ref={taRef}
            className="rf-input rf-textarea"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={14}
          />
        )}
      </div>

      {error && <p className="rf-error">{error}</p>}

      <div className="rf-actions">
        <button className="rf-btn rf-primary" onClick={submit} disabled={busy}>
          {isEdit ? (busy ? "更新中…" : "記事を更新") : busy ? "作成中…" : "記事を作成"}
        </button>
        <button className="rf-btn" onClick={onCancel} disabled={busy}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

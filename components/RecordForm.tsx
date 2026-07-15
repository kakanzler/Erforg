"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownView } from "./MarkdownView";

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
  const [color, setColor] = useState("#b3271e");
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);

  // Undo/redo history (covers toolbar insertions, which the native textarea
  // undo stack misses). Typing is coalesced via a short debounce.
  const hist = useRef<{ stack: string[]; index: number }>({
    stack: [BODY_TEMPLATE],
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
          {busy ? "作成中…" : "記事を作成"}
        </button>
        <button className="rf-btn" onClick={onCancel} disabled={busy}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownView } from "./MarkdownView";

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
/** A bare symbol insert like π or ∀ — no selection is wrapped. */
function sym(s: string, title: string, tex: string): Tool {
  return { sym: s, title, before: `$${tex}$`, after: "", ph: "" };
}

type ToolGroup = { label: string; tools: Tool[] };

// Greek is listed in alphabetical order so a letter can be found by position
// rather than by reading every glyph. Omicron is omitted deliberately: it is
// typographically identical to a Latin o and TeX has no distinct command for it.
const GREEK_LOWER: Tool[] = [
  sym("α", "アルファ", "\\alpha"),
  sym("β", "ベータ", "\\beta"),
  sym("γ", "ガンマ", "\\gamma"),
  sym("δ", "デルタ", "\\delta"),
  sym("ε", "イプシロン", "\\varepsilon"),
  sym("ζ", "ゼータ", "\\zeta"),
  sym("η", "エータ", "\\eta"),
  sym("θ", "シータ", "\\theta"),
  sym("ι", "イオタ", "\\iota"),
  sym("κ", "カッパ", "\\kappa"),
  sym("λ", "ラムダ", "\\lambda"),
  sym("μ", "ミュー", "\\mu"),
  sym("ν", "ニュー", "\\nu"),
  sym("ξ", "クシー", "\\xi"),
  sym("π", "パイ", "\\pi"),
  sym("ρ", "ロー", "\\rho"),
  sym("σ", "シグマ", "\\sigma"),
  sym("τ", "タウ", "\\tau"),
  sym("υ", "ウプシロン", "\\upsilon"),
  // \varphi is the curly φ; KaTeX's \phi draws the straight-stemmed ϕ.
  sym("φ", "ファイ", "\\varphi"),
  sym("χ", "カイ", "\\chi"),
  sym("ψ", "プサイ", "\\psi"),
  sym("ω", "オメガ", "\\omega"),
];

// Only the capitals that differ from a Latin letter — the rest are typed直接.
const GREEK_UPPER: Tool[] = [
  sym("Γ", "ガンマ（大）", "\\Gamma"),
  sym("Δ", "デルタ（大）", "\\Delta"),
  sym("Θ", "シータ（大）", "\\Theta"),
  sym("Λ", "ラムダ（大）", "\\Lambda"),
  sym("Ξ", "クシー（大）", "\\Xi"),
  sym("Π", "パイ（大）", "\\Pi"),
  sym("Σ", "シグマ（大）", "\\Sigma"),
  sym("Υ", "ウプシロン（大）", "\\Upsilon"),
  sym("Φ", "ファイ（大）", "\\Phi"),
  sym("Ψ", "プサイ（大）", "\\Psi"),
  sym("Ω", "オメガ（大）", "\\Omega"),
];

const MATH_GROUPS: ToolGroup[] = [
  {
    label: "演算",
    tools: [
      // \displaystyle draws the operator full size. \int keeps its bounds beside
      // the sign as super/subscripts (its default); \sum and \bigcup/\bigcap
      // stack them above and below, which is conventional for each.
      {
        sym: "∫",
        title: "定積分",
        before: "$\\displaystyle\\int_{a}^{b} ",
        after: " \\, dx$",
        ph: "f(x)",
      },
      { sym: "a⁄b", title: "分数", before: "$\\frac{", after: "}{b}$", ph: "a" },
      { sym: "√", title: "平方根", before: "$\\sqrt{", after: "}$", ph: "x" },
      {
        sym: "∑",
        title: "総和",
        before: "$\\displaystyle\\sum\\limits_{i=1}^{n} ",
        after: "$",
        ph: "a_i",
      },
      // A bare arrow, not a combining one over a letter — the mincho face has
      // no U+20D7 and renders it as tofu.
      { sym: "→", title: "ベクトル", before: "$\\vec{", after: "}$", ph: "a" },
      { sym: "xⁿ", title: "上付き", before: "<sup>", after: "</sup>", ph: "2" },
      { sym: "xₙ", title: "下付き", before: "<sub>", after: "</sub>", ph: "2" },
    ],
  },
  {
    label: "関数",
    tools: [
      { sym: "log", title: "log", before: "$\\log ", after: "$", ph: "x" },
      { sym: "sin", title: "sin", before: "$\\sin ", after: "$", ph: "\\theta" },
      { sym: "cos", title: "cos", before: "$\\cos ", after: "$", ph: "\\theta" },
      { sym: "tan", title: "tan", before: "$\\tan ", after: "$", ph: "\\theta" },
    ],
  },
  {
    label: "集合",
    tools: [
      // \mathbb gives the double-struck letters used for the number systems.
      sym("ℕ", "自然数全体", "\\mathbb{N}"),
      sym("ℤ", "整数全体", "\\mathbb{Z}"),
      sym("ℚ", "有理数全体", "\\mathbb{Q}"),
      sym("ℝ", "実数全体", "\\mathbb{R}"),
      sym("ℂ", "複素数全体", "\\mathbb{C}"),
      {
        sym: "∪",
        title: "和集合",
        before: "$\\displaystyle\\bigcup_{i=1}^{n} ",
        after: "$",
        ph: "A_i",
      },
      {
        sym: "∩",
        title: "積集合",
        before: "$\\displaystyle\\bigcap_{i=1}^{n} ",
        after: "$",
        ph: "A_i",
      },
      // \varnothing is the round slashed circle; \emptyset draws a narrow zero.
      sym("∅", "空集合", "\\varnothing"),
      sym("∈", "属する", "\\in"),
      sym("⊂", "部分集合", "\\subset"),
      sym("∃", "存在する", "\\exists"),
      sym("∀", "すべての", "\\forall"),
    ],
  },
  { label: "ギリシャ文字", tools: [...GREEK_LOWER, ...GREEK_UPPER] },
  {
    label: "組合せ",
    tools: [
      { sym: "nCr", title: "組み合わせ", before: "${}_{n}\\mathrm{C}_{k}$", after: "", ph: "" },
      { sym: "nHr", title: "重複組み合わせ", before: "${}_{n}\\mathrm{H}_{k}$", after: "", ph: "" },
      { sym: "nΠr", title: "重複順列", before: "${}_{n}\\Pi_{k}$", after: "", ph: "" },
    ],
  },
];

const TEXT_GROUP: ToolGroup = {
  label: "書式",
  tools: [
    { sym: "小", title: "小文字", before: "<small>", after: "</small>", ph: "テキスト" },
    { sym: "B", title: "太字（再度で解除）", before: "**", after: "**", ph: "太字", toggle: true },
    { sym: "I", title: "イタリック（再度で解除）", before: "*", after: "*", ph: "斜体", toggle: true },
    { sym: "U", title: "下線（再度で解除）", before: "<u>", after: "</u>", ph: "下線", toggle: true },
    { sym: "S", title: "取り消し線（再度で解除）", before: "~~", after: "~~", ph: "取り消し", toggle: true },
  ],
};

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
  onDone,
  onCancel,
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
  onDone: (r: { bookSlug: string; slug: string }) => void;
  onCancel: () => void;
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
  const [bookSlug, setBookSlug] = useState(() => slugify(initialTitle));
  const [bookSlugTouched, setBookSlugTouched] = useState(false);

  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(() => (isEdit ? editSlug! : slugify(initialTitle)));
  // In edit mode the slug must not follow the title — a rename is deliberate.
  const [slugTouched, setSlugTouched] = useState(isEdit);
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

  // Keep each slug in sync with its title until that slug is edited by hand.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (!bookSlugTouched) setBookSlug(slugify(bookTitle));
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
    setBody(d.body);
    hist.current = { stack: [d.body], index: 0 };
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
      const targetBookSlug = isNewBook ? bookSlug : parent;
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
          slug,
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
      onDone({ bookSlug: json.bookSlug, slug: json.slug });
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

      {isNewBook ? (
        <>
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
          <div className="rf-grid">
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
        </>
      ) : (
        // An existing book's metadata is not editable here: the API deliberately
        // ignores the book fields for a book that already exists, so inputs
        // would silently do nothing.
        <div className="rf-row">
          <span className="rf-label">この本の情報</span>
          {/* inline: the stylesheet is out of scope for this change */}
          <p style={{ margin: "0.2rem 0", opacity: 0.85 }}>
            {[selectedBook?.title, selectedBook?.author, selectedBook?.category]
              .filter(Boolean)
              .join(" ・ ")}
          </p>
        </div>
      )}

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
            本文（Markdown ・ 数式は $…$ ・ 図は ```mermaid ・ Ctrl+Z /
            Ctrl+Shift+Z）
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
            <div className="rf-tool-section">
              {MATH_GROUPS.map((group) => (
                <div key={group.label} className="rf-tool-group">
                  <span className="rf-tool-group-label">{group.label}</span>
                  <div className="rf-tool-group-items">
                    {group.tools.map((t) => (
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
                  </div>
                </div>
              ))}
            </div>

            <div className="rf-tool-section rf-tool-section-text">
              <div className="rf-tool-group">
                <span className="rf-tool-group-label">{TEXT_GROUP.label}</span>
                <div className="rf-tool-group-items">
                  {TEXT_GROUP.tools.map((t) => (
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
              </div>
            </div>
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

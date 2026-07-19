"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "./MarkdownView";

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

/**
 * The shared authoring editor: the math / text toolbar, its own undo–redo
 * history (the native textarea stack misses programmatic insertions), selection
 * handling and the preview toggle. The parent owns the body string, so a form
 * can snapshot it into a draft or post it without knowing about any of this.
 */
export function MarkdownEditor({
  value,
  onChange,
  id = "rf-body",
}: {
  value: string;
  onChange: (v: string) => void;
  /** 本文 textarea の id。同じ画面に複数置くときだけ変える。 */
  id?: string;
}) {
  const [color, setColor] = useState("#b3271e");
  const [showPreview, setShowPreview] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);

  // Undo/redo history (covers toolbar insertions, which the native textarea
  // undo stack misses). Typing is coalesced via a short debounce.
  // Seeded with the body actually loaded, so the first undo in edit mode does
  // not wipe the article back to the template.
  const hist = useRef<{ stack: string[]; index: number }>({
    stack: [value],
    index: 0,
  });
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last value this editor itself produced. Anything else arriving in
  // `value` is the parent replacing the body wholesale (e.g. restoring a
  // draft), which must start a fresh history rather than let undo walk back
  // into the discarded text.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      hist.current = { stack: [value], index: 0 };
    }
  }, [value]);

  useEffect(() => {
    if (pendingSel.current && taRef.current) {
      const [a, b] = pendingSel.current;
      taRef.current.focus();
      taRef.current.setSelectionRange(a, b);
      pendingSel.current = null;
    }
  }, [value]);

  function emit(next: string) {
    lastEmitted.current = next;
    onChange(next);
  }

  function record(v: string) {
    const h = hist.current;
    if (v === h.stack[h.index]) return;
    const stack = h.stack.slice(0, h.index + 1);
    stack.push(v);
    if (stack.length > 200) stack.shift();
    hist.current = { stack, index: stack.length - 1 };
  }

  function clearTimer() {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
  }

  function onBodyChange(next: string) {
    emit(next);
    clearTimer();
    typingTimer.current = setTimeout(() => record(next), 350);
  }

  // Apply a programmatic edit (toolbar) and record it immediately.
  function commitNow(next: string, s: [number, number]) {
    clearTimer();
    pendingSel.current = s;
    emit(next);
    record(next);
  }

  function undo() {
    clearTimer();
    const h = hist.current;
    if (value !== h.stack[h.index]) record(value); // flush pending typed state
    const cur = hist.current;
    if (cur.index > 0) {
      cur.index -= 1;
      const v = cur.stack[cur.index];
      pendingSel.current = [v.length, v.length];
      emit(v);
    }
  }

  function redo() {
    clearTimer();
    const h = hist.current;
    if (h.index < h.stack.length - 1) {
      h.index += 1;
      const v = h.stack[h.index];
      pendingSel.current = [v.length, v.length];
      emit(v);
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
    return ta ? [ta.selectionStart, ta.selectionEnd] : [value.length, value.length];
  }

  function surround(before: string, after: string, placeholder: string) {
    const [start, end] = sel();
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    const from = start + before.length;
    commitNow(next, [from, from + selected.length]);
  }

  // Wrap, or unwrap if the selection is already wrapped (toggle off).
  function toggleWrap(before: string, after: string, placeholder: string) {
    const [start, end] = sel();
    const selected = value.slice(start, end);

    // markers included inside the selection
    if (
      selected.length >= before.length + after.length &&
      selected.startsWith(before) &&
      selected.endsWith(after)
    ) {
      const inner = selected.slice(before.length, selected.length - after.length);
      const next = value.slice(0, start) + inner + value.slice(end);
      commitNow(next, [start, start + inner.length]);
      return;
    }
    // markers sitting just outside the selection
    const os = start - before.length;
    const oe = end + after.length;
    if (os >= 0 && value.slice(os, start) === before && value.slice(end, oe) === after) {
      const next = value.slice(0, os) + selected + value.slice(oe);
      commitNow(next, [os, os + selected.length]);
      return;
    }
    // otherwise wrap
    const s = selected || placeholder;
    const next = value.slice(0, start) + before + s + after + value.slice(end);
    const from = start + before.length;
    commitNow(next, [from, from + s.length]);
  }

  return (
    <div className="rf-row">
      <div className="rf-bodyhead">
        <label className="rf-label" htmlFor={id}>
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
          <MarkdownView>{value}</MarkdownView>
        </div>
      ) : (
        <textarea
          id={id}
          ref={taRef}
          className="rf-input rf-textarea"
          value={value}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={14}
        />
      )}
    </div>
  );
}

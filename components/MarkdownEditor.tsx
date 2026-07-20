"use client";

import { useEffect, useRef, useState } from "react";

// Toolbar insertions. `toggle` markers (bold/italic/underline/strike) are removed
// when the same button is pressed again on an already-wrapped selection.
type Tool = {
  sym: string;
  title: string;
  before: string;
  after: string;
  ph: string;
  toggle?: boolean;
  /**
   * Second keystroke of the chord, pressed after `Alt+<group prefix>`. A single
   * lowercase letter, or an uppercase letter meaning "with Shift". Matched
   * case-sensitively, so `g` and `G` are different tools.
   */
  key: string;
  /** The one tool whose `before` depends on the live colour picker. */
  useColor?: boolean;
};
/** A bare symbol insert like π or ∀ — no selection is wrapped. */
function sym(key: string, s: string, title: string, tex: string): Tool {
  return { key, sym: s, title, before: `$${tex}$`, after: "", ph: "" };
}

/** `prefix` is the letter pressed with Alt to arm this group. */
type ToolGroup = { label: string; prefix: string; tools: Tool[] };

// Greek is listed in alphabetical order so a letter can be found by position
// rather than by reading every glyph. Omicron is omitted deliberately: it is
// typographically identical to a Latin o and TeX has no distinct command for it.
// Chord keys follow the conventional Latin correspondence (α→a, θ→q, ω→w), and
// the capitals take the same letter with Shift.
const GREEK_LOWER: Tool[] = [
  sym("a", "α", "アルファ", "\\alpha"),
  sym("b", "β", "ベータ", "\\beta"),
  sym("g", "γ", "ガンマ", "\\gamma"),
  sym("d", "δ", "デルタ", "\\delta"),
  sym("e", "ε", "イプシロン", "\\varepsilon"),
  sym("z", "ζ", "ゼータ", "\\zeta"),
  sym("h", "η", "エータ", "\\eta"),
  sym("q", "θ", "シータ", "\\theta"),
  sym("i", "ι", "イオタ", "\\iota"),
  sym("k", "κ", "カッパ", "\\kappa"),
  sym("l", "λ", "ラムダ", "\\lambda"),
  sym("m", "μ", "ミュー", "\\mu"),
  sym("n", "ν", "ニュー", "\\nu"),
  sym("x", "ξ", "クシー", "\\xi"),
  sym("p", "π", "パイ", "\\pi"),
  sym("r", "ρ", "ロー", "\\rho"),
  sym("s", "σ", "シグマ", "\\sigma"),
  sym("t", "τ", "タウ", "\\tau"),
  sym("u", "υ", "ウプシロン", "\\upsilon"),
  // \varphi is the curly φ; KaTeX's \phi draws the straight-stemmed ϕ.
  sym("f", "φ", "ファイ", "\\varphi"),
  sym("c", "χ", "カイ", "\\chi"),
  sym("y", "ψ", "プサイ", "\\psi"),
  sym("w", "ω", "オメガ", "\\omega"),
];

// Only the capitals that differ from a Latin letter — the rest are typed直接.
const GREEK_UPPER: Tool[] = [
  sym("G", "Γ", "ガンマ（大）", "\\Gamma"),
  sym("D", "Δ", "デルタ（大）", "\\Delta"),
  sym("Q", "Θ", "シータ（大）", "\\Theta"),
  sym("L", "Λ", "ラムダ（大）", "\\Lambda"),
  sym("X", "Ξ", "クシー（大）", "\\Xi"),
  sym("P", "Π", "パイ（大）", "\\Pi"),
  sym("S", "Σ", "シグマ（大）", "\\Sigma"),
  sym("U", "Υ", "ウプシロン（大）", "\\Upsilon"),
  sym("F", "Φ", "ファイ（大）", "\\Phi"),
  sym("Y", "Ψ", "プサイ（大）", "\\Psi"),
  sym("W", "Ω", "オメガ（大）", "\\Omega"),
];

const MATH_GROUPS: ToolGroup[] = [
  {
    label: "演算",
    prefix: "o",
    tools: [
      // \displaystyle draws the operator full size. \int keeps its bounds beside
      // the sign as super/subscripts (its default); \sum and \bigcup/\bigcap
      // stack them above and below, which is conventional for each.
      {
        key: "i",
        sym: "∫",
        title: "定積分",
        before: "$\\displaystyle\\int_{a}^{b} ",
        after: " \\, dx$",
        ph: "f(x)",
      },
      { key: "f", sym: "a⁄b", title: "分数", before: "$\\frac{", after: "}{b}$", ph: "a" },
      { key: "r", sym: "√", title: "平方根", before: "$\\sqrt{", after: "}$", ph: "x" },
      {
        key: "s",
        sym: "∑",
        title: "総和",
        before: "$\\displaystyle\\sum\\limits_{i=1}^{n} ",
        after: "$",
        ph: "a_i",
      },
      // A bare arrow, not a combining one over a letter — the mincho face has
      // no U+20D7 and renders it as tofu.
      { key: "v", sym: "→", title: "ベクトル", before: "$\\vec{", after: "}$", ph: "a" },
      { key: "u", sym: "xⁿ", title: "上付き", before: "<sup>", after: "</sup>", ph: "2" },
      { key: "d", sym: "xₙ", title: "下付き", before: "<sub>", after: "</sub>", ph: "2" },
    ],
  },
  {
    label: "関数",
    // "k" and not "f": Chrome reserves Alt+F for its own menu.
    prefix: "k",
    tools: [
      { key: "l", sym: "log", title: "log", before: "$\\log ", after: "$", ph: "x" },
      { key: "s", sym: "sin", title: "sin", before: "$\\sin ", after: "$", ph: "\\theta" },
      { key: "c", sym: "cos", title: "cos", before: "$\\cos ", after: "$", ph: "\\theta" },
      { key: "t", sym: "tan", title: "tan", before: "$\\tan ", after: "$", ph: "\\theta" },
    ],
  },
  {
    label: "集合",
    prefix: "s",
    tools: [
      // \mathbb gives the double-struck letters used for the number systems.
      sym("n", "ℕ", "自然数全体", "\\mathbb{N}"),
      sym("z", "ℤ", "整数全体", "\\mathbb{Z}"),
      sym("q", "ℚ", "有理数全体", "\\mathbb{Q}"),
      sym("r", "ℝ", "実数全体", "\\mathbb{R}"),
      sym("c", "ℂ", "複素数全体", "\\mathbb{C}"),
      {
        key: "u",
        sym: "∪",
        title: "和集合",
        before: "$\\displaystyle\\bigcup_{i=1}^{n} ",
        after: "$",
        ph: "A_i",
      },
      {
        key: "i",
        sym: "∩",
        title: "積集合",
        before: "$\\displaystyle\\bigcap_{i=1}^{n} ",
        after: "$",
        ph: "A_i",
      },
      // \varnothing is the round slashed circle; \emptyset draws a narrow zero.
      sym("e", "∅", "空集合", "\\varnothing"),
      sym("m", "∈", "属する", "\\in"),
      sym("b", "⊂", "部分集合", "\\subset"),
      sym("x", "∃", "存在する", "\\exists"),
      sym("a", "∀", "すべての", "\\forall"),
    ],
  },
  { label: "ギリシャ文字", prefix: "g", tools: [...GREEK_LOWER, ...GREEK_UPPER] },
  {
    label: "組合せ",
    prefix: "c",
    tools: [
      { key: "c", sym: "nCr", title: "組み合わせ", before: "${}_{n}\\mathrm{C}_{k}$", after: "", ph: "" },
      { key: "h", sym: "nHr", title: "重複組み合わせ", before: "${}_{n}\\mathrm{H}_{k}$", after: "", ph: "" },
      { key: "p", sym: "nΠr", title: "重複順列", before: "${}_{n}\\Pi_{k}$", after: "", ph: "" },
    ],
  },
];

const TEXT_GROUP: ToolGroup = {
  label: "書式",
  prefix: "t",
  tools: [
    { key: "m", sym: "小", title: "小文字", before: "<small>", after: "</small>", ph: "テキスト" },
    { key: "b", sym: "B", title: "太字（再度で解除）", before: "**", after: "**", ph: "太字", toggle: true },
    { key: "i", sym: "I", title: "イタリック（再度で解除）", before: "*", after: "*", ph: "斜体", toggle: true },
    { key: "u", sym: "U", title: "下線（再度で解除）", before: "<u>", after: "</u>", ph: "下線", toggle: true },
    { key: "s", sym: "S", title: "取り消し線（再度で解除）", before: "~~", after: "~~", ph: "取り消し", toggle: true },
    // Rendered apart from the others (beside the colour picker), but it belongs
    // to the group so it takes part in the chord map and the uniqueness check.
    { key: "c", sym: "A", title: "文字色", before: "", after: "</span>", ph: "テキスト", useColor: true },
  ],
};

const ALL_GROUPS: ToolGroup[] = [...MATH_GROUPS, TEXT_GROUP];

// A duplicate key would silently shadow a button, and a duplicate prefix would
// shadow a whole group — fail loudly at module load instead.
(function assertChordsUnique() {
  const prefixes = new Set<string>();
  for (const g of ALL_GROUPS) {
    if (prefixes.has(g.prefix)) {
      throw new Error(`MarkdownEditor: duplicate group prefix "${g.prefix}"`);
    }
    prefixes.add(g.prefix);
    const keys = new Set<string>();
    for (const t of g.tools) {
      if (keys.has(t.key)) {
        throw new Error(
          `MarkdownEditor: duplicate chord key "${t.key}" in group "${g.label}"`
        );
      }
      keys.add(t.key);
    }
  }
})();

/** How long an armed chord waits for its second keystroke. */
const CHORD_TIMEOUT_MS = 3000;

/** Keydowns that are only a modifier: Shift+W must not disarm on the Shift. */
const MODIFIER_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "AltGraph",
]);

/** "Alt+O → S" / "Alt+G → Shift+W" — the shift form marks an uppercase key. */
function chordHint(prefix: string, key: string): string {
  const shifted = key !== key.toLowerCase();
  return `Alt+${prefix.toUpperCase()} → ${shifted ? "Shift+" : ""}${key.toUpperCase()}`;
}

function toolTitle(group: ToolGroup, t: Tool): string {
  return `${t.title}（${chordHint(group.prefix, t.key)}）`;
}

/**
 * With Alt held, some layouts report a composed character in `key`; the
 * physical `code` still names the letter, so prefer it for the prefix step.
 */
function prefixLetter(e: React.KeyboardEvent): string {
  const m = /^Key([A-Z])$/.exec(e.code);
  return m ? m[1].toLowerCase() : e.key.toLowerCase();
}

/**
 * The shared authoring editor: the math / text toolbar, its own undo–redo
 * history (the native textarea stack misses programmatic insertions) and
 * selection handling. The parent owns the body string, so a form can snapshot
 * it into a draft or post it without knowing about any of this.
 *
 * There is no preview here: every consumer is an /edit page whose right-hand
 * pane already renders the body, so a second preview would only compete with it.
 */
export function MarkdownEditor({
  value,
  onChange,
  id = "rf-body",
  rightPane,
}: {
  value: string;
  onChange: (v: string) => void;
  /** 本文 textarea の id。同じ画面に複数置くときだけ変える。 */
  id?: string;
  /**
   * A reading pane to show beside the textarea (preview / reference tabs).
   * When present, the toolbar spans the full width above a `textarea | rightPane`
   * split; when absent, the textarea alone fills the row as before.
   */
  rightPane?: React.ReactNode;
}) {
  const [color, setColor] = useState("#b3271e");
  // The group armed by Alt+<prefix>, waiting for its second keystroke.
  const [armed, setArmed] = useState<ToolGroup | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function disarm() {
    if (chordTimer.current) {
      clearTimeout(chordTimer.current);
      chordTimer.current = null;
    }
    setArmed(null);
  }

  function arm(group: ToolGroup) {
    if (chordTimer.current) clearTimeout(chordTimer.current);
    chordTimer.current = setTimeout(() => {
      chordTimer.current = null;
      setArmed(null);
    }, CHORD_TIMEOUT_MS);
    setArmed(group);
  }

  useEffect(() => {
    return () => {
      if (chordTimer.current) clearTimeout(chordTimer.current);
    };
  }, []);

  // Alt+W: focus the textarea and put the caret at the end, from anywhere on
  // the page (not just while the textarea already has focus — that is the
  // whole point of the shortcut). Attached on window, independent of the
  // chord handler above, which only ever sees keydowns already inside the
  // textarea.
  useEffect(() => {
    function onWindowKeyDown(e: KeyboardEvent) {
      // Only `isComposing` here. A Japanese IME reports keyCode 229 for keys it
      // routes through itself, but an Alt-modified key is never composition
      // text — bailing on 229 as well would silently kill this shortcut for
      // anyone typing in Japanese.
      if (e.isComposing) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const isW = e.code === "KeyW" || e.key.toLowerCase() === "w";
      if (!isW) return;
      e.preventDefault();
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        const end = ta.value.length;
        ta.setSelectionRange(end, end);
      }
    }
    // Capture phase, for the same reason as the tab shortcuts: nothing between
    // window and the focused element gets a chance to swallow it first.
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, []);

  /** Run a tool exactly as clicking its button does. */
  function runTool(t: Tool) {
    const before = t.useColor ? `<span style="color:${color}">` : t.before;
    if (t.toggle) toggleWrap(before, t.after, t.ph);
    else surround(before, t.after, t.ph);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Never take a keystroke away from a Japanese IME while it is composing.
    if (e.nativeEvent.isComposing) return;
    // keyCode 229 means "the IME is handling this key". That is true of the
    // letters it composes, but not of an Alt-modified key — treating those as
    // IME input would disable every chord while writing in Japanese.
    if (!e.altKey && e.nativeEvent.keyCode === 229) return;

    // Step 1 — Alt+<prefix> arms (or re-arms) a group.
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const group = ALL_GROUPS.find((g) => g.prefix === prefixLetter(e));
      if (group) {
        e.preventDefault();
        arm(group);
        return;
      }
    }

    // Step 2 — the next real keystroke either fires a tool or disarms.
    if (armed) {
      if (MODIFIER_KEYS.has(e.key)) return; // Shift of a Shift+W chord
      const group = armed;
      disarm();
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // Case-sensitive, so "g" and "G" pick different tools.
        const t = group.tools.find((x) => x.key === e.key);
        if (t) {
          e.preventDefault();
          runTool(t);
          return;
        }
        if (e.key === "Escape") {
          // Cancel the chord only. The editor may sit inside a Modal that
          // closes on Escape, and losing the whole form here would be brutal.
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        return;
      }
      // A Ctrl/Meta combination falls through to undo/redo below.
    }

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
          Ctrl+Shift+Z ・ Alt+キーで記号グループ）
        </label>
      </div>

      <div className="rf-toolbar">
        {/* Absolutely positioned, so arming a chord never reflows the toolbar. */}
        <span className="rf-chord" role="status" aria-live="polite">
          {armed ? `${armed.label}…` : ""}
        </span>

        <div className="rf-tool-section">
          {MATH_GROUPS.map((group) => (
            <div key={group.label} className="rf-tool-group">
              <span className="rf-tool-group-label">
                {group.label} (Alt+{group.prefix.toUpperCase()})
              </span>
              <div className="rf-tool-group-items">
                {group.tools.map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    className="rf-tool"
                    title={toolTitle(group, t)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runTool(t)}
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
            <span className="rf-tool-group-label">
              {TEXT_GROUP.label} (Alt+{TEXT_GROUP.prefix.toUpperCase()})
            </span>
            <div className="rf-tool-group-items">
              {/* The colour tool renders below, beside its picker. */}
              {TEXT_GROUP.tools
                .filter((t) => !t.useColor)
                .map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    className="rf-tool"
                    title={toolTitle(TEXT_GROUP, t)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runTool(t)}
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
                {TEXT_GROUP.tools
                  .filter((t) => t.useColor)
                  .map((t) => (
                    <button
                      key={t.title}
                      type="button"
                      className="rf-tool"
                      title={toolTitle(TEXT_GROUP, t)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => runTool(t)}
                    >
                      {t.sym}
                    </button>
                  ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {rightPane ? (
        <div className="edit-split">
          {/* Row 1: a header for each column, so both share the same row
              height and row 2 (the two bodies) necessarily starts level. */}
          <div className="edit-pane edit-pane-editor-head">
            編集 <span className="edit-hotkey">(Alt+W)</span>
          </div>
          <div className="edit-pane edit-pane-editor">
            <textarea
              id={id}
              ref={taRef}
              className="rf-input rf-textarea"
              value={value}
              onChange={(e) => onBodyChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={disarm}
              rows={14}
            />
          </div>
          {/* rightPane (EditorPane) is a fragment of its own tab strip plus
              two panes, all placed directly as grid items so the tab strip
              shares row 1 and the panes share row 2 with the left column. */}
          {rightPane}
        </div>
      ) : (
        <textarea
          id={id}
          ref={taRef}
          className="rf-input rf-textarea"
          value={value}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={disarm}
          rows={14}
        />
      )}
    </div>
  );
}

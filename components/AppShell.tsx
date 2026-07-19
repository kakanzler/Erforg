"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { TbrBook } from "@/lib/books";
import { Stars } from "./Stars";
import { TsundokuList } from "./TsundokuList";

/** Only the article fields the sidebar tree shows — never the markdown body. */
export type ShellArticle = {
  slug: string;
  title: string;
  dateRead: string;
  rating: number;
};

export type ShellBook = {
  slug: string;
  title: string;
  author: string;
  category: string;
  articles: ShellArticle[];
};

/** Only the note fields the sidebar tree shows — never the markdown body. */
export type ShellNote = {
  category: string;
  slug: string;
  title: string;
  date: string;
};

export type ShellNoteCategory = {
  name: string;
  notes: ShellNote[];
};

type NamedCount = { name: string; count: number };

const LEFT_KEY = "erfolg:ui:left";
const RIGHT_KEY = "erfolg:ui:right";
const COLLAPSED_KEY = "erfolg:ui:collapsed";

/**
 * Books and note categories share one collapsed-set, so note categories are
 * namespaced. A book slug can never start with this prefix: the API rejects a
 * slug containing ":" as an illegal filename character.
 */
const NOTE_KEY_PREFIX = "note:";

/** Must match the overlay breakpoint in globals.css. */
const OVERLAY_MAX_WIDTH = 1100;

/** The sidebar shows a taste of the pile; /tsundoku holds the whole list. */
const TBR_PREVIEW = 8;

/** "2026-05-11" → "2026.05.11" (compact form for tree rows). */
function shortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Japanese slugs arrive percent-encoded in the pathname; compare decoded. */
function decodePath(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore private-mode / quota failures
  }
  return fallback;
}

function writeBool(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

/**
 * NOTEBOOK: notes that belong to a free-form category instead of a book.
 * A category row only expands/collapses — there is no category index page.
 */
function NotebookPanel({
  noteCategories,
  editable,
  collapsed,
  onToggleCategory,
  here,
}: {
  noteCategories: ShellNoteCategory[];
  editable: boolean;
  collapsed: Set<string>;
  onToggleCategory: (key: string) => void;
  here: string;
}) {
  const total = noteCategories.reduce((n, c) => n + c.notes.length, 0);

  // Nothing to show and nothing to add — the heading alone would be noise.
  if (!editable && total === 0) return null;

  return (
    <>
      <h2 className="section-title notebook-title">
        <span>
          NOTEBOOK（{noteCategories.length}分類 ・ {total}件）
        </span>
        {editable && (
          <Link
            href="/edit/note"
            className="notebook-add"
            title="ノートを追加"
            aria-label="ノートを追加"
          >
            ＋
          </Link>
        )}
      </h2>

      {noteCategories.length === 0 ? (
        <p className="tree-empty">まだノートがありません。</p>
      ) : (
        <ul className="tree">
          {noteCategories.map((c) => {
            const key = `${NOTE_KEY_PREFIX}${c.name}`;
            const isCollapsed = collapsed.has(key);

            return (
              <li key={c.name} className="tree-node">
                <div className="tree-book-row">
                  <button
                    type="button"
                    className="tree-toggle"
                    onClick={() => onToggleCategory(key)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${c.name}のノートを${
                      isCollapsed ? "開く" : "閉じる"
                    }`}
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                  {/* A category has no page of its own, so the row is a plain
                      label that toggles rather than a link. */}
                  <button
                    type="button"
                    className="tree-book tree-category"
                    onClick={() => onToggleCategory(key)}
                  >
                    <span className="tree-book-main">
                      <span className="tree-book-title">{c.name}</span>
                      <span className="tree-book-meta">{c.notes.length}件</span>
                    </span>
                  </button>
                </div>

                {!isCollapsed &&
                  (c.notes.length > 0 ? (
                    <ul className="tree-articles">
                      {c.notes.map((n, i) => {
                        const nHref = `/notes/${c.name}/${n.slug}`;
                        return (
                          <li key={n.slug} className="tree-article-item">
                            <Link
                              href={`/notes/${encodeURIComponent(
                                c.name
                              )}/${encodeURIComponent(n.slug)}`}
                              className="tree-article"
                              data-current={here === nHref}
                            >
                              <span className="tree-connector" aria-hidden="true">
                                {i === c.notes.length - 1 ? "└" : "├"}
                              </span>
                              <span className="tree-article-title">{n.title}</span>
                              <span className="tree-article-meta">
                                {shortDate(n.date)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="tree-empty">ノートなし</p>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * The CATEGORY chips, the BOOKS tree and the NOTEBOOK tree. Split out because
 * it reads `useSearchParams()`, which opts its nearest Suspense boundary into
 * client rendering — keeping it here means only this subtree is affected and
 * every page stays statically generated.
 */
function LeftPanel({
  books,
  categories,
  noteCategories,
  notesEditable,
  collapsed,
  onToggle,
}: {
  books: ShellBook[];
  categories: NamedCount[];
  noteCategories: ShellNoteCategory[];
  notesEditable: boolean;
  collapsed: Set<string>;
  /** Toggles one entry of the shared collapsed-set (book slug or note key). */
  onToggle: (key: string) => void;
}) {
  const active = useSearchParams().get("category") ?? undefined;
  const here = decodePath(usePathname());
  const shown = books.filter((b) => !active || b.category === active);

  return (
    <>
      <h2 className="section-title">CATEGORY</h2>
      <div className="categories">
        <Link href="/" className="chip" data-active={!active}>
          すべて
        </Link>
        {categories.map((c) => (
          <Link
            key={c.name}
            href={`/?category=${encodeURIComponent(c.name)}`}
            className="chip"
            data-active={active === c.name}
          >
            {c.name}（{c.count}）
          </Link>
        ))}
      </div>

      {/* Both counts, because a book can hold several articles — a single
          number here would contradict the heatmap's article total. */}
      <h2 className="section-title">
        {active ? active : "BOOKS"}（{shown.length}冊 ・{" "}
        {shown.reduce((n, b) => n + b.articles.length, 0)}記事）
      </h2>

      {shown.length === 0 ? (
        <p className="tree-empty">まだ記録がありません。</p>
      ) : (
        <ul className="tree">
          {shown.map((book) => {
            const href = `/books/${book.slug}`;
            const isCollapsed = collapsed.has(book.slug);
            const hasArticles = book.articles.length > 0;

            return (
              <li key={book.slug} className="tree-node">
                <div className="tree-book-row">
                  <button
                    type="button"
                    className="tree-toggle"
                    onClick={() => onToggle(book.slug)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${book.title}の記事を${
                      isCollapsed ? "開く" : "閉じる"
                    }`}
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                  <Link
                    href={href}
                    className="tree-book"
                    data-current={here === href}
                  >
                    <span className="tree-book-main">
                      <span className="tree-book-title">{book.title}</span>
                      <span className="tree-book-meta">
                        {[book.author, book.category].filter(Boolean).join(" ・ ")}
                      </span>
                    </span>
                  </Link>
                </div>

                {!isCollapsed &&
                  (hasArticles ? (
                    <ul className="tree-articles">
                      {book.articles.map((a, i) => {
                        const aHref = `${href}/${a.slug}`;
                        return (
                          <li key={a.slug} className="tree-article-item">
                            <Link
                              href={aHref}
                              className="tree-article"
                              data-current={here === aHref}
                            >
                              <span className="tree-connector" aria-hidden="true">
                                {i === book.articles.length - 1 ? "└" : "├"}
                              </span>
                              <span className="tree-article-title">{a.title}</span>
                              <span className="tree-article-meta">
                                {shortDate(a.dateRead)}
                                {a.rating > 0 && <Stars rating={a.rating} />}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="tree-empty">記事なし</p>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      <NotebookPanel
        noteCategories={noteCategories}
        editable={notesEditable}
        collapsed={collapsed}
        onToggleCategory={onToggle}
        here={here}
      />
    </>
  );
}

/**
 * 積読 preview. Its category filter is local UI state on purpose — the左の
 * CATEGORY links drive the URL, and mixing the two would make one sidebar
 * silently rewrite the other's view.
 */
function RightPanel({
  tsundoku,
  tsundokuCategories,
}: {
  tsundoku: TbrBook[];
  tsundokuCategories: NamedCount[];
}) {
  const [category, setCategory] = useState<string | null>(null);
  const shown = category
    ? tsundoku.filter((b) => b.category === category)
    : tsundoku;

  return (
    <>
      <h2 className="section-title">積んでる本</h2>

      {tsundoku.length === 0 ? (
        <p className="tree-empty">積んでる本はありません。</p>
      ) : (
        <>
          {/* With a single category every entry matches, so the chips would be
              two buttons that do nothing. They appear once 積読 entries carry
              a category (`- タイトル / 著者 / カテゴリ`). */}
          {tsundokuCategories.length > 1 && (
            <div className="categories">
              <button
                type="button"
                className="chip"
                data-active={category === null}
                onClick={() => setCategory(null)}
              >
                すべて
              </button>
              {tsundokuCategories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="chip"
                  data-active={category === c.name}
                  onClick={() => setCategory(c.name)}
                >
                  {c.name}（{c.count}）
                </button>
              ))}
            </div>
          )}

          <p className="tbr-count">
            {tsundoku.length}件中 {shown.length}件
          </p>

          <TsundokuList books={shown.slice(0, TBR_PREVIEW)} />

          <Link href="/tsundoku" className="see-all">
            すべて見る →
          </Link>
        </>
      )}
    </>
  );
}

/**
 * The frame shared by every page: CATEGORY + BOOKS on the left, the page in the
 * middle, and — only when running locally — 積読 on the right. Each side toggles
 * with a button or a hotkey ([ and ]) and remembers its state in localStorage.
 */
export function AppShell({
  books,
  categories,
  noteCategories,
  notesEditable,
  tsundoku,
  tsundokuCategories,
  showTsundoku,
  children,
}: {
  books: ShellBook[];
  categories: NamedCount[];
  noteCategories: ShellNoteCategory[];
  /** ノートの作成・編集はローカル開発時のみ。 */
  notesEditable: boolean;
  tsundoku: TbrBook[];
  tsundokuCategories: NamedCount[];
  /** 積読 is private, so the right sidebar exists only in local development. */
  showTsundoku: boolean;
  children: React.ReactNode;
}) {
  // Fixed server-side defaults. Reading localStorage in a useState initializer
  // would make the client's first render disagree with the server's HTML, so
  // the stored preference is applied in an effect below instead.
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Narrow viewports render the sidebars as overlays, so they start closed
    // there unless the reader has said otherwise.
    const wide = window.innerWidth > OVERLAY_MAX_WIDTH;
    setLeftOpen(readBool(LEFT_KEY, wide));
    setRightOpen(readBool(RIGHT_KEY, wide));
    try {
      const raw = window.localStorage.getItem(COLLAPSED_KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(list)) setCollapsed(new Set(list.map(String)));
    } catch {
      // ignore parse/storage errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeBool(LEFT_KEY, leftOpen);
  }, [hydrated, leftOpen]);

  useEffect(() => {
    if (hydrated) writeBool(RIGHT_KEY, rightOpen);
  }, [hydrated, rightOpen]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      // ignore storage errors
    }
  }, [hydrated, collapsed]);

  // Shared by the BOOKS and NOTEBOOK trees; note categories carry a prefix so
  // a category and a book slug of the same name cannot collide in the set.
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Hotkeys. Modifier combinations belong to the browser/OS, and a bare "[" is
  // ordinary text inside a form field — in both cases the key is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" && e.key !== "]") return;
      // "]" has nothing to toggle when the right sidebar does not exist.
      if (e.key === "]" && !showTsundoku) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      if (e.key === "[") setLeftOpen((v) => !v);
      else setRightOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTsundoku]);

  return (
    <div className="shell">
      <button
        type="button"
        className="shell-toggle shell-toggle-left"
        title="左サイドバー（[）"
        aria-label="左サイドバー（[）"
        aria-expanded={leftOpen}
        onClick={() => setLeftOpen((v) => !v)}
      >
        [
      </button>
      {showTsundoku && (
        <button
          type="button"
          className="shell-toggle shell-toggle-right"
          title="右サイドバー（]）"
          aria-label="右サイドバー（]）"
          aria-expanded={rightOpen}
          onClick={() => setRightOpen((v) => !v)}
        >
          ]
        </button>
      )}

      {/* Only visible at overlay widths (see globals.css). */}
      {(leftOpen || (rightOpen && showTsundoku)) && (
        <div
          className="shell-backdrop"
          aria-hidden="true"
          onClick={() => {
            setLeftOpen(false);
            setRightOpen(false);
          }}
        />
      )}

      <aside
        className="shell-side shell-side-left"
        data-open={leftOpen}
        aria-label="カテゴリ・本・ノート"
        aria-hidden={!leftOpen}
      >
        <Suspense fallback={<p className="tree-empty">読み込み中…</p>}>
          <LeftPanel
            books={books}
            categories={categories}
            noteCategories={noteCategories}
            notesEditable={notesEditable}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
          />
        </Suspense>
      </aside>

      <div className="shell-center">{children}</div>

      {showTsundoku && (
        <aside
          className="shell-side shell-side-right"
          data-open={rightOpen}
          aria-label="積んでる本"
          aria-hidden={!rightOpen}
        >
          <RightPanel
            tsundoku={tsundoku}
            tsundokuCategories={tsundokuCategories}
          />
        </aside>
      )}
    </div>
  );
}

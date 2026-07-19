"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarkdownView } from "./MarkdownView";

const DRAFT_PREFIX = "erfolg:draft:";
const NOTE_PREFIX = "erfolg:draft:note:"; // must be tested before new:/edit:
const RECORD_EDIT_PREFIX = "erfolg:draft:edit:";
const RECORD_NEW_PREFIX = "erfolg:draft:new:";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // same TTL the forms use

/** Sentinel the note form writes into `picked` for a brand-new category. */
const NEW_CATEGORY = "__new__";

/** A record draft as written by RecordForm. */
type RecordDraft = {
  savedAt: number;
  bookTitle?: string;
  bookSlug?: string;
  title?: string;
  body?: string;
};

/** A note draft as written by NoteForm. */
type NoteDraft = {
  savedAt: number;
  picked?: string;
  newCategory?: string;
  title?: string;
  body?: string;
};

/** One row of the browser, normalized away from the two storage shapes. */
type DraftEntry = {
  key: string;
  kind: "record" | "note";
  savedAt: number;
  title: string;
  /** Subdued second line: the parent book, or the note's category. */
  context: string;
  body: string;
  /** Destination page when the draft belongs to an existing one, else null. */
  href: string | null;
  linkLabel: string;
};

const UNTITLED = "（無題）";

function formatDraftTime(savedAt: number): string {
  const d = new Date(savedAt);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/** `a/b` → `[a, b]`, splitting on the first slash only. Null when malformed. */
function splitPair(rest: string): [string, string] | null {
  const i = rest.indexOf("/");
  if (i <= 0) return null;
  const head = rest.slice(0, i);
  const tail = rest.slice(i + 1);
  if (!head || !tail) return null;
  return [head, tail];
}

function encodePath(...segments: string[]): string {
  return "/" + segments.map(encodeURIComponent).join("/");
}

/**
 * Turn one localStorage entry into a row, or null when the key is not a draft,
 * the value is corrupt (no numeric `savedAt`), or the draft is past its TTL.
 * Stale drafts are only hidden here — never deleted.
 */
function parseEntry(key: string, raw: string): DraftEntry | null {
  if (!key.startsWith(DRAFT_PREFIX)) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const savedAt = (value as { savedAt?: unknown }).savedAt;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (Date.now() - savedAt >= DRAFT_TTL_MS) return null;

  // `note:` first: `erfolg:draft:note:new` would otherwise never be reached,
  // and a note key must not be mistaken for a record one.
  if (key.startsWith(NOTE_PREFIX)) {
    const d = value as NoteDraft;
    const rest = key.slice(NOTE_PREFIX.length);
    const pair = splitPair(rest);
    const category =
      d.picked === NEW_CATEGORY ? (d.newCategory ?? "") : (d.picked ?? "");
    return {
      key,
      kind: "note",
      savedAt,
      title: d.title?.trim() || UNTITLED,
      context: category || (pair ? pair[0] : ""),
      body: d.body ?? "",
      href: pair ? encodePath("notes", pair[0], pair[1]) : null,
      linkLabel: "ノートを開く",
    };
  }

  if (key.startsWith(RECORD_EDIT_PREFIX) || key.startsWith(RECORD_NEW_PREFIX)) {
    const d = value as RecordDraft;
    const isEdit = key.startsWith(RECORD_EDIT_PREFIX);
    const pair = isEdit ? splitPair(key.slice(RECORD_EDIT_PREFIX.length)) : null;
    return {
      key,
      kind: "record",
      savedAt,
      title: d.title?.trim() || UNTITLED,
      context: d.bookTitle?.trim() || d.bookSlug?.trim() || "",
      body: d.body ?? "",
      href: pair ? encodePath("books", pair[0], pair[1]) : null,
      linkLabel: "記事を開く",
    };
  }

  return null;
}

/** Read every live draft out of localStorage, newest saved first. */
function loadDrafts(): DraftEntry[] {
  if (typeof window === "undefined") return [];
  const out: DraftEntry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const raw = window.localStorage.getItem(key);
      if (raw == null) continue;
      const entry = parseEntry(key, raw);
      if (entry) out.push(entry);
    }
  } catch {
    // ignore storage errors (private mode etc.)
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Two-pane browser over the locally saved drafts: the list on the left, the
 * selected draft's Markdown rendered on the right. Mounted only while the
 * modal is open, so the read always reflects the current storage.
 */
export function DraftBrowser() {
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadDrafts();
    setDrafts(loaded);
    setSelectedKey(loaded[0]?.key ?? null);
  }, []);

  const records = useMemo(() => drafts.filter((d) => d.kind === "record"), [drafts]);
  const notes = useMemo(() => drafts.filter((d) => d.kind === "note"), [drafts]);
  const selected = drafts.find((d) => d.key === selectedKey) ?? null;

  function discard(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
    const i = drafts.findIndex((d) => d.key === key);
    const remaining = drafts.filter((d) => d.key !== key);
    setDrafts(remaining);
    if (selectedKey === key) {
      // Move to the draft that took its place, or to the previous one.
      const next = remaining[i] ?? remaining[i - 1] ?? null;
      setSelectedKey(next?.key ?? null);
    }
  }

  function renderSection(label: string, items: DraftEntry[]) {
    return (
      <section className="db-section">
        <h3 className="section-title db-section-title">{label}</h3>
        {items.length === 0 ? (
          <p className="db-empty">なし</p>
        ) : (
          <ul className="db-items">
            {items.map((d) => (
              <li key={d.key}>
                <button
                  type="button"
                  className={`db-item${d.key === selectedKey ? " is-active" : ""}`}
                  onClick={() => setSelectedKey(d.key)}
                >
                  <span className="db-item-title">{d.title}</span>
                  <span className="db-item-meta">
                    {d.context ? `${d.context} ・ ` : ""}
                    {formatDraftTime(d.savedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="db db-none">
        <p className="db-empty">下書きはありません。</p>
      </div>
    );
  }

  return (
    <div className="db">
      <div className="db-list">
        {renderSection("読書記録", records)}
        {renderSection("NOTEBOOK", notes)}
      </div>
      <div className="db-preview">
        {selected && (
          <>
            <h2 className="db-preview-title">{selected.title}</h2>
            <p className="db-preview-meta">
              {[
                selected.kind === "record" ? "読書記録" : "NOTEBOOK",
                selected.context,
                `${formatDraftTime(selected.savedAt)} 保存`,
              ]
                .filter(Boolean)
                .join(" ・ ")}
            </p>
            <div className="db-preview-actions">
              {selected.href && (
                <Link href={selected.href} className="see-all">
                  {selected.linkLabel}
                </Link>
              )}
              <button
                type="button"
                className="db-discard"
                onClick={() => discard(selected.key)}
              >
                破棄
              </button>
            </div>
            <div className="db-body record-body">
              <MarkdownView>{selected.body}</MarkdownView>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

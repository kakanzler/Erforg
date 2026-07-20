"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarkdownView } from "./MarkdownView";

/**
 * One entry of the 参照 picker. Built on the server (see app/edit/references.ts)
 * and passed down as titles + ids only — bodies are fetched on demand from
 * /api/content, so opening an edit page never ships every article to the client.
 */
export type ReferenceItem = {
  /** `record:<book>/<article>` or `note:<category>/<slug>` — the option value. */
  id: string;
  kind: "record" | "note";
  /** Folder-level id: the book slug, or the note category. */
  parent: string;
  /** File-level id: the article slug, or the note slug. */
  slug: string;
  /** Heading the option is grouped under: the book title, or the category. */
  group: string;
  title: string;
  /** The published page this reference lives on. */
  href: string;
};

type Tab = "preview" | "reference";

type Loaded = { id: string; title: string; body: string };

/** Group the flat list into `<optgroup>`s, preserving the server's order. */
function byGroup(items: ReferenceItem[]): { group: string; items: ReferenceItem[] }[] {
  const out: { group: string; items: ReferenceItem[] }[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
}

function contentUrl(item: ReferenceItem): string {
  const p = new URLSearchParams({ kind: item.kind });
  if (item.kind === "record") {
    p.set("book", item.parent);
    p.set("article", item.slug);
  } else {
    p.set("category", item.parent);
    p.set("slug", item.slug);
  }
  return `/api/content?${p.toString()}`;
}

/**
 * The 参照 tab: pick anything already written and read it beside the draft.
 *
 * Its selection lives here rather than in the form, so typing in the editor —
 * which re-renders the whole form on every keystroke — cannot reset it. The
 * component is declared at module level for the same reason: a nested
 * declaration would be a new type each render and remount this state away.
 */
function ReferencePane({ references }: { references: ReferenceItem[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = references.find((r) => r.id === selectedId) ?? null;

  // Keyed on the id, not on the item object: `references` is a prop that the
  // form re-passes on every keystroke, and depending on the found object would
  // re-fetch the reference whenever its identity happened to change.
  useEffect(() => {
    const selected = references.find((r) => r.id === selectedId) ?? null;
    if (!selected) {
      setLoaded(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    fetch(contentUrl(selected))
      .then(async (res) => {
        const json = (await res.json()) as { title?: string; body?: string; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setLoaded(null);
          setError(json.error ?? "読み込みに失敗しました。");
          return;
        }
        setLoaded({ id: selected.id, title: json.title ?? selected.title, body: json.body ?? "" });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoaded(null);
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <>
      <div className="edit-ref-picker">
        <select
          className="rf-input"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label="参照する記事・ノート"
        >
          <option value="">— 参照するものを選ぶ —</option>
          {byGroup(references).map((g, i) => (
            <optgroup key={`${g.group}-${i}`} label={g.group}>
              {g.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selected && (
          <Link href={selected.href} className="see-all" target="_blank">
            ページを開く →
          </Link>
        )}
      </div>

      <div className="edit-pane-body record-body">
        {!selected && <p className="edit-pane-hint">書きながら読み返したい記事やノートを選べます。</p>}
        {selected && busy && <p className="edit-pane-hint">読み込み中…</p>}
        {error && <p className="rf-error">{error}</p>}
        {loaded && loaded.id === selected?.id && <MarkdownView>{loaded.body}</MarkdownView>}
      </div>
    </>
  );
}

/**
 * The right-hand reading pane, passed into `MarkdownEditor` as its `rightPane`:
 * a live preview of the same body, or any other note or article the writer
 * wants open beside it.
 */
export function EditorPane({
  body,
  references,
}: {
  body: string;
  references: ReferenceItem[];
}) {
  const [tab, setTab] = useState<Tab>("preview");

  // Alt+P / Alt+R switch tabs from anywhere on the edit page. This component
  // owns the tab state, so it owns these two; Alt+W (focus the textarea) is
  // MarkdownEditor's own listener, since it owns the textarea ref instead.
  useEffect(() => {
    function onWindowKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === "KeyP" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        setTab("preview");
      } else if (e.code === "KeyR" || e.key.toLowerCase() === "r") {
        e.preventDefault();
        setTab("reference");
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  return (
    <>
      <div className="edit-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="edit-tab"
          data-active={tab === "preview"}
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          プレビュー <span className="edit-hotkey">(Alt+P)</span>
        </button>
        <button
          type="button"
          role="tab"
          className="edit-tab"
          data-active={tab === "reference"}
          aria-selected={tab === "reference"}
          onClick={() => setTab("reference")}
        >
          参照 <span className="edit-hotkey">(Alt+R)</span>
        </button>
      </div>

      {/* Both panes stay mounted: unmounting the reference one would throw
          away the chosen document every time the writer peeks at the preview. */}
      <div className="edit-pane edit-pane-side-body" hidden={tab !== "preview"}>
        <div className="edit-pane-body record-body">
          <MarkdownView>{body}</MarkdownView>
        </div>
      </div>
      <div className="edit-pane edit-pane-side-body" hidden={tab !== "reference"}>
        <ReferencePane references={references} />
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Modal } from "./Modal";

// Loaded only when the browser is opened, so the (empty) public bundle stays
// light — MarkdownView, KaTeX and mermaid all ride along with this chunk.
const DraftBrowser = dynamic(
  () => import("./DraftBrowser").then((m) => m.DraftBrowser),
  { ssr: false }
);

/**
 * Top-page entry point for the saved local drafts. Drafts live in
 * localStorage and only matter while authoring, so this renders nothing
 * outside the local (editable) build.
 */
export function DraftList({ editable }: { editable: boolean }) {
  const [open, setOpen] = useState(false);

  if (!editable) return null;

  return (
    <div className="draft-list">
      <button className="draft-list-btn" onClick={() => setOpen(true)}>
        下書き
      </button>
      {open && (
        <Modal wide onClose={() => setOpen(false)}>
          <DraftBrowser />
        </Modal>
      )}
    </div>
  );
}

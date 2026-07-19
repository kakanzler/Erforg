"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the mermaid renderer. `next/dynamic` with `ssr: false`
 * is not allowed inside a server component, and MarkdownView is rendered from
 * one (app/books/[slug]/page.tsx), so the dynamic import is isolated here.
 */
// No `loading` fallback: Mermaid itself renders the raw source until the
// diagram is ready, which keeps the placeholder in one place.
const Mermaid = dynamic(() => import("./Mermaid"), { ssr: false });

export default function MermaidBlock({ chart }: { chart: string }) {
  return <Mermaid chart={chart} />;
}

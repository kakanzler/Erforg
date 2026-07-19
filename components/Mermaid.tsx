"use client";

import { useEffect, useId, useState } from "react";

/**
 * Parchment-tuned mermaid theme. Kept in sync with the ink/accent tokens in
 * app/globals.css (mermaid needs literal colors, it cannot read CSS vars).
 */
const THEME_VARIABLES = {
  background: "transparent",
  primaryColor: "#f2e3c0",
  primaryTextColor: "#3a2a16",
  primaryBorderColor: "#7a2e22",
  lineColor: "#7a2e22",
  secondaryColor: "#e9d8b4",
  tertiaryColor: "#efe2c6",
  fontFamily: "inherit",
  fontSize: "14px",
};

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

/**
 * Loads mermaid on first use and initializes it exactly once per module load.
 * The import lives here (not at module scope) so mermaid stays out of the
 * initial bundle and is only fetched on pages that contain a diagram.
 */
let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default as unknown as MermaidApi;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: THEME_VARIABLES,
        // On a parse failure mermaid otherwise injects its own "Syntax error"
        // bomb graphic into the document body, which would sit outside React's
        // tree and survive alongside our own fallback.
        suppressErrorRendering: true,
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export default function Mermaid({ chart }: { chart: string }) {
  const reactId = useId();
  // React's useId yields ":r0:" style values; colons are invalid in the DOM/CSS
  // ids mermaid generates internally, so reduce it to a safe token.
  const domId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);

    (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg: rendered } = await mermaid.render(domId, chart);
        if (!cancelled) setSvg(rendered);
      } catch {
        // A half-typed diagram in the live preview must never crash the form.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, domId]);

  if (failed) {
    return (
      <pre className="mermaid-error">
        図の記法にエラーがあります{"\n"}
        {chart}
      </pre>
    );
  }

  if (svg === null) {
    // Show the source while loading so there is no jump from an empty box.
    return <pre>{chart}</pre>;
  }

  return (
    <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

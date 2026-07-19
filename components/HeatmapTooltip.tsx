"use client";

import { useState } from "react";

type Tip = { text: string; x: number; y: number };

/**
 * Hover layer for the activity grid. The grid itself stays a server component —
 * only this thin wrapper ships, and it just reads the `data-tip` string the
 * server already put on each cell.
 *
 * The bubble is position:fixed rather than absolute so the scroll container's
 * `overflow-x: auto` (which forces overflow-y to auto too) cannot clip it.
 */
export function HeatmapTooltip({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);

  function show(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    const cell = target.closest<HTMLElement>("[data-tip]");
    if (!cell) {
      setTip(null);
      return;
    }
    const r = cell.getBoundingClientRect();
    // Keep the bubble inside the viewport; it is centred on the cell.
    const half = 110;
    const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    setTip({ text: cell.dataset.tip ?? "", x, y: r.top });
  }

  return (
    <div
      className="hm-hover"
      onMouseOver={(e) => show(e.target)}
      onMouseLeave={() => setTip(null)}
    >
      {children}
      {tip && (
        <div className="hm-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      )}
    </div>
  );
}

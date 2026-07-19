import type { Article } from "@/lib/books";
import { HeatmapTooltip } from "./HeatmapTooltip";

const WEEKDAYS = ["月", "", "水", "", "金", "", ""];
const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 0 = none, 1–4 = increasing intensity. */
function heatLevel(count: number, max: number): number {
  if (count <= 0) return 0;
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

type Cell = { key: string; count: number; tip: string } | null;

/** "2026.07.19" — the tooltip heading, without the 読了 suffix. */
function dotted(key: string): string {
  return key.replace(/-/g, ".");
}

/**
 * GitHub-style contribution grid. Cells are shaded by how many articles
 * carry that day as their read date — more articles that day = darker cell.
 */
export function ActivityHeatmap({
  articles,
  year,
}: {
  articles: Article[];
  year?: number;
}) {
  const y = year ?? new Date().getFullYear();

  // Which articles landed on each day — the count drives the shade, the list
  // becomes the hover text.
  const byDay = new Map<string, Article[]>();
  for (const a of articles) {
    if (!a.dateRead) continue;
    const d = new Date(a.dateRead);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== y) continue;
    const key = toKey(d);
    const list = byDay.get(key);
    if (list) list.push(a);
    else byDay.set(key, [a]);
  }
  const counts = new Map([...byDay].map(([k, v]) => [k, v.length]));
  const max = Math.max(1, ...counts.values());
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const todayIso = toKey(new Date());

  // Every day of the year, Monday-first, padded so week columns line up.
  const days: Cell[] = [];
  const cursor = new Date(y, 0, 1);
  const pad = (cursor.getDay() + 6) % 7; // Mon=0 … Sun=6
  for (let i = 0; i < pad; i++) days.push(null);
  while (cursor.getFullYear() === y) {
    const key = toKey(cursor);
    const on = byDay.get(key) ?? [];
    const tip = on.length
      ? [
          `${dotted(key)}（${on.length}記事）`,
          ...on.map((a) => `${a.bookTitle} — ${a.title}`),
        ].join("\n")
      : "";
    days.push({ key, count: on.length, tip });
    cursor.setDate(cursor.getDate() + 1);
  }
  while (days.length % 7 !== 0) days.push(null);

  const weeks: Cell[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // A month label sits above the week where that month first appears.
  let prevMonth = -1;
  const monthLabels = weeks.map((week) => {
    const first = week.find((c): c is NonNullable<Cell> => c !== null);
    if (!first) return "";
    const m = new Date(first.key).getMonth();
    if (m !== prevMonth) {
      prevMonth = m;
      return MONTHS[m];
    }
    return "";
  });

  return (
    <section className="heatmap">
      <div className="heatmap-head">
        <h2 className="section-title" style={{ margin: 0, border: "none" }}>
          ACTIVITY
        </h2>
        <span className="heatmap-total">
          {y}年 ・ {total}記事
        </span>
      </div>

      <HeatmapTooltip>
        <div className="heatmap-scroll">
        <div className="heatmap-grid">
          <div className="hm-weekdays">
            <div className="hm-monthrow-spacer" />
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="hm-weekday">
                {w}
              </div>
            ))}
          </div>

          <div>
            <div className="hm-months">
              {monthLabels.map((label, i) => (
                <div key={i} className="hm-month">
                  {label}
                </div>
              ))}
            </div>
            <div className="hm-weeks">
              {weeks.map((week, wi) => (
                <div key={wi} className="hm-week">
                  {week.map((cell, ci) => {
                    if (cell === null) {
                      return <div key={`e-${wi}-${ci}`} className="hm-cell hm-empty" />;
                    }
                    const future = cell.key > todayIso;
                    return (
                      <div
                        key={cell.key}
                        className="hm-cell"
                        data-level={future ? 0 : heatLevel(cell.count, max)}
                        data-today={cell.key === todayIso ? "true" : undefined}
                        // Only days with activity get a tooltip.
                        data-tip={cell.tip || undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </HeatmapTooltip>

      <div className="heatmap-legend">
        <span>少</span>
        <span className="hm-cell" data-level={0} />
        <span className="hm-cell" data-level={1} />
        <span className="hm-cell" data-level={2} />
        <span className="hm-cell" data-level={3} />
        <span className="hm-cell" data-level={4} />
        <span>多</span>
      </div>
    </section>
  );
}

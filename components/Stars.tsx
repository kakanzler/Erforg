export function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="stars" aria-label={`評価 ${full} / 5`}>
      {"★".repeat(full)}
      <span className="empty">{"★".repeat(5 - full)}</span>
    </span>
  );
}

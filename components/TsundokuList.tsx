import type { TbrBook } from "@/lib/books";

export function TsundokuList({ books }: { books: TbrBook[] }) {
  if (books.length === 0) return null;
  return (
    <ul className="tbr-list">
      {books.map((b, i) => (
        <li key={`${b.title}-${i}`} className="tbr-item">
          <span className="tbr-title">{b.title}</span>
          {b.author && <span className="tbr-author">{b.author}</span>}
        </li>
      ))}
    </ul>
  );
}

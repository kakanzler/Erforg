import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";

/**
 * Renders reading-record Markdown. Supports GFM, LaTeX math via KaTeX
 * ($...$ / $$...$$), and raw HTML (underline, colored text). Records are
 * authored locally by the site owner, so raw HTML is trusted here.
 */
export function MarkdownView({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
    >
      {children}
    </ReactMarkdown>
  );
}

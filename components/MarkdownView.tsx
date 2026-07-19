import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import MermaidBlock from "./MermaidBlock";

/**
 * Renders reading-record Markdown. Supports GFM, LaTeX math via KaTeX
 * ($...$ / $$...$$), raw HTML (underline, colored text), and ```mermaid
 * fenced blocks rendered as diagrams. Records are authored locally by the
 * site owner, so raw HTML is trusted here.
 */
export function MarkdownView({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={{
        // A fenced block is wrapped in <pre>. For mermaid we drop that wrapper,
        // otherwise the diagram would sit inside the dark `.record-body pre`
        // chrome (and a <div> inside <pre> is invalid nesting).
        pre({ node, children, ...props }) {
          const child = node?.children?.[0];
          if (
            child &&
            child.type === "element" &&
            child.tagName === "code" &&
            (child.properties?.className as string[] | undefined)?.includes(
              "language-mermaid"
            )
          ) {
            return <>{children}</>;
          }
          return <pre {...props}>{children}</pre>;
        },
        // react-markdown v9 exposes the fence language as `language-*` on the
        // <code> element. Only mermaid is diverted; everything else (inline
        // code, other fenced blocks) falls through untouched.
        code({ className, children, ...props }) {
          if (/(^|\s)language-mermaid(\s|$)/.test(className ?? "")) {
            return <MermaidBlock chart={String(children).trim()} />;
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

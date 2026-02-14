/**
 * MarkdownRenderer - Renders Markdown content as styled React elements.
 *
 * Uses react-markdown with remark-gfm for GFM support (tables, strikethrough,
 * task lists). All styling uses Tailwind semantic tokens for theme compatibility.
 *
 * @module components/markdown/MarkdownRenderer
 */

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-on-surface mb-3">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-on-surface mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-on-surface mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-on-surface-secondary mb-2 leading-relaxed">{children}</p>
  ),
  pre: ({ children }) => (
    <pre className="bg-surface-alt p-3 rounded-lg overflow-x-auto my-2">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    // Block code is wrapped in <pre><code>, inline code is just <code>
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className="text-sm font-mono text-on-surface">{children}</code>
      );
    }
    return (
      <code className="bg-surface-alt px-1.5 py-0.5 rounded text-sm font-mono text-on-surface">
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-text hover:underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-on-surface-secondary">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-accent pl-4 italic text-on-surface-muted my-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border border-outline">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-outline px-3 py-2 bg-surface-alt font-semibold text-sm text-on-surface">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-outline px-3 py-2 text-sm text-on-surface-secondary">
      {children}
    </td>
  ),
  hr: () => <hr className="border-outline my-4" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-on-surface">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className={`prose-sm ${className || ''}`}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

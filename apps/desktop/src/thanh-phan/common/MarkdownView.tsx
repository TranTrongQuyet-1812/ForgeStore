import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { openUrl } from '@tauri-apps/plugin-opener';
import clsx from 'clsx';

export interface MarkdownViewProps {
  content: string;
  className?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}

export type BlockType =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'quote'; text: string }
  | { type: 'image'; alt: string; src: string }
  | { type: 'paragraph'; text: string };

/**
 * Thuật toán biến đổi URL tương đối thành URL GitHub tuyệt đối (P3B-05.9)
 * - Ảnh: https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}
 * - Link: https://github.com/${owner}/${repo}/blob/${branch}/${cleanPath}
 */
export function resolveGitHubUrl(
  rawUrl: string,
  repoContext?: { owner?: string; repo?: string; branch?: string },
  isImage: boolean = false,
): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();

  // Triệt tiêu các scheme nguy hiểm
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/') ||
    lower.startsWith('data:application/')
  ) {
    return '';
  }

  // Giữ nguyên các URL tuyệt đối an toàn hoặc anchor trong trang
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('#') ||
    (isImage && lower.startsWith('data:image/'))
  ) {
    return trimmed;
  }

  // Nối URL tương đối nếu có ngữ cảnh repo
  if (repoContext?.owner && repoContext?.repo) {
    // Làm sạch leading slashes, ./ và ../ (kể cả ../../)
    const cleanPath = trimmed.replace(/^(\.?\.?\/+)+/, '');
    const branch = repoContext.branch || 'HEAD';
    if (isImage) {
      return `https://raw.githubusercontent.com/${repoContext.owner}/${repoContext.repo}/${branch}/${cleanPath}`;
    }
    return `https://github.com/${repoContext.owner}/${repoContext.repo}/blob/${branch}/${cleanPath}`;
  }

  return trimmed;
}

/**
 * Cấu hình schema lọc an toàn rehype-sanitize:
 * - Cho phép các thẻ HTML cấu trúc phổ biến trong README (p, div, img, a, details, summary, sub, sup, kbd).
 * - Cho phép thuộc tính align căn lề (như <p align="center"> của RustDesk).
 * - Triệt tiêu 100% <script>, <iframe>, thuộc tính sự kiện onerror, onload, onclick.
 * - Chỉ cho phép scheme giao thức an toàn (http, https, mailto, data:image/).
 */
export const customSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'details', 'summary', 'sub', 'sup', 'kbd'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'align'],
    img: [
      ...(defaultSchema.attributes?.img || []),
      'src',
      'alt',
      'title',
      'width',
      'height',
      'align',
      'loading',
    ],
    a: [...(defaultSchema.attributes?.a || []), 'href', 'title', 'target', 'rel'],
    div: [...(defaultSchema.attributes?.div || []), 'align'],
    p: [...(defaultSchema.attributes?.p || []), 'align'],
    h1: [...(defaultSchema.attributes?.h1 || []), 'align'],
    h2: [...(defaultSchema.attributes?.h2 || []), 'align'],
    h3: [...(defaultSchema.attributes?.h3 || []), 'align'],
    h4: [...(defaultSchema.attributes?.h4 || []), 'align'],
    th: [...(defaultSchema.attributes?.th || []), 'align'],
    td: [...(defaultSchema.attributes?.td || []), 'align'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
};

/**
 * Mở URL an toàn qua Tauri opener, fallback sang window.open ngoài môi trường desktop
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url || url.startsWith('#')) return;
  // Gia cố an ninh: chỉ cho phép http, https hoặc mailto
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    return;
  }
  try {
    await openUrl(url);
  } catch (err) {
    console.warn('[MarkdownView] Fallback mở link qua window.open:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Component hiển thị Markdown chuẩn W3C/GFM sử dụng react-markdown (P3B-05.9):
 * 1. Hỗ trợ HTML thô an toàn (như <p align="center">...) qua rehype-raw.
 * 2. Lọc sạch mã độc XSS qua rehype-sanitize.
 * 3. Tự động nối URL tương đối của GitHub cho ảnh và link (không bị vỡ ảnh).
 * 4. Mở link bằng trình duyệt hệ thống ngoài máy tính qua @tauri-apps/plugin-opener.
 */
export function MarkdownView({
  content,
  className,
  owner,
  repo,
  branch = 'HEAD',
}: MarkdownViewProps) {
  const repoContext = useMemo(
    () => (owner && repo ? { owner, repo, branch } : undefined),
    [owner, repo, branch],
  );

  const components: Components = useMemo(
    () => ({
      // Bóc tách node ra khỏi props để tránh gắn node="[object Object]" lên DOM elements
      a: ({ node: _node, href, children, ...props }) => {
        const resolvedHref = resolveGitHubUrl(href || '', repoContext, false);
        // Link bị chặn hoặc rỗng: hiện thành chữ thường an toàn, không click được
        if (!resolvedHref) {
          return <span className="text-secondary/70">{children}</span>;
        }
        return (
          <a
            href={resolvedHref}
            onClick={(e) => {
              if (resolvedHref && !resolvedHref.startsWith('#')) {
                e.preventDefault();
                void openExternalUrl(resolvedHref);
              }
            }}
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-0.5"
            target="_blank"
            rel="noreferrer noopener"
            {...props}
          >
            {children}
          </a>
        );
      },
      img: ({ node: _node, src, alt, ...props }) => {
        const resolvedSrc = resolveGitHubUrl(src || '', repoContext, true);
        if (!resolvedSrc) return null;
        return (
          <img
            src={resolvedSrc}
            alt={alt || 'Hình ảnh tài liệu'}
            loading="lazy"
            className="max-w-full rounded-lg inline-block my-2 border border-border/40"
            {...props}
          />
        );
      },
      h1: ({ node: _node, children, ...props }) => (
        <h1
          className="text-2xl font-bold text-primary mb-3 mt-5 pb-2 border-b border-border"
          {...props}
        >
          {children}
        </h1>
      ),
      h2: ({ node: _node, children, ...props }) => (
        <h2 className="text-xl font-semibold text-primary mb-2 mt-4" {...props}>
          {children}
        </h2>
      ),
      h3: ({ node: _node, children, ...props }) => (
        <h3 className="text-base font-semibold text-primary mb-2 mt-3" {...props}>
          {children}
        </h3>
      ),
      h4: ({ node: _node, children, ...props }) => (
        <h4 className="text-sm font-semibold text-primary mb-1 mt-2" {...props}>
          {children}
        </h4>
      ),
      p: ({ node: _node, children, ...props }) => (
        <p className="text-sm text-secondary leading-relaxed mb-3" {...props}>
          {children}
        </p>
      ),
      blockquote: ({ node: _node, children, ...props }) => (
        <blockquote
          className="border-l-4 border-emerald-500/50 pl-3 py-1 my-2 text-sm text-muted italic bg-surface-elevated/40 rounded-r-lg"
          {...props}
        >
          {children}
        </blockquote>
      ),
      code: ({ node: _node, className: codeClass, children, ...props }) => {
        const isInline = !codeClass && typeof children === 'string';
        if (isInline) {
          return (
            <code
              className="px-1.5 py-0.5 rounded bg-surface-elevated text-emerald-400 font-mono text-xs border border-border"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <code className={clsx('font-mono text-xs text-emerald-400', codeClass)} {...props}>
            {children}
          </code>
        );
      },
      pre: ({ node: _node, children, ...props }) => (
        <pre
          className="p-3 rounded-xl bg-surface-elevated border border-border font-mono text-xs overflow-x-auto text-emerald-400 my-3"
          {...props}
        >
          {children}
        </pre>
      ),
      table: ({ node: _node, children, ...props }) => (
        <div className="overflow-x-auto my-3">
          <table className="w-full border-collapse text-xs" {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ node: _node, children, ...props }) => (
        <th
          className="border border-border bg-surface-elevated px-3 py-1.5 text-left font-semibold text-primary"
          {...props}
        >
          {children}
        </th>
      ),
      td: ({ node: _node, children, ...props }) => (
        <td className="border border-border px-3 py-1.5 text-secondary" {...props}>
          {children}
        </td>
      ),
      ul: ({ node: _node, children, ...props }) => (
        <ul className="list-disc list-inside space-y-1 my-2 text-sm text-secondary pl-2" {...props}>
          {children}
        </ul>
      ),
      ol: ({ node: _node, children, ...props }) => (
        <ol
          className="list-decimal list-inside space-y-1 my-2 text-sm text-secondary pl-2"
          {...props}
        >
          {children}
        </ol>
      ),
      li: ({ node: _node, children, ...props }) => (
        <li className="leading-relaxed" {...props}>
          {children}
        </li>
      ),
    }),
    [repoContext],
  );

  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className={clsx('markdown-content text-secondary', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Hàm phân tích cú pháp Markdown tương thích ngược cho các bài kiểm tra logic (P3B-05.9)
 */
export function parseMarkdownBlocks(content: string): BlockType[] {
  if (!content) return [];
  const lines = content.split('\n');
  const result: BlockType[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++;
      result.push({
        type: 'code',
        language: lang,
        code: codeLines.join('\n'),
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      result.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i]?.trim().startsWith('>') || !lines[i]?.trim())) {
        if (lines[i]?.trim().startsWith('>')) {
          quoteLines.push(lines[i]!.trim().slice(1).trim());
        }
        i++;
      }
      result.push({
        type: 'quote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() ?? '';
      if (nextLine.startsWith('|') && nextLine.includes('---')) {
        const parseRow = (r: string) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
        const headers = parseRow(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i]?.trim().startsWith('|')) {
          rows.push(parseRow(lines[i]!.trim()));
          i++;
        }
        result.push({
          type: 'table',
          headers,
          rows,
        });
        continue;
      }
    }

    const singleImageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (singleImageMatch && singleImageMatch[2]) {
      result.push({
        type: 'image',
        alt: singleImageMatch[1] || 'Hình ảnh tài liệu',
        src: singleImageMatch[2].trim(),
      });
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]?.trim() ?? '')) {
        items.push(lines[i]!.trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      result.push({
        type: 'list',
        items,
        ordered: false,
      });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]?.trim() ?? '')) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      result.push({
        type: 'list',
        items,
        ordered: true,
      });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]?.trim() &&
      !lines[i]?.trim().startsWith('```') &&
      !lines[i]?.trim().startsWith('#') &&
      !lines[i]?.trim().startsWith('>') &&
      !lines[i]?.trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[i]?.trim() ?? '') &&
      !/^\d+\.\s+/.test(lines[i]?.trim() ?? '')
    ) {
      paraLines.push(lines[i]!.trim());
      i++;
    }
    result.push({
      type: 'paragraph',
      text: paraLines.join(' '),
    });
  }

  return result;
}

import React, { useMemo } from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
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
 * Phân tích cú pháp văn bản Markdown thành các khối cấu trúc BlockType (P3B-05.9 & Lỗi 9)
 */
export function parseMarkdownBlocks(content: string): BlockType[] {
  if (!content) return [];
  const lines = content.split('\n');
  const result: BlockType[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Bỏ qua dòng trống
    if (!trimmed) {
      i++;
      continue;
    }

    // Khối code: ```lang
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // Bỏ qua dòng kết thúc ```
      result.push({
        type: 'code',
        language: lang,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // Tiêu đề #, ##, ###, ####
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

    // Trích dẫn: >
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

    // Bảng Markdown: | Header | Header |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() ?? '';
      if (nextLine.startsWith('|') && nextLine.includes('---')) {
        const parseRow = (r: string) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
        const headers = parseRow(trimmed);
        i += 2; // Bỏ qua header và divider
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

    // Lỗi 9: Ảnh riêng dòng: ![alt](url)
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

    // Danh sách không thứ tự: - hoặc *
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

    // Lỗi 9: Danh sách có thứ tự: 1. 2. 3.
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

    // Đoạn văn thông thường
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]?.trim() &&
      !lines[i]?.trim().startsWith('```') &&
      !lines[i]?.trim().startsWith('#') &&
      !lines[i]?.trim().startsWith('>') &&
      !/^[-*]\s+/.test(lines[i]?.trim() ?? '') &&
      !/^\d+\.\s+/.test(lines[i]?.trim() ?? '') &&
      !/^!\[([^\]]*)\]\(([^)]+)\)$/.test(lines[i]?.trim() ?? '')
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

/**
 * Kiểm tra URL an toàn chống XSS Scheme Injection (FS-SEC-01)
 */
function isSafeUrl(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase().trim();
  return (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('#') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('/') ||
    lower.startsWith('./')
  );
}

/**
 * Render inline formatting (bold, inline code, link, image) bằng React elements an toàn, không dùng dangerouslySetInnerHTML.
 */
function renderInline(text: string): React.ReactNode {
  // 1. Tách text theo inline code `...`
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={pIdx}
          className="px-1.5 py-0.5 rounded bg-surface-elevated text-accent-ai font-mono text-[11px] border border-border/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // 2. Xử lý Bold **...**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={pIdx}>
        {boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
            return (
              <strong key={bIdx} className="font-semibold text-primary">
                {bPart.slice(2, -2)}
              </strong>
            );
          }

          // 3. Lỗi 9: Xử lý Ảnh Markdown inline ![alt](url) TRƯỚC link
          const imageParts = bPart.split(/(!\[[^\]]*\]\([^)]+\))/g);
          return imageParts.map((imPart, imIdx) => {
            const imgMatch = imPart.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (imgMatch && imgMatch[2]) {
              const rawSrc = imgMatch[2].trim();
              const safeSrc = isSafeUrl(rawSrc) ? rawSrc : '';
              if (!safeSrc) return null;

              return (
                <img
                  key={imIdx}
                  src={safeSrc}
                  alt={imgMatch[1] || 'Hình ảnh'}
                  className="max-w-full h-auto rounded-lg border border-border/50 my-2 inline-block shadow-sm"
                  loading="lazy"
                />
              );
            }

            // 4. Xử lý Link Markdown [text](url) an toàn
            const linkParts = imPart.split(/(\[[^\]]+\]\([^)]+\))/g);
            return linkParts.map((lPart, lIdx) => {
              const linkMatch = lPart.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
              if (linkMatch && linkMatch[1] && linkMatch[2]) {
                const rawUrl = linkMatch[2].trim();
                const safe = isSafeUrl(rawUrl);
                const safeHref = safe ? rawUrl : '#';

                return (
                  <a
                    key={lIdx}
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!safe) {
                        e.preventDefault();
                      }
                    }}
                    className="text-accent-forge hover:underline font-medium"
                  >
                    {linkMatch[1]}
                  </a>
                );
              }
              return lPart;
            });
          });
        })}
      </React.Fragment>
    );
  });
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const blocks = useMemo<BlockType[]>(() => parseMarkdownBlocks(content), [content]);

  return (
    <div className={`space-y-4 text-xs leading-relaxed text-secondary ${className}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1
                  key={index}
                  className="text-base font-bold font-display text-primary pt-3 pb-1 border-b border-border/40"
                >
                  {renderInline(block.text)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={index}
                  className="text-sm font-bold font-display text-primary pt-2 pb-0.5 border-b border-border/30"
                >
                  {renderInline(block.text)}
                </h2>
              );
            }
            return (
              <h3 key={index} className="text-xs font-semibold font-display text-primary pt-1">
                {renderInline(block.text)}
              </h3>
            );
          }

          case 'code':
            return (
              <div
                key={index}
                className="my-3 rounded-xl bg-surface-elevated/70 border border-border overflow-hidden"
              >
                {block.language && (
                  <div className="px-3 py-1 bg-surface-elevated border-b border-border text-[10px] font-mono text-muted uppercase">
                    {block.language}
                  </div>
                )}
                <pre className="p-3 font-mono text-[11px] overflow-x-auto text-primary leading-relaxed">
                  <code>{block.code}</code>
                </pre>
              </div>
            );

          case 'table':
            return (
              <div key={index} className="my-3 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-surface-elevated border-b border-border text-primary font-semibold font-mono">
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3 py-2">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-border/40 hover:bg-surface-elevated/40 transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-secondary">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'list':
            return block.ordered ? (
              <ol key={index} className="list-decimal pl-5 space-y-1 my-2">
                {block.items.map((it, itIdx) => (
                  <li key={itIdx} className="text-secondary">
                    {renderInline(it)}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="list-disc pl-5 space-y-1 my-2">
                {block.items.map((it, itIdx) => (
                  <li key={itIdx} className="text-secondary">
                    {renderInline(it)}
                  </li>
                ))}
              </ul>
            );

          case 'quote':
            return (
              <blockquote
                key={index}
                className="pl-3 py-1 border-l-2 border-accent-forge/60 italic text-muted text-xs bg-surface-elevated/20 rounded-r-lg my-2"
              >
                {renderInline(block.text)}
              </blockquote>
            );

          case 'image': {
            const safeSrc = isSafeUrl(block.src) ? block.src : '';
            if (!safeSrc) return null;
            return (
              <div key={index} className="my-3 flex justify-center">
                <img
                  src={safeSrc}
                  alt={block.alt}
                  className="max-w-full h-auto rounded-xl border border-border shadow-md"
                  loading="lazy"
                />
              </div>
            );
          }

          case 'paragraph':
            return (
              <p key={index} className="text-xs text-secondary leading-relaxed">
                {renderInline(block.text)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};

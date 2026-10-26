import { describe, it, expect } from 'vitest';
import { parseMarkdownBlocks, resolveGitHubUrl, customSanitizeSchema } from './XemMarkdown';

describe('Markdown Parser Logic (P3B-05.9)', () => {
  it('xử lý chuỗi rỗng hoặc undefined trả về mảng rỗng', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
    expect(parseMarkdownBlocks('   \n\n  ')).toEqual([]);
  });

  it('phân tích các cấp độ tiêu đề heading (h1, h2, h3, h4)', () => {
    const markdown = `# Tiêu đề Cấp 1
Dòng mô tả bên dưới.

## Tiêu đề Cấp 2
### Tiêu đề Cấp 3
#### Tiêu đề Cấp 4`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Tiêu đề Cấp 1' });
    expect(blocks[1]).toEqual({ type: 'paragraph', text: 'Dòng mô tả bên dưới.' });
    expect(blocks[2]).toEqual({ type: 'heading', level: 2, text: 'Tiêu đề Cấp 2' });
    expect(blocks[3]).toEqual({ type: 'heading', level: 3, text: 'Tiêu đề Cấp 3' });
    expect(blocks[4]).toEqual({ type: 'heading', level: 4, text: 'Tiêu đề Cấp 4' });
  });

  it('phân tích khối code block có ngôn ngữ và nhiều dòng code', () => {
    const markdown = `\`\`\`typescript
const a = 1;
const b = 2;
console.log(a + b);
\`\`\``;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'code',
      language: 'typescript',
      code: 'const a = 1;\nconst b = 2;\nconsole.log(a + b);',
    });
  });

  it('phân tích trích dẫn blockquote (>...)', () => {
    const markdown = `> Lưu ý: Đây là phần mềm mã nguồn mở.
> Hãy kiểm tra tính an toàn trước khi sử dụng.`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'quote',
      text: 'Lưu ý: Đây là phần mềm mã nguồn mở. Hãy kiểm tra tính an toàn trước khi sử dụng.',
    });
  });

  it('phân tích bảng Markdown với headers và rows', () => {
    const markdown = `| Tên cột A | Tên cột B | Tên cột C |
|---|---|---|
| Dữ liệu 1 | Dữ liệu 2 | Dữ liệu 3 |
| Dữ liệu 4 | Dữ liệu 5 | Dữ liệu 6 |`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'table',
      headers: ['Tên cột A', 'Tên cột B', 'Tên cột C'],
      rows: [
        ['Dữ liệu 1', 'Dữ liệu 2', 'Dữ liệu 3'],
        ['Dữ liệu 4', 'Dữ liệu 5', 'Dữ liệu 6'],
      ],
    });
  });

  it('phân tích danh sách không thứ tự (- hoặc *)', () => {
    const markdown = `- Hỗ trợ Windows x64
- Hỗ trợ Android APK
* Tối ưu hóa giao diện`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'list',
      items: ['Hỗ trợ Windows x64', 'Hỗ trợ Android APK', 'Tối ưu hóa giao diện'],
      ordered: false,
    });
  });

  it('phân tích kết hợp nhiều loại khối trong tài liệu README thực tế', () => {
    const markdown = `# RustDesk

> Ứng dụng điều khiển máy tính từ xa mã nguồn mở.

## Cài đặt
\`\`\`bash
winget install rustdesk
\`\`\`

## Tính năng
- Bảo mật P2P
- Hiệu suất cao với Rust`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(6);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('quote');
    expect(blocks[2].type).toBe('heading');
    expect(blocks[3].type).toBe('code');
    expect(blocks[4].type).toBe('heading');
    expect(blocks[5].type).toBe('list');
  });

  it('Lỗi 9: phân tích danh sách có thứ tự (1. 2. 3.) với ordered = true', () => {
    const markdown = `1. Cài đặt Node.js
2. Chạy pnpm install
3. Khởi động ứng dụng`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'list',
      items: ['Cài đặt Node.js', 'Chạy pnpm install', 'Khởi động ứng dụng'],
      ordered: true,
    });
  });

  it('Lỗi 9: phân tích ảnh Markdown riêng dòng thành khối image', () => {
    const markdown = `![ForgeStore Preview](https://raw.githubusercontent.com/test/preview.png)`;

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'image',
      alt: 'ForgeStore Preview',
      src: 'https://raw.githubusercontent.com/test/preview.png',
    });
  });
});

describe('Thuật toán resolveGitHubUrl & An ninh Markdown (P3B-05.9)', () => {
  const repoCtx = { owner: 'rustdesk', repo: 'rustdesk' };

  it('xử lý chuỗi rỗng hoặc undefined trả về rỗng', () => {
    expect(resolveGitHubUrl('')).toBe('');
    expect(resolveGitHubUrl('   ')).toBe('');
  });

  it('triệt tiêu các scheme nguy hiểm (javascript:, vbscript:, data:text/)', () => {
    expect(resolveGitHubUrl('javascript:alert(1)', repoCtx)).toBe('');
    expect(resolveGitHubUrl('JAVASCRIPT:alert("xss")', repoCtx)).toBe('');
    expect(resolveGitHubUrl('vbscript:msgbox("hi")', repoCtx)).toBe('');
    expect(resolveGitHubUrl('data:text/html;base64,...', repoCtx)).toBe('');
  });

  it('giữ nguyên các URL tuyệt đối an toàn và anchor trong trang', () => {
    expect(resolveGitHubUrl('https://rustdesk.com', repoCtx)).toBe('https://rustdesk.com');
    expect(resolveGitHubUrl('http://example.com/api', repoCtx)).toBe('http://example.com/api');
    expect(resolveGitHubUrl('mailto:support@rustdesk.com', repoCtx)).toBe(
      'mailto:support@rustdesk.com',
    );
    expect(resolveGitHubUrl('#features', repoCtx)).toBe('#features');
  });

  it('giữ nguyên data:image/ cho ảnh khi isImage = true', () => {
    const base64Img =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(resolveGitHubUrl(base64Img, repoCtx, true)).toBe(base64Img);
  });

  it('biến đổi đường dẫn ảnh tương đối thành URL raw GitHub', () => {
    // Không có dấu ./
    expect(resolveGitHubUrl('res/logo-header.svg', repoCtx, true)).toBe(
      'https://raw.githubusercontent.com/rustdesk/rustdesk/HEAD/res/logo-header.svg',
    );
    // Có dấu ./
    expect(resolveGitHubUrl('./assets/screenshot.png', repoCtx, true)).toBe(
      'https://raw.githubusercontent.com/rustdesk/rustdesk/HEAD/assets/screenshot.png',
    );
    // Có dấu /
    expect(resolveGitHubUrl('/docs/images/arch.jpg', repoCtx, true)).toBe(
      'https://raw.githubusercontent.com/rustdesk/rustdesk/HEAD/docs/images/arch.jpg',
    );
  });

  it('biến đổi đường dẫn link tương đối thành URL blob GitHub', () => {
    expect(resolveGitHubUrl('docs/README.md', repoCtx, false)).toBe(
      'https://github.com/rustdesk/rustdesk/blob/HEAD/docs/README.md',
    );
    expect(resolveGitHubUrl('./LICENSE', repoCtx, false)).toBe(
      'https://github.com/rustdesk/rustdesk/blob/HEAD/LICENSE',
    );
    // Kiểm tra làm sạch ../ và ../../ (Lỗi 3 phản hồi từ Claude)
    expect(resolveGitHubUrl('../LICENSE', repoCtx, false)).toBe(
      'https://github.com/rustdesk/rustdesk/blob/HEAD/LICENSE',
    );
    expect(resolveGitHubUrl('../../docs/ARCHITECTURE.md', repoCtx, false)).toBe(
      'https://github.com/rustdesk/rustdesk/blob/HEAD/docs/ARCHITECTURE.md',
    );
  });

  it('tôn trọng nhánh tuỳ chỉnh nếu được cung cấp', () => {
    const customCtx = { owner: 'rustdesk', repo: 'rustdesk', branch: 'master' };
    expect(resolveGitHubUrl('res/logo.svg', customCtx, true)).toBe(
      'https://raw.githubusercontent.com/rustdesk/rustdesk/master/res/logo.svg',
    );
  });
});

describe('Cấu hình customSanitizeSchema (An ninh & Lọc mã độc)', () => {
  it('không cho phép thẻ script và iframe', () => {
    expect(customSanitizeSchema.tagNames).not.toContain('script');
    expect(customSanitizeSchema.tagNames).not.toContain('iframe');
    expect(customSanitizeSchema.tagNames).not.toContain('object');
    expect(customSanitizeSchema.tagNames).not.toContain('embed');
  });

  it('cho phép thuộc tính align cho p, div, img để hiển thị căn giữa chuẩn', () => {
    expect(customSanitizeSchema.attributes?.p).toContain('align');
    expect(customSanitizeSchema.attributes?.div).toContain('align');
    expect(customSanitizeSchema.attributes?.img).toContain('align');
  });

  it('chỉ cho phép các protocol an toàn cho href và src', () => {
    expect(customSanitizeSchema.protocols.href).toEqual(['http', 'https', 'mailto']);
    expect(customSanitizeSchema.protocols.src).toEqual(['http', 'https', 'data']);
    expect(customSanitizeSchema.protocols.href).not.toContain('javascript');
  });
});

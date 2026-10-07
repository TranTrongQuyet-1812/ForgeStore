import { describe, it, expect } from 'vitest';
import { parseMarkdownBlocks } from './MarkdownView';

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

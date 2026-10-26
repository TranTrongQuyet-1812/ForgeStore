import { describe, it, expect } from 'vitest';
import { MarkdownMasker } from './markdown-masker.util';

describe('MarkdownMasker', () => {
  it('che đủ 6 tầng: code block, inline code, html, image, link url, raw url theo đúng thứ tự (P3B-05.1)', () => {
    const raw = `
# Chào mừng đến với Dự án
Xem mã nguồn tại https://github.com/forgestore/forge
![Logo](https://example.com/logo.png)
Hãy xem [Tài liệu hướng dẫn](https://docs.example.com/start) và thẻ <span class="badge">v1.0</span>.
Đoạn code nhỏ: \`const a = 10;\` và khối code:
\`\`\`typescript
function test() {
  return "hello";
}
\`\`\`
`.trim();

    const { maskedText, placeholderMap, totalPlaceholders } = MarkdownMasker.mask(raw);

    expect(totalPlaceholders).toBeGreaterThanOrEqual(6);
    expect(maskedText).not.toContain('function test()');
    expect(maskedText).not.toContain('const a = 10;');
    expect(maskedText).not.toContain('<span class="badge">');
    expect(maskedText).not.toContain('![Logo](https://example.com/logo.png)');
    expect(maskedText).not.toContain('https://docs.example.com/start');
    expect(maskedText).not.toContain('https://github.com/forgestore/forge');

    // Label của link markdown phải được giữ lại để dịch
    expect(maskedText).toContain('[Tài liệu hướng dẫn]');

    // Unmask phải khôi phục 100% nguyên văn ban đầu
    const restored = MarkdownMasker.unmask(maskedText, placeholderMap);
    expect(restored).toBe(raw);
  });

  it('che inline code TRƯỚC thẻ HTML để tránh lỗi che lồng 2 lớp khi có <locale> bên trong code (P3B-05.1 bug 03/10)', () => {
    const raw = 'Cấu hình tham số `<locale>` trong file config hoặc `<lang>`';
    const { maskedText, placeholderMap } = MarkdownMasker.mask(raw);

    // Ký hiệu ⟦C1⟧ che `<locale>` trong inline code
    expect(maskedText).toContain('⟦C1⟧');
    expect(maskedText).not.toContain('`<⟦C'); // Không bao giờ có chuyện che lồng thẻ bên trong inline code

    const restored = MarkdownMasker.unmask(maskedText, placeholderMap);
    expect(restored).toBe(raw);
  });

  it('unmask thành công ngay cả khi mô hình AI đổi ký hiệu ⟦C1⟧ thành [C1]', () => {
    const raw = 'Tham khảo tại `git clone https://repo.com` để cài đặt.';
    const { maskedText, placeholderMap } = MarkdownMasker.mask(raw);

    // Giả lập AI trả về [C1] thay vì ⟦C1⟧
    const aiOutput = maskedText.replace('⟦C1⟧', '[C1]');

    const restored = MarkdownMasker.unmask(aiOutput, placeholderMap);
    expect(restored).toBe(raw);
  });

  it('xử lý an toàn chuỗi rỗng và chuỗi không có thành phần markdown đặc biệt', () => {
    const emptyResult = MarkdownMasker.mask('');
    expect(emptyResult.maskedText).toBe('');
    expect(emptyResult.totalPlaceholders).toBe(0);
    expect(MarkdownMasker.unmask('', emptyResult.placeholderMap)).toBe('');

    const plainText = 'Đây là đoạn văn xuôi thuần túy không có ký hiệu kỹ thuật.';
    const plainResult = MarkdownMasker.mask(plainText);
    expect(plainResult.maskedText).toBe(plainText);
    expect(plainResult.totalPlaceholders).toBe(0);
    expect(MarkdownMasker.unmask(plainResult.maskedText, plainResult.placeholderMap)).toBe(
      plainText,
    );
  });

  it('không che nhầm biểu thức so sánh toán học như "a < b và c > d" thành thẻ HTML (Mục 10)', () => {
    const raw = 'Nếu x < 10 và y > 20 thì thực thi thuật toán.';
    const { maskedText, totalPlaceholders } = MarkdownMasker.mask(raw);
    expect(totalPlaceholders).toBe(0);
    expect(maskedText).toBe(raw);
  });
});

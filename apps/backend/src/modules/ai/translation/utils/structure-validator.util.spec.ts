import { describe, it, expect } from 'vitest';
import { StructureValidator } from './structure-validator.util';

describe('StructureValidator', () => {
  describe('extractText', () => {
    it('trích xuất văn bản từ nhiều định dạng API phản hồi khác nhau', () => {
      expect(StructureValidator.extractText('plain string')).toBe('plain string');
      expect(StructureValidator.extractText({ response: 'from cloudflare' })).toBe(
        'from cloudflare',
      );
      expect(StructureValidator.extractText({ result: { response: 'from cf nested' } })).toBe(
        'from cf nested',
      );
      expect(
        StructureValidator.extractText({
          choices: [{ message: { content: 'from openai format' } }],
        }),
      ).toBe('from openai format');
      expect(StructureValidator.extractText({ content: 'from content field' })).toBe(
        'from content field',
      );
      expect(StructureValidator.extractText({ text: 'from text field' })).toBe('from text field');
      expect(StructureValidator.extractText(null)).toBe('');
      expect(StructureValidator.extractText({})).toBe('');
    });
  });

  describe('cleanOutput', () => {
    it('loại bỏ các khối <think>...</think> rò rỉ từ mô hình lý luận', () => {
      const raw = `<think>
Tôi sẽ dịch đoạn này sang tiếng Việt.
Giữ nguyên [C1] và các tiêu đề.
</think>
# Tiêu đề tiếng Việt
Nội dung dịch ở đây [C1].`;

      const cleaned = StructureValidator.cleanOutput(raw, '# Heading\nContent [C1].');
      expect(cleaned).toBe('# Tiêu đề tiếng Việt\nNội dung dịch ở đây [C1].');
      expect(cleaned).not.toContain('<think>');
    });

    it('bóc khối code markdown bọc ngoài nếu đầu vào không phải là khối code', () => {
      const input = '# Tiêu đề gốc\nNội dung văn xuôi.';
      const outputWrapped = '```markdown\n# Tiêu đề tiếng Việt\nNội dung dịch.\n```';

      const cleaned = StructureValidator.cleanOutput(outputWrapped, input);
      expect(cleaned).toBe('# Tiêu đề tiếng Việt\nNội dung dịch.');
    });

    it('giữ nguyên khối code nếu đầu vào vốn dĩ là khối code', () => {
      const input = '```typescript\nconsole.log(1);\n```';
      const output = '```typescript\nconsole.log(1);\n```';

      const cleaned = StructureValidator.cleanOutput(output, input);
      expect(cleaned).toBe(output);
    });
  });

  describe('findStructureProblem', () => {
    it('trả về null khi bản dịch bảo toàn 100% cấu trúc', () => {
      const input = `
# Tiêu đề chính
Đây là đoạn văn có ⟦C1⟧ và ⟦C2⟧.
| Cột 1 | Cột 2 |
|---|---|
| Dòng 1 | Dòng 2 |
## Tiêu đề phụ
`.trim();

      const output = `
# Tiêu đề chính tiếng Việt
Đây là đoạn văn dịch có ⟦C1⟧ và ⟦C2⟧.
| Cột 1 | Cột 2 |
|---|---|
| Dòng 1 | Dòng 2 |
## Tiêu đề phụ tiếng Việt
`.trim();

      expect(StructureValidator.findStructureProblem(input, output)).toBeNull();
    });

    it('chấp nhận bản dịch đổi ký hiệu ⟦C1⟧ sang [C1]', () => {
      const input = 'Đoạn văn có ⟦C1⟧ và ⟦C2⟧.';
      const output = 'Đoạn văn dịch có [C1] và [C2].';
      expect(StructureValidator.findStructureProblem(input, output)).toBeNull();
    });

    it('bắt lỗi empty_output khi bản dịch rỗng hoặc chỉ có khoảng trắng', () => {
      expect(StructureValidator.findStructureProblem('input text', '')).toBe('empty_output');
      expect(StructureValidator.findStructureProblem('input text', '   \n  ')).toBe('empty_output');
    });

    it('bắt lỗi placeholders_changed khi làm mất, thừa hoặc đổi số thứ tự ký hiệu giữ chỗ', () => {
      const input = 'Đoạn văn có [C1] và [C2].';

      // Mất [C2]
      expect(StructureValidator.findStructureProblem(input, 'Đoạn dịch chỉ có [C1].')).toBe(
        'placeholders_changed',
      );

      // Thừa [C3]
      expect(StructureValidator.findStructureProblem(input, 'Đoạn dịch có [C1], [C2], [C3].')).toBe(
        'placeholders_changed',
      );

      // Đổi số [C1] thành [C9]
      expect(StructureValidator.findStructureProblem(input, 'Đoạn dịch có [C9] và [C2].')).toBe(
        'placeholders_changed',
      );
    });

    it('bắt lỗi headings_changed khi số lượng tiêu đề markdown bị thay đổi', () => {
      const input = '# H1\n## H2\nNội dung.';
      const output1 = '# H1 dịch\nNội dung.'; // Mất H2
      const output2 = '# H1\n## H2\n### H3\nNội dung.'; // Thêm H3

      expect(StructureValidator.findStructureProblem(input, output1)).toBe('headings_changed');
      expect(StructureValidator.findStructureProblem(input, output2)).toBe('headings_changed');
    });

    it('bắt lỗi table_changed khi số lượng dòng bảng markdown bị thay đổi', () => {
      const input = `
| A | B |
|---|---|
| 1 | 2 |
`.trim();

      const output = `
| A | B |
| 1 | 2 |
`.trim(); // Mất dòng divider |---|---|

      expect(StructureValidator.findStructureProblem(input, output)).toBe('table_changed');
    });
  });
});

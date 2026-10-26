/**
 * Tiện ích làm sạch và kiểm định tính toàn vẹn cấu trúc văn bản Markdown sau khi dịch.
 * Kế thừa và chuẩn hóa từ logic của infra/cloudflare-translate-worker/worker.js.
 *
 * Tuân thủ quy tắc P3B-05.3 & P3B-05.14:
 * - Lọc bỏ thinking tokens (<think>...</think>) và bóc khối code bao ngoài nếu input không có.
 * - Kiểm tra đủ số lượng từng ký hiệu giữ chỗ (⟦C1⟧ hoặc [C1]).
 * - Kiểm tra đủ số lượng tiêu đề (#, ##, ###) và số lượng dòng bảng (|...|).
 * - Trả về mã lỗi cố định nếu vi phạm, không bao giờ bỏ qua cấu trúc bị hỏng.
 */

export type LyDoLoiCauTruc =
  'placeholders_changed' | 'headings_changed' | 'table_changed' | 'empty_output';

export const PLACEHOLDER_REGEX = /\[C\d+\]|⟦C\d+⟧/g;
export const HEADING_REGEX = /^#{1,6}\s/gm;
export const TABLE_ROW_REGEX = /^\s*\|.*\|\s*$/gm;

export class StructureValidator {
  /**
   * Bóc tách nội dung văn bản từ nhiều cấu trúc phản hồi API khác nhau (Gemini, OpenAI, Cloudflare, v.v.).
   */
  public static extractText(output: unknown): string {
    if (!output) return '';
    if (typeof output === 'string') return output;

    const obj = output as Record<string, unknown>;
    const candidate =
      obj.response ??
      (obj.result as Record<string, unknown> | undefined)?.response ??
      (obj.choices as Array<{ message?: { content?: unknown } }> | undefined)?.[0]?.message
        ?.content ??
      obj.content ??
      obj.text ??
      '';

    return typeof candidate === 'string' ? candidate : '';
  }

  /**
   * Làm sạch đầu ra:
   * 1. Loại bỏ các khối suy nghĩ <think>...</think> rò rỉ từ các model lý luận (DeepSeek, Gemma, v.v.).
   * 2. Bóc khối code markdown bọc ngoài (```markdown ... ```) nếu đoạn đầu vào ban đầu không bắt đầu bằng khối code.
   */
  public static cleanOutput(text: string, input: string): string {
    let cleaned = String(text ?? '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();

    const wrapped = cleaned.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
    if (wrapped && wrapped[1] && !/^```/m.test(input)) {
      cleaned = wrapped[1].trim();
    }

    return cleaned;
  }

  /**
   * Chuẩn hóa ký hiệu giữ chỗ về định dạng chung [C{n}] để so sánh không phân biệt ⟦⟧ hay [].
   */
  private static normalizePlaceholder(token: string): string {
    return token.replace('⟦', '[').replace('⟧', ']');
  }

  /**
   * Kiểm định tính toàn vẹn cấu trúc giữa bản gốc (input đã mask) và bản dịch (output).
   * Trả về mã lỗi nếu có vi phạm cấu trúc, hoặc null nếu cấu trúc hoàn toàn bảo toàn.
   */
  public static findStructureProblem(input: string, output: string): LyDoLoiCauTruc | null {
    if (!output || output.trim() === '') {
      return 'empty_output';
    }

    // 1. Kiểm tra ký hiệu giữ chỗ (Placeholders)
    const placeholdersInput = (input.match(PLACEHOLDER_REGEX) ?? [])
      .map(this.normalizePlaceholder)
      .sort();
    const placeholdersOutput = (output.match(PLACEHOLDER_REGEX) ?? [])
      .map(this.normalizePlaceholder)
      .sort();

    if (
      placeholdersInput.length !== placeholdersOutput.length ||
      placeholdersInput.some((token, idx) => token !== placeholdersOutput[idx])
    ) {
      return 'placeholders_changed';
    }

    // 2. Kiểm tra số lượng tiêu đề (Headings)
    const headingsInput = (input.match(HEADING_REGEX) ?? []).length;
    const headingsOutput = (output.match(HEADING_REGEX) ?? []).length;
    if (headingsInput !== headingsOutput) {
      return 'headings_changed';
    }

    // 3. Kiểm tra số lượng dòng bảng Markdown (Table rows)
    const tableRowsInput = (input.match(TABLE_ROW_REGEX) ?? []).length;
    const tableRowsOutput = (output.match(TABLE_ROW_REGEX) ?? []).length;
    if (tableRowsInput !== tableRowsOutput) {
      return 'table_changed';
    }

    return null;
  }
}

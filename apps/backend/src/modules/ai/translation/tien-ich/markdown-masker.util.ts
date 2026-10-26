/**
 * Tiện ích che chắn (masking) văn bản Markdown trước khi gửi qua AI dịch thuật
 * và khôi phục (unmasking) lại nguyên vẹn sau khi nhận kết quả.
 *
 * Tuân thủ quy tắc P3B-05.1:
 * Thứ tự che 6 tầng: Khối code -> inline code -> Thẻ HTML -> Ảnh -> URL link -> URL trần.
 * Lưu ý: Phải che inline code TRƯỚC thẻ HTML để tránh lỗi che lồng 2 lớp khi <locale> nằm trong `...`.
 * Khi unmask: Ráp lại bằng vòng lặp cho tới khi không còn ký hiệu giữ chỗ nào sót lại.
 */

export interface MaskResult {
  maskedText: string;
  placeholderMap: Map<string, string>;
  totalPlaceholders: number;
}

export class MarkdownMasker {
  /**
   * Che 6 tầng các thành phần kỹ thuật trong văn bản Markdown.
   * Sử dụng ký hiệu giữ chỗ ⟦C1⟧, ⟦C2⟧... (chuẩn P3B-05.1).
   */
  public static mask(content: string): MaskResult {
    const map = new Map<string, string>();
    let counter = 1;

    const store = (match: string): string => {
      const key = `⟦C${counter++}⟧`;
      map.set(key, match);
      return key;
    };

    let text = content;

    // Tầng 1: Khối code đa dòng (```lang ... ```)
    text = text.replace(/```[\s\S]*?```/g, store);

    // Tầng 2: Inline code (`...`) - BẮT BUỘC trước thẻ HTML (P3B-05.1)
    text = text.replace(/`[^`\n]+`/g, store);

    // Tầng 3: Thẻ HTML (<p ...>, <a>, <img>, <br>, v.v.) - không che nhầm biểu thức so sánh "a < b"
    text = text.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>\n]*>/g, store);

    // Tầng 4: Ảnh Markdown (![alt](url)) - che toàn bộ ảnh
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, store);

    // Tầng 5: URL của Markdown link ([label](url)) - chỉ che phần url, giữ label để AI dịch chữ
    text = text.replace(/(\[[^\]]+\])\(([^)]+)\)/g, (_m, label: string, url: string) => {
      return `${label}(${store(url)})`;
    });

    // Tầng 6: URL trần (http:// hoặc https://)
    text = text.replace(
      /\bhttps?:\/\/[^\s<>()]+(?:\([^\s<>()]+\)|[^\s`!()[\]{};:'".,<>?«»“”‘’])/gi,
      store,
    );

    return {
      maskedText: text,
      placeholderMap: map,
      totalPlaceholders: map.size,
    };
  }

  /**
   * Gỡ bỏ ký hiệu giữ chỗ, khôi phục lại văn bản gốc hoàn chỉnh.
   * Lặp tới khi không còn ký hiệu nào còn sót lại (chống unmask sót hoặc ký hiệu lồng nhau).
   */
  public static unmask(text: string, placeholderMap: Map<string, string>): string {
    let result = text;
    const entries = Array.from(placeholderMap.entries()).reverse();

    // Vòng lặp tối đa 5 lượt để gỡ sạch mọi tầng lồng
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      let changed = false;
      for (const [key, val] of entries) {
        if (result.includes(key)) {
          result = result.replaceAll(key, val);
          changed = true;
        }
        // Hỗ trợ cả định dạng [Cn] nếu model vô tình đổi dấu ngoặc ⟦⟧ sang []
        const bracketKey = key.replace('⟦', '[').replace('⟧', ']');
        if (result.includes(bracketKey)) {
          result = result.replaceAll(bracketKey, val);
          changed = true;
        }
      }
      if (!changed) break;
      iterations++;
    }

    return result;
  }
}

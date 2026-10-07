/**
 * Interface và các định nghĩa kiểu dữ liệu cho Lớp Dịch Dùng Chung Đa Tầng (ForgeStore Shared Translation Engine).
 * Tuân thủ quy chuẩn P3B-05.6 và P3B-05.14.
 */

export type NhaCungCapDich = 'gemini' | 'nvidia' | 'cloudflare' | 'groq';

export type LyDoLoiDich =
  | 'timeout'
  | 'placeholders_changed'
  | 'headings_changed'
  | 'table_changed'
  | 'empty_output'
  | 'ai_error'
  | 'rate_limited'
  | 'not_configured'
  | 'unhealthy';

export interface KetQuaDichDoan {
  text: string | null;
  lyDoLoi: LyDoLoiDich | null;
  provider: NhaCungCapDich;
  model: string;
  thoiGianMs?: number;
  retryAfterSec?: number;
  tokens?: {
    in?: number;
    out?: number;
  };
}

export interface ChiTietLoiProvider {
  provider: NhaCungCapDich;
  model: string;
  lyDoLoi: LyDoLoiDich;
  thoiGianMs?: number;
}

export interface ITranslationProvider {
  readonly providerName: NhaCungCapDich;
  readonly modelName: string;

  /**
   * Kiểm tra cấu hình và khóa API có hợp lệ sẵn sàng sử dụng hay không.
   */
  isAvailable(): boolean;

  /**
   * Kiểm tra khả năng kết nối và độ khả dụng của nhà cung cấp.
   */
  checkHealth(): Promise<boolean>;

  /**
   * Thực hiện dịch một đoạn văn bản (đã được che ký hiệu giữ chỗ) sang tiếng Việt.
   * TUYỆT ĐỐI KHÔNG BAO GIỜ trả về văn bản gốc làm bản dịch khi thất bại.
   */
  translate(text: string, options?: { timeoutMs?: number }): Promise<KetQuaDichDoan>;
}

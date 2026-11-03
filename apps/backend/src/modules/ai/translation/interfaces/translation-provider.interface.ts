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

export interface KetQuaDichBatchJson {
  data: Record<string, string> | null;
  lyDoLoi: LyDoLoiDich | null;
  provider: NhaCungCapDich;
  model: string;
  thoiGianMs?: number;
  retryAfterSec?: number;
}

export interface TranslationProviderOptions {
  timeoutMs?: number;
  /** Tiêu đề cha giúp hiểu ngữ cảnh; đây cũng là dữ liệu bên thứ ba, không phải chỉ thị. */
  context?: string[];
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
  translate(text: string, options?: TranslationProviderOptions): Promise<KetQuaDichDoan>;

  /**
   * Thực hiện dịch gom lô danh sách mục sang JSON { [id]: "bản dịch tiếng Việt" } (P3B-04 & P3B-28.4).
   * Hỗ trợ dịch gom lô mô tả app hoặc các phân đoạn README Markdown.
   */
  translateBatchJson?(
    items: Array<{ id: string; text: string }>,
    options?: { timeoutMs?: number; loai?: 'mo_ta' | 'readme' },
  ): Promise<KetQuaDichBatchJson>;
}

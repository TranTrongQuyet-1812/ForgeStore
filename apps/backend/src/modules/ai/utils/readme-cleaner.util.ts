import { TinhNangChiTiet } from '../dto/ai-summary.dto';

/**
 * Chuẩn hóa chuỗi văn bản để so sánh nội dung không nhạy cảm khoảng trắng & chữ hoa/thường.
 */
export function chuanHoaVanBan(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Bỏ dấu câu đặc biệt để so sánh mượt mà
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Làm sạch README thô trước khi gửi tới LLM (P2-30.2):
 * - Bỏ badges, HTML tags, link hình ảnh, khối code dài.
 * - Giới hạn độ dài tối đa (mặc định 8.000 ký tự) để tối ưu token.
 */
export function lamSachReadme(rawReadme: string, maxLen = 8000): string {
  if (!rawReadme) return '';

  let cleaned = rawReadme;

  // 1. Loại bỏ các khối code dài (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ');

  // 2. Loại bỏ badges dạng [![...](...)](...) hoặc [![...](...)]
  cleaned = cleaned.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, ' ');
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, ' ');

  // 3. Loại bỏ thẻ HTML (ví dụ: <div align="center">, <p>, <img>, v.v.)
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // 4. Loại bỏ các link markdown thuần túy giữ lại text hiển thị: [Text](url) -> Text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 5. Chuẩn hóa xuống dòng và khoảng trắng liên tiếp
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  cleaned = cleaned.trim();

  // 6. Cắt ngắn văn bản nếu vượt quá giới hạn cấu hình
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen) + '\n...[Đã cắt ngắn để tối ưu hóa]';
  }

  return cleaned;
}

/**
 * Kiểm tra trích dẫn bằng Code thuần không dùng AI (P2-30.8 & Rule D-01):
 * Phần `trichDan` của mỗi tính năng bắt buộc phải có mặt thực sự trong README gốc.
 * Nếu tính năng nào trích dẫn không khớp thì loại bỏ tính năng đó.
 *
 * @param danhSachTinhNang Danh sách tính năng do LLM trả về
 * @param rawReadme Nội dung README gốc trước hoặc sau khi làm sạch
 * @returns Danh sách các tính năng đã được kiểm chứng trích dẫn hợp lệ
 */
export function kiemTraTrichDanHopLe(
  danhSachTinhNang: TinhNangChiTiet[],
  rawReadme: string,
): TinhNangChiTiet[] {
  if (!danhSachTinhNang || danhSachTinhNang.length === 0 || !rawReadme) {
    return [];
  }

  const normalizedReadme = chuanHoaVanBan(rawReadme);

  return danhSachTinhNang.filter((item) => {
    if (!item.trichDan || item.trichDan.trim().length < 5) {
      return false;
    }
    const normalizedQuote = chuanHoaVanBan(item.trichDan);
    return normalizedReadme.includes(normalizedQuote);
  });
}

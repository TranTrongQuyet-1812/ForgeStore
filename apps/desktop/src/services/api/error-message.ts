import { ApiError } from './api-client';

/**
 * Lấy câu thông báo tiếng Việt để hiện cho người dùng từ một lỗi bất kỳ.
 * Backend trả lý do trong `data.thongBao`; `err.message` của ApiError chỉ là "API Error 400: "
 * (phần mô tả trống), nên phải đọc `data.thongBao` trước.
 */
export function layThongBaoLoi(err: unknown, macDinh: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { thongBao?: unknown } | null | undefined;
    const thongBao = typeof data?.thongBao === 'string' ? data.thongBao.trim() : '';
    if (err.status === 429) {
      return 'Bạn thao tác hơi nhanh, vui lòng đợi vài giây rồi thử lại.';
    }
    return thongBao || macDinh;
  }
  return macDinh;
}

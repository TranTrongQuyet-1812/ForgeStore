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
      if (err.retryAfterGiay) {
        const phut = Math.max(1, Math.ceil(err.retryAfterGiay / 60));
        return phut >= 2
          ? `Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau khoảng ${phut} phút.`
          : 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.';
      }
      return 'Bạn đã thao tác quá nhiều lần trong một giờ. Vui lòng thử lại sau.';
    }
    return thongBao || macDinh;
  }
  return macDinh;
}

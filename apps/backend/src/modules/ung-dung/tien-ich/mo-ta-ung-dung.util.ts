import { createHash } from 'crypto';

/**
 * Lấy mô tả tiếng Việt hợp lệ của ứng dụng: chỉ trả `moTaVi` khi mã băm SHA-256
 * của `moTaGocTiengAnh` hiện tại còn khớp `maBamMoTa` (hoặc khi chưa có nguồn/mã băm).
 * Dùng chung cho trang Khám phá, Chi tiết, Tìm kiếm và Yêu thích (P3B-44.3).
 */
export function layMoTaViHienTai(app: {
  moTaVi?: string | null;
  moTaGocTiengAnh?: string | null;
  maBamMoTa?: string | null;
}): string | null {
  if (!app.moTaVi) return null;
  if (!app.moTaGocTiengAnh || !app.maBamMoTa) return app.moTaVi;
  const maBamNguon = createHash('sha256').update(app.moTaGocTiengAnh.trim()).digest('hex');
  // Giữ bản dịch cũ trong DB để có thể đối chiếu, nhưng không hiển thị khi nguồn đã đổi.
  return maBamNguon === app.maBamMoTa ? app.moTaVi : null;
}

/**
 * Lấy khẩu hiệu hiển thị dự phòng khi chưa có `moTaVi` hợp lệ (P3B-44.3).
 * Nếu đã có `maBamMoTa` và `moTaGocTiengAnh` (nguồn đã đổi so với bản dịch cũ) thì ưu tiên mô tả gốc hiện tại.
 */
export function layKhauHieuHienThi(
  app: { moTaGocTiengAnh?: string | null; maBamMoTa?: string | null },
  khauHieuCu?: string | null,
): string | null {
  if (app.maBamMoTa && app.moTaGocTiengAnh) return app.moTaGocTiengAnh;
  return khauHieuCu || app.moTaGocTiengAnh || null;
}

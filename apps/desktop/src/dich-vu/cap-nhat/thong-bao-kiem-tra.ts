// Nội dung thông báo khi người dùng chủ động bấm "Kiểm Tra Cập Nhật" ở trang Thư viện.
// Tách riêng khỏi trang để kiểm bằng test tự động (trang chưa có test giao diện).

export type LoaiThongBaoKiemTra = 'success' | 'info' | 'error';

export interface ThongBaoKiemTra {
  loai: LoaiThongBaoKiemTra;
  noiDung: string;
}

export const THONG_BAO_CHUA_DANG_NHAP: ThongBaoKiemTra = {
  loai: 'info',
  noiDung: 'Hãy đăng nhập để kiểm tra cập nhật.',
};

export const THONG_BAO_THU_VIEN_TRONG: ThongBaoKiemTra = {
  loai: 'info',
  noiDung: 'Chưa có ứng dụng nào để kiểm tra.',
};

export const THONG_BAO_KIEM_TRA_LOI: ThongBaoKiemTra = {
  loai: 'error',
  noiDung: 'Không kiểm tra được cập nhật. Vui lòng thử lại.',
};

/**
 * Chọn thông báo theo kết quả kiểm tra với máy chủ.
 * `null` nghĩa là kiểm tra thất bại, khác với `0` là kiểm tra xong và không có bản mới.
 */
export function thongBaoTheoSoLuong(soLuong: number | null): ThongBaoKiemTra {
  if (soLuong === null) return THONG_BAO_KIEM_TRA_LOI;
  if (soLuong === 0) {
    return { loai: 'success', noiDung: 'Tất cả ứng dụng đã là bản mới nhất.' };
  }
  return { loai: 'info', noiDung: `Có ${soLuong} ứng dụng có bản cập nhật mới.` };
}

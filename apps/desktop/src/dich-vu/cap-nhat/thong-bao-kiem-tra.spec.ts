import { describe, it, expect } from 'vitest';
import {
  THONG_BAO_CHUA_DANG_NHAP,
  THONG_BAO_KIEM_TRA_LOI,
  THONG_BAO_THU_VIEN_TRONG,
  thongBaoTheoSoLuong,
} from './thong-bao-kiem-tra';

describe('thongBaoTheoSoLuong', () => {
  it('báo lỗi khi kiểm tra thất bại (null), không nhầm với không có bản mới', () => {
    expect(thongBaoTheoSoLuong(null)).toEqual(THONG_BAO_KIEM_TRA_LOI);
    expect(THONG_BAO_KIEM_TRA_LOI.loai).toBe('error');
  });

  it('báo đã mới nhất khi kiểm tra xong và không có bản cập nhật (0)', () => {
    expect(thongBaoTheoSoLuong(0)).toEqual({
      loai: 'success',
      noiDung: 'Tất cả ứng dụng đã là bản mới nhất.',
    });
  });

  it('báo số lượng khi có bản cập nhật', () => {
    expect(thongBaoTheoSoLuong(1)).toEqual({
      loai: 'info',
      noiDung: 'Có 1 ứng dụng có bản cập nhật mới.',
    });
    expect(thongBaoTheoSoLuong(3).noiDung).toBe('Có 3 ứng dụng có bản cập nhật mới.');
  });

  it('có thông báo riêng cho chưa đăng nhập và thư viện trống', () => {
    expect(THONG_BAO_CHUA_DANG_NHAP).toEqual({
      loai: 'info',
      noiDung: 'Hãy đăng nhập để kiểm tra cập nhật.',
    });
    expect(THONG_BAO_THU_VIEN_TRONG).toEqual({
      loai: 'info',
      noiDung: 'Chưa có ứng dụng nào để kiểm tra.',
    });
  });
});

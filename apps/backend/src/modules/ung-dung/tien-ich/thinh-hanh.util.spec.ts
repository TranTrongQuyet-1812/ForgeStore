import { describe, expect, it } from 'vitest';
import { HE_SO_THINH_HANH_REPO_DA_LUU_TRU, tinhDiemThinhHanh } from './thinh-hanh.util';

describe('tinhDiemThinhHanh', () => {
  it('giảm một nửa điểm cho repo lưu trữ nhưng vẫn giữ điểm dương', () => {
    const diemBinhThuong = tinhDiemThinhHanh(1000, 12, 1, false);
    const diemLuuTru = tinhDiemThinhHanh(1000, 12, 1, true);

    expect(HE_SO_THINH_HANH_REPO_DA_LUU_TRU).toBe(0.5);
    expect(diemLuuTru).toBe(diemBinhThuong * 0.5);
    expect(diemLuuTru).toBeGreaterThan(0);
  });
});

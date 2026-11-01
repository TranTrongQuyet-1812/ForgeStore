import { describe, expect, it } from 'vitest';
import { TIEU_DE_HUONG_DAN_DONG_LENH } from './tieu-de-huong-dan.core';

describe('tiêu đề hướng dẫn cài đặt dòng lệnh', () => {
  it('không hiển thị tên kỹ thuật CLI', () => {
    expect(TIEU_DE_HUONG_DAN_DONG_LENH).toBe('HƯỚNG DẪN CÀI ĐẶT QUA DÒNG LỆNH');
    expect(TIEU_DE_HUONG_DAN_DONG_LENH).not.toContain('CLI');
  });
});

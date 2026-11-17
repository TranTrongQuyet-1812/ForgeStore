import { describe, expect, it } from 'vitest';
import { laHoanNgan, layThongBaoBanDichHoan } from './thong-bao-dich-hoan.core';

describe('P3B-38.1: thông báo bản dịch bị hoãn', () => {
  const bayGio = Date.UTC(2026, 10, 17, 12, 0, 0);
  const phut = (n: number) => n * 60 * 1000;
  const gio = (n: number) => n * 60 * 60 * 1000;

  it('hoãn 5 phút thì ghi "trong ít phút nữa", không ghi "ngày mai"', () => {
    const thongBao = layThongBaoBanDichHoan(bayGio + phut(5), bayGio);
    expect(thongBao).toContain('trong ít phút nữa');
    expect(thongBao).not.toContain('ngày mai');
  });

  it('hoãn 24 giờ thì ghi "vào ngày mai"', () => {
    expect(layThongBaoBanDichHoan(bayGio + gio(24), bayGio)).toContain('vào ngày mai');
  });

  it('ranh giới 6 giờ vẫn tính là hoãn ngắn, quá 6 giờ là ngày mai', () => {
    expect(laHoanNgan(bayGio + gio(6), bayGio)).toBe(true);
    expect(laHoanNgan(bayGio + gio(6) + 1, bayGio)).toBe(false);
  });

  it('backend cũ không trả mốc thử lại thì giữ cách ghi cũ là ngày mai', () => {
    expect(laHoanNgan(undefined, bayGio)).toBe(false);
    expect(laHoanNgan(null, bayGio)).toBe(false);
    expect(layThongBaoBanDichHoan(undefined, bayGio)).toContain('vào ngày mai');
  });
});

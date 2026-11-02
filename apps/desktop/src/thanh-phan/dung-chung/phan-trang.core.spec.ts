import { describe, expect, it } from 'vitest';
import { taoDanhSachSoTrang, tinhKhoangDangXem } from './phan-trang.core';

describe('dãy nút số trang', () => {
  it('ít trang thì hiện đủ, không có dấu ...', () => {
    expect(taoDanhSachSoTrang(1, 1)).toEqual([1]);
    expect(taoDanhSachSoTrang(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('đứng đầu: chỉ cắt phần xa', () => {
    expect(taoDanhSachSoTrang(1, 28)).toEqual([1, 2, null, 28]);
  });

  it('đứng giữa: có dấu ... hai bên', () => {
    expect(taoDanhSachSoTrang(10, 28)).toEqual([1, null, 9, 10, 11, null, 28]);
  });

  it('chỗ trống đúng một trang thì hiện số đó thay vì dấu ...', () => {
    expect(taoDanhSachSoTrang(3, 28)).toEqual([1, 2, 3, 4, null, 28]);
    expect(taoDanhSachSoTrang(26, 28)).toEqual([1, null, 25, 26, 27, 28]);
  });

  it('đứng cuối: chỉ cắt phần xa', () => {
    expect(taoDanhSachSoTrang(28, 28)).toEqual([1, null, 27, 28]);
  });

  it('không có trang nào thì dãy rỗng', () => {
    expect(taoDanhSachSoTrang(1, 0)).toEqual([]);
  });
});

describe('khoảng ứng dụng đang xem', () => {
  it('trang giữa đủ kích thước', () => {
    expect(tinhKhoangDangXem(2, 30, 809)).toEqual({ tu: 31, den: 60 });
  });

  it('trang cuối bị kẹp theo tổng số', () => {
    expect(tinhKhoangDangXem(27, 30, 809)).toEqual({ tu: 781, den: 809 });
  });

  it('không có ứng dụng thì về 0', () => {
    expect(tinhKhoangDangXem(1, 30, 0)).toEqual({ tu: 0, den: 0 });
  });
});

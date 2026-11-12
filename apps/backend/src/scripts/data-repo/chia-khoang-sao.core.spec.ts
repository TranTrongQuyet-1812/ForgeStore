import { describe, expect, it } from 'vitest';
import { chiaKhoangSaoThichUng, diemChia, TRAN_KET_QUA_SEARCH } from './chia-khoang-sao.core';

/** Bộ đếm giả: đếm số repo có sao nằm trong [tu, den] từ một danh sách sao cho trước. */
function demGia(saoCacRepo: number[]) {
  return async (tu: number, den: number) => saoCacRepo.filter((s) => s >= tu && s <= den).length;
}

/** Phân bố sao lệch mạnh như GitHub: rất nhiều repo sao thấp, ít repo sao cao. */
function phanBoLech(soRepo: number): number[] {
  const kq: number[] = [];
  for (let i = 0; i < soRepo; i++) kq.push(Math.floor(1000 * Math.pow(1000, i / soRepo)));
  return kq;
}

describe('diemChia', () => {
  it('luôn nằm trong [tu, den - 1] để hai nửa không rỗng và không lặp vô hạn', () => {
    for (const [tu, den] of [
      [5, 6],
      [1000, 1001],
      [1000, 1_000_000],
      [1000, 1000 * 1000],
      [20_000, 20_001],
    ] as const) {
      const mid = diemChia(tu, den);
      expect(mid).toBeGreaterThanOrEqual(tu);
      expect(mid).toBeLessThan(den);
    }
  });
});

describe('chiaKhoangSaoThichUng', () => {
  it('khoảng ≤ trần thì giữ nguyên, chỉ tốn một lượt đếm', async () => {
    const sao = Array.from({ length: 400 }, (_, i) => 1000 + i);
    const kq = await chiaKhoangSaoThichUng(demGia(sao), 1000, 1_000_000);
    expect(kq.khoang).toEqual([{ tu: 1000, den: 1_000_000, tong: 400 }]);
    expect(kq.soLuotDem).toBe(1);
  });

  it('chia tới khi mọi khoảng ≤ 1.000, phủ đủ không sót không trùng, sao giảm dần', async () => {
    const sao = phanBoLech(12_000);
    const kq = await chiaKhoangSaoThichUng(demGia(sao), 1000, 1_000_000);
    expect(kq.khoangDonQuaLon).toEqual([]);
    expect(kq.khoang.length).toBeGreaterThan(1);
    for (const k of kq.khoang) expect(k.tong).toBeLessThanOrEqual(TRAN_KET_QUA_SEARCH);
    expect(kq.khoang.reduce((t, k) => t + k.tong, 0)).toBe(sao.length);
    for (let i = 1; i < kq.khoang.length; i++) {
      const truoc = kq.khoang[i - 1]!;
      const sau = kq.khoang[i]!;
      expect(sau.den).toBeLessThan(truoc.tu); // giảm dần, không chồng nhau
    }
  });

  it('mỗi mức sao duy nhất vẫn quá trần thì báo riêng, không lặp vô hạn', async () => {
    const sao = [
      ...Array.from({ length: 2500 }, () => 1500),
      ...Array.from({ length: 300 }, (_, i) => 5000 + i),
    ];
    const kq = await chiaKhoangSaoThichUng(demGia(sao), 1000, 1_000_000);
    expect(kq.khoangDonQuaLon).toEqual([{ tu: 1500, den: 1500, tong: 2500 }]);
    expect(kq.khoang.reduce((t, k) => t + k.tong, 0)).toBe(300);
  });

  it('số lượt đếm nằm trong mức chấp nhận được (Search chỉ 30 lượt mỗi phút)', async () => {
    const sao = phanBoLech(40_000);
    const kq = await chiaKhoangSaoThichUng(demGia(sao), 1000, 1_000_000);
    // 40.000 repo cần ít nhất 40 khoảng; cận trên rộng rãi cho phân bố lệch
    expect(kq.khoang.length).toBeGreaterThanOrEqual(40);
    expect(kq.soLuotDem).toBeLessThan(kq.khoang.length * 25);
  });

  it('không có repo nào thì không có khoảng nào', async () => {
    const kq = await chiaKhoangSaoThichUng(demGia([]), 1000, 1_000_000);
    expect(kq.khoang).toEqual([]);
    expect(kq.soLuotDem).toBe(1);
  });
});

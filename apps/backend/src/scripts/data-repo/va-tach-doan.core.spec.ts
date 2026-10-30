import { describe, expect, it } from 'vitest';
import type { DoanChoDich } from './data-repo.types';
import { coDanhSachMaBamKhac, docDanhSachDichLai, ghepBanDichCu } from './va-tach-doan.core';

function taoDoan(stt: number, maBam: string, canDich: boolean, vi: string | null): DoanChoDich {
  return {
    stt,
    maBam,
    mucQuanTrong: 1,
    vanBanDaChe: `Đoạn ${maBam}`,
    canDich,
    vi,
  };
}

describe('va-tach-doan.core', () => {
  it('chỉ coi danh sách khác khi số lượng hoặc thứ tự mã băm thay đổi', () => {
    expect(coDanhSachMaBamKhac([taoDoan(1, 'a', true, null)], [taoDoan(9, 'a', true, 'cũ')])).toBe(
      false,
    );
    expect(coDanhSachMaBamKhac([taoDoan(1, 'b', true, null)], [taoDoan(1, 'a', true, 'cũ')])).toBe(
      true,
    );
  });

  it('ghép các mã băm trùng theo thứ tự, giữ bản cũ còn tồn tại và để đoạn mới trống', () => {
    const ketQua = ghepBanDichCu(
      [taoDoan(1, 'lap', true, null), taoDoan(2, 'moi', true, null), taoDoan(3, 'lap', true, null)],
      [taoDoan(10, 'lap', true, 'bản dịch lần một'), taoDoan(11, 'lap', true, 'bản dịch lần hai')],
    );

    expect(ketQua.doan.map((doan) => doan.vi)).toEqual([
      'bản dịch lần một',
      null,
      'bản dịch lần hai',
    ]);
    expect(ketQua.soDoanDungLai).toBe(2);
    expect(ketQua.soDoanCanDich).toBe(1);
  });

  it('không dùng nội dung gốc cũ cho đoạn nay cần dịch, và áp dụng yêu cầu dịch lại', () => {
    const cu = [
      taoDoan(7, 'mo-lai', false, 'văn bản gốc'),
      taoDoan(8, 'can-dich-lai', true, 'bản dịch cần sửa'),
      taoDoan(9, 'dich-duoc-giu', true, 'bản dịch giữ lại'),
    ];
    const moi = [
      taoDoan(1, 'mo-lai', true, null),
      taoDoan(2, 'can-dich-lai', true, null),
      taoDoan(3, 'dich-duoc-giu', true, null),
      taoDoan(4, 'het-ton-tai', false, 'giữ nguyên'),
    ];
    const ketQua = ghepBanDichCu(moi, cu, {
      sttCu: new Set([8]),
      maBam: new Set(),
    });

    expect(ketQua.doan.map((doan) => doan.vi)).toEqual([
      null,
      null,
      'bản dịch giữ lại',
      'giữ nguyên',
    ]);
    expect(ketQua.soDoanDungLai).toBe(1);
    expect(ketQua.soDoanCanDich).toBe(2);
  });

  it('đọc yêu cầu dịch lại theo stt, khoảng stt và mã băm', () => {
    const maBam = 'a'.repeat(64);
    const danhSach = docDanhSachDichLai(
      `# ghi chú\nowner/repo 65-67,103/108\nowner/repo ${maBam} # sửa đoạn có hash này`,
    );

    expect([...danhSach.get('owner/repo')!.sttCu]).toEqual([65, 66, 67, 103, 108]);
    expect([...danhSach.get('owner/repo')!.maBam]).toEqual([maBam]);
    const ketQua = ghepBanDichCu(
      [taoDoan(1, maBam, true, null)],
      [taoDoan(65, maBam, true, 'bản dịch cũ')],
      danhSach.get('owner/repo'),
    );
    expect(ketQua.doan[0]?.vi).toBeNull();
  });
});

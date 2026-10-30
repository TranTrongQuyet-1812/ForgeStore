import { describe, expect, it } from 'vitest';
import type { DoanChoDich } from './data-repo.types';
import {
  coDanhSachMaBamKhac,
  docDanhSachDichLai,
  doiSttSangMaBam,
  ghepBanDichCu,
  phanLoaiThayDoi,
} from './va-tach-doan.core';

function taoDoan(stt: number, maBam: string, canDich: boolean, vi: string | null): DoanChoDich {
  return { stt, maBam, mucQuanTrong: 1, vanBanDaChe: `Đoạn ${maBam}`, canDich, vi };
}

describe('va-tach-doan.core', () => {
  it('phân biệt repo A theo danh sách mã băm thay đổi', () => {
    expect(phanLoaiThayDoi([taoDoan(1, 'b', true, null)], [taoDoan(9, 'a', true, 'cũ')])).toBe('A');
    expect(coDanhSachMaBamKhac([taoDoan(1, 'a', true, null)], [taoDoan(9, 'a', true, 'cũ')])).toBe(
      false,
    );
  });

  it('chọn repo B khi mã băm y nguyên nhưng canDich đổi, để đoạn mới trống', () => {
    const cu = [taoDoan(20, 'gioi-thieu', false, 'giới thiệu')];
    const moi = [taoDoan(1, 'gioi-thieu', true, null)];
    expect(phanLoaiThayDoi(moi, cu)).toBe('B');
    const ketQua = ghepBanDichCu(moi, cu);
    expect(ketQua.doan[0]?.vi).toBeNull();
    expect(ketQua.soDoanCanDich).toBe(1);
  });

  it('ghép mã băm trùng theo thứ tự và để đoạn mới cần dịch trống', () => {
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

  it('đổi STT cũ sang đúng lần xuất hiện của đoạn trùng, bỏ STT không hợp lệ', () => {
    const cu = [
      taoDoan(5, 'lap', true, 'dịch thứ nhất'),
      taoDoan(8, 'lap', true, 'dịch thứ hai'),
      taoDoan(9, 'bo-qua', false, null),
    ];
    const moi = [taoDoan(1, 'lap', true, null), taoDoan(2, 'lap', true, null)];
    const chon = docDanhSachDichLai('owner/repo 8\nowner/repo 9\nowner/repo 99');
    const daDoiStt = doiSttSangMaBam(cu, moi, chon.get('owner/repo')!);
    const ketQua = ghepBanDichCu(moi, cu, daDoiStt.chon);
    expect(ketQua.doan.map((doan) => doan.vi)).toEqual(['dịch thứ nhất', null]);
    expect(daDoiStt.boQua.map(({ stt, lyDo }) => [stt, lyDo])).toEqual([
      [9, 'stt cũ không cần dịch'],
      [99, 'không tìm thấy stt cũ'],
    ]);
  });

  it('đọc STT, khoảng và mã băm trong danh sách dịch lại', () => {
    const maBam = 'a'.repeat(64);
    const danhSach = docDanhSachDichLai(
      `# ghi chú\nowner/repo 65-67,103/108\nowner/repo ${maBam} # sửa đoạn này`,
    );
    expect([...danhSach.get('owner/repo')!.sttCu]).toEqual([65, 66, 67, 103, 108]);
    expect([...danhSach.get('owner/repo')!.maBam]).toEqual([maBam]);
    const cu = [taoDoan(65, maBam, true, 'bản dịch cũ')];
    const moi = [taoDoan(1, maBam, true, null)];
    const daDoiStt = doiSttSangMaBam(cu, moi, danhSach.get('owner/repo')!);
    expect(ghepBanDichCu(moi, cu, daDoiStt.chon).doan[0]?.vi).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { BanGhiDaCao, DoanChoDich, DongDaKiem, DongDich } from './data-repo.types';
import { ghepBanDichDaNhap, taoRepoVa2 } from './va-tach-doan2.core';

function taoCao(readme: string): BanGhiDaCao {
  return {
    repo: 'owner/repo',
    lo: 'dich-g02-l001',
    caoLuc: '2026-10-22T00:00:00.000Z',
    sao: 10,
    idGithub: 12,
    moTaEn: 'description',
    readmeEn: readme,
    readmeSha: 'old-sha',
    etagRepo: 'old-repo-etag',
    etagReleases: 'old-release-etag',
    etagReadme: 'old-readme-etag',
  };
}

function taoDaKiem(doan: Array<{ maBam: string; goc: string; dich: string }>): DongDaKiem {
  return {
    repo: 'owner/repo',
    lo: 'dich-g02-l001',
    moTaEn: 'description',
    moTaVi: 'mô tả cũ',
    readmeSha: 'old-sha',
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
    doan,
    readmeVi: null,
    nguon: 'test',
  };
}

function taoDoan(cao: BanGhiDaCao): DoanChoDich[] {
  return (cao.readmeEn ?? '').split('|').map((maBam, index) => ({
    stt: index + 1,
    maBam,
    mucQuanTrong: 1,
    vanBanDaChe: maBam,
    canDich: true,
    vi: null,
  }));
}

function taoBanCu(readme: string, vi: string[]): DoanChoDich[] {
  return taoDoan(taoCao(readme)).map((doan, index) => ({ ...doan, vi: vi[index] ?? null }));
}

describe('va-tach-doan2.core', () => {
  it('dùng README mới, giữ bản dịch đoạn y nguyên và để đoạn mới trống', () => {
    const caoCu = taoCao('same|old');
    const daKiemCu = taoDaKiem([
      { maBam: 'same', goc: 'same', dich: 'bản dịch giữ lại' },
      { maBam: 'old', goc: 'old', dich: 'bản dịch bỏ' },
    ]);
    const ketQua = taoRepoVa2({
      caoCu,
      daKiemCu,
      doanCuDaChe: taoBanCu('same|old', ['bản dịch giữ lại', 'bản dịch bỏ']),
      readmeMoi: 'same|new',
      shaMoi: 'new-sha',
      loMoi: 'va2-g02-l001',
      saoMoi: 20,
      idMoi: 12,
      taoDoan,
    });

    expect(ketQua.cao).toMatchObject({
      lo: 'va2-g02-l001',
      readmeEn: 'same|new',
      readmeSha: 'new-sha',
      sao: 20,
      etagRepo: null,
      etagReadme: null,
      etagReleases: null,
    });
    expect(ketQua.choDich.moTaVi).toBe('mô tả cũ');
    expect(ketQua.choDich.doan.map((doan) => doan.vi)).toEqual(['bản dịch giữ lại', null]);
    expect(ketQua.daDich.doan.map((doan) => doan.vi)).toEqual(['bản dịch giữ lại', null]);
    expect(ketQua.soDoanDungLai).toBe(1);
    expect(ketQua.soDoanCanDich).toBe(1);
  });

  it('báo lỗi nếu bản kiểm cũ thiếu bản dịch cho đoạn nguồn', () => {
    expect(() =>
      taoRepoVa2({
        caoCu: taoCao('same|missing'),
        daKiemCu: taoDaKiem([{ maBam: 'same', goc: 'same', dich: 'đã dịch' }]),
        doanCuDaChe: taoBanCu('same', ['đã dịch']),
        readmeMoi: 'same|new',
        shaMoi: 'new-sha',
        loMoi: 'va2-g02-l001',
        taoDoan,
      }),
    ).toThrow('Số đoạn cũ không khớp');
  });

  it('giữ nguyên đủ token che trong bản dịch cũ để nhap không báo placeholders_changed', () => {
    const vanBanDaChe = 'Open ⟦C1⟧ to view ⟦C2⟧';
    const banDichDaChe = 'Mở ⟦C2⟧ để xem ⟦C1⟧';
    const taoDoanCoToken = (): DoanChoDich[] => [
      {
        stt: 1,
        maBam: 'with-tokens',
        mucQuanTrong: 1,
        vanBanDaChe,
        canDich: true,
        vi: null,
      },
    ];
    const ketQua = taoRepoVa2({
      caoCu: taoCao('old'),
      daKiemCu: taoDaKiem([{ maBam: 'with-tokens', goc: 'old goc', dich: 'đã gỡ che' }]),
      doanCuDaChe: [{ ...taoDoanCoToken()[0]!, vi: banDichDaChe }],
      readmeMoi: 'new',
      shaMoi: 'new-sha',
      loMoi: 'va2-g02-l001',
      taoDoan: taoDoanCoToken,
    });

    expect(ketQua.choDich.doan[0]?.vanBanDaChe.match(/⟦C\d+⟧/g)).toHaveLength(2);
    expect(ketQua.choDich.doan[0]?.vi?.match(/⟦C\d+⟧/g)).toHaveLength(2);
    expect(ketQua.choDich.doan[0]?.vi).toBe(banDichDaChe);
  });

  it('khôi phục bản Anti đã điền theo repo, mã băm và lần xuất hiện, chỉ vào đoạn còn trống', () => {
    const base = taoDoan(taoCao('same|same|new'));
    const dongMoi: DongDich = {
      repo: 'owner/repo',
      lo: 'va2-g02-l001',
      moTaEn: null,
      moTaVi: null,
      doan: base,
    };
    const dongCu: DongDich = {
      ...dongMoi,
      doan: base.map((doan, index) => ({
        ...doan,
        vi: index === 0 ? 'Anti xong lần một' : index === 1 ? 'Anti xong lần hai' : null,
      })),
    };
    const ketQua = ghepBanDichDaNhap(dongMoi, dongCu);

    expect(ketQua.soGhep).toBe(2);
    expect(ketQua.sttGhep).toEqual([1, 2]);
    expect(ketQua.dong.doan.map((doan) => doan.vi)).toEqual([
      'Anti xong lần một',
      'Anti xong lần hai',
      null,
    ]);
  });
});

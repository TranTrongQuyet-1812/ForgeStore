import { describe, expect, it } from 'vitest';
import type { BanGhiDaCao, DoanChoDich, DongDaKiem } from './data-repo.types';
import { taoRepoVa2 } from './va-tach-doan2.core';

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
        readmeMoi: 'same|new',
        shaMoi: 'new-sha',
        loMoi: 'va2-g02-l001',
        taoDoan,
      }),
    ).toThrow('Thiếu bản dịch cũ');
  });
});

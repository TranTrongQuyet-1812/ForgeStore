import { describe, expect, it, vi } from 'vitest';
import type { BanGhiDaCao, DongDaKiem } from './data-repo.types';
import {
  chayKiemTuoi,
  kiemTraMotRepo,
  layChuaXuLy,
  phanLoaiRepo,
  thongKeDoanCuMoi,
  type KetQuaHttp,
  type TienDoKiemTuoi,
} from './kiem-tuoi.core';

function taoCao(repo = 'owner/repo'): BanGhiDaCao {
  return {
    repo,
    lo: 'dich-g01-l001',
    caoLuc: '2026-10-22T00:00:00.000Z',
    sao: 10,
    idGithub: 123,
    moTaEn: null,
    readmeEn: 'README cũ',
    readmeSha: 'sha-cu',
    etagRepo: 'repo-etag',
    etagReleases: null,
    etagReadme: 'readme-etag',
  };
}

function taoDaKiem(maBam: string[] = ['a', 'b']): DongDaKiem {
  return {
    repo: 'owner/repo',
    lo: 'dich-g01-l001',
    moTaEn: null,
    moTaVi: null,
    readmeSha: 'sha-cu',
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
    doan: maBam.map((ma) => ({ maBam: ma, goc: ma, dich: ma })),
    readmeVi: null,
    nguon: 'test',
  };
}

function http(status: number, data?: unknown, headers: Record<string, string> = {}): KetQuaHttp {
  return {
    response: new Response(data === undefined ? null : JSON.stringify(data), { status, headers }),
    dungLuongConLai: Number(headers['x-ratelimit-remaining'] ?? 4000),
    thoiDiemReset: Number(headers['x-ratelimit-reset'] ?? 1790000000),
  };
}

const taoDoan = (cao: BanGhiDaCao) =>
  (cao.readmeEn ?? '')
    .split(',')
    .filter(Boolean)
    .map((maBam, stt) => ({ maBam, stt, goc: maBam, dich: maBam }));

describe('kiem-tuoi.core', () => {
  it('gửi ETag và xếp 304 ở cả hai endpoint là không đổi', async () => {
    const yeuCau = vi.fn(async () => http(304));
    const ketQua = await kiemTraMotRepo(taoCao(), taoDaKiem(), yeuCau, taoDoan);
    expect(ketQua.baoCao?.loai).toBe('khong_doi');
    expect(ketQua.baoCao?.statusRepo).toBe(304);
    expect(ketQua.baoCao?.statusReadme).toBe(304);
    expect(yeuCau).toHaveBeenCalledTimes(2);
    expect(yeuCau).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repositories/123',
      'repo-etag',
    );
    expect(yeuCau).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/owner/repo/readme',
      'readme-etag',
    );
  });

  it('xếp repo 404 là đã xóa, không gọi endpoint README', async () => {
    const yeuCau = vi.fn(async () => http(404));
    const ketQua = await kiemTraMotRepo(taoCao(), taoDaKiem(), yeuCau, taoDoan);
    expect(ketQua.baoCao?.loai).toBe('da_xoa');
    expect(ketQua.baoCao?.statusRepo).toBe(404);
    expect(yeuCau).toHaveBeenCalledTimes(1);
  });

  it('nhận diện tên mới từ phản hồi chuyển hướng', async () => {
    const yeuCau = vi
      .fn<(...args: [string, string | null]) => Promise<KetQuaHttp>>()
      .mockResolvedValueOnce(
        http(301, undefined, { location: 'https://api.github.com/repos/new-owner/new-name' }),
      )
      .mockResolvedValueOnce(http(304));
    const ketQua = await kiemTraMotRepo(taoCao(), taoDaKiem(), yeuCau, taoDoan);
    expect(ketQua.baoCao?.loai).toBe('doi_ten');
    expect(ketQua.baoCao?.tenMoi).toBe('new-owner/new-name');
    expect(yeuCau.mock.calls[1]?.[0]).toBe(
      'https://api.github.com/repos/new-owner/new-name/readme',
    );
  });

  it('nhận diện repo lưu trữ', async () => {
    const yeuCau = vi
      .fn()
      .mockResolvedValueOnce(http(200, { full_name: 'owner/repo', archived: true }))
      .mockResolvedValueOnce(http(304));
    const ketQua = await kiemTraMotRepo(taoCao(), taoDaKiem(), yeuCau, taoDoan);
    expect(ketQua.baoCao?.loai).toBe('luu_tru');
    expect(ketQua.baoCao?.archived).toBe(true);
  });

  it('phân loại README đổi nhẹ và đổi nhiều theo tỷ lệ đoạn', async () => {
    const readmeHttp = (content: string) =>
      http(200, {
        sha: 'github-blob-sha',
        encoding: 'base64',
        content: Buffer.from(content).toString('base64'),
      });
    const makeRequest = (content: string) =>
      vi
        .fn()
        .mockResolvedValueOnce(http(200, { full_name: 'owner/repo' }))
        .mockResolvedValueOnce(readmeHttp(content));
    const old = taoDaKiem(Array.from({ length: 100 }, (_, i) => `m${i}`));
    const slight = await kiemTraMotRepo(
      taoCao(),
      old,
      makeRequest([...Array.from({ length: 99 }, (_, i) => `m${i}`), 'new'].join(',')),
      taoDoan,
    );
    const heavy = await kiemTraMotRepo(
      taoCao(),
      old,
      makeRequest(
        [
          ...Array.from({ length: 94 }, (_, i) => `m${i}`),
          ...Array.from({ length: 6 }, (_, i) => `new${i}`),
        ].join(','),
      ),
      taoDoan,
    );
    expect(slight.baoCao?.loai).toBe('readme_doi_nhe');
    expect(slight.baoCao?.soDoanMoi).toBe(1);
    expect(slight.baoCao?.soDoanXoa).toBe(1);
    expect(heavy.baoCao?.loai).toBe('readme_doi_nhieu');
    expect(heavy.baoCao?.tiLeDoi).toBeGreaterThanOrEqual(0.05);
  });

  it('phân loại riêng tư hoặc bị chặn và đếm đoạn trùng theo số lần xuất hiện', () => {
    expect(phanLoaiRepo('owner/repo', { private: true }).loai).toBe('rieng_tu_hoac_bi_chan');
    expect(thongKeDoanCuMoi(['a', 'a', 'b'], ['a', 'b', 'c'])).toEqual({
      giu: 2,
      them: 1,
      xoa: 1,
      tiLeDoi: 1 / 3,
    });
  });

  it('dừng trước request thứ hai khi hạn mức xuống dưới 200 và có thể tiếp tục', async () => {
    const danhSach: TienDoKiemTuoi[] = [
      { cao: taoCao('owner/a'), daKiem: taoDaKiem() },
      { cao: taoCao('owner/b'), daKiem: taoDaKiem() },
    ];
    const ghiNhan = vi.fn();
    const yeuCauThap = vi.fn(async () =>
      http(304, undefined, { 'x-ratelimit-remaining': '199', 'x-ratelimit-reset': '1790000000' }),
    );
    const dung = await chayKiemTuoi(
      danhSach,
      new Set(),
      { yeuCau: yeuCauThap, taoDongMoi: taoDoan, ngu: async () => undefined },
      ghiNhan,
    );
    expect(dung.dungViHanMuc).toBe(true);
    expect(dung.thoiDiemReset).toBe(1790000000);
    expect(yeuCauThap.mock.calls.length).toBeLessThanOrEqual(2);
    expect(ghiNhan).not.toHaveBeenCalled();

    const yeuCauTot = vi.fn(async () => http(304));
    const ketQuaDaCo = new Set<string>();
    const capNhat = (_ketQua: unknown, cao: BanGhiDaCao) => ketQuaDaCo.add(cao.repo.toLowerCase());
    await chayKiemTuoi(
      danhSach,
      ketQuaDaCo,
      { yeuCau: yeuCauTot, taoDongMoi: taoDoan, ngu: async () => undefined },
      capNhat,
      1,
    );
    expect(layChuaXuLy(danhSach, ketQuaDaCo)).toHaveLength(1);
    await chayKiemTuoi(
      danhSach,
      ketQuaDaCo,
      { yeuCau: yeuCauTot, taoDongMoi: taoDoan, ngu: async () => undefined },
      capNhat,
    );
    expect(ketQuaDaCo.size).toBe(2);
  });
});

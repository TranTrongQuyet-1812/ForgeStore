import { describe, expect, it } from 'vitest';
import type { BanGhiDaCao, DongDaKiem, DongDich } from './data-repo.types';
import type { LoGocHopNhat } from './hop-nhat.core';
import { docDanhSachDoiTen, hopNhatKhoCuoi, kiemTraKhoDaGhi } from './hop-nhat.core';

function taoCao(repo: string, lo: string, sao = 1): BanGhiDaCao {
  return {
    repo,
    lo,
    caoLuc: '2026-10-30T00:00:00.000Z',
    sao,
    moTaEn: null,
    readmeEn: `README ${repo}`,
    readmeSha: `sha-${repo}`,
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
  };
}

function taoDaKiem(repo: string, lo: string, dich: string): DongDaKiem {
  return {
    repo,
    lo,
    moTaEn: null,
    moTaVi: null,
    readmeSha: `sha-${repo}`,
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
    doan: [],
    readmeVi: dich,
    nguon: 'test',
  };
}

const khongLoi: DongDich[] = [];

describe('hop-nhat.core', () => {
  it('thay đúng repo đã kiểm, đổi lo về lô gốc và giữ thứ tự cùng dữ liệu repo cũ', () => {
    const caoCu = [taoCao('owner/a', 'dich-g01-l001'), taoCao('owner/b', 'dich-g01-l001')];
    const kiemCu = [
      taoDaKiem('owner/b', 'dich-g01-l001', 'README B cũ'),
      taoDaKiem('owner/a', 'dich-g01-l001', 'README A'),
    ];
    const ketQua = hopNhatKhoCuoi(
      [{ lo: 'dich-g01-l001', cao: caoCu, daKiem: kiemCu }],
      [
        {
          lo: 'va-g01-l001',
          cao: [taoCao('owner/b', 'va-g01-l001', 99)],
          daKiem: [taoDaKiem('owner/b', 'va-g01-l001', 'README B mới')],
          loi: khongLoi,
        },
      ],
      2,
    );

    expect(ketQua.cacLo[0]?.cao.map((r) => r.repo)).toEqual(['owner/a', 'owner/b']);
    expect(ketQua.cacLo[0]?.cao).toEqual([
      caoCu[0],
      { ...taoCao('owner/b', 'va-g01-l001', 99), lo: 'dich-g01-l001' },
    ]);
    expect(ketQua.cacLo[0]?.daKiem.map((r) => r.repo)).toEqual(['owner/b', 'owner/a']);
    expect(ketQua.cacLo[0]?.daKiem.map((r) => r.readmeVi)).toEqual(['README B mới', 'README A']);
    expect(ketQua.cacLo[0]?.daKiem[0]?.lo).toBe('dich-g01-l001');
    expect(ketQua.tongThayThe).toBe(1);
    expect(() => kiemTraKhoDaGhi(ketQua, ketQua.cacLo)).not.toThrow();
  });

  it('báo lỗi nếu repo vá không có trong lô gốc', () => {
    expect(() =>
      hopNhatKhoCuoi(
        [
          {
            lo: 'dich-g01-l001',
            cao: [taoCao('owner/a', 'dich-g01-l001')],
            daKiem: [taoDaKiem('owner/a', 'dich-g01-l001', 'A')],
          },
        ],
        [
          {
            lo: 'va-g01-l001',
            cao: [taoCao('owner/missing', 'va-g01-l001')],
            daKiem: [taoDaKiem('owner/missing', 'va-g01-l001', 'x')],
            loi: khongLoi,
          },
        ],
        1,
      ),
    ).toThrow('không có trong lô gốc');
  });

  it('báo lỗi nếu một repo nguồn xuất hiện ở hai lô', () => {
    const row = taoCao('owner/a', 'dich-g01-l001');
    const check = taoDaKiem('owner/a', 'dich-g01-l001', 'A');
    expect(() =>
      hopNhatKhoCuoi(
        [
          { lo: 'dich-g01-l001', cao: [row], daKiem: [check] },
          {
            lo: 'dich-g01-l002',
            cao: [{ ...row, lo: 'dich-g01-l002' }],
            daKiem: [{ ...check, lo: 'dich-g01-l002' }],
          },
        ],
        [],
        1,
      ),
    ).toThrow('xuất hiện ở hai lô');
  });

  it('dừng nếu Dot_Va còn repo trong 04_loi', () => {
    const loi: DongDich = {
      repo: 'owner/a',
      lo: 'va-g01-l001',
      moTaEn: null,
      moTaVi: null,
      doan: [],
    };
    expect(() =>
      hopNhatKhoCuoi(
        [
          {
            lo: 'dich-g01-l001',
            cao: [taoCao('owner/a', 'dich-g01-l001')],
            daKiem: [taoDaKiem('owner/a', 'dich-g01-l001', 'A')],
          },
        ],
        [
          {
            lo: 'va-g01-l001',
            cao: [taoCao('owner/a', 'va-g01-l001')],
            daKiem: [taoDaKiem('owner/a', 'va-g01-l001', 'A')],
            loi: [loi],
          },
        ],
        1,
      ),
    ).toThrow('còn 1 repo trong 04_loi');
  });

  it('ghép lô Dot_Va2 theo repo gốc rồi đổi tên trong cả dữ liệu cào và đã kiểm', () => {
    const tenCu = 'diegosouzapw/OmniRoute';
    const tenMoi = 'cheaper-inference/OmniRoute';
    const caoGoc = {
      ...taoCao(tenCu, 'dich-g01-l001'),
      owner: 'diegosouzapw',
      name: 'OmniRoute',
      html_url: `https://github.com/${tenCu}`,
    };
    const kiemGoc = {
      ...taoDaKiem(tenCu, 'dich-g01-l001', 'README cũ'),
      owner: { login: 'diegosouzapw', url: `https://api.github.com/users/diegosouzapw` },
      html_url: `https://github.com/${tenCu}`,
    };
    const caoVa = {
      ...taoCao(tenCu, 'va2-g01-l001', 9),
      readmeEn: 'README mới',
      owner: 'diegosouzapw',
      name: 'OmniRoute',
      html_url: `https://github.com/${tenCu}`,
    };
    const kiemVa = {
      ...taoDaKiem(tenCu, 'va2-g01-l001', 'README dịch mới'),
      owner: { login: 'diegosouzapw', url: 'https://api.github.com/users/diegosouzapw' },
      html_url: `https://github.com/${tenCu}`,
    };
    const doiTen = docDanhSachDoiTen(`# repo chuyển chủ\n\n${tenCu} ${tenMoi}\n`);
    const ketQua = hopNhatKhoCuoi(
      [
        {
          lo: 'dich-g01-l001',
          cao: [caoGoc],
          daKiem: [kiemGoc],
        },
      ],
      [
        {
          lo: 'va2-g01-l001',
          cao: [caoVa],
          daKiem: [kiemVa],
          loi: khongLoi,
        },
      ],
      1,
      doiTen,
      [tenCu],
    );

    expect(ketQua.cacLo[0]?.lo).toBe('dich-g01-l001');
    expect(ketQua.cacLo[0]?.cao[0]).toMatchObject({
      repo: tenMoi,
      lo: 'dich-g01-l001',
      readmeEn: 'README mới',
      owner: 'cheaper-inference',
      name: 'OmniRoute',
      html_url: `https://github.com/${tenMoi}`,
    });
    expect(ketQua.cacLo[0]?.daKiem[0]).toMatchObject({
      repo: tenMoi,
      lo: 'dich-g01-l001',
      readmeVi: 'README dịch mới',
      owner: { login: 'cheaper-inference', url: 'https://api.github.com/users/cheaper-inference' },
      html_url: `https://github.com/${tenMoi}`,
    });
    expect(ketQua.danhSachThayThe).toMatchObject([
      { repo: tenCu, loGoc: 'dich-g01-l001', loVa: 'va2-g01-l001' },
    ]);
    expect(ketQua.danhSachDoiTen).toEqual(doiTen);
    expect(ketQua.danhSachLuuTru).toEqual([tenCu]);
  });

  it('báo lỗi nếu tên cũ không tồn tại hoặc tên mới trùng repo có sẵn', () => {
    const goc: LoGocHopNhat[] = [
      {
        lo: 'dich-g01-l001',
        cao: [taoCao('owner/a', 'dich-g01-l001'), taoCao('owner/b', 'dich-g01-l001')],
        daKiem: [
          taoDaKiem('owner/a', 'dich-g01-l001', 'A'),
          taoDaKiem('owner/b', 'dich-g01-l001', 'B'),
        ],
      },
    ];
    expect(() =>
      hopNhatKhoCuoi(goc, [], 2, [{ tenCu: 'owner/missing', tenMoi: 'new/repo' }]),
    ).toThrow('Không tìm thấy repo cần đổi tên');
    expect(() => hopNhatKhoCuoi(goc, [], 2, [{ tenCu: 'owner/a', tenMoi: 'owner/b' }])).toThrow(
      'Tên mới owner/b đã thuộc repo khác',
    );
  });

  it('đọc danh sách đổi tên có comment và dòng trống', () => {
    expect(docDanhSachDoiTen('# cũ → mới\n\nowner/a owner/b\n')).toEqual([
      { tenCu: 'owner/a', tenMoi: 'owner/b' },
    ]);
    expect(() => docDanhSachDoiTen('owner/a')).toThrow('phải có dạng owner/repo owner/repo');
  });
});

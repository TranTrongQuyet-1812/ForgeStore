import { describe, expect, it } from 'vitest';
import {
  canKhoiTaoNestDay,
  layBanDichCoKyHieu,
  layCapNhatLuuTru,
  taoChiTietTrangThaiDay,
  taoMapBanDichCoKyHieu,
  taoMapTrangThaiLuuTru,
} from './day.core';
import { taoDongChoDich } from './data-repo.core';
import {
  goKhungGiuNguyen,
  type DoanDichReadme,
} from '../../modules/ai/translation/tien-ich/readme-markdown-processor.util';
import type { BanGhiDaCao, DongDaKiem, DongDich } from './data-repo.types';

describe('day.core', () => {
  it('chạy thử thông thường không cần khởi tạo Nest; chế độ ghi và sửa bộ nhớ thì cần', () => {
    expect(canKhoiTaoNestDay(false, false)).toBe(false);
    expect(canKhoiTaoNestDay(true, false)).toBe(true);
    expect(canKhoiTaoNestDay(false, true)).toBe(true);
  });

  it('tạo cùng cặp trạng thái cho log thành công, lỗi và app mới', () => {
    expect(taoChiTietTrangThaiDay('KHONG_CO_BAN_CAI', 'HOAT_DONG')).toEqual({
      trangThaiTruoc: 'KHONG_CO_BAN_CAI',
      trangThaiSau: 'HOAT_DONG',
    });
    expect(taoChiTietTrangThaiDay(null, 'KHONG_CO_BAN_CAI')).toEqual({
      trangThaiTruoc: null,
      trangThaiSau: 'KHONG_CO_BAN_CAI',
    });
  });

  it('đặt true cho repo archived và false cho repo được báo đang hoạt động', () => {
    const trangThai = taoMapTrangThaiLuuTru([
      { repo: 'owner/archived', loai: 'luu_tru', archived: true },
      { repo: 'owner/active', loai: 'khong_doi', archived: false },
    ]);

    expect(layCapNhatLuuTru('OWNER/ARCHIVED', trangThai)).toEqual({ daLuuTru: true });
    expect(layCapNhatLuuTru('owner/active', trangThai)).toEqual({ daLuuTru: false });
  });

  it('không thay đổi cờ nếu không truyền báo cáo hoặc repo không có trong báo cáo', () => {
    expect(layCapNhatLuuTru('owner/repo')).toEqual({});
    expect(layCapNhatLuuTru('owner/repo', new Map())).toEqual({});
  });
});

describe('bản dịch có ký hiệu giữ chỗ cho bộ nhớ dịch chung', () => {
  const cao: BanGhiDaCao = {
    repo: 'owner/repo',
    lo: 'dich-g01-l001',
    caoLuc: '2026-10-31T00:00:00.000Z',
    sao: 1,
    moTaEn: null,
    readmeEn: '# Title\n\nSee the [guide](https://example.com/guide) for details.\n',
    readmeSha: null,
    etagRepo: null,
    etagReleases: null,
    etagReadme: null,
  };

  function taoDaKiem(viCoKyHieu: Array<string | null>): DongDaKiem {
    const doanNguon = taoDongChoDich(cao).doan;
    return {
      repo: cao.repo,
      lo: cao.lo,
      moTaEn: null,
      moTaVi: null,
      readmeSha: null,
      etagRepo: null,
      etagReleases: null,
      etagReadme: null,
      doan: doanNguon.map((doan, index) => ({
        maBam: doan.maBam,
        goc: doan.vanBanDaChe,
        dich: doan.canDich
          ? goKhungGiuNguyen(
              { ...doan, khungGiuNguyen: doan.khungGiuNguyen ?? {} } as unknown as DoanDichReadme,
              viCoKyHieu[index] ?? '',
            )
          : doan.vanBanDaChe,
      })),
      readmeVi: null,
      nguon: 'test',
    } as DongDaKiem;
  }

  function banDichMau(): Array<string | null> {
    return taoDongChoDich(cao).doan.map((doan) =>
      doan.canDich
        ? doan.vanBanDaChe.replace('See the', 'Xem').replace('for details', 'để biết thêm')
        : null,
    );
  }

  it('trả về bản dịch còn nguyên ký hiệu giữ chỗ khi tháo ra khớp bản đã kiểm', () => {
    const vi = banDichMau();
    const ketQua = layBanDichCoKyHieu(cao, taoDaKiem(vi), vi);
    const coKyHieu = [...ketQua.values()].some((giaTri) => /⟦C\d+⟧/.test(giaTri));

    expect(ketQua.size).toBeGreaterThan(0);
    expect(coKyHieu).toBe(true);
  });

  it('dừng nếu bản dịch có ký hiệu không khớp bản đã kiểm', () => {
    const vi = banDichMau();
    const daKiem = taoDaKiem(vi);
    const doanLech = daKiem.doan.findIndex((doan) => doan.dich !== doan.goc);
    daKiem.doan[doanLech]!.dich = 'một bản dịch khác hẳn';

    expect(() => layBanDichCoKyHieu(cao, daKiem, vi)).toThrow(/không khớp/);
  });

  it('dừng nếu thiếu bản dịch có ký hiệu của repo', () => {
    const vi = banDichMau();

    expect(() => layBanDichCoKyHieu(cao, taoDaKiem(vi), undefined)).toThrow(/Thiếu hoặc lệch/);
  });

  it('thêm bản dịch mang tên mới cho repo đã đổi tên', () => {
    const dong = { repo: 'old/Repo', doan: [{ vi: 'cũ' }] } as unknown as DongDich;
    const map = taoMapBanDichCoKyHieu([[dong]], [{ tenCu: 'old/repo', tenMoi: 'new/repo' }]);

    expect(map.get('new/repo')).toEqual(['cũ']);
    expect(map.get('old/repo')).toEqual(['cũ']);
  });

  it('gom bản dịch theo repo và để nguồn sau ghi đè nguồn trước', () => {
    const dong = (vi: string) => ({ repo: 'Owner/Repo', doan: [{ vi }] }) as unknown as DongDich;
    const map = taoMapBanDichCoKyHieu([[dong('cũ')], [dong('mới')]]);

    expect(map.get('owner/repo')).toEqual(['mới']);
  });
});

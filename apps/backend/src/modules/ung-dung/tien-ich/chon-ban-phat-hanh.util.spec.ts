import { describe, expect, it } from 'vitest';
import { DinhDangTep } from '@forgestore/types';
import {
  chuanHoaNenTang,
  kiemTraTepThuocNenTang,
  layBanPhatHanhMoiNhat,
  locVaSapXepBanPhatHanh,
  trichXuatDinhDangVaKienTruc,
} from './chon-ban-phat-hanh.util';

describe('ReleaseSelectorUtil (N1 + K1)', () => {
  describe('chuanHoaNenTang', () => {
    it('chuẩn hóa chính xác các biến thể của windows và android', () => {
      expect(chuanHoaNenTang('windows')).toBe('WINDOWS');
      expect(chuanHoaNenTang('WINDOWS')).toBe('WINDOWS');
      expect(chuanHoaNenTang('win')).toBe('WINDOWS');
      expect(chuanHoaNenTang('android')).toBe('ANDROID');
      expect(chuanHoaNenTang('ANDROID')).toBe('ANDROID');
      expect(chuanHoaNenTang('apk')).toBe('ANDROID');
      expect(chuanHoaNenTang('all')).toBeNull();
      expect(chuanHoaNenTang(null)).toBeNull();
      expect(chuanHoaNenTang(undefined)).toBeNull();
    });
  });

  describe('N1 Ca thực tế: BleachBit (Bản v0.1.0 đăng lại không có file cài)', () => {
    const bleachbitReleases = [
      {
        tenPhienBan: 'v0.1.0',
        ngayPhatHanh: new Date('2026-09-09T00:00:00Z'),
        laBanThuNghiem: false,
        danhSachTepCaiDat: [], // 0 file cài đặt
      },
      {
        tenPhienBan: 'v6.0.4',
        ngayPhatHanh: new Date('2026-09-08T00:00:00Z'),
        laBanThuNghiem: false,
        danhSachTepCaiDat: [
          {
            maTep: 'f1',
            tenTep: 'BleachBit-6.0.4-setup.exe',
            dinhDangTep: DinhDangTep.EXE,
          },
          {
            maTep: 'f2',
            tenTep: 'BleachBit-6.0.4-portable.zip',
            dinhDangTep: DinhDangTep.ZIP_PORTABLE,
          },
        ],
      },
      {
        tenPhienBan: 'v4.7.0',
        ngayPhatHanh: new Date('2026-06-04T00:00:00Z'),
        laBanThuNghiem: false,
        danhSachTepCaiDat: [], // 0 file cài đặt
      },
    ];

    it('phải chọn v6.0.4 làm bản mới nhất thay vì v0.1.0 (do v0.1.0 không có file cài)', () => {
      const latest = layBanPhatHanhMoiNhat(bleachbitReleases, 'windows');
      expect(latest).not.toBeNull();
      expect(latest?.tenPhienBan).toBe('v6.0.4');
      expect(latest?.danhSachTepCaiDat).toHaveLength(2);
    });

    it('loại bỏ hoàn toàn các bản không có file cài khỏi danh sách', () => {
      const sorted = locVaSapXepBanPhatHanh(bleachbitReleases, 'windows');
      expect(sorted).toHaveLength(1);
      expect(sorted[0]?.tenPhienBan).toBe('v6.0.4');
    });
  });

  describe('N1 + K1 Ca thực tế: Obsidian (Bản v1.13.8 chỉ có APK, v1.13.7 có EXE)', () => {
    const obsidianReleases = [
      {
        tenPhienBan: 'v1.13.8',
        ngayPhatHanh: new Date('2026-09-20T00:00:00Z'),
        laBanThuNghiem: false,
        danhSachTepCaiDat: [
          {
            maTep: 'apk-1',
            tenTep: 'Obsidian-1.13.8.apk',
            dinhDangTep: DinhDangTep.APK,
          },
        ],
      },
      {
        tenPhienBan: 'v1.13.7',
        ngayPhatHanh: new Date('2026-09-15T00:00:00Z'),
        laBanThuNghiem: false,
        danhSachTepCaiDat: [
          {
            maTep: 'exe-1',
            tenTep: 'Obsidian-1.13.7.exe',
            dinhDangTep: DinhDangTep.EXE,
          },
          {
            maTep: 'apk-2',
            tenTep: 'Obsidian-1.13.7.apk',
            dinhDangTep: DinhDangTep.APK,
          },
        ],
      },
    ];

    it('với platform=windows: chọn bản v1.13.7 và chỉ chứa file EXE', () => {
      const latest = layBanPhatHanhMoiNhat(obsidianReleases, 'windows');
      expect(latest).not.toBeNull();
      expect(latest?.tenPhienBan).toBe('v1.13.7');
      expect(latest?.danhSachTepCaiDat).toHaveLength(1);
      expect(latest?.danhSachTepCaiDat[0]?.dinhDangTep).toBe(DinhDangTep.EXE);
    });

    it('với platform=android: chọn bản v1.13.8 và chứa file APK', () => {
      const latest = layBanPhatHanhMoiNhat(obsidianReleases, 'android');
      expect(latest).not.toBeNull();
      expect(latest?.tenPhienBan).toBe('v1.13.8');
      expect(latest?.danhSachTepCaiDat).toHaveLength(1);
      expect(latest?.danhSachTepCaiDat[0]?.dinhDangTep).toBe(DinhDangTep.APK);
    });

    it('với platform=windows trong danhSachBanPhatHanh: loại bỏ hoàn toàn bản v1.13.8', () => {
      const list = locVaSapXepBanPhatHanh(obsidianReleases, 'windows', {
        chiGiuTepTheoNenTang: true,
      });
      expect(list).toHaveLength(1);
      expect(list[0]?.tenPhienBan).toBe('v1.13.7');
      expect(list[0]?.danhSachTepCaiDat).toHaveLength(1);
      expect(list[0]?.danhSachTepCaiDat[0]?.dinhDangTep).toBe(DinhDangTep.EXE);
    });
  });

  describe('SemVer vs Prerelease', () => {
    it('ưu tiên bản phát hành chính thức hơn bản beta dù beta số phiên bản cao hơn', () => {
      const releases = [
        {
          tenPhienBan: 'v2.0.0-beta.1',
          ngayPhatHanh: new Date('2026-09-25T00:00:00Z'),
          laBanThuNghiem: true,
          danhSachTepCaiDat: [{ dinhDangTep: DinhDangTep.EXE }],
        },
        {
          tenPhienBan: 'v1.9.0',
          ngayPhatHanh: new Date('2026-09-20T00:00:00Z'),
          laBanThuNghiem: false,
          danhSachTepCaiDat: [{ dinhDangTep: DinhDangTep.EXE }],
        },
      ];

      const latest = layBanPhatHanhMoiNhat(releases, 'windows');
      expect(latest?.tenPhienBan).toBe('v1.9.0');
    });

    it('nếu chỉ toàn bản thử nghiệm thì vẫn chọn bản thử nghiệm mới nhất', () => {
      const releases = [
        {
          tenPhienBan: 'v2.0.0-beta.2',
          ngayPhatHanh: new Date('2026-09-25T00:00:00Z'),
          laBanThuNghiem: true,
          danhSachTepCaiDat: [{ dinhDangTep: DinhDangTep.EXE }],
        },
        {
          tenPhienBan: 'v2.0.0-beta.1',
          ngayPhatHanh: new Date('2026-09-20T00:00:00Z'),
          laBanThuNghiem: true,
          danhSachTepCaiDat: [{ dinhDangTep: DinhDangTep.EXE }],
        },
      ];

      const latest = layBanPhatHanhMoiNhat(releases, 'windows');
      expect(latest?.tenPhienBan).toBe('v2.0.0-beta.2');
    });
  });

  describe('L-03 Ca thực tế: Trích xuất định dạng và kiến trúc tệp thật', () => {
    it('DBeaver 24.3.0: chỉ có EXE và ZIP (không có MSI), kiến trúc x64', () => {
      const dbeaverAssets = [
        {
          tenTep: 'dbeaver-ce-24.3.0-x86_64-setup.exe',
          dinhDangTep: DinhDangTep.EXE,
          kienTrucChip: 'X86_64',
        },
        {
          tenTep: 'dbeaver-ce-24.3.0-win32.win32.x86_64.zip',
          dinhDangTep: DinhDangTep.ZIP_PORTABLE,
          kienTrucChip: 'X86_64',
        },
      ];

      const { dinhDangCoSan, kienTrucCoSan } = trichXuatDinhDangVaKienTruc(dbeaverAssets);
      expect(dinhDangCoSan).toEqual(['EXE', 'ZIP']);
      expect(dinhDangCoSan).not.toContain('MSI');
      expect(kienTrucCoSan).toEqual(['x64']);
    });

    it('PowerToys v0.89.0: chỉ có EXE, hỗ trợ cả x64 và ARM64', () => {
      const powerToysAssets = [
        {
          tenTep: 'PowerToysUserSetup-0.89.0-x64.exe',
          dinhDangTep: DinhDangTep.EXE,
          kienTrucChip: 'X86_64',
        },
        {
          tenTep: 'PowerToysUserSetup-0.89.0-arm64.exe',
          dinhDangTep: DinhDangTep.EXE,
          kienTrucChip: 'ARM64_V8A',
        },
      ];

      const { dinhDangCoSan, kienTrucCoSan } = trichXuatDinhDangVaKienTruc(powerToysAssets);
      expect(dinhDangCoSan).toEqual(['EXE']);
      expect(kienTrucCoSan).toEqual(['x64', 'ARM64']);
    });

    it('Cryptomator 1.14.2: có EXE và MSI, chỉ có x64 (không có ARM64)', () => {
      const cryptomatorAssets = [
        {
          tenTep: 'Cryptomator-1.14.2-x64.exe',
          dinhDangTep: DinhDangTep.EXE,
          kienTrucChip: 'X86_64',
        },
        {
          tenTep: 'Cryptomator-1.14.2-x64.msi',
          dinhDangTep: DinhDangTep.MSI,
          kienTrucChip: 'X86_64',
        },
      ];

      const { dinhDangCoSan, kienTrucCoSan } = trichXuatDinhDangVaKienTruc(cryptomatorAssets);
      expect(dinhDangCoSan).toEqual(['EXE', 'MSI']);
      expect(kienTrucCoSan).toEqual(['x64']);
      expect(kienTrucCoSan).not.toContain('ARM64');
    });

    it('Mảng tệp rỗng hoặc undefined: trả về mảng rỗng không bị lỗi', () => {
      expect(trichXuatDinhDangVaKienTruc([])).toEqual({ dinhDangCoSan: [], kienTrucCoSan: [] });
      expect(trichXuatDinhDangVaKienTruc(undefined)).toEqual({
        dinhDangCoSan: [],
        kienTrucCoSan: [],
      });
    });
  });
});

describe('P2-60.3: bổ sung độ phủ cho bộ chọn bản phát hành', () => {
  describe('kiemTraTepThuocNenTang', () => {
    it('không chỉ định nền tảng thì tệp nào cũng hợp lệ', () => {
      expect(kiemTraTepThuocNenTang(DinhDangTep.KHAC, null)).toBe(true);
    });

    it('WINDOWS nhận EXE, MSI, ZIP portable; không nhận APK', () => {
      expect(kiemTraTepThuocNenTang(DinhDangTep.EXE, 'WINDOWS')).toBe(true);
      expect(kiemTraTepThuocNenTang(DinhDangTep.MSI, 'WINDOWS')).toBe(true);
      expect(kiemTraTepThuocNenTang(DinhDangTep.ZIP_PORTABLE, 'WINDOWS')).toBe(true);
      expect(kiemTraTepThuocNenTang(DinhDangTep.APK, 'WINDOWS')).toBe(false);
    });

    it('ANDROID chỉ nhận APK', () => {
      expect(kiemTraTepThuocNenTang(DinhDangTep.APK, 'ANDROID')).toBe(true);
      expect(kiemTraTepThuocNenTang(DinhDangTep.EXE, 'ANDROID')).toBe(false);
    });

    it('giá trị nền tảng ngoài dự kiến thì không chặn (nhánh phòng vệ)', () => {
      expect(kiemTraTepThuocNenTang(DinhDangTep.EXE, 'LINUX' as never)).toBe(true);
    });
  });

  describe('locVaSapXepBanPhatHanh: các nhánh biên', () => {
    const ban = (tenPhienBan: string, ngay: string, tep: DinhDangTep[], thuNghiem = false) => ({
      tenPhienBan,
      ngayPhatHanh: new Date(ngay),
      laBanThuNghiem: thuNghiem,
      danhSachTepCaiDat: tep.map((dinhDangTep, i) => ({ maTep: `t${i}`, dinhDangTep })),
    });

    it('danh sách rỗng hoặc không có thì trả mảng rỗng', () => {
      expect(locVaSapXepBanPhatHanh([], 'windows')).toEqual([]);
      expect(locVaSapXepBanPhatHanh(undefined as never, 'windows')).toEqual([]);
    });

    it('bản không khai báo danhSachTepCaiDat thì giữ lại (chưa nạp tệp)', () => {
      const chuaNapTep = { tenPhienBan: 'v1.0.0', ngayPhatHanh: new Date('2026-01-01') };
      const kq = locVaSapXepBanPhatHanh([chuaNapTep as never], 'windows');
      expect(kq).toHaveLength(1);
    });

    it('không chỉ định nền tảng thì chấp nhận cả tệp Windows và Android, loại tệp KHAC', () => {
      const kq = locVaSapXepBanPhatHanh(
        [
          ban('v2.0.0', '2026-03-01', [DinhDangTep.KHAC]),
          ban('v1.0.0', '2026-02-01', [DinhDangTep.APK]),
          ban('v1.1.0', '2026-02-15', [DinhDangTep.EXE]),
        ],
        undefined,
      );
      expect(kq.map((r) => r.tenPhienBan)).toEqual(['v1.1.0', 'v1.0.0']);
    });

    it('toàn bộ bản đều không có tệp thì mặc định xếp theo SemVer thay vì trả rỗng', () => {
      const kq = locVaSapXepBanPhatHanh(
        [ban('v1.0.0', '2026-01-01', []), ban('v2.0.0', '2026-02-01', [])],
        'windows',
      );
      expect(kq.map((r) => r.tenPhienBan)).toEqual(['v2.0.0', 'v1.0.0']);
    });

    it('tắt fallback thì toàn bộ bản không tệp trả rỗng', () => {
      const kq = locVaSapXepBanPhatHanh([ban('v1.0.0', '2026-01-01', [])], 'windows', {
        fallbackSemVerKhiKhongCoTep: false,
      });
      expect(kq).toEqual([]);
    });

    it('có tệp nhưng sai nền tảng (chỉ APK khi xem Windows) thì trả rỗng, không fallback', () => {
      const kq = locVaSapXepBanPhatHanh(
        [ban('v1.0.0', '2026-01-01', [DinhDangTep.APK])],
        'windows',
      );
      expect(kq).toEqual([]);
    });

    it('cùng số phiên bản thì bản đăng sau đứng trước', () => {
      const kq = locVaSapXepBanPhatHanh(
        [
          ban('v1.0.0', '2026-01-01', [DinhDangTep.EXE]),
          ban('v1.0.0', '2026-03-01', [DinhDangTep.EXE]),
        ],
        'windows',
      );
      expect(kq.map((r) => r.ngayPhatHanh.toISOString().slice(0, 10))).toEqual([
        '2026-03-01',
        '2026-01-01',
      ]);
    });
  });

  describe('trichXuatDinhDangVaKienTruc: các định dạng và kiến trúc còn lại', () => {
    it('nhận APK và các kiến trúc x86, Universal, ARM64', () => {
      const kq = trichXuatDinhDangVaKienTruc([
        { dinhDangTep: 'APK', kienTrucChip: 'ARM64_V8A' },
        { dinhDangTep: 'APK', kienTrucChip: 'DUNG_CHUNG' },
        { dinhDangTep: 'EXE', kienTrucChip: 'X86' },
        { dinhDangTep: 'MSI', kienTrucChip: 'UNIVERSAL' },
      ]);
      expect(kq.dinhDangCoSan).toEqual(['EXE', 'MSI', 'APK']);
      expect(kq.kienTrucCoSan).toEqual(['ARM64', 'x86', 'Universal']);
    });

    it('danh sách rỗng hoặc không có thì trả hai mảng rỗng', () => {
      expect(trichXuatDinhDangVaKienTruc(undefined)).toEqual({
        dinhDangCoSan: [],
        kienTrucCoSan: [],
      });
      expect(trichXuatDinhDangVaKienTruc([])).toEqual({ dinhDangCoSan: [], kienTrucCoSan: [] });
    });
  });
});

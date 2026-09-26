import { describe, expect, it } from 'vitest';
import { DinhDangTep } from '@forgestore/types';
import {
  chuanHoaNenTang,
  layBanPhatHanhMoiNhat,
  locVaSapXepBanPhatHanh,
} from './release-selector.util';

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
});

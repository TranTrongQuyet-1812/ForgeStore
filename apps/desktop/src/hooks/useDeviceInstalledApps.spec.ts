import { describe, it, expect } from 'vitest';
import { kiemTraAppDaCaiHelper, layTrangThaiCaiDatHelper } from './useDeviceInstalledApps';
import type { UngDungDaCaiDto } from '@forgestore/types';
import type { ThongTinCaiDatApp } from '../stores/useInstallStore';

describe('useDeviceInstalledApps (L-02: Đồng bộ trạng thái đã cài đặt trên thiết bị)', () => {
  // Dữ liệu thật từ báo cáo test tay máy Windows 11 (TRANQUYET)
  const mockBackendInstalledList: UngDungDaCaiDto[] = [
    {
      maBanGhi: 'record-npp-01',
      maNguoiDung: 'user-uuid-1812',
      maUngDung: 'npp-uuid-001',
      maThietBi: 'device-tranquyet-01',
      phienBanHienTai: '8.9.8.1',
      maTepDaCai: 'file-npp-installer-x64',
      duongDanThuMuc: null,
      khoaRegistry: 'Notepad++',
      tenHienThiRegistry: 'Notepad++ (64-bit x64)',
      ngayCaiDat: '2026-09-26T23:22:30.000Z',
      ngayCapNhatCuoi: '2026-09-26T23:22:30.000Z',
      ungDung: {
        tenKhoChua: 'notepad-plus-plus',
        tenRepoDayDu: 'notepad-plus-plus/notepad-plus-plus',
        duongDanIcon: 'https://github.com/notepad-plus-plus.png',
      },
    },
    {
      maBanGhi: 'record-dbeaver-02',
      maNguoiDung: 'user-uuid-1812',
      maUngDung: 'dbeaver-uuid-002',
      maThietBi: 'device-tranquyet-01',
      phienBanHienTai: '24.3.0',
      khoaRegistry: 'DBeaver',
      tenHienThiRegistry: 'DBeaver 24.3.0',
      ngayCaiDat: '2026-09-26T22:00:00.000Z',
      ngayCapNhatCuoi: '2026-09-26T22:00:00.000Z',
      ungDung: {
        tenKhoChua: 'dbeaver',
        tenRepoDayDu: 'dbeaver/dbeaver',
      },
    },
  ] as unknown as UngDungDaCaiDto[];

  it('Notepad++ đã cài: nhận diện đúng theo ID, tên kho chứa slug và repo handle', () => {
    // Tìm theo UUID
    expect(
      kiemTraAppDaCaiHelper({
        installedList: mockBackendInstalledList,
        caiDatMap: {},
        appIdOrKey: 'npp-uuid-001',
        isAuthenticated: true,
      }),
    ).toBe(true);

    // Tìm theo slug kho chứa
    expect(
      kiemTraAppDaCaiHelper({
        installedList: mockBackendInstalledList,
        caiDatMap: {},
        appIdOrKey: 'notepad-plus-plus',
        isAuthenticated: true,
      }),
    ).toBe(true);

    // Tìm theo repo handle
    expect(
      kiemTraAppDaCaiHelper({
        installedList: mockBackendInstalledList,
        caiDatMap: {},
        appIdOrKey: 'notepad-plus-plus/notepad-plus-plus',
        isAuthenticated: true,
      }),
    ).toBe(true);

    const trangThai = layTrangThaiCaiDatHelper({
      installedList: mockBackendInstalledList,
      caiDatMap: {},
      appIdOrKey: 'notepad-plus-plus',
      repoHandle: 'notepad-plus-plus/notepad-plus-plus',
      isAuthenticated: true,
    });

    expect(trangThai.trangThai).toBe('DA_CAI_DAT');
    expect(trangThai.label).toBe('✓ Đã cài');
  });

  it('Flameshot sau khi gỡ cài đặt: trả về trạng thái CHUA_CAI và nhãn "Cài đặt"', () => {
    // Flameshot không có trong mockBackendInstalledList
    const trangThai = layTrangThaiCaiDatHelper({
      installedList: mockBackendInstalledList,
      caiDatMap: {},
      appIdOrKey: 'flameshot',
      repoHandle: 'flameshot-org/flameshot',
      isAuthenticated: true,
    });

    expect(trangThai.trangThai).toBe('CHUA_CAI');
    expect(trangThai.label).toBe('Cài đặt');
  });

  it('PowerToys đang tải trong RAM: ưu tiên hiển thị tiến trình %', () => {
    const mockCaiDatMap = {
      powertoys: {
        maUngDung: 'powertoys',
        trangThai: 'DANG_TAI' as const,
        phanTram: 45,
        tocDoBps: 2_500_000,
        daTaiBytes: 45_000_000,
        tongBytes: 100_000_000,
      },
    } as unknown as Record<string, ThongTinCaiDatApp>;

    const trangThai = layTrangThaiCaiDatHelper({
      installedList: mockBackendInstalledList,
      caiDatMap: mockCaiDatMap,
      appIdOrKey: 'powertoys',
      repoHandle: 'microsoft/PowerToys',
      isAuthenticated: true,
    });

    expect(trangThai.trangThai).toBe('DANG_TAI');
    expect(trangThai.label).toBe('Đang tải 45%');
    expect(trangThai.phanTram).toBe(45);
  });

  it('Ứng dụng đang xác minh hoặc cài đặt trong RAM: hiển thị nhãn tiến trình tương ứng', () => {
    const mockCaiDatMap = {
      'rustdesk-uuid': {
        maUngDung: 'rustdesk-uuid',
        trangThai: 'DANG_CAI_DAT' as const,
        phanTram: 100,
        tocDoBps: 0,
        daTaiBytes: 18_000_000,
        tongBytes: 18_000_000,
      },
    } as unknown as Record<string, ThongTinCaiDatApp>;

    const trangThai = layTrangThaiCaiDatHelper({
      installedList: mockBackendInstalledList,
      caiDatMap: mockCaiDatMap,
      appIdOrKey: 'rustdesk-uuid',
      isAuthenticated: true,
    });

    expect(trangThai.trangThai).toBe('DANG_CAI_DAT');
    expect(trangThai.label).toBe('Đang cài đặt...');
  });

  it('Chưa đăng nhập: không tra cứu backend list nhưng vẫn tôn trọng RAM cục bộ', () => {
    // 1. Chưa đăng nhập và không có trong RAM -> Cài đặt
    const trangThaiChuaCai = layTrangThaiCaiDatHelper({
      installedList: mockBackendInstalledList, // Dù có list nhưng isAuthenticated = false
      caiDatMap: {},
      appIdOrKey: 'notepad-plus-plus',
      isAuthenticated: false,
    });
    expect(trangThaiChuaCai.trangThai).toBe('CHUA_CAI');
    expect(trangThaiChuaCai.label).toBe('Cài đặt');

    // 2. Chưa đăng nhập nhưng vừa cài xong trong RAM -> ✓ Đã cài
    const trangThaiVuaCai = layTrangThaiCaiDatHelper({
      installedList: [],
      caiDatMap: {
        'notepad-plus-plus': {
          maUngDung: 'notepad-plus-plus',
          trangThai: 'DA_CAI_DAT',
          phanTram: 100,
          tocDoBps: 0,
          daTaiBytes: 10_000_000,
          tongBytes: 10_000_000,
        },
      } as unknown as Record<string, ThongTinCaiDatApp>,
      appIdOrKey: 'notepad-plus-plus',
      isAuthenticated: false,
    });
    expect(trangThaiVuaCai.trangThai).toBe('DA_CAI_DAT');
    expect(trangThaiVuaCai.label).toBe('✓ Đã cài');
  });
});

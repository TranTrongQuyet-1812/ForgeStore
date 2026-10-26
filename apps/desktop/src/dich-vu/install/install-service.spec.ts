import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstallStore } from '../../kho-trang-thai/useInstallStore';
import { installService } from './install-service';
import type { ThamSoCaiDat, TienDoTaiFrontend } from './install-types';

describe('InstallService & useInstallStore (P3-08..P3-11)', () => {
  beforeEach(() => {
    // Reset zustand store before each test
    useInstallStore.setState({ caiDatMap: {} });
  });

  describe('InstallService Web Dev Flow', () => {
    it('thực thi trọn vẹn luồng tải giả lập với đầy đủ các trạng thái', async () => {
      const params: ThamSoCaiDat = {
        maUngDung: 'app-test-123',
        tenApp: 'Obsidian',
        url: 'https://github.com/obsidianmd/obsidian-releases/releases/download/v1.7.7/Obsidian-1.7.7.exe',
        tenTep: 'Obsidian-1.7.7.exe',
        loaiTep: 'EXE',
        sha256DuKien: 'a'.repeat(64),
      };

      const capturedStates: string[] = [];
      const onProgress = (tienDo: TienDoTaiFrontend) => {
        capturedStates.push(tienDo.trangThai);
      };

      const res = await installService.batDauTaiVaCaiDat(params, onProgress);

      expect(res.thanh_cong).toBe(true);
      expect(res.loai_cai_dat).toBe('EXE');
      expect(res.duong_dan_thuc_thi).toBeDefined();

      // Kiểm tra đầy đủ 4 trạng thái nối tiếp nhau
      expect(capturedStates).toContain('DANG_TAI');
      expect(capturedStates).toContain('XAC_MINH');
      expect(capturedStates).toContain('DANG_CAI_DAT');
      expect(capturedStates).toContain('DA_CAI_DAT');
    });

    it('hủy tải thành công và trả về true', async () => {
      const res = await installService.huyTai('app-cancel-123');
      expect(res).toBe(true);
    });
  });

  describe('useInstallStore State Management', () => {
    it('quản lý trạng thái cài đặt thành công trên Store', async () => {
      const params: ThamSoCaiDat = {
        maUngDung: 'rustdesk-id',
        tenApp: 'RustDesk',
        url: 'https://github.com/rustdesk/rustdesk/releases/download/1.3.0/rustdesk-1.3.0-x86_64.exe',
        tenTep: 'rustdesk-1.3.0-x86_64.exe',
        loaiTep: 'EXE',
      };

      const promise = useInstallStore.getState().batDauCaiDat(params);

      // Ngay sau khi gọi, trạng thái phải là DANG_TAI
      const initialInfo = useInstallStore.getState().layThongTinApp('rustdesk-id');
      expect(initialInfo).toBeDefined();
      expect(initialInfo?.trangThai).toBe('DANG_TAI');

      const success = await promise;
      expect(success).toBe(true);

      const finalInfo = useInstallStore.getState().layThongTinApp('rustdesk-id');
      expect(finalInfo?.trangThai).toBe('DA_CAI_DAT');
      expect(finalInfo?.phanTram).toBe(100);
      expect(finalInfo?.duongDanThucThi).toContain('RustDesk.exe');
    });

    it('xử lý trạng thái khi người dùng nhấn hủy tải', async () => {
      useInstallStore.getState().capNhatTrangThai('app-to-cancel', {
        tenApp: 'Test App',
        trangThai: 'DANG_TAI',
        phanTram: 45,
      });

      await useInstallStore.getState().huyCaiDat('app-to-cancel');

      const info = useInstallStore.getState().layThongTinApp('app-to-cancel');
      expect(info?.trangThai).toBe('DA_HUY');
      expect(info?.phanTram).toBe(0);
    });

    it('xử lý ghi nhận lỗi khi tải thất bại', async () => {
      vi.spyOn(installService, 'batDauTaiVaCaiDat').mockRejectedValueOnce(
        new Error('LỖI_XAC_MINH_SHA256: Mã băm không khớp'),
      );

      const params: ThamSoCaiDat = {
        maUngDung: 'bad-sha-app',
        tenApp: 'BadApp',
        url: 'https://example.com/bad.exe',
        tenTep: 'bad.exe',
        loaiTep: 'EXE',
      };

      const success = await useInstallStore.getState().batDauCaiDat(params);
      expect(success).toBe(false);

      const info = useInstallStore.getState().layThongTinApp('bad-sha-app');
      expect(info?.trangThai).toBe('LOI');
      expect(info?.thongDiepLoi).toContain('LỖI_XAC_MINH_SHA256');
    });

    it('khôi phục từ storage và tự động reset các tác vụ DANG_TAI/XAC_MINH về DA_HUY mà không bị lỗi TDZ', async () => {
      const storageMap = new Map<string, string>();
      const mockLocalStorage = {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storageMap.set(k, v);
        },
        removeItem: (k: string) => {
          storageMap.delete(k);
        },
        clear: () => {
          storageMap.clear();
        },
      };

      const originalWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: mockLocalStorage,
      };

      const mockStorageData = {
        state: {
          caiDatMap: {
            'stuck-download-app': {
              maUngDung: 'stuck-download-app',
              tenApp: 'Stuck App',
              trangThai: 'DANG_TAI',
              phanTram: 42,
              tocDoBps: 1024000,
              daTaiBytes: 42000000,
              tongBytes: 100000000,
              thoiGianCapNhat: Date.now(),
            },
            'already-installed-app': {
              maUngDung: 'already-installed-app',
              tenApp: 'Installed App',
              trangThai: 'DA_CAI_DAT',
              phanTram: 100,
              duongDanThuMuc: 'D:\\Apps\\Portable',
              thoiGianCapNhat: Date.now(),
            },
          },
        },
        version: 0,
      };

      try {
        mockLocalStorage.setItem('forgestore_install_tasks', JSON.stringify(mockStorageData));

        await useInstallStore.persist.rehydrate();

        expect(useInstallStore.persist.hasHydrated()).toBe(true);
        const stuckApp = useInstallStore.getState().layThongTinApp('stuck-download-app');
        expect(stuckApp).toBeDefined();
        expect(stuckApp?.trangThai).toBe('DA_HUY');
        expect(stuckApp?.phanTram).toBe(0);
        expect(stuckApp?.tocDoBps).toBe(0);
        expect(stuckApp?.thongDiepLoi).toContain(
          'Tiến trình tải bị gián đoạn do ứng dụng đã đóng.',
        );

        // Đảm bảo app đã cài đặt vẫn giữ nguyên trạng thái và đường dẫn thư mục
        const installedApp = useInstallStore.getState().layThongTinApp('already-installed-app');
        expect(installedApp).toBeDefined();
        expect(installedApp?.trangThai).toBe('DA_CAI_DAT');
        expect(installedApp?.duongDanThuMuc).toBe('D:\\Apps\\Portable');
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as unknown as { window?: unknown }).window;
        } else {
          (globalThis as unknown as { window: unknown }).window = originalWindow;
        }
      }
    });
  });

  describe('Registry & Native Uninstaller (A4)', () => {
    it('kiemTraAppRegistry trả về null trong môi trường Web dev', async () => {
      const res = await installService.kiemTraAppRegistry('Notepad++');
      expect(res).toBeNull();
    });

    it('goCaiDatQuaRegistry trả về true trong môi trường Web dev fallback', async () => {
      const res = await installService.goCaiDatQuaRegistry(
        '"C:\\Program Files\\App\\uninstall.exe"',
      );
      expect(res).toBe(true);
    });
  });

  describe('Safe Folder Opener (A1, TC-09, SEC-02)', () => {
    it('moThuMuc chạy fallback an toàn trong môi trường Web dev', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      await installService.moThuMuc('D:\\ForgeStore_Apps\\Notepad++');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[WebDev Preview] Giả lập mở thư mục tại: D:\\ForgeStore_Apps\\Notepad++',
        ),
      );
      consoleSpy.mockRestore();
    });

    it('moThuMuc gọi native mo_thu_muc trong môi trường Tauri', async () => {
      vi.spyOn(
        installService as unknown as { isTauriEnv: () => boolean },
        'isTauriEnv',
      ).mockReturnValue(true);
      const mockInvoke = vi.fn().mockResolvedValue(undefined);
      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke,
      }));

      await installService.moThuMuc('D:\\ForgeStore_Apps\\PortableApp');
      expect(mockInvoke).toHaveBeenCalledWith('mo_thu_muc', {
        duongDan: 'D:\\ForgeStore_Apps\\PortableApp',
      });

      vi.doUnmock('@tauri-apps/api/core');
      vi.restoreAllMocks();
    });

    it('moThuMuc fallback sang revealItemInDir nếu mo_thu_muc native lỗi', async () => {
      vi.spyOn(
        installService as unknown as { isTauriEnv: () => boolean },
        'isTauriEnv',
      ).mockReturnValue(true);
      const mockInvoke = vi.fn().mockRejectedValue(new Error('Lỗi invoke'));
      const mockReveal = vi.fn().mockResolvedValue(undefined);

      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke,
      }));
      vi.doMock('@tauri-apps/plugin-opener', () => ({
        revealItemInDir: mockReveal,
      }));

      await installService.moThuMuc('D:\\ForgeStore_Apps\\FallbackDir');
      expect(mockInvoke).toHaveBeenCalled();
      expect(mockReveal).toHaveBeenCalledWith('D:\\ForgeStore_Apps\\FallbackDir');

      vi.doUnmock('@tauri-apps/api/core');
      vi.doUnmock('@tauri-apps/plugin-opener');
      vi.restoreAllMocks();
    });

    it('moThuMuc bỏ qua an toàn và không gọi native khi đường dẫn rỗng', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await installService.moThuMuc('');
      await installService.moThuMuc('   ');
      await installService.moThuMuc(null);
      await installService.moThuMuc(undefined);
      expect(warnSpy).toHaveBeenCalledTimes(4);
      warnSpy.mockRestore();
    });

    it('moUngDung bỏ qua an toàn và không gọi native khi đường dẫn rỗng', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await installService.moUngDung('');
      await installService.moUngDung('   ');
      await installService.moUngDung(null);
      await installService.moUngDung(undefined);
      expect(warnSpy).toHaveBeenCalledTimes(4);
      warnSpy.mockRestore();
    });

    it('moUngDungTuRegistry bỏ qua an toàn và trả về false khi khoaRegistry rỗng', async () => {
      const resEmpty = await installService.moUngDungTuRegistry('');
      const resBlank = await installService.moUngDungTuRegistry('   ');
      expect(resEmpty).toBe(false);
      expect(resBlank).toBe(false);
    });

    it('moUngDungTuRegistry gọi command native mo_ung_dung_tu_registry trong môi trường Tauri', async () => {
      vi.spyOn(
        installService as unknown as { isTauriEnv: () => boolean },
        'isTauriEnv',
      ).mockReturnValue(true);
      const mockInvoke = vi.fn().mockResolvedValue(undefined);

      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke,
      }));

      const res = await installService.moUngDungTuRegistry('Notepad++', 'Notepad++');
      expect(res).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('mo_ung_dung_tu_registry', {
        khoaRegistry: 'Notepad++',
        tenApp: 'Notepad++',
      });

      vi.doUnmock('@tauri-apps/api/core');
      vi.restoreAllMocks();
    });
  });
});

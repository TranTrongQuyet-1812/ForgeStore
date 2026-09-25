import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstallStore } from '../../stores/useInstallStore';
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
  });
});

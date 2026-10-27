import { describe, expect, it, vi, beforeEach } from 'vitest';
import { capNhatService } from './cap-nhat.service';
import { useCapNhatStore } from '../../kho-trang-thai/useCapNhatStore';
import { apiClient } from '../api/api-client';
import type { CheckUpdatesResponseDto } from '@forgestore/types';

const mockDeviceId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

describe('CapNhatService & useCapNhatStore (P3-12.3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCapNhatStore.setState({
      soLuongBanCapNhat: 0,
      danhSachCapNhat: [],
      danhSachBoQuaVersion: {},
      dangKiemTra: false,
      thoiGianKiemTraCuoi: null,
    });
  });

  describe('capNhatService', () => {
    it('gửi danh sách ứng dụng đã cài đặt và nhận về thông tin các bản cập nhật', async () => {
      const mockResponse: CheckUpdatesResponseDto = {
        danhSachCapNhat: [
          {
            maUngDung: 'app-obsidian',
            phienBanHienTai: '1.5.8',
            phienBanMoiNhat: '1.5.12',
            coBanCapNhat: true,
            tomTatNangCapVi: 'Sửa lỗi và nâng cấp hiệu năng',
          },
          {
            maUngDung: 'app-rustdesk',
            phienBanHienTai: '1.3.1',
            phienBanMoiNhat: '1.3.1',
            coBanCapNhat: false,
          },
        ],
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResponse as never);

      const res = await capNhatService.kiemTraCapNhat(mockDeviceId, [
        { maUngDung: 'app-obsidian', phienBanHienTai: '1.5.8' },
        { maUngDung: 'app-rustdesk', phienBanHienTai: '1.3.1' },
      ]);

      expect(postSpy).toHaveBeenCalledWith('/ung-dung/kiem-tra-cap-nhat', {
        maThietBi: mockDeviceId,
        danhSachCaiDat: [
          { maUngDung: 'app-obsidian', phienBanHienTai: '1.5.8' },
          { maUngDung: 'app-rustdesk', phienBanHienTai: '1.3.1' },
        ],
        ungDung: [
          { maUngDung: 'app-obsidian', phienBan: '1.5.8' },
          { maUngDung: 'app-rustdesk', phienBan: '1.3.1' },
        ],
      });
      expect(res.danhSachCapNhat).toHaveLength(2);
      expect(res.danhSachCapNhat[0].coBanCapNhat).toBe(true);
    });

    it('truyền lỗi lên store khi kiểm tra cập nhật thất bại', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network offline'));

      await expect(capNhatService.kiemTraCapNhat(mockDeviceId, [])).rejects.toThrow(
        'Network offline',
      );
    });
  });

  describe('useCapNhatStore', () => {
    it('đếm bản cập nhật đủ điều kiện và cập nhật số lượng badge', async () => {
      const mockResponse: CheckUpdatesResponseDto = {
        danhSachCapNhat: [
          {
            maUngDung: 'app-1',
            phienBanHienTai: '1.0.0',
            phienBanMoiNhat: '1.1.0',
            coBanCapNhat: true,
          },
          {
            maUngDung: 'app-2',
            phienBanHienTai: '2.0.0',
            phienBanMoiNhat: '2.0.0',
            coBanCapNhat: false,
          },
          {
            maUngDung: 'app-3',
            phienBanHienTai: '0.9.0',
            phienBanMoiNhat: '1.0.0',
            coBanCapNhat: true,
          },
        ],
      };

      vi.spyOn(capNhatService, 'kiemTraCapNhat').mockResolvedValueOnce(mockResponse);

      const count = await useCapNhatStore.getState().kiemTraCapNhat(mockDeviceId, []);

      expect(count).toBe(2);
      expect(useCapNhatStore.getState().soLuongBanCapNhat).toBe(2);
      expect(useCapNhatStore.getState().danhSachCapNhat).toHaveLength(2);
      expect(useCapNhatStore.getState().dangKiemTra).toBe(false);
      expect(useCapNhatStore.getState().thoiGianKiemTraCuoi).not.toBeNull();
    });

    it('phân biệt kiểm tra thành công nhưng không có bản cập nhật', async () => {
      vi.spyOn(capNhatService, 'kiemTraCapNhat').mockResolvedValueOnce({ danhSachCapNhat: [] });

      const count = await useCapNhatStore.getState().kiemTraCapNhat(mockDeviceId, []);

      expect(count).toBe(0);
      expect(useCapNhatStore.getState().soLuongBanCapNhat).toBe(0);
      expect(useCapNhatStore.getState().dangKiemTra).toBe(false);
    });

    it('xử lý an toàn khi capNhatService gặp exception', async () => {
      vi.spyOn(capNhatService, 'kiemTraCapNhat').mockRejectedValueOnce(new Error('Crash'));

      const count = await useCapNhatStore.getState().kiemTraCapNhat(mockDeviceId, []);

      expect(count).toBeNull();
      expect(useCapNhatStore.getState().soLuongBanCapNhat).toBe(0);
      expect(useCapNhatStore.getState().dangKiemTra).toBe(false);
    });

    it('loại bản cập nhật có phiên bản đã được chọn bỏ qua', async () => {
      const response: CheckUpdatesResponseDto = {
        danhSachCapNhat: [
          {
            maUngDung: 'app-ignored',
            phienBanHienTai: '1.0.0',
            phienBanMoiNhat: '1.1.0',
            coBanCapNhat: true,
          },
          {
            maUngDung: 'app-update',
            phienBanHienTai: '2.0.0',
            phienBanMoiNhat: '2.1.0',
            coBanCapNhat: true,
          },
        ],
      };
      useCapNhatStore.setState({ danhSachBoQuaVersion: { 'app-ignored': '1.1.0' } });
      vi.spyOn(capNhatService, 'kiemTraCapNhat').mockResolvedValueOnce(response);

      const count = await useCapNhatStore.getState().kiemTraCapNhat(mockDeviceId, []);

      expect(count).toBe(1);
      expect(useCapNhatStore.getState().danhSachCapNhat.map((item) => item.maUngDung)).toEqual([
        'app-update',
      ]);
    });

    it('trả về null nếu deviceId không phải UUID hợp lệ', async () => {
      const spy = vi.spyOn(capNhatService, 'kiemTraCapNhat');

      const count = await useCapNhatStore.getState().kiemTraCapNhat('invalid-device-id', []);

      expect(count).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      expect(useCapNhatStore.getState().dangKiemTra).toBe(false);
    });
  });
});

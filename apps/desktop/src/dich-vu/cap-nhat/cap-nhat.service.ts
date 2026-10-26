import { apiClient } from '../api/api-client';
import type { CheckUpdatesRequest, CheckUpdatesResponseDto } from '@forgestore/types';

export const capNhatService = {
  /**
   * Kiểm tra các bản cập nhật cho các ứng dụng đã cài trên máy (P3-12.3, B2, BE-02)
   */
  async kiemTraCapNhat(
    deviceId: string,
    danhSachCaiDat: Array<{ maUngDung: string; phienBanHienTai: string }> = [],
  ): Promise<CheckUpdatesResponseDto> {
    try {
      const payload: CheckUpdatesRequest = {
        maThietBi: deviceId,
      };

      if (danhSachCaiDat && danhSachCaiDat.length > 0) {
        payload.danhSachCaiDat = danhSachCaiDat.map((item) => ({
          maUngDung: item.maUngDung,
          phienBanHienTai: item.phienBanHienTai,
        }));
        payload.ungDung = danhSachCaiDat.map((item) => ({
          maUngDung: item.maUngDung,
          phienBan: item.phienBanHienTai,
        }));
      }

      return await apiClient.post<CheckUpdatesResponseDto>('/ung-dung/kiem-tra-cap-nhat', payload);
    } catch (err) {
      console.warn('[UpdaterService] Không thể kiểm tra cập nhật:', err);
      return { danhSachCapNhat: [] };
    }
  },
};

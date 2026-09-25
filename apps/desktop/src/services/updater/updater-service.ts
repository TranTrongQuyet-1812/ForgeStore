import { apiClient } from '../api/api-client';
import type { CheckUpdatesResponseDto } from '@forgestore/types';

export const updaterService = {
  /**
   * Kiểm tra các bản cập nhật cho các ứng dụng đã cài trên máy (P3-12.3)
   */
  async kiemTraCapNhat(
    deviceId: string,
    danhSachCaiDat: Array<{ maUngDung: string; phienBanHienTai: string }> = [],
  ): Promise<CheckUpdatesResponseDto> {
    try {
      return await apiClient.post<CheckUpdatesResponseDto>('/apps/check-updates', {
        maThietBi: deviceId,
        danhSachCaiDat,
      });
    } catch (err) {
      console.warn('[UpdaterService] Không thể kiểm tra cập nhật:', err);
      return { danhSachCapNhat: [] };
    }
  },
};

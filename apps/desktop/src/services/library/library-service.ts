import { apiClient } from '../api/api-client';
import type { GhiNhanCaiDatRequest, UngDungDaCaiDto } from '@forgestore/types';

export const libraryService = {
  /**
   * Lấy danh sách ứng dụng đã cài đặt trên thiết bị hiện tại (P3-12.2)
   */
  async layDanhSachAppDaCai(deviceId: string): Promise<UngDungDaCaiDto[]> {
    try {
      return await apiClient.get<UngDungDaCaiDto[]>(`/devices/${deviceId}/installed`);
    } catch (err) {
      console.warn('[LibraryService] Không thể lấy danh sách app đã cài từ backend:', err);
      return [];
    }
  },

  /**
   * Ghi nhận hoặc nâng cấp ứng dụng vừa cài đặt lên thiết bị (P3-12.2)
   */
  async ghiNhanCaiDat(
    deviceId: string,
    dto: GhiNhanCaiDatRequest,
  ): Promise<UngDungDaCaiDto | null> {
    try {
      return await apiClient.post<UngDungDaCaiDto>(`/devices/${deviceId}/installed`, dto);
    } catch (err) {
      console.warn('[LibraryService] Lỗi khi ghi nhận cài đặt lên backend:', err);
      return null;
    }
  },

  /**
   * Gỡ ứng dụng khỏi danh sách thiết bị (P3-12.2)
   */
  async goCaiDat(deviceId: string, appId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/devices/${deviceId}/installed/${appId}`);
      return true;
    } catch (err) {
      console.error('[LibraryService] Lỗi khi gỡ ứng dụng khỏi thiết bị:', err);
      return false;
    }
  },
};

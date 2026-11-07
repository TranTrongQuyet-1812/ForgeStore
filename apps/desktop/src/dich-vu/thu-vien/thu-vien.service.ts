import { apiClient, ApiError } from '../api/api-client';
import type {
  CapNhatKhoaRegistryRequest,
  GhiNhanCaiDatCliRequest,
  GhiNhanCaiDatRequest,
  UngDungDaCaiDto,
  XacNhanCaiDatCliResponse,
} from '@forgestore/types';

export const thuVienService = {
  /**
   * Lấy danh sách ứng dụng đã cài đặt trên thiết bị hiện tại (P3-12.2)
   */
  async layDanhSachAppDaCai(deviceId: string): Promise<UngDungDaCaiDto[]> {
    try {
      return await apiClient.get<UngDungDaCaiDto[]>(`/thiet-bi/${deviceId}/da-cai`);
    } catch (err) {
      console.warn('[LibraryService] Không thể lấy danh sách app đã cài từ backend:', err);
      throw err;
    }
  },

  /**
   * Ghi nhận hoặc nâng cấp ứng dụng vừa cài đặt lên thiết bị (P3-12.2)
   */
  /**
   * Như `ghiNhanCaiDat` nhưng cho biết lỗi có đáng thử lại không: mất mạng, hết giờ, 401 (đang làm mới phiên), 5xx và 429 thì thử lại được;
   * lỗi 4xx khác (app không còn trong kho, dữ liệu sai, không có quyền) thì thử lại bao nhiêu lần cũng vậy.
   */
  async ghiNhanCaiDatCoKetQua(
    deviceId: string,
    dto: GhiNhanCaiDatRequest,
  ): Promise<{ thanhCong: boolean; thuLaiDuoc: boolean }> {
    try {
      await apiClient.post(`/thiet-bi/${deviceId}/da-cai`, dto);
      return { thanhCong: true, thuLaiDuoc: false };
    } catch (err) {
      const ma = err instanceof ApiError ? err.status : 0;
      const loiVinhVien = ma >= 400 && ma < 500 && ma !== 401 && ma !== 408 && ma !== 429;
      console.warn('[LibraryService] Lỗi khi ghi nhận cài đặt lên backend:', err);
      return { thanhCong: false, thuLaiDuoc: !loiVinhVien };
    }
  },

  async ghiNhanCaiDat(
    deviceId: string,
    dto: GhiNhanCaiDatRequest,
  ): Promise<UngDungDaCaiDto | null> {
    try {
      return await apiClient.post<UngDungDaCaiDto>(`/thiet-bi/${deviceId}/da-cai`, dto);
    } catch (err) {
      console.warn('[LibraryService] Lỗi khi ghi nhận cài đặt lên backend:', err);
      return null;
    }
  },

  /**
   * Ghi nhận ứng dụng cài đặt qua dòng lệnh CLI ("Tôi đã cài" - P3B-16.5)
   * Tạo bản ghi ở trạng thái CHO_XAC_NHAN, tự hết hạn sau 24 giờ.
   */
  async ghiNhanCaiDatCli(
    deviceId: string,
    dto: GhiNhanCaiDatCliRequest,
  ): Promise<UngDungDaCaiDto | null> {
    try {
      return await apiClient.post<UngDungDaCaiDto>(`/thiet-bi/${deviceId}/da-cai/cli`, dto);
    } catch (err) {
      console.warn('[LibraryService] Lỗi khi ghi nhận cài đặt CLI lên backend:', err);
      return null;
    }
  },

  /**
   * Xác nhận lại ứng dụng CLI đã cài ("Xác nhận đã cài" - P3B-16.5)
   * Chuyển trạng thái sang DA_XAC_NHAN và hủy đếm ngược 24h.
   */
  async xacNhanCaiDatCli(
    deviceId: string,
    appId: string,
  ): Promise<XacNhanCaiDatCliResponse | null> {
    try {
      return await apiClient.patch<XacNhanCaiDatCliResponse>(
        `/thiet-bi/${deviceId}/da-cai/${appId}/xac-nhan-cli`,
      );
    } catch (err) {
      console.warn('[LibraryService] Lỗi khi xác nhận cài đặt CLI lên backend:', err);
      return null;
    }
  },

  /**
   * Ghi phiên bản thật của gói cài bằng dòng lệnh (P3B-30), đọc từ `npm ls -g` hay `pip show`.
   * Chỉ đổi phiên bản, giữ nguyên trạng thái xác nhận. Lỗi thì trả `false`, lần mở Thư viện sau sẽ thử lại.
   */
  async capNhatPhienBanCli(deviceId: string, appId: string, phienBan: string): Promise<boolean> {
    try {
      await apiClient.patch(`/thiet-bi/${deviceId}/da-cai/${appId}/phien-ban`, { phienBan });
      return true;
    } catch (err) {
      console.warn('[LibraryService] Lỗi khi cập nhật phiên bản CLI lên backend:', err);
      return false;
    }
  },

  /**
   * Cập nhật riêng khóa Registry Windows cho ứng dụng đã cài đặt (DELIV-40.2)
   * Giữ nguyên mã tệp đã cài và phiên bản hiện tại trên CSDL backend.
   */
  async capNhatKhoaRegistry(
    deviceId: string,
    appId: string,
    dto: CapNhatKhoaRegistryRequest,
  ): Promise<boolean> {
    try {
      await apiClient.patch(`/thiet-bi/${deviceId}/da-cai/${appId}/registry`, dto);
      return true;
    } catch (err) {
      console.warn('[LibraryService] Lỗi khi cập nhật khóa registry lên backend:', err);
      return false;
    }
  },

  /**
   * Gỡ ứng dụng khỏi danh sách thiết bị (P3-12.2 & P3B-16.6)
   */
  async goCaiDat(deviceId: string, appId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/thiet-bi/${deviceId}/da-cai/${appId}`);
      return true;
    } catch (err) {
      console.error('[LibraryService] Lỗi khi gỡ ứng dụng khỏi thiết bị:', err);
      return false;
    }
  },
};

import { apiClient } from '../api/api-client';
import type { UngDungTomTatDto, TrangKetQua } from '@forgestore/types';

export interface ToggleFavoriteResult {
  daYeuThich: boolean;
  tongSoYeuThich: number;
}

export const yeuThichService = {
  /**
   * Lấy danh sách ứng dụng trong kho yêu thích của người dùng hiện tại (P3-12.1)
   */
  async layDanhSachYeuThich(page = 1, limit = 20): Promise<TrangKetQua<UngDungTomTatDto>> {
    return apiClient.get<TrangKetQua<UngDungTomTatDto>>(
      `/nguoi-dung/yeu-thich?page=${page}&limit=${limit}`,
    );
  },

  /**
   * Bật / Tắt trạng thái yêu thích của ứng dụng (P3-12.1)
   */
  async chuyenDoiYeuThich(appId: string): Promise<ToggleFavoriteResult> {
    const cleanId = appId.trim();
    const targetEndpoint = cleanId.includes('/')
      ? `/ung-dung/${encodeURIComponent(cleanId)}/yeu-thich`
      : `/ung-dung/${cleanId}/yeu-thich`;
    // Không gửi header tự đặt (vd. x-device-type): header lạ làm preflight CORS của WebView2
    // chặn request trước khi tới backend. Loại thiết bị do backend tự xác định từ phiên đăng nhập.
    return apiClient.post<ToggleFavoriteResult>(targetEndpoint);
  },
};

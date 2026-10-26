import { apiClient } from '../api/api-client';
import type { UngDungTomTatDto, TrangKetQua } from '@forgestore/types';

export interface ToggleFavoriteResult {
  daYeuThich: boolean;
  tongSoYeuThich: number;
}

export const favoritesService = {
  /**
   * Lấy danh sách ứng dụng trong kho yêu thích của người dùng hiện tại (P3-12.1)
   */
  async layDanhSachYeuThich(page = 1, limit = 20): Promise<TrangKetQua<UngDungTomTatDto>> {
    return apiClient.get<TrangKetQua<UngDungTomTatDto>>(
      `/user/favorites?page=${page}&limit=${limit}`,
    );
  },

  /**
   * Bật / Tắt trạng thái yêu thích của ứng dụng (P3-12.1)
   */
  async chuyenDoiYeuThich(appId: string): Promise<ToggleFavoriteResult> {
    const cleanId = appId.trim();
    const targetEndpoint = cleanId.includes('/')
      ? `/apps/${encodeURIComponent(cleanId)}/favorite`
      : `/apps/${cleanId}/favorite`;
    // Không gửi header tự đặt (vd. x-device-type): header lạ làm preflight CORS của WebView2
    // chặn request trước khi tới backend. Loại thiết bị do backend tự xác định từ phiên đăng nhập.
    return apiClient.post<ToggleFavoriteResult>(targetEndpoint);
  },
};

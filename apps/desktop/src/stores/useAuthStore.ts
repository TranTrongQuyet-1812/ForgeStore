import { create } from 'zustand';
import type { NguoiDungDto, AuthResponseDto, AuthRefreshResponseDto } from '@forgestore/types';
import { tokenStorage } from '../services/auth/token-storage';
import { apiClient, ApiError } from '../services/api/api-client';

interface AuthState {
  user: NguoiDungDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Khởi tạo trạng thái đăng nhập từ Windows Credential Manager khi mở app */
  initAuth: () => Promise<void>;

  /** Cập nhật phiên đăng nhập sau khi xác thực thành công */
  setAuth: (data: AuthResponseDto) => Promise<void>;

  /** Đăng xuất: xóa token khỏi RAM và Windows Credential Manager */
  logout: () => Promise<void>;

  /** Làm mới hồ sơ người dùng hiện tại */
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  initAuth: async () => {
    set({ isLoading: true });
    try {
      // 1. Kiểm tra xem có Refresh Token trong Windows Credential Manager không
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // 2. Tự động đổi accessToken mới
      const refreshRes = await apiClient.post<AuthRefreshResponseDto>('/auth/refresh', {
        refreshToken,
      });

      tokenStorage.setAccessToken(refreshRes.accessToken);
      if (refreshRes.refreshToken) {
        await tokenStorage.setRefreshToken(refreshRes.refreshToken);
      }

      set({ accessToken: refreshRes.accessToken, isAuthenticated: true });

      // 3. Tải hồ sơ người dùng
      await get().fetchProfile();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        console.warn('[useAuthStore] Phiên đăng nhập trước đó đã hết hạn hoặc không hợp lệ.');
        await tokenStorage.clearAllTokens();
        set({ user: null, accessToken: null, isAuthenticated: false });
      } else {
        console.warn(
          '[useAuthStore] Không thể kết nối tới máy chủ khi khôi phục phiên (mất mạng/timeout/5xx): Giữ nguyên token để thử lại sau.',
          err,
        );
        set({ isAuthenticated: false });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  setAuth: async (data: AuthResponseDto) => {
    tokenStorage.setAccessToken(data.accessToken);

    if (data.refreshToken) {
      await tokenStorage.setRefreshToken(data.refreshToken);
    }

    set({
      user: data.nguoiDung || null,
      accessToken: data.accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await tokenStorage.clearAllTokens();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  fetchProfile: async () => {
    try {
      const profile = await apiClient.get<NguoiDungDto>('/user/profile');
      set({ user: profile });
    } catch (err) {
      console.error('[useAuthStore] Không thể tải thông tin hồ sơ:', err);
    }
  },
}));

// Tự động lắng nghe các sự kiện đăng xuất và làm mới token từ API Client
apiClient.onLogout(() => {
  useAuthStore.getState().logout();
});

apiClient.onTokenRefresh((newToken) => {
  useAuthStore.setState({ accessToken: newToken, isAuthenticated: true });
});

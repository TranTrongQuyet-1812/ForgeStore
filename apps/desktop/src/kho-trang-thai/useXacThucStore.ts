import { create } from 'zustand';
import type {
  NguoiDungDto,
  ThietBiDto,
  AuthResponseDto,
  AuthRefreshResponseDto,
} from '@forgestore/types';
import { tokenStorage, parseJwtDid } from '../dich-vu/xac-thuc/luu-tru-token';
import { apiClient, ApiError } from '../dich-vu/api/api-client';
import { queryClient } from '../dich-vu/api/query-client';

interface AuthState {
  user: NguoiDungDto | null;
  thietBi: ThietBiDto | null;
  maThietBi: string | null;
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

/** Chỉ giữ một bộ lắng nghe `online` tại một thời điểm, dù initAuth thất bại nhiều lần lúc mất mạng. */
let dangChoCoMang = false;

export const useXacThucStore = create<AuthState>((set, get) => ({
  user: null,
  thietBi: null,
  maThietBi: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  initAuth: async () => {
    set({ isLoading: true });
    try {
      // 1. Kiểm tra xem có Refresh Token trong Windows Credential Manager không
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        set({
          user: null,
          thietBi: null,
          maThietBi: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      // 2. Tự động đổi accessToken mới
      const refreshRes = await apiClient.post<AuthRefreshResponseDto>('/xac-thuc/lam-moi', {
        refreshToken,
      });

      tokenStorage.setAccessToken(refreshRes.accessToken);
      if (refreshRes.refreshToken) {
        await tokenStorage.setRefreshToken(refreshRes.refreshToken);
      }

      const did = parseJwtDid(refreshRes.accessToken) || null;
      set({
        accessToken: refreshRes.accessToken,
        maThietBi: did,
        isAuthenticated: true,
      });

      // 3. Tải hồ sơ người dùng và thiết bị
      await get().fetchProfile();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        console.warn('[useXacThucStore] Phiên đăng nhập trước đó đã hết hạn hoặc không hợp lệ.');
        await tokenStorage.clearAllTokens();
        set({
          user: null,
          thietBi: null,
          maThietBi: null,
          accessToken: null,
          isAuthenticated: false,
        });
      } else {
        console.warn(
          '[useXacThucStore] Không thể kết nối tới máy chủ khi khôi phục phiên (mất mạng/timeout/5xx): Giữ nguyên token để thử lại sau.',
          err,
        );
        set({ isAuthenticated: false });
        // Mở app lúc mất mạng: có mạng lại thì tự khôi phục phiên, không bắt người dùng khởi động lại app
        if (typeof window !== 'undefined' && !dangChoCoMang) {
          dangChoCoMang = true;
          window.addEventListener(
            'online',
            () => {
              dangChoCoMang = false;
              if (!get().isAuthenticated) void get().initAuth();
            },
            { once: true },
          );
        }
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

    const did = data.thietBi?.maThietBi || parseJwtDid(data.accessToken) || null;

    set({
      user: data.nguoiDung || null,
      thietBi: data.thietBi || null,
      maThietBi: did,
      accessToken: data.accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await tokenStorage.clearAllTokens();
    // Xóa toàn bộ cache dữ liệu riêng tư của người dùng cũ (chống Data Bleeding)
    queryClient.clear();
    set({
      user: null,
      thietBi: null,
      maThietBi: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  fetchProfile: async () => {
    try {
      const profile = await apiClient.get<NguoiDungDto>('/nguoi-dung/ho-so');
      set({ user: profile });

      // Nạp danh sách thiết bị của tài khoản để đồng bộ đúng ThietBiDto
      const did = get().maThietBi;
      try {
        const devices = await apiClient.get<ThietBiDto[]>('/thiet-bi');
        if (devices && devices.length > 0) {
          const currentDev = did ? devices.find((d) => d.maThietBi === did) : devices[0];
          if (currentDev) {
            set({ thietBi: currentDev, maThietBi: currentDev.maThietBi });
          }
        }
      } catch {
        // Bỏ qua nếu chưa nạp được danh sách thiết bị
      }
    } catch (err) {
      console.error('[useXacThucStore] Không thể tải thông tin hồ sơ:', err);
    }
  },
}));

// Tự động lắng nghe các sự kiện đăng xuất và làm mới token từ API Client
apiClient.onLogout(() => {
  useXacThucStore.getState().logout();
});

apiClient.onTokenRefresh((newToken) => {
  const did = parseJwtDid(newToken);
  useXacThucStore.setState((prev) => ({
    accessToken: newToken,
    maThietBi: did || prev.maThietBi,
    isAuthenticated: true,
  }));
});

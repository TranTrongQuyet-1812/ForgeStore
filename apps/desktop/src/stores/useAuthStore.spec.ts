import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { tokenStorage } from '../services/auth/token-storage';
import { VaiTro } from '@forgestore/types';

describe('useAuthStore (P3-03.4)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await tokenStorage.clearAllTokens();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initAuth khi không có refresh token trong máy: kết thúc loading và giữ trạng thái chưa đăng nhập', async () => {
    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('initAuth khi có refresh token: tự động lấy access token mới và tải hồ sơ người dùng', async () => {
    await tokenStorage.setRefreshToken('stored-refresh-token');

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'new-session-access-token',
            refreshToken: 'new-rotated-token',
          }),
        };
      }
      if (url.includes('/user/profile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            maNguoiDung: 'user-uuid-1812',
            tenDangNhap: 'trantrongquyet',
            tenHienThi: 'Trần Trọng Quyết',
            vaiTro: VaiTro.NGUOI_DUNG,
            ngayTao: new Date().toISOString(),
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    global.fetch = mockFetch;

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('new-session-access-token');
    expect(state.user?.tenDangNhap).toBe('trantrongquyet');
    expect(await tokenStorage.getRefreshToken()).toBe('new-rotated-token');
  });

  it('logout: dọn sạch dữ liệu trong store và xóa token khỏi storage', async () => {
    tokenStorage.setAccessToken('active-access');
    await tokenStorage.setRefreshToken('active-refresh');
    useAuthStore.setState({
      user: {
        maNguoiDung: 'user-1',
        tenDangNhap: 'quyet',
        vaiTro: VaiTro.NGUOI_DUNG,
        ngayTao: new Date(),
      },
      accessToken: 'active-access',
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });
});

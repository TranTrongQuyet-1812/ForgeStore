import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authService, DEEP_LINK_SCHEME } from './auth-service';
import { pkce } from './pkce';
import { tokenStorage } from './token-storage';
import { useAuthStore } from '../../stores/useAuthStore';
import { VaiTro } from '@forgestore/types';

describe('AuthService (P3-04 - GitHub OAuth Deep Link & PKCE Exchange)', () => {
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
    authService.destroy();
  });

  it('loginWithGithub sinh mã PKCE và lưu verifier vào bộ nhớ tạm', async () => {
    const openMock = vi.fn();
    const originalWindow = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: { open: typeof openMock } }).window = { open: openMock };

    try {
      await authService.loginWithGithub();

      expect(openMock).toHaveBeenCalledTimes(1);
      const calledUrl = openMock.mock.calls[0][0] as string;

      expect(calledUrl).toContain('/auth/github');
      expect(calledUrl).toContain(`redirect=${encodeURIComponent(DEEP_LINK_SCHEME)}`);
      expect(calledUrl).toContain('challenge=');

      // Verifier phải được lưu trong pkce storage
      const verifier = pkce.getAndClearVerifier();
      expect(verifier).toBeDefined();
      expect(verifier).toHaveLength(64);
    } finally {
      (global as unknown as { window?: unknown }).window = originalWindow;
    }
  });

  it('handleDeepLinkUrl xử lý URL forgestore://auth?code=... và đổi token thành công', async () => {
    // 1. Giả lập đã có verifier được lưu từ bước login
    pkce.saveVerifier('mock-saved-pkce-verifier-123');

    // 2. Mock fetch cho endpoint /auth/exchange
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/exchange')) {
        const body = JSON.parse(init?.body as string);
        expect(body.code).toBe('oauth-exchange-code-999');
        expect(body.verifier).toBe('mock-saved-pkce-verifier-123');
        expect(body.thietBi.dinhDanhPhanCung).toBeDefined();

        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'mock-jwt-access-token',
            refreshToken: 'mock-jwt-refresh-token',
            nguoiDung: {
              maNguoiDung: 'user-uuid-1812',
              tenDangNhap: 'trantrongquyet',
              tenHienThi: 'Trần Trọng Quyết',
              vaiTro: VaiTro.NGUOI_DUNG,
              duongDanAvatar: 'https://avatars.githubusercontent.com/u/1812',
            },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    global.fetch = mockFetch;

    // 3. Giả lập hệ điều hành gửi deep link
    const success = await authService.handleDeepLinkUrl(
      'forgestore://auth?code=oauth-exchange-code-999',
    );
    expect(success).toBe(true);

    // 4. Kiểm tra useAuthStore đã cập nhật trạng thái đăng nhập
    const authState = useAuthStore.getState();
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.accessToken).toBe('mock-jwt-access-token');
    expect(authState.user?.tenDangNhap).toBe('trantrongquyet');

    // 5. Refresh token đã được ủy thác lưu an toàn
    expect(await tokenStorage.getRefreshToken()).toBe('mock-jwt-refresh-token');
  });

  it('handleDeepLinkUrl trả về false nếu URL không chứa code hoặc thiếu verifier', async () => {
    // Trường hợp 1: Không có code
    const res1 = await authService.handleDeepLinkUrl('forgestore://auth?other=abc');
    expect(res1).toBe(false);

    // Trường hợp 2: Có code nhưng không có verifier (hoặc đã hết hạn)
    const res2 = await authService.handleDeepLinkUrl('forgestore://auth?code=xyz');
    expect(res2).toBe(false);
  });

  it('logout dọn sạch phiên đăng nhập trên UI và storage', async () => {
    tokenStorage.setAccessToken('active-token');
    await tokenStorage.setRefreshToken('active-refresh');
    useAuthStore.setState({
      user: {
        maNguoiDung: 'user-1',
        tenDangNhap: 'quyet',
        vaiTro: VaiTro.NGUOI_DUNG,
        ngayTao: new Date(),
      },
      accessToken: 'active-token',
      isAuthenticated: true,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ thongBao: 'success' }),
    });
    global.fetch = mockFetch;

    await authService.logout();

    const authState = useAuthStore.getState();
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });
});

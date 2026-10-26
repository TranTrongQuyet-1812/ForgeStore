import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authService, DEEP_LINK_SCHEME } from './auth-service';
import { pkce } from './pkce';
import { tokenStorage } from './token-storage';
import { useAuthStore } from '../../kho-trang-thai/useAuthStore';
import { VaiTro } from '@forgestore/types';

describe('AuthService (P3-04 & Mục 68 - Multi-Session Deep Link & PKCE Exchange)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    pkce.clearAllVerifiers();
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

  it('loginWithGithub sinh mã PKCE, tạo sessionId và lưu verifier vào bộ nhớ tạm', async () => {
    const openMock = vi.fn();
    const originalWindow = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: { open: typeof openMock } }).window = { open: openMock };

    try {
      await authService.loginWithGithub();

      expect(openMock).toHaveBeenCalledTimes(1);
      const calledUrl = openMock.mock.calls[0][0] as string;

      expect(calledUrl).toContain('/auth/github');
      // Redirect URI chứa DEEP_LINK_SCHEME và tham số session ?a=
      expect(calledUrl).toContain(encodeURIComponent(`${DEEP_LINK_SCHEME}?a=`));
      expect(calledUrl).toContain('challenge=');

      const currentSessionId = authService.getCurrentSessionId();
      expect(currentSessionId).toBeTruthy();

      // Verifier phải được lưu tương ứng với sessionId
      const verifier = pkce.getAndClearVerifier(currentSessionId!);
      expect(verifier).toBeDefined();
      expect(verifier).toHaveLength(64);
    } finally {
      (global as unknown as { window?: unknown }).window = originalWindow;
    }
  });

  it('loginWithGoogle sinh mã PKCE và mở trình duyệt với URL /auth/google kèm sessionId', async () => {
    const openMock = vi.fn();
    const originalWindow = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: { open: typeof openMock } }).window = { open: openMock };

    try {
      await authService.loginWithGoogle();

      expect(openMock).toHaveBeenCalledTimes(1);
      const calledUrl = openMock.mock.calls[0][0] as string;

      expect(calledUrl).toContain('/auth/google');
      expect(calledUrl).toContain(encodeURIComponent(`${DEEP_LINK_SCHEME}?a=`));
      expect(calledUrl).toContain('challenge=');

      const currentSessionId = authService.getCurrentSessionId();
      expect(currentSessionId).toBeTruthy();

      const verifier = pkce.getAndClearVerifier(currentSessionId!);
      expect(verifier).toBeDefined();
      expect(verifier).toHaveLength(64);
    } finally {
      (global as unknown as { window?: unknown }).window = originalWindow;
    }
  });

  it('handleDeepLinkUrl xử lý URL forgestore://auth?a=...&code=... và đổi token thành công', async () => {
    const sessionId = 'session-test-01';
    // 1. Giả lập đã có verifier được lưu từ bước login
    pkce.saveVerifier('mock-saved-pkce-verifier-123', sessionId);

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

    // 3. Giả lập hệ điều hành gửi deep link chứa sessionId
    const success = await authService.handleDeepLinkUrl(
      `forgestore://auth?a=${sessionId}&code=oauth-exchange-code-999`,
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

  it('bỏ qua deep link error từ tab cũ khi người dùng đã mở tab mới (Multi-Session Safety)', async () => {
    const errorListener = vi.fn();
    authService.onAuthError(errorListener);

    const openMock = vi.fn();
    const originalWindow = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: { open: typeof openMock } }).window = { open: openMock };

    try {
      // 1. Mở Tab A
      await authService.loginWithGoogle();
      const sessionA = authService.getCurrentSessionId()!;

      // 2. Bấm "Hủy kết nối và thử lại", mở tiếp Tab B
      await authService.loginWithGithub();
      const sessionB = authService.getCurrentSessionId()!;

      expect(sessionA).not.toBe(sessionB);

      // 3. Người dùng bấm Hủy trên Tab A cũ: deep link error của session A gửi về
      const resA = await authService.handleDeepLinkUrl(
        `forgestore://auth?a=${sessionA}&error=access_denied`,
      );
      expect(resA).toBe(false);

      // Vì sessionA != sessionB (phiên hiện tại đang chờ), errorListener KHÔNG ĐƯỢC PHÉP gọi để tránh tắt spinner Tab B!
      expect(errorListener).not.toHaveBeenCalled();

      // 4. Mock fetch cho exchange của Tab B
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/auth/exchange')) {
          const body = JSON.parse(init?.body as string);
          expect(body.code).toBe('code-for-tab-b');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              accessToken: 'jwt-tab-b',
              refreshToken: 'refresh-tab-b',
              nguoiDung: {
                maNguoiDung: 'user-b',
                tenDangNhap: 'user_b',
                vaiTro: VaiTro.NGUOI_DUNG,
              },
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      global.fetch = mockFetch;

      // 5. Tab B đăng nhập thành công
      const resB = await authService.handleDeepLinkUrl(
        `forgestore://auth?a=${sessionB}&code=code-for-tab-b`,
      );
      expect(resB).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    } finally {
      (global as unknown as { window?: unknown }).window = originalWindow;
    }
  });

  it('handleDeepLinkUrl kích hoạt onAuthError khi phiên hiện tại nhận lỗi hủy', async () => {
    const errorListener = vi.fn();
    const unsubscribe = authService.onAuthError(errorListener);

    const openMock = vi.fn();
    const originalWindow = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: { open: typeof openMock } }).window = { open: openMock };

    try {
      await authService.loginWithGoogle();
      const sessionActive = authService.getCurrentSessionId()!;

      // Giả lập người dùng bấm Hủy trên chính tab đang chờ
      const res = await authService.handleDeepLinkUrl(
        `forgestore://auth?a=${sessionActive}&error=access_denied`,
      );
      expect(res).toBe(false);
      expect(errorListener).toHaveBeenCalledWith('access_denied');

      // Hủy đăng ký listener
      unsubscribe();
      await authService.handleDeepLinkUrl('forgestore://auth?error=another_error');
      expect(errorListener).toHaveBeenCalledTimes(1);
    } finally {
      (global as unknown as { window?: unknown }).window = originalWindow;
    }
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

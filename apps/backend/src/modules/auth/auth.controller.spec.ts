import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DUONG_DAN_XONG, dungTrangQuayLaiApp } from './trang-quay-lai-app';

describe('AuthController (Unit Tests)', () => {
  let controller: AuthController;
  let mockAuthService: {
    khoiTaoGithubAuth: ReturnType<typeof vi.fn>;
    xuLyGithubCallback: ReturnType<typeof vi.fn>;
    khoiTaoGoogleAuth: ReturnType<typeof vi.fn>;
    xuLyGoogleCallback: ReturnType<typeof vi.fn>;
    layVaXoaState: ReturnType<typeof vi.fn>;
    doiMaXacThuc: ReturnType<typeof vi.fn>;
    lamMoiToken: ReturnType<typeof vi.fn>;
    dangXuat: ReturnType<typeof vi.fn>;
    layHoSo: ReturnType<typeof vi.fn>;
  };
  let mockResponse: {
    redirect: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  /** HTML đã gửi qua res.send */
  const htmlDaGui = (): string => mockResponse.send.mock.calls[0][0] as string;
  /** Headers đã đặt qua res.set */
  const headersDaDat = (): Record<string, string> =>
    mockResponse.set.mock.calls[0][0] as Record<string, string>;

  beforeEach(() => {
    mockAuthService = {
      khoiTaoGithubAuth: vi.fn(),
      xuLyGithubCallback: vi.fn(),
      khoiTaoGoogleAuth: vi.fn(),
      xuLyGoogleCallback: vi.fn(),
      layVaXoaState: vi.fn(),
      doiMaXacThuc: vi.fn(),
      lamMoiToken: vi.fn(),
      dangXuat: vi.fn(),
      layHoSo: vi.fn(),
    };

    mockResponse = {
      redirect: vi.fn(),
      status: vi.fn(),
      set: vi.fn(),
      send: vi.fn(),
    };
    mockResponse.status.mockReturnValue(mockResponse);
    mockResponse.set.mockReturnValue(mockResponse);
    mockResponse.send.mockReturnValue(mockResponse);

    controller = new AuthController(mockAuthService as unknown as AuthService);
  });

  describe('Google OAuth Callback & Google Workspace hd parameter resilience', () => {
    it('xuLyGoogleCallback: chấp nhận query thô chứa tham số phụ hd của Google Workspace mà không lỗi', async () => {
      mockAuthService.xuLyGoogleCallback.mockResolvedValue(
        'forgestore://auth?code=mock-exchange-code',
      );

      const queryWithHd = {
        code: 'google-auth-code',
        state: 'valid-state-uuid',
        scope: 'openid email profile',
        authuser: '0',
        prompt: 'consent',
        hd: 'fpt.edu.vn', // Tham số Google Workspace Hosted Domain
        extraParam: 'unexpected-value',
      };

      await controller.xuLyGoogleCallback(queryWithHd, mockResponse as unknown as Response);

      expect(mockAuthService.xuLyGoogleCallback).toHaveBeenCalledWith(
        'google-auth-code',
        'valid-state-uuid',
      );
      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(htmlDaGui()).toContain('Đăng nhập thành công');
      expect(htmlDaGui()).toContain(
        'window.location.href = "forgestore://auth?code=mock-exchange-code"',
      );
    });

    it('xuLyGoogleCallback: xử lý khi người dùng hủy ủy quyền trên Google', async () => {
      mockAuthService.layVaXoaState.mockResolvedValue({
        redirect: 'forgestore://auth?a=abc12345',
      });

      const cancelQuery = {
        error: 'access_denied',
        state: 'valid-state-uuid',
      };

      await controller.xuLyGoogleCallback(cancelQuery, mockResponse as unknown as Response);

      expect(htmlDaGui()).toContain('Bạn đã hủy đăng nhập');
      // Giữ nguyên mã phiên `a` để app biết lỗi thuộc lần đăng nhập nào
      expect(htmlDaGui()).toContain('"forgestore://auth?a=abc12345&error=access_denied"');
    });

    it('xuLyCallback (GitHub): chấp nhận query thô chứa tham số phụ ngoài dự kiến', async () => {
      mockAuthService.xuLyGithubCallback.mockResolvedValue(
        'forgestore://auth?code=mock-exchange-code',
      );

      const githubQueryWithExtra = {
        code: 'github-code-123',
        state: 'state-123',
        extra_github_param: 'some_data',
      };

      await controller.xuLyCallback(githubQueryWithExtra, mockResponse as unknown as Response);

      expect(mockAuthService.xuLyGithubCallback).toHaveBeenCalledWith(
        'github-code-123',
        'state-123',
      );
      expect(htmlDaGui()).toContain('"forgestore://auth?code=mock-exchange-code"');
    });

    it('xuLyCallback (GitHub): lỗi trong service vẫn trả trang lỗi mở lại app', async () => {
      mockAuthService.xuLyGithubCallback.mockRejectedValue({
        response: { maLoi: 'MA_XAC_THUC_KHONG_HOP_LE' },
      });

      await controller.xuLyCallback({ code: 'c', state: 's' }, mockResponse as unknown as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(htmlDaGui()).toContain('Đăng nhập chưa hoàn tất');
      expect(htmlDaGui()).toContain('"forgestore://auth?error=MA_XAC_THUC_KHONG_HOP_LE"');
    });
  });

  describe('Trang quay lại app sau callback', () => {
    it('đặt header chống cache, chống rò Referer và CSP nonce khớp với script', async () => {
      mockAuthService.xuLyGithubCallback.mockResolvedValue('forgestore://auth?a=x&code=y');

      await controller.xuLyCallback({ code: 'c', state: 's' }, mockResponse as unknown as Response);

      const headers = headersDaDat();
      expect(headers['Content-Type']).toBe('text/html; charset=utf-8');
      expect(headers['Cache-Control']).toBe('no-store');
      expect(headers['Referrer-Policy']).toBe('no-referrer');

      const nonce = /script-src 'nonce-([^']+)'/.exec(headers['Content-Security-Policy'])?.[1];
      expect(nonce).toBeTruthy();
      expect(htmlDaGui()).toContain(`<script nonce="${nonce}">`);
    });

    it('dọn URL callback khỏi thanh địa chỉ bằng history.replaceState', () => {
      const { html } = dungTrangQuayLaiApp('thanh-cong', 'forgestore://auth?code=y');
      expect(html).toContain(`history.replaceState(null, '', "${DUONG_DAN_XONG}")`);
      expect(html).toContain('href="forgestore://auth?code=y"');
    });

    it('escape deep link trong href và trong script (chống XSS)', () => {
      const docHai =
        'forgestore://auth?x="><img src=x onerror=alert(1)></script><script>alert(2)//';
      const { html } = dungTrangQuayLaiApp('thanh-cong', docHai);

      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('</script><script>alert(2)');
      expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    });

    it('trang "xong" không có script và không có nút mở app', () => {
      controller.xong(mockResponse as unknown as Response);

      expect(htmlDaGui()).toContain('Bạn có thể đóng tab này');
      expect(htmlDaGui()).not.toContain('<script');
      expect(htmlDaGui()).not.toContain('Mở ForgeStore</a>');
    });
  });
});

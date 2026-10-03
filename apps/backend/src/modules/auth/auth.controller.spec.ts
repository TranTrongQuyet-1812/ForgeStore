import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
  };

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
    };

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
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'forgestore://auth?code=mock-exchange-code',
      );
    });

    it('xuLyGoogleCallback: xử lý khi người dùng hủy ủy quyền trên Google', async () => {
      mockAuthService.layVaXoaState.mockResolvedValue({
        redirect: 'forgestore://auth',
      });

      const cancelQuery = {
        error: 'access_denied',
        state: 'valid-state-uuid',
      };

      await controller.xuLyGoogleCallback(cancelQuery, mockResponse as unknown as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith('forgestore://auth?error=access_denied');
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
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'forgestore://auth?code=mock-exchange-code',
      );
    });
  });
});

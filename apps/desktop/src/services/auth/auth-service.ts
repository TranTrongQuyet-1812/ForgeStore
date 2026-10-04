/**
 * Dịch vụ Xác thực Toàn diện (Authentication Service) cho ForgeStore Desktop.
 *
 * Tính năng chính (P3-04):
 * 1. Khởi tạo quy trình GitHub OAuth + PKCE (RFC 7636).
 * 2. Mở trình duyệt mặc định hệ thống qua plugin opener.
 * 3. Lắng nghe Deep Link URL `forgestore://auth?code=...` qua plugin deep-link.
 * 4. Đổi mã 1 lần lấy cặp JWT Tokens qua `POST /auth/exchange` kèm thông tin thiết bị (SHA-256 MachineGuid).
 * 5. Cập nhật state đăng nhập vào Zustand useAuthStore và Windows Credential Manager.
 */

import { apiClient } from '../api/api-client';
import { isTauri } from './token-storage';
import { pkce } from './pkce';
import { deviceService } from '../device/device-service';
import { useAuthStore } from '../../stores/useAuthStore';
import type { AuthResponseDto } from '@forgestore/types';

export const DEEP_LINK_SCHEME = 'forgestore://auth';

export class AuthService {
  private isListening = false;
  private unlistenDeepLink: (() => void) | null = null;
  private authErrorListeners = new Set<(error: string) => void>();

  /**
   * Đăng ký lắng nghe sự kiện lỗi xác thực hoặc người dùng hủy cấp quyền
   */
  public onAuthError(listener: (error: string) => void): () => void {
    this.authErrorListeners.add(listener);
    return () => {
      this.authErrorListeners.delete(listener);
    };
  }

  private notifyAuthError(error: string): void {
    for (const listener of this.authErrorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error('[AuthService] Lỗi trong authErrorListener:', err);
      }
    }
  }

  /**
   * Đăng ký lắng nghe sự kiện Deep Link toàn cục khi app khởi động
   */
  public async init(): Promise<void> {
    // 1. Khởi tạo phiên từ Windows Credential Manager
    await useAuthStore.getState().initAuth();

    // 2. Lắng nghe Deep Link nếu chạy trên Tauri native (P3-04 & Điểm 2)
    if (isTauri() && !this.isListening) {
      try {
        const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');

        // Bắt deep link khi app mở nguội (cold start)
        try {
          const currentUrls = await getCurrent();
          if (currentUrls && currentUrls.length > 0) {
            for (const url of currentUrls) {
              if (url.startsWith('forgestore://auth')) {
                await this.handleDeepLinkUrl(url);
              }
            }
          }
        } catch (coldErr) {
          console.warn('[AuthService] Lỗi khi đọc getCurrent deep-link:', coldErr);
        }

        // Lắng nghe deep link từ plugin deep-link khi app đang chạy (single-instance tự động chuyển tiếp)
        this.unlistenDeepLink = await onOpenUrl(async (urls: string[]) => {
          for (const url of urls) {
            if (url.startsWith('forgestore://auth')) {
              await this.handleDeepLinkUrl(url);
            }
          }
        });

        this.isListening = true;
      } catch (err) {
        console.error('[AuthService] Không thể khởi tạo deep-link listener:', err);
      }
    }
  }

  /**
   * Bắt đầu đăng nhập GitHub với PKCE
   */
  public async loginWithGithub(): Promise<void> {
    await this.startOAuthFlow('/auth/github');
  }

  /**
   * Bắt đầu đăng nhập Google với PKCE (P3B-15)
   */
  public async loginWithGoogle(): Promise<void> {
    await this.startOAuthFlow('/auth/google');
  }

  /**
   * Khởi tạo luồng OAuth chung với PKCE và mở trình duyệt
   */
  private async startOAuthFlow(endpoint: string): Promise<void> {
    // 1. Sinh Code Verifier và Code Challenge S256 chuẩn RFC 7636
    const verifier = pkce.generateCodeVerifier(64);
    const challenge = await pkce.generateCodeChallenge(verifier);

    // 2. Lưu verifier vào bộ nhớ tạm
    pkce.saveVerifier(verifier);

    // 3. Xây dựng URL điều hướng tới endpoint OAuth
    const baseUrl = apiClient.getBaseUrl();
    const authUrl = `${baseUrl}${endpoint}?challenge=${encodeURIComponent(challenge)}&redirect=${encodeURIComponent(DEEP_LINK_SCHEME)}`;

    // 4. Mở trình duyệt hệ thống
    if (isTauri()) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(authUrl);
        return;
      } catch (err) {
        console.warn('[AuthService] Lỗi khi dùng plugin opener, fallback window.open:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.open(authUrl, '_blank');
    }
  }

  /**
   * Xử lý chuỗi URL Deep Link nhận được từ hệ điều hành
   */
  public async handleDeepLinkUrl(urlStr: string): Promise<boolean> {
    try {
      // Phân tách tham số code từ URL (ví dụ: forgestore://auth?code=xyz hoặc forgestore://auth/callback?code=xyz)
      const parsedUrl = new URL(urlStr.replace('forgestore://auth', 'http://localhost/auth'));

      // Kiểm tra nếu callback trả về mã lỗi (ví dụ người dùng hủy cấp quyền)
      const error = parsedUrl.searchParams.get('error');
      if (error) {
        pkce.getAndClearVerifier();
        console.warn(`[AuthService] Đăng nhập không thành công: ${error}`);
        this.notifyAuthError(error);
        return false;
      }

      const code = parsedUrl.searchParams.get('code');

      if (!code) {
        console.warn('[AuthService] Deep link không chứa mã code xác thực:', urlStr);
        this.notifyAuthError('MISSING_CODE');
        return false;
      }

      // Lấy lại Code Verifier đã lưu khi mở trình duyệt
      const verifier = pkce.getAndClearVerifier();
      if (!verifier) {
        console.error(
          '[AuthService] Không tìm thấy PKCE Verifier hợp lệ. Phiên đăng nhập có thể đã hết hạn.',
        );
        this.notifyAuthError('EXPIRED_VERIFIER');
        return false;
      }

      // Thu thập thông tin phần cứng máy trạm (MachineGuid băm SHA-256)
      const thietBi = await deviceService.getDeviceInfo();

      // Gửi yêu cầu đổi mã 1 lần lấy cặp JWT tokens (Zero-Token-on-URL)
      const authRes = await apiClient.post<AuthResponseDto>('/auth/exchange', {
        code,
        verifier,
        thietBi,
      });

      // Lưu trữ phiên an toàn vào RAM & Windows Credential Manager
      await useAuthStore.getState().setAuth(authRes);
      return true;
    } catch (err) {
      console.error('[AuthService] Lỗi trong quá trình đổi mã xác thực:', err);
      this.notifyAuthError('EXCHANGE_FAILED');
      return false;
    }
  }

  /**
   * Đăng xuất khỏi hệ thống
   */
  public async logout(): Promise<void> {
    try {
      if (useAuthStore.getState().isAuthenticated) {
        await apiClient.post('/auth/logout').catch(() => {});
      }
    } finally {
      await useAuthStore.getState().logout();
    }
  }

  /**
   * Hủy lắng nghe deep link khi component unmount (nếu cần)
   */
  public destroy(): void {
    if (this.unlistenDeepLink) {
      this.unlistenDeepLink();
      this.unlistenDeepLink = null;
      this.isListening = false;
    }
  }
}

export const authService = new AuthService();

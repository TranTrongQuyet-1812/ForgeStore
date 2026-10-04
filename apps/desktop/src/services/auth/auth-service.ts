/**
 * Dịch vụ Xác thực Toàn diện (Authentication Service) cho ForgeStore Desktop.
 *
 * Tính năng chính (P3-04 & Mục 68):
 * 1. Khởi tạo quy trình GitHub / Google OAuth + PKCE (RFC 7636).
 * 2. Hỗ trợ đa phiên đồng thời (Multi-Session): Gắn tham số session `a=<sessionId>` vào redirect URL,
 *    giúp bảo toàn verifier độc lập khi người dùng mở nhiều tab hoặc bấm "Thử lại".
 * 3. Mở trình duyệt mặc định hệ thống qua plugin opener.
 * 4. Lắng nghe Deep Link URL `forgestore://auth?a=...&code=...` qua plugin deep-link.
 * 5. Bỏ qua các deep link hủy từ tab cũ (`sessionId !== currentSessionId`) để không gây gián đoạn phiên đang chờ.
 * 6. Đổi mã 1 lần lấy cặp JWT Tokens qua `POST /auth/exchange` kèm thông tin thiết bị (SHA-256 MachineGuid).
 * 7. Cập nhật state đăng nhập vào Zustand useAuthStore và Windows Credential Manager.
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
  private currentSessionId: string | null = null;

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
   * Lấy mã phiên đăng nhập đang hoạt động
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Hủy phiên đăng nhập hiện tại khi người dùng bấm "Hủy kết nối và thử lại"
   */
  public cancelCurrentLogin(): void {
    this.currentSessionId = null;
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
    // 1. Sinh mã phiên ngẫu nhiên cho lần đăng nhập này (Mục 68)
    const sessionId = pkce.generateSessionId();
    this.currentSessionId = sessionId;

    // 2. Sinh Code Verifier và Code Challenge S256 chuẩn RFC 7636
    const verifier = pkce.generateCodeVerifier(64);
    const challenge = await pkce.generateCodeChallenge(verifier);

    // 3. Lưu verifier vào bộ nhớ tạm theo sessionId (chống ghi đè giữa các tab)
    pkce.saveVerifier(verifier, sessionId);

    // 4. Xây dựng URL điều hướng tới endpoint OAuth với redirect URI chứa sessionId (?a=...)
    const baseUrl = apiClient.getBaseUrl();
    const redirectWithSession = `${DEEP_LINK_SCHEME}?a=${sessionId}`;
    const authUrl = `${baseUrl}${endpoint}?challenge=${encodeURIComponent(challenge)}&redirect=${encodeURIComponent(redirectWithSession)}`;

    // 5. Mở trình duyệt hệ thống
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
      // Phân tách tham số từ URL (ví dụ: forgestore://auth?a=xyz&code=abc hoặc forgestore://auth?a=xyz&error=access_denied)
      const parsedUrl = new URL(urlStr.replace('forgestore://auth', 'http://localhost/auth'));
      const sessionId = parsedUrl.searchParams.get('a') || undefined;

      // Kiểm tra nếu callback trả về mã lỗi (ví dụ người dùng hủy cấp quyền)
      const error = parsedUrl.searchParams.get('error');
      if (error) {
        // Xóa verifier của phiên đó khỏi storage
        if (sessionId) {
          pkce.getAndClearVerifier(sessionId);
        } else {
          pkce.getAndClearVerifier();
        }

        // Nếu app đã đăng nhập xong rồi, bỏ qua lỗi từ các tab thừa còn lại
        if (useAuthStore.getState().isAuthenticated) {
          return false;
        }

        // Nếu lỗi gửi về từ một tab cũ (không khớp phiên đang chờ hiện tại), bỏ qua và không tắt spinner
        if (sessionId && this.currentSessionId && sessionId !== this.currentSessionId) {
          console.warn(
            `[AuthService] Bỏ qua deep link lỗi từ phiên cũ [${sessionId}]. Phiên hiện tại đang chờ là [${this.currentSessionId}].`,
          );
          return false;
        }

        this.currentSessionId = null;
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

      // Lấy lại Code Verifier đã lưu tương ứng với sessionId
      const verifier = pkce.getAndClearVerifier(sessionId);
      if (!verifier) {
        console.error(
          `[AuthService] Không tìm thấy PKCE Verifier hợp lệ cho phiên [${sessionId ?? 'default'}]. Phiên đăng nhập có thể đã hết hạn.`,
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

      this.currentSessionId = null;

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
      this.currentSessionId = null;
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

/**
 * Type-Safe API Client cho ForgeStore Desktop Client.
 *
 * Tính năng chính (P3-03.1 & P3-03.2):
 * 1. Tự động đính kèm `Authorization: Bearer <accessToken>` từ bộ nhớ RAM.
 * 2. Cơ chế Single-Flight 401 Interceptor:
 *    - Khi gặp lỗi 401, tự động gọi `/auth/refresh` ĐÚNG MỘT LẦN.
 *    - Các request khác đến trong lúc đang refresh sẽ được xếp hàng (Promise Queue), không bắn bão request lên server.
 *    - Sau khi refresh thành công: Cập nhật accessToken trong RAM, xoay vòng refreshToken (nếu có) vào Windows Credential Manager, và tự động gửi lại toàn bộ request trong hàng đợi.
 *    - Nếu refresh thất bại: Hủy phiên, dọn sạch token và gọi logout callback.
 */

import { tokenStorage } from '../xac-thuc/luu-tru-token';
import { desktopLogger } from '../logger/desktop-logger';
import type { AuthRefreshResponseDto } from '@forgestore/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
    public retryAfterGiay?: number,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

export type LogoutListener = () => void;
export type TokenRefreshListener = (newAccessToken: string) => void;

export class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<string> | null = null;
  private logoutListeners: Set<LogoutListener> = new Set();
  private tokenRefreshListeners: Set<TokenRefreshListener> = new Set();

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
      'http://localhost:3000/api/v1';
    // Đảm bảo không có trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public onLogout(listener: LogoutListener): () => void {
    this.logoutListeners.add(listener);
    return () => this.logoutListeners.delete(listener);
  }

  public onTokenRefresh(listener: TokenRefreshListener): () => void {
    this.tokenRefreshListeners.add(listener);
    return () => this.tokenRefreshListeners.delete(listener);
  }

  private notifyLogout(): void {
    this.logoutListeners.forEach((fn) => fn());
  }

  private notifyTokenRefresh(newToken: string): void {
    this.tokenRefreshListeners.forEach((fn) => fn(newToken));
  }

  /**
   * Thực hiện quy trình làm mới token duy nhất 1 lần (Single-Flight Token Refresh)
   */
  private async executeTokenRefresh(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('Không tìm thấy Refresh Token trong Windows Credential Manager');
        }

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new ApiError(response.status, response.statusText, errData);
        }

        const data: AuthRefreshResponseDto = await response.json();
        const newAccessToken = data.accessToken;

        // Cập nhật RAM access token
        tokenStorage.setAccessToken(newAccessToken);

        // Nếu server cấp refreshToken mới qua cơ chế Token Rotation, lưu ngay vào Windows Credential Manager
        if (data.refreshToken) {
          await tokenStorage.setRefreshToken(data.refreshToken);
        }

        this.notifyTokenRefresh(newAccessToken);
        return newAccessToken;
      } catch (error) {
        // Chỉ dọn dẹp sạch token và đăng xuất khi lỗi xác thực (401 hoặc 403)
        // Nếu lỗi mất mạng (Network error, timeout) hoặc 5xx, KHÔNG xóa token!
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await tokenStorage.clearAllTokens();
          this.notifyLogout();
        }
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Core request function với retry tự động khi gặp 401
   */
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const accessToken = tokenStorage.getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkErr) {
      void desktopLogger.ghiLogError(
        `Lỗi kết nối mạng khi gọi API [${endpoint}]: ${networkErr}`,
        'ApiClient',
      );
      throw networkErr;
    }

    // Xử lý khi nhận 401 Unauthorized
    if (response.status === 401) {
      void desktopLogger.ghiLogWarn(
        `API [${endpoint}] trả về 401 Unauthorized, bắt đầu quy trình làm mới token`,
        'ApiClient',
      );
      // Nếu chính endpoint /auth/refresh bị 401 hoặc request này đã là retry một lần rồi thì không retry nữa
      if (endpoint.includes('/auth/refresh') || isRetry) {
        await tokenStorage.clearAllTokens();
        this.notifyLogout();
        const errData = await response.json().catch(() => ({}));
        throw new ApiError(response.status, response.statusText, errData);
      }

      // Chờ kết quả refresh duy nhất (các request khác sẽ cùng đợi promise này)
      const newAccessToken = await this.executeTokenRefresh();

      // Gửi lại request ban đầu với Access Token mới
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
      if (!retryHeaders.has('Content-Type') && !(options.body instanceof FormData)) {
        retryHeaders.set('Content-Type', 'application/json');
      }

      return await this.request<T>(
        endpoint,
        {
          ...options,
          headers: retryHeaders,
        },
        true, // Đánh dấu đã retry
      );
    }

    if (!response.ok) {
      const thongDiepLoi = `Lỗi phản hồi API [${endpoint}]: HTTP ${response.status} ${response.statusText}`;
      if (response.status >= 400 && response.status < 500) {
        void desktopLogger.ghiLogWarn(thongDiepLoi, 'ApiClient');
      } else {
        void desktopLogger.ghiLogError(thongDiepLoi, 'ApiClient');
      }
      const errData = await response.json().catch(() => ({}));
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      throw new ApiError(
        response.status,
        response.statusText,
        errData,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      );
    }

    // Nếu không có content (204 No Content)
    if (response.status === 204) {
      return null as unknown as T;
    }

    return (await response.json()) as T;
  }

  public get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Singleton instance dùng cho toàn app
export const apiClient = new ApiClient();

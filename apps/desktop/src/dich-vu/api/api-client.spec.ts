import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApiClient } from './api-client';
import { tokenStorage } from '../xac-thuc/luu-tru-token';

describe('ApiClient & 401 Single-Flight Refresh Queue (P3-03.1 & P3-03.2)', () => {
  let client: ApiClient;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    client = new ApiClient('http://localhost:3000');
    await tokenStorage.clearAllTokens();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lỗi 429: ApiError mang theo thời gian chờ đọc từ header Retry-After', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: '',
      headers: new Headers({ 'retry-after': '3284' }),
      json: async () => ({ thongBao: 'ThrottlerException: Too Many Requests' }),
    });
    await expect(client.get('/x')).rejects.toMatchObject({ status: 429, retryAfterGiay: 3284 });
  });

  it('lỗi 429 không có Retry-After: retryAfterGiay để trống', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: '',
      headers: new Headers(),
      json: async () => ({}),
    });
    await expect(client.get('/x')).rejects.toMatchObject({
      status: 429,
      retryAfterGiay: undefined,
    });
  });

  it('tự động đính kèm Authorization header khi có Access Token trong RAM', async () => {
    tokenStorage.setAccessToken('initial-access-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'success' }),
    });
    global.fetch = mockFetch;

    const res = await client.get('/test');
    expect(res).toEqual({ message: 'success' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const callHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(callHeaders.get('Authorization')).toBe('Bearer initial-access-token');
  });

  it('xử lý 401 Single-Flight: nhiều request đồng thời chỉ kích hoạt duy nhất 1 lần refresh và tự động replay', async () => {
    tokenStorage.setAccessToken('expired-access-token');
    await tokenStorage.setRefreshToken('valid-refresh-token');

    let refreshCount = 0;

    const getHeader = (h: unknown, key: string): string | null => {
      if (!h || typeof h !== 'object') return null;
      if ('get' in h && typeof (h as { get: (k: string) => string | null }).get === 'function') {
        return (h as { get: (k: string) => string | null }).get(key);
      }
      const record = h as Record<string, string>;
      return record[key] || record[key.toLowerCase()] || null;
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const authHeader = getHeader(init?.headers, 'Authorization');

      // 1. Endpoint refresh token
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'fresh-new-access-token',
            refreshToken: 'rotated-refresh-token',
          }),
        };
      }

      // 2. Các request thông thường: nếu là token cũ -> 401
      if (authHeader === 'Bearer expired-access-token') {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Token expired' }),
        };
      }

      // 3. Nếu gửi bằng token mới -> 200 OK
      if (authHeader === 'Bearer fresh-new-access-token') {
        if (url.includes('/app/1'))
          return { ok: true, status: 200, json: async () => ({ id: '1' }) };
        if (url.includes('/app/2'))
          return { ok: true, status: 200, json: async () => ({ id: '2' }) };
        if (url.includes('/app/3'))
          return { ok: true, status: 200, json: async () => ({ id: '3' }) };
      }

      return { ok: false, status: 500, json: async () => ({}) };
    });

    global.fetch = mockFetch;

    // Bắn 3 request song song cùng lúc khi access token hết hạn
    const [res1, res2, res3] = await Promise.all([
      client.get('/app/1'),
      client.get('/app/2'),
      client.get('/app/3'),
    ]);

    expect(res1).toEqual({ id: '1' });
    expect(res2).toEqual({ id: '2' });
    expect(res3).toEqual({ id: '3' });

    // KHẲNG ĐỊNH QUAN TRỌNG: Chỉ có duy nhất 1 request /auth/refresh được gọi (Single-Flight)
    expect(refreshCount).toBe(1);

    // Access token trong RAM đã được cập nhật
    expect(tokenStorage.getAccessToken()).toBe('fresh-new-access-token');

    // Refresh token đã được xoay vòng
    expect(await tokenStorage.getRefreshToken()).toBe('rotated-refresh-token');
  });

  it('khi refresh token hết hạn (401 tại /auth/refresh): kích hoạt logout và xóa sạch token', async () => {
    tokenStorage.setAccessToken('expired-access-token');
    await tokenStorage.setRefreshToken('revoked-refresh-token');

    const logoutMock = vi.fn();
    client.onLogout(logoutMock);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Refresh token revoked' }),
        };
      }
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Access token expired' }),
      };
    });

    global.fetch = mockFetch;

    await expect(client.get('/user/profile')).rejects.toThrow();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it('khi gặp lỗi mạng (TypeError / offline) khi refresh: ném lỗi nhưng KHÔNG xóa token và KHÔNG kích hoạt logout', async () => {
    tokenStorage.setAccessToken('expired-access-token');
    await tokenStorage.setRefreshToken('valid-refresh-token');

    const logoutMock = vi.fn();
    client.onLogout(logoutMock);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        throw new TypeError('Failed to fetch'); // Giả lập mất mạng
      }
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Access token expired' }),
      };
    });

    global.fetch = mockFetch;

    await expect(client.get('/user/profile')).rejects.toThrow('Failed to fetch');

    // Khẳng định: Lỗi mạng không làm mất token và không kích hoạt logout
    expect(logoutMock).not.toHaveBeenCalled();
    expect(await tokenStorage.getRefreshToken()).toBe('valid-refresh-token');
  });
});

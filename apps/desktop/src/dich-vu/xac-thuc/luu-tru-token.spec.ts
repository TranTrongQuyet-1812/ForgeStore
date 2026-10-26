import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from './luu-tru-token';

describe('TokenStorage (P3-03.3)', () => {
  beforeEach(async () => {
    await tokenStorage.clearAllTokens();
  });

  it('lưu trữ và truy xuất Access Token thuần túy trong RAM', () => {
    expect(tokenStorage.getAccessToken()).toBeNull();

    tokenStorage.setAccessToken('mock-access-token-123');
    expect(tokenStorage.getAccessToken()).toBe('mock-access-token-123');

    tokenStorage.setAccessToken(null);
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('lưu trữ và truy xuất Refresh Token an toàn (Web dev fallback)', async () => {
    expect(await tokenStorage.getRefreshToken()).toBeNull();

    await tokenStorage.setRefreshToken('mock-refresh-token-xyz');
    expect(await tokenStorage.getRefreshToken()).toBe('mock-refresh-token-xyz');

    await tokenStorage.clearRefreshToken();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it('clearAllTokens xóa sạch cả Access Token và Refresh Token', async () => {
    tokenStorage.setAccessToken('access-123');
    await tokenStorage.setRefreshToken('refresh-456');

    await tokenStorage.clearAllTokens();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });
});

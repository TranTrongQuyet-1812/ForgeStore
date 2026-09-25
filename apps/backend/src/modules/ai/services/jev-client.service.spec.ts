import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JevClientService } from './jev-client.service';
import { CacheService } from '../../redis/cache.service';
import * as TypeSafeSdk from '@typesafe-ai/sdk';

vi.mock('@typesafe-ai/sdk', async () => {
  const actual = await vi.importActual<typeof import('@typesafe-ai/sdk')>('@typesafe-ai/sdk');
  return {
    ...actual,
    TypeSafeClient: vi.fn().mockImplementation((config) => ({
      config,
    })),
  };
});

describe('JevClientService (P2-37 & Timeout 5000ms & Ngưỡng Token)', () => {
  function createService(
    configOverrides: Record<string, unknown> = {},
    cacheOverrides: Record<string, unknown> = {},
  ) {
    const configMap: Record<string, unknown> = {
      TYPESAFE_API_KEY: 'ts_test_key_123',
      JEV_ENABLED: true,
      ...configOverrides,
    };

    const mockConfigService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        return configMap[key] !== undefined ? configMap[key] : defaultValue;
      }),
    };

    const mockCacheService = {
      tangSo: vi.fn().mockResolvedValue(100),
      get: vi.fn(),
      set: vi.fn(),
      ...cacheOverrides,
    };

    const service = new JevClientService(
      mockConfigService as unknown as ConfigService,
      mockCacheService as unknown as CacheService,
    );

    return { service, mockConfigService, mockCacheService };
  }

  it('Khởi tạo TypeSafeClient với timeout mặc định là 5000ms (5 giây)', () => {
    createService();
    expect(TypeSafeSdk.TypeSafeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'ts_test_key_123',
        timeout: 5000,
      }),
    );
  });

  it('Cho phép cấu hình ghi đè timeout qua JEV_TIMEOUT_MS', () => {
    createService({ JEV_TIMEOUT_MS: 7000 });
    expect(TypeSafeSdk.TypeSafeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 7000,
      }),
    );
  });

  it('Tắt Jev khi JEV_ENABLED = false hoặc 0', () => {
    const { service } = createService({ JEV_ENABLED: false });
    expect(service.isEnabled).toBe(false);
  });
});

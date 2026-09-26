import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../redis/cache.service';
import { LlmRateLimiterService, TokenBucketState } from './llm-rate-limiter.service';

describe('LlmRateLimiterService (AI1)', () => {
  let service: LlmRateLimiterService;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };
  let mockCacheService: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    withLock: ReturnType<typeof vi.fn>;
  };
  let memoryStore: Map<string, TokenBucketState>;

  beforeEach(() => {
    memoryStore = new Map<string, TokenBucketState>();

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'AI_GEMINI_RPM') return 12;
        if (key === 'AI_GEMINI_EMBEDDING_RPM') return 80;
        if (key === 'AI_NVIDIA_NIM_RPM') return 30;
        return undefined;
      }),
    };

    mockCacheService = {
      get: vi.fn(async (key: string) => memoryStore.get(key) || null),
      set: vi.fn(async (key: string, val: TokenBucketState) => {
        memoryStore.set(key, val);
      }),
      withLock: vi.fn(async (_lockKey: string, _ttl: number, action: () => Promise<unknown>) => {
        return action();
      }),
    };

    service = new LlmRateLimiterService(
      mockConfigService as unknown as ConfigService,
      mockCacheService as unknown as CacheService,
    );
  });

  it('đọc đúng giới hạn RPM từ cấu hình', () => {
    expect(service.layRpm('gemini')).toBe(12);
    expect(service.layRpm('gemini_embedding')).toBe(80);
    expect(service.layRpm('nvidia_nim')).toBe(30);
  });

  it('AI1: gọi 12 lần liên tiếp thì Gemini nhận đủ 12 token; lần thứ 13 bị từ chối chủ động', async () => {
    // 12 lần đầu tiên: thành công
    for (let i = 1; i <= 12; i++) {
      const res = await service.layToken('gemini', 0);
      expect(res.chapNhan).toBe(true);
      expect(res.capacity).toBe(12);
      expect(res.conLai).toBeCloseTo(12 - i, 1);
    }

    // Lần thứ 13 gọi ngay lập tức: bị từ chối chủ động vì hết token bucket (< 1.0)
    const res13 = await service.layToken('gemini', 0);
    expect(res13.chapNhan).toBe(false);
    expect(res13.conLai).toBeLessThan(1.0);
    expect(res13.thoiGianChoMs).toBeGreaterThan(0);
  });

  it('Gemini Embedding có hạn mức 80 RPM và độc lập với Gemini Text', async () => {
    // Hút cạn Gemini Text (12 token)
    for (let i = 0; i < 12; i++) {
      await service.layToken('gemini', 0);
    }
    const geminiTextRes = await service.layToken('gemini', 0);
    expect(geminiTextRes.chapNhan).toBe(false);

    // Gemini Embedding vẫn còn nguyên vẹn 80 tokens
    const embeddingRes = await service.layToken('gemini_embedding', 0);
    expect(embeddingRes.chapNhan).toBe(true);
    expect(embeddingRes.capacity).toBe(80);
    expect(embeddingRes.conLai).toBeCloseTo(79, 1);
  });

  it('hồi phục token theo thời gian trôi qua', async () => {
    const now = Date.now();
    // Giả lập trạng thái còn 0 token cách đây 10 giây
    // Với Gemini 12 RPM: 12/60 = 0.2 token/giây -> 10 giây hồi 2 token
    memoryStore.set('fs:llm:bucket:gemini', {
      tokens: 0,
      lastRefill: now - 10000,
    });

    const res = await service.layToken('gemini', 0);
    expect(res.chapNhan).toBe(true);
    // Hồi được ~2 token, trừ 1 token còn ~1 token
    expect(res.conLai).toBeCloseTo(1, 0);
  });
});

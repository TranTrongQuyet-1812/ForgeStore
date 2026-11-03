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
  let memoryStore: Map<string, unknown>;

  beforeEach(() => {
    memoryStore = new Map<string, unknown>();

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
      tangSo: vi.fn(async (key: string, amount = 1) => {
        const next = Number(memoryStore.get(key) ?? 0) + amount;
        memoryStore.set(key, next);
        return next;
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

  it('giữ hạn mức ngày riêng theo model Gemini và trả số đã dùng', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(
      new Date(),
    );
    memoryStore.set(`fs:llm:daily:gemini-3.1-flash-lite:${today}`, 500);
    const permission = await service.layQuyenGemini('gemini-3.1-flash-lite');

    expect(permission.chapNhan).toBe(false);
    expect(permission.hetHanMucNgay).toBe(true);
    expect(memoryStore.get(`fs:llm:daily:gemini-3.1-flash-lite:${today}`)).toBe(500);
  });

  it('đếm một yêu cầu Gemini đã được nhận trước khi gửi mô hình', async () => {
    const permission = await service.layQuyenGemini('gemini-3.5-flash-lite');
    expect(permission.chapNhan).toBe(true);
    expect(permission.soDaDung).toBe(1);
    expect(mockCacheService.tangSo).toHaveBeenCalledWith(
      expect.stringMatching(/^fs:llm:daily:gemini-3\.5-flash-lite:/),
      1,
      172800,
    );
  });

  it('hũ ngày Embedding riêng từng mô hình, nhận đến yêu cầu thứ 1.000 rồi chặn', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(
      new Date(),
    );
    memoryStore.set(`fs:llm:daily:gemini-embedding-2:${today}`, 999);
    await expect(service.giuChoEmbedding('gemini-embedding-2')).resolves.toBe(true);
    await expect(service.giuChoEmbedding('gemini-embedding-2')).resolves.toBe(false);
    await expect(service.giuChoEmbedding('gemini-embedding-001')).resolves.toBe(true);
  });

  it('đọc tổng lượt dùng theo model và số README đã xếp hàng hôm nay', async () => {
    const ngay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(
      new Date(),
    );
    memoryStore.set(`fs:llm:daily:gemini-3.1-flash-lite:${ngay}`, 7);
    memoryStore.set(`fs:llm:daily:gemini-3.5-flash-lite:${ngay}`, 9);
    memoryStore.set(`fs:ai:translation:queued-count:${ngay}`, 2);

    await expect(service.layThongKeGeminiTheoNgay()).resolves.toEqual({
      ngayPacific: ngay,
      theoMoHinh: {
        'gemini-3.1-flash-lite': 7,
        'gemini-3.5-flash-lite': 9,
      },
      soMucChoSangNgayMai: 2,
    });
  });

  it('giãn hai lượt liên tiếp của cùng model ít nhất 4 giây', async () => {
    vi.useFakeTimers();
    try {
      await service.layQuyenGemini('gemini-3.1-flash-lite');
      const lanThuHai = service.layQuyenGemini('gemini-3.1-flash-lite');
      let daXong = false;
      void lanThuHai.then(() => {
        daXong = true;
      });
      await vi.advanceTimersByTimeAsync(3999);
      expect(daXong).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(lanThuHai).resolves.toMatchObject({ chapNhan: true, soDaDung: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('đưa lượt chờ qua nửa đêm Pacific vào bộ đếm của ngày mới', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-04T07:59:58.000Z'));
      await service.layQuyenGemini('gemini-3.1-flash-lite');
      const lanThuHai = service.layQuyenGemini('gemini-3.1-flash-lite');
      await vi.advanceTimersByTimeAsync(4000);
      await expect(lanThuHai).resolves.toMatchObject({ chapNhan: true, soDaDung: 1 });
      expect(memoryStore.get('fs:llm:daily:gemini-3.1-flash-lite:2026-11-03')).toBe(1);
      expect(memoryStore.get('fs:llm:daily:gemini-3.1-flash-lite:2026-11-04')).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

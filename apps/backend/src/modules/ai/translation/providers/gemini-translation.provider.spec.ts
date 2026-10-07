import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GeminiTranslationProvider } from './gemini-translation.provider';
import { LlmRateLimiterService } from '../../services/llm-rate-limiter.service';

describe('GeminiTranslationProvider', () => {
  let provider: GeminiTranslationProvider;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-key-gemini';
        if (key === 'GEMINI_MODEL') return 'gemini-3.1-flash-lite';
        return undefined;
      }),
    } as unknown as ConfigService;
  });

  it('khởi tạo thành công với model GEMINI_MODEL (Mục 3)', () => {
    provider = new GeminiTranslationProvider(mockConfigService);
    expect(provider.providerName).toBe('gemini');
    expect(provider.modelName).toBe('gemini-3.1-flash-lite');
    expect(provider.isAvailable()).toBe(true);
  });

  it('báo not_configured khi thiếu API key', async () => {
    const emptyConfig = {
      get: vi.fn(() => undefined),
    } as unknown as ConfigService;
    const unconfigProvider = new GeminiTranslationProvider(emptyConfig);
    expect(unconfigProvider.isAvailable()).toBe(false);

    const res = await unconfigProvider.translate('Hello');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('not_configured');
  });

  it('xử lý chuỗi rỗng an toàn', async () => {
    provider = new GeminiTranslationProvider(mockConfigService);
    const res = await provider.translate('');
    expect(res.text).toBe('');
    expect(res.lyDoLoi).toBeNull();
  });

  it('bị chặn và trả về rate_limited khi LlmRateLimiterService hết token bucket (Mục 6)', async () => {
    const mockRateLimiter = {
      layToken: vi.fn().mockResolvedValue({
        chapNhan: false,
        conLai: 0,
        capacity: 12,
        thoiGianChoMs: 8000,
      }),
    } as unknown as LlmRateLimiterService;

    provider = new GeminiTranslationProvider(mockConfigService, mockRateLimiter);
    const res = await provider.translate('Hello world');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('rate_limited');
    expect(res.retryAfterSec).toBe(8);
  });
});

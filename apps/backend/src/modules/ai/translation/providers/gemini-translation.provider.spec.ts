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

  it('đưa model sang lượt sau khi hết hũ ngày', async () => {
    const mockRateLimiter = {
      layQuyenGemini: vi.fn().mockResolvedValue({
        chapNhan: false,
        soDaDung: 500,
        hetHanMucNgay: true,
        thoiGianChoGiay: 8,
      }),
    } as unknown as LlmRateLimiterService;

    provider = new GeminiTranslationProvider(mockConfigService, mockRateLimiter);
    const res = await provider.translate('Hello world');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('daily_quota_exhausted');
    expect(res.retryAfterSec).toBe(8);
  });

  it('Fix Lỗi 5: xử lý và trả về ai_error khi Gemini translate() bị cắt cụt do MAX_TOKENS', async () => {
    provider = new GeminiTranslationProvider(mockConfigService);
    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{ finishReason: 'MAX_TOKENS' }],
          text: 'Một đoạn dịch dở dang...',
        }),
      },
    };

    const res = await provider.translate('Tài liệu hướng dẫn dài ngoằng...');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('ai_error');
    expect(res.provider).toBe('gemini');
  });

  it('Fix Lỗi 5: xử lý và trả về ai_error khi Gemini translateBatchJson() bị cắt cụt do MAX_TOKENS', async () => {
    provider = new GeminiTranslationProvider(mockConfigService);
    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{ finishReason: 'MAX_TOKENS' }],
          text: '{"app1": "Dịch dở...',
        }),
      },
    };

    const res = await provider.translateBatchJson([
      { id: 'app1', text: 'An awesome open source application' },
    ]);
    expect(res.data).toBeNull();
    expect(res.lyDoLoi).toBe('ai_error');
    expect(res.provider).toBe('gemini');
  });

  it('dịch gom lô JSON thành công khi trả về cấu trúc hợp lệ', async () => {
    provider = new GeminiTranslationProvider(mockConfigService);
    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{ finishReason: 'STOP' }],
          text: '```json\n{"app1": "Ứng dụng mã nguồn mở tuyệt vời"}\n```',
        }),
      },
    };

    const res = await provider.translateBatchJson([
      { id: 'app1', text: 'An awesome open source application' },
    ]);
    expect(res.data).toEqual({ app1: 'Ứng dụng mã nguồn mở tuyệt vời' });
    expect(res.lyDoLoi).toBeNull();
  });
});

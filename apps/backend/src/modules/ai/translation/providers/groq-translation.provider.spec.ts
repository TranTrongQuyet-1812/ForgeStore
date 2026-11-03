import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GroqTranslationProvider } from './groq-translation.provider';

describe('GroqTranslationProvider', () => {
  let provider: GroqTranslationProvider;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'GROQ_API_KEY') return 'test-key-groq';
        if (key === 'GROQ_MODEL') return 'qwen/qwen3.8-27b';
        return undefined;
      }),
    } as unknown as ConfigService;
  });

  it('khởi tạo thành công với model qwen/qwen3.8-27b', () => {
    provider = new GroqTranslationProvider(mockConfigService);
    expect(provider.providerName).toBe('groq');
    expect(provider.modelName).toBe('qwen/qwen3.8-27b');
    expect(provider.isAvailable()).toBe(true);
  });

  it('gửi prompt tìm kiếm cùng system prompt và trả nội dung JSON', async () => {
    provider = new GroqTranslationProvider(mockConfigService);
    let payload: Record<string, unknown> = {};
    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"tuKhoa":["editor"]}' } }] }),
      };
    });
    await expect(provider.translateSearchJson('prompt', 'system')).resolves.toContain('editor');
    expect(payload.messages).toEqual([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'prompt' },
    ]);
  });

  it('báo not_configured khi thiếu API key', async () => {
    const emptyConfig = {
      get: vi.fn(() => undefined),
    } as unknown as ConfigService;
    const unconfigProvider = new GroqTranslationProvider(emptyConfig);
    expect(unconfigProvider.isAvailable()).toBe(false);

    const res = await unconfigProvider.translate('Hello');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('not_configured');
  });

  it('xử lý chuỗi rỗng an toàn', async () => {
    provider = new GroqTranslationProvider(mockConfigService);
    const res = await provider.translate('');
    expect(res.text).toBe('');
    expect(res.lyDoLoi).toBeNull();
  });

  it('bắt HTTP 429 và bóc tách chính xác header retry-after (P3B-05.14)', async () => {
    provider = new GroqTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'retry-after' ? '45' : null),
      },
    });

    const res = await provider.translate('Sample text');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('rate_limited');
    expect(res.retryAfterSec).toBe(45);
  });

  it('gửi cờ reasoning_effort: "none" và nhận kết quả thành công', async () => {
    provider = new GroqTranslationProvider(mockConfigService);
    let capturedBody: Record<string, unknown> = {};

    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        status: 200,
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Văn bản tiếng Việt từ Groq' } }],
        }),
      };
    });

    const res = await provider.translate('English text');
    expect(capturedBody.reasoning_effort).toBe('none');
    expect(res.text).toBe('Văn bản tiếng Việt từ Groq');
    expect(res.lyDoLoi).toBeNull();
  });

  it('bắt lỗi ai_error khi bản dịch bị cắt cụt do chạm giới hạn token (finish_reason === length) (Mục 2)', async () => {
    provider = new GroqTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: 'Đoạn văn bị cắt cụt dang dở' },
            finish_reason: 'length',
          },
        ],
      }),
    });

    const res = await provider.translate('Long input text');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('ai_error');
  });
});

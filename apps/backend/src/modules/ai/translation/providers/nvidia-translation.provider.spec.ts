import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NvidiaTranslationProvider } from './nvidia-translation.provider';

describe('NvidiaTranslationProvider', () => {
  let provider: NvidiaTranslationProvider;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'NVIDIA_API_KEY') return 'test-key-nvidia';
        if (key === 'NVIDIA_TRANSLATE_MODEL') return 'google/diffusiongemma-26b-a4b-it';
        return undefined;
      }),
    } as unknown as ConfigService;
  });

  it('khởi tạo thành công với model google/diffusiongemma-26b-a4b-it', () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
    expect(provider.providerName).toBe('nvidia');
    expect(provider.modelName).toBe('google/diffusiongemma-26b-a4b-it');
    expect(provider.isAvailable()).toBe(true);
  });

  it('gửi prompt tìm kiếm cùng system prompt và trả nội dung JSON', async () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
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
    const unconfigProvider = new NvidiaTranslationProvider(emptyConfig);
    expect(unconfigProvider.isAvailable()).toBe(false);

    const res = await unconfigProvider.translate('Hello');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('not_configured');
  });

  it('xử lý chuỗi rỗng an toàn', async () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
    const res = await provider.translate('');
    expect(res.text).toBe('');
    expect(res.lyDoLoi).toBeNull();
  });

  it('xử lý HTTP 429 trả về rate_limited', async () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
    });

    const res = await provider.translate('Sample text');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('rate_limited');
  });

  it('xử lý phản hồi thành công và kiểm tra cấu trúc toàn vẹn', async () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '# Tiêu đề dịch' } }],
      }),
    });

    const res = await provider.translate('# Heading');
    expect(res.text).toBe('# Tiêu đề dịch');
    expect(res.lyDoLoi).toBeNull();
  });

  it('bắt lỗi khi cấu trúc output bị hỏng so với input', async () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mất tiêu đề dịch' } }],
      }),
    });

    // Input có # nhưng output mất # -> headings_changed
    const res = await provider.translate('# Heading');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('headings_changed');
  });

  it('bắt lỗi ai_error khi bản dịch bị cắt cụt do chạm giới hạn token (finish_reason === length) (Mục 2)', async () => {
    provider = new NvidiaTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: '# Đoạn văn bị cắt cụt dang dở' },
            finish_reason: 'length',
          },
        ],
      }),
    });

    const res = await provider.translate('# Heading');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('ai_error');
  });
});

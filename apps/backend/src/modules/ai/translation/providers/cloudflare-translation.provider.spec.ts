import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CloudflareTranslationProvider } from './cloudflare-translation.provider';

describe('CloudflareTranslationProvider', () => {
  let provider: CloudflareTranslationProvider;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'CLOUDFLARE_TRANSLATE_URL') return 'https://worker.test/translate';
        if (key === 'CLOUDFLARE_TRANSLATE_SECRET') return 'test-secret-cf';
        if (key === 'CLOUDFLARE_TRANSLATE_MODEL') return '@cf/aisingapore/gemma-sea-lion-v4-27b-it';
        return undefined;
      }),
    } as unknown as ConfigService;
  });

  it('khởi tạo thành công với Sea-LION 27B và kiểm tra availability', () => {
    provider = new CloudflareTranslationProvider(mockConfigService);
    expect(provider.providerName).toBe('cloudflare');
    expect(provider.modelName).toBe('@cf/aisingapore/gemma-sea-lion-v4-27b-it');
    expect(provider.isAvailable()).toBe(true);
  });

  it('tự động nối /translate nếu biến môi trường chỉ là URL gốc của Worker (Mục 1)', async () => {
    const rootConfig = {
      get: vi.fn((key: string) => {
        if (key === 'CLOUDFLARE_TRANSLATE_URL')
          return 'https://forgestore-translate.user.workers.dev';
        if (key === 'CLOUDFLARE_TRANSLATE_SECRET') return 'test-secret-cf';
        return undefined;
      }),
    } as unknown as ConfigService;

    const cfProvider = new CloudflareTranslationProvider(rootConfig);
    let calledUrl = '';
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      calledUrl = url;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          translations: ['Bản dịch'],
          reasons: [null],
        }),
      };
    });

    await cfProvider.translate('Hello');
    expect(calledUrl).toBe('https://forgestore-translate.user.workers.dev/translate');
  });

  it('báo not_configured khi thiếu URL hoặc Secret', async () => {
    const emptyConfig = {
      get: vi.fn(() => undefined),
    } as unknown as ConfigService;
    const unconfigProvider = new CloudflareTranslationProvider(emptyConfig);
    expect(unconfigProvider.isAvailable()).toBe(false);

    const res = await unconfigProvider.translate('Hello');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('not_configured');
  });

  it('xử lý chuỗi rỗng an toàn', async () => {
    provider = new CloudflareTranslationProvider(mockConfigService);
    const res = await provider.translate('');
    expect(res.text).toBe('');
    expect(res.lyDoLoi).toBeNull();
  });

  it('gửi đúng header X-ForgeStore-Secret và nhận bản dịch thành công từ worker', async () => {
    provider = new CloudflareTranslationProvider(mockConfigService);
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedHeaders = opts.headers;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          provider: 'cloudflare-workers-ai',
          model: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
          translations: ['Bản dịch tiếng Việt'],
          reasons: [null],
          failed: 0,
        }),
      };
    });

    const res = await provider.translate('Input text');
    expect(capturedHeaders['X-ForgeStore-Secret']).toBe('test-secret-cf');
    expect(res.text).toBe('Bản dịch tiếng Việt');
    expect(res.lyDoLoi).toBeNull();
  });

  it('gửi prompt tìm kiếm riêng và trả JSON thô cho bước kiểm tra schema', async () => {
    provider = new CloudflareTranslationProvider(mockConfigService);
    let body: Record<string, unknown> = {};
    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ translation: '{"tuKhoa":["editor"]}' }) };
    });

    await expect(provider.translateSearchJson('prompt', 'system')).resolves.toBe(
      '{"tuKhoa":["editor"]}',
    );
    expect(body).toMatchObject({ text: 'prompt', context: 'system', response_format: 'json' });
  });

  it('bắt lỗi khi worker trả về translation null kèm lý do lỗi cố định (P3B-05.14)', async () => {
    provider = new CloudflareTranslationProvider(mockConfigService);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        provider: 'cloudflare-workers-ai',
        model: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
        translations: [null],
        reasons: ['placeholders_changed'],
        failed: 1,
      }),
    });

    const res = await provider.translate('Input with [C1]');
    expect(res.text).toBeNull();
    expect(res.lyDoLoi).toBe('placeholders_changed');
  });
});

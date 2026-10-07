import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslationRotationService } from './translation-rotation.service';
import { GeminiTranslationProvider } from '../providers/gemini-translation.provider';
import { NvidiaTranslationProvider } from '../providers/nvidia-translation.provider';
import { CloudflareTranslationProvider } from '../providers/cloudflare-translation.provider';
import { GroqTranslationProvider } from '../providers/groq-translation.provider';
import { CacheService } from '../../../redis/cache.service';
import { sanitizeLogMessage } from '../utils/log-sanitizer.util';

describe('TranslationRotationService', () => {
  let service: TranslationRotationService;
  let mockGemini: GeminiTranslationProvider;
  let mockNvidia: NvidiaTranslationProvider;
  let mockCloudflare: CloudflareTranslationProvider;
  let mockGroq: GroqTranslationProvider;
  let mockCacheService: CacheService;

  beforeEach(() => {
    mockGemini = {
      providerName: 'gemini',
      modelName: 'gemini-3.1-flash-lite',
      isAvailable: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue(true),
      translate: vi.fn(),
    } as unknown as GeminiTranslationProvider;

    mockNvidia = {
      providerName: 'nvidia',
      modelName: 'google/diffusiongemma-26b-a4b-it',
      isAvailable: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue(true),
      translate: vi.fn(),
    } as unknown as NvidiaTranslationProvider;

    mockCloudflare = {
      providerName: 'cloudflare',
      modelName: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
      isAvailable: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue(true),
      translate: vi.fn(),
    } as unknown as CloudflareTranslationProvider;

    mockGroq = {
      providerName: 'groq',
      modelName: 'qwen/qwen3.8-27b',
      isAvailable: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue(true),
      translate: vi.fn(),
    } as unknown as GroqTranslationProvider;

    const cacheStore = new Map<string, unknown>();
    mockCacheService = {
      get: vi
        .fn()
        .mockImplementation((key: string) => Promise.resolve(cacheStore.get(key) ?? null)),
      set: vi.fn().mockImplementation((key: string, val: unknown) => {
        cacheStore.set(key, val);
        return Promise.resolve();
      }),
      del: vi.fn().mockImplementation((keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) cacheStore.delete(k);
        return Promise.resolve();
      }),
    } as unknown as CacheService;

    service = new TranslationRotationService(
      mockGemini,
      mockNvidia,
      mockCloudflare,
      mockGroq,
      mockCacheService,
    );
  });

  describe('3 Chốt Chặn Bắt Buộc Của Claude', () => {
    it('Chốt chặn 1: TUYỆT ĐỐI KHÔNG BAO GIỜ coi bản gốc là bản dịch khi cả 4 nhà đều thất bại', async () => {
      const rawText = '# Welcome\nThis is an English document with `code`.';

      // Cả 4 nhà đều thất bại
      vi.mocked(mockGemini.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'ai_error',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      });
      vi.mocked(mockNvidia.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'timeout',
        provider: 'nvidia',
        model: 'google/diffusiongemma-26b-a4b-it',
      });
      vi.mocked(mockCloudflare.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'empty_output',
        provider: 'cloudflare',
        model: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
      });
      vi.mocked(mockGroq.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'placeholders_changed',
        provider: 'groq',
        model: 'qwen/qwen3.8-27b',
      });

      const res = await service.dichVanBan(rawText);

      // KHẲNG ĐỊNH: thanhCong = false và banDich = null (không được phép trả rawText!)
      expect(res.thanhCong).toBe(false);
      expect(res.banDich).toBeNull();
      expect(res.banDich).not.toBe(rawText);
      expect(res.chiTietLoi).toHaveLength(4);
      expect(res.chiTietLoi.map((e) => e.lyDoLoi)).toEqual([
        'ai_error',
        'timeout',
        'empty_output',
        'placeholders_changed',
      ]);
    });

    it('Chốt chặn 2: TUYỆT ĐỐI KHÔNG lộ API key trong log (sanitized logs)', () => {
      const rawApiKey = 'AIzaSyD-1234567890abcdefghijklmnopqrst';
      const logWithKey = `Lỗi gọi API: https://generativelanguage.googleapis.com?key=${rawApiKey} với header Authorization: Bearer ${rawApiKey}`;

      const sanitized = sanitizeLogMessage(logWithKey);

      expect(sanitized).not.toContain(rawApiKey);
      expect(sanitized).toContain('key=[REDACTED]');
      expect(sanitized).toContain('Bearer [REDACTED]');
    });

    it('Chốt chặn 3: ĐÚNG THỨ TỰ XOAY TUA: Gemini (1) -> NVIDIA (2) -> Cloudflare (3) -> Groq (4)', async () => {
      const rawText = '# Title\nHello world';

      // Gemini lỗi -> Phải gọi NVIDIA
      vi.mocked(mockGemini.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'ai_error',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      });
      // NVIDIA lỗi -> Phải gọi Cloudflare
      vi.mocked(mockNvidia.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'timeout',
        provider: 'nvidia',
        model: 'google/diffusiongemma-26b-a4b-it',
      });
      // Cloudflare thành công!
      vi.mocked(mockCloudflare.translate).mockResolvedValue({
        text: '# Tiêu đề\nXin chào thế giới',
        lyDoLoi: null,
        provider: 'cloudflare',
        model: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
      });

      const res = await service.dichVanBan(rawText);

      expect(mockGemini.translate).toHaveBeenCalledTimes(1);
      expect(mockNvidia.translate).toHaveBeenCalledTimes(1);
      expect(mockCloudflare.translate).toHaveBeenCalledTimes(1);
      // Groq không được gọi vì Cloudflare đã thành công
      expect(mockGroq.translate).not.toHaveBeenCalled();

      expect(res.thanhCong).toBe(true);
      expect(res.provider).toBe('cloudflare');
      expect(res.banDich).toBe('# Tiêu đề\nXin chào thế giới');
      expect(res.chiTietLoi).toHaveLength(2);
    });
  });

  describe('Che 6 tầng & Khôi phục (Mask & Unmask)', () => {
    it('tự động che các phần tử kỹ thuật trước khi gửi và unmask chính xác khi nhận kết quả', async () => {
      const rawText = 'Tham khảo code `git status` tại https://github.com/forgestore';

      vi.mocked(mockGemini.translate).mockImplementation(async (masked) => {
        // AI nhận vào chuỗi đã bị mask có dạng 'Tham khảo code ⟦C1⟧ tại ⟦C2⟧'
        expect(masked).toContain('⟦C1⟧');
        expect(masked).toContain('⟦C2⟧');
        expect(masked).not.toContain('git status');
        expect(masked).not.toContain('https://github.com/forgestore');

        return {
          text: 'Tham khảo mã lệnh ⟦C1⟧ tại ⟦C2⟧',
          lyDoLoi: null,
          provider: 'gemini',
          model: 'gemini-3.1-flash-lite',
        };
      });

      const res = await service.dichVanBan(rawText);

      expect(res.thanhCong).toBe(true);
      // Kết quả unmask phải khôi phục đúng code và url ban đầu
      expect(res.banDich).toBe('Tham khảo mã lệnh `git status` tại https://github.com/forgestore');
    });
  });

  describe('Xử lý Rate Limit & Cooldown (P3B-05.14)', () => {
    it('khóa cooldown và tự động bỏ qua provider bị rate limit', async () => {
      const rawText = 'Simple text';

      // Gemini bị rate limit với retry-after 60s
      vi.mocked(mockGemini.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'rate_limited',
        retryAfterSec: 60,
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      });
      // NVIDIA thành công
      vi.mocked(mockNvidia.translate).mockResolvedValue({
        text: 'Văn bản đơn giản',
        lyDoLoi: null,
        provider: 'nvidia',
        model: 'google/diffusiongemma-26b-a4b-it',
      });

      const res1 = await service.dichVanBan(rawText);
      expect(res1.thanhCong).toBe(true);
      expect(res1.provider).toBe('nvidia');

      // Kiểm tra mockCacheService đã lưu cooldown cho gemini
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'fs:ai:translation:cooldown:gemini',
        true,
        60,
      );

      // Lần gọi thứ 2: Gemini đang cooldown, dịch vụ phải tự động bỏ qua Gemini và gọi thẳng NVIDIA
      vi.mocked(mockGemini.translate).mockClear();
      vi.mocked(mockNvidia.translate).mockClear();

      const res2 = await service.dichVanBan(rawText);
      expect(mockGemini.translate).not.toHaveBeenCalled();
      expect(mockNvidia.translate).toHaveBeenCalledTimes(1);
      expect(res2.thanhCong).toBe(true);
      expect(res2.provider).toBe('nvidia');
    });
  });

  describe('Xử lý chuỗi rỗng và danh sách phân đoạn', () => {
    it('xử lý chuỗi rỗng ngay lập tức mà không gọi provider nào', async () => {
      const res = await service.dichVanBan('');
      expect(res.thanhCong).toBe(true);
      expect(res.banDich).toBe('');
      expect(mockGemini.translate).not.toHaveBeenCalled();
    });

    it('dịch danh sách nhiều phân đoạn với dichNhieuDoan', async () => {
      vi.mocked(mockGemini.translate).mockImplementation(async (text) => ({
        text: `Đã dịch: ${text}`,
        lyDoLoi: null,
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      }));

      const res = await service.dichNhieuDoan(['Đoạn 1', 'Đoạn 2']);
      expect(res.tongThanhCong).toBe(2);
      expect(res.tongThatBai).toBe(0);
      expect(res.ketQua).toHaveLength(2);
    });

    it('tạm bỏ nhà dịch 30 phút và đánh dấu unhealthy khi thất bại liên tiếp 3 lần (Mục 4)', async () => {
      const raw = 'Test text';
      // Giả lập Gemini luôn bị ai_error
      vi.mocked(mockGemini.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'ai_error',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      });
      // NVIDIA thành công để chuỗi dịch không bị rớt hoàn toàn
      vi.mocked(mockNvidia.translate).mockResolvedValue({
        text: 'NVIDIA dịch',
        lyDoLoi: null,
        provider: 'nvidia',
        model: 'google/diffusiongemma-26b-a4b-it',
      });

      // Lần 1: Gemini lỗi (lỗi liên tiếp = 1)
      await service.dichVanBan(raw);
      expect(mockGemini.translate).toHaveBeenCalledTimes(1);

      // Lần 2: Gemini lỗi (lỗi liên tiếp = 2)
      await service.dichVanBan(raw);
      expect(mockGemini.translate).toHaveBeenCalledTimes(2);

      // Lần 3: Gemini lỗi (lỗi liên tiếp = 3 -> kích hoạt unhealthy!)
      await service.dichVanBan(raw);
      expect(mockGemini.translate).toHaveBeenCalledTimes(3);

      // Lần 4: Gemini đang ở trạng thái unhealthy, dịch vụ bỏ qua Gemini và gọi thẳng NVIDIA
      vi.mocked(mockGemini.translate).mockClear();
      vi.mocked(mockNvidia.translate).mockClear();

      const res4 = await service.dichVanBan(raw);
      expect(mockGemini.translate).not.toHaveBeenCalled();
      expect(mockNvidia.translate).toHaveBeenCalledTimes(1);
      expect(
        res4.chiTietLoi.some((c) => c.provider === 'gemini' && c.lyDoLoi === 'unhealthy'),
      ).toBe(true);
    });

    it('tăng dần thời gian cooldown khi bị 429 lặp lại (Mục 7)', async () => {
      const raw = 'Text';
      vi.mocked(mockGemini.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'rate_limited',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      });
      vi.mocked(mockNvidia.translate).mockResolvedValue({
        text: 'NVIDIA dịch',
        lyDoLoi: null,
        provider: 'nvidia',
        model: 'google/diffusiongemma-26b-a4b-it',
      });

      // Lần 1: 429 lần đầu -> cooldown 60s
      await service.dichVanBan(raw);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'fs:ai:translation:cooldown:gemini',
        true,
        60,
      );

      // Giả lập cooldown hết hạn, lần 2 lại bị 429 -> cooldown tăng lên 120s
      vi.mocked(mockCacheService.get).mockImplementation((k: string) => {
        if (k === 'fs:ai:translation:cooldown:gemini') return Promise.resolve(null);
        if (k === 'fs:ai:translation:429_count:gemini') return Promise.resolve(1);
        return Promise.resolve(null);
      });

      await service.dichVanBan(raw);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'fs:ai:translation:cooldown:gemini',
        true,
        120,
      );
    });
  });
});

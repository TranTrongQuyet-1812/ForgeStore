import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslationRotationService } from './translation-rotation.service';
import { GeminiTranslationProvider } from '../providers/gemini-translation.provider';
import { CacheService } from '../../../redis/cache.service';

describe('TranslationRotationService', () => {
  let service: TranslationRotationService;
  let gemini31: GeminiTranslationProvider;
  let gemini35: GeminiTranslationProvider;
  let cache: CacheService;
  let cacheStore: Map<string, unknown>;

  beforeEach(() => {
    gemini31 = {
      providerName: 'gemini',
      modelName: 'gemini-3.1-flash-lite',
      isAvailable: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue(true),
      translate: vi.fn(),
      translateBatchJson: vi.fn(),
    } as unknown as GeminiTranslationProvider;
    gemini35 = {
      providerName: 'gemini',
      modelName: 'gemini-3.5-flash-lite',
      isAvailable: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue(true),
      translate: vi.fn(),
      translateBatchJson: vi.fn(),
    } as unknown as GeminiTranslationProvider;
    cacheStore = new Map();
    cache = {
      get: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        cacheStore.set(key, value);
      }),
      del: vi.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) cacheStore.delete(key);
      }),
      tangSo: vi.fn(async (key: string, amount = 1) => {
        const value = Number(cacheStore.get(key) ?? 0) + amount;
        cacheStore.set(key, value);
        return value;
      }),
      setNx: vi.fn(async (key: string) => {
        if (cacheStore.has(key)) return false;
        cacheStore.set(key, true);
        return true;
      }),
    } as unknown as CacheService;
    service = new TranslationRotationService(gemini31, gemini35, cache);
  });

  it('chỉ đăng ký hai model nội dung đã chốt', () => {
    expect(service.layDanhSachProviders().map((item) => item.model)).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
    ]);
  });

  it('đếm duy nhất từng mục được xếp sang ngày mai', async () => {
    await service.ghiNhanMucChoNgayMai(['app-1', 'app-1', 'app-2']);
    expect(cache.tangSo).toHaveBeenCalledTimes(2);
    expect(cache.tangSo).toHaveBeenCalledWith(
      expect.stringMatching(/^fs:ai:translation:queued-count:\d{4}-\d{2}-\d{2}$/),
      1,
      172800,
    );
  });

  it('xoay luân phiên giữa hai model và dùng model còn lại khi model đầu lỗi', async () => {
    vi.mocked(gemini31.translateBatchJson!).mockResolvedValue({
      data: null,
      lyDoLoi: 'ai_error',
      provider: 'gemini',
      model: gemini31.modelName,
    });
    vi.mocked(gemini35.translateBatchJson!).mockResolvedValue({
      data: { '1': 'Bản dịch' },
      lyDoLoi: null,
      provider: 'gemini',
      model: gemini35.modelName,
    });
    const result = await service.dichGomLoJson([{ id: '1', text: 'Original' }]);
    expect(result.ketQua).toEqual({ '1': 'Bản dịch' });
    expect(gemini31.translateBatchJson).toHaveBeenCalledOnce();
    expect(gemini35.translateBatchJson).toHaveBeenCalledOnce();
  });

  it('chỉ từ chối bản dịch trùng nguyên văn với mô tả, vẫn nhận đoạn README vốn là tên riêng', async () => {
    for (const provider of [gemini31, gemini35]) {
      vi.mocked(provider.translateBatchJson!).mockResolvedValue({
        data: { '1': 'ForgeStore CLI' },
        lyDoLoi: null,
        provider: 'gemini',
        model: provider.modelName,
      });
    }

    const readme = await service.dichGomLoJson([{ id: '1', text: 'ForgeStore CLI' }], {
      loai: 'readme',
    });
    const moTa = await service.dichGomLoJson([{ id: '1', text: 'ForgeStore CLI' }], {
      loai: 'mo_ta',
    });

    expect(readme.ketQua).toEqual({ '1': 'ForgeStore CLI' });
    expect(moTa.ketQua).toEqual({});
    expect(moTa.thieuIds).toEqual(['1']);
  });

  it('xếp lô sang ngày mai khi hai hũ hết hạn mức', async () => {
    for (const provider of [gemini35, gemini31]) {
      vi.mocked(provider.translateBatchJson!).mockResolvedValue({
        data: null,
        lyDoLoi: 'daily_quota_exhausted',
        provider: 'gemini',
        model: provider.modelName,
        retryAfterSec: 3600,
      });
    }
    const result = await service.dichGomLoJson([{ id: '1', text: 'Original' }]);
    expect(result.choNgayMai).toBe(true);
    expect(result.retryAfterSec).toBe(3600);
    expect(result.thieuIds).toEqual(['1']);
  });

  it('không dùng nhà dịch ngoài hai model khi dịch văn bản', async () => {
    vi.mocked(gemini35.translate).mockResolvedValue({
      text: null,
      lyDoLoi: 'ai_error',
      provider: 'gemini',
      model: gemini35.modelName,
    });
    vi.mocked(gemini31.translate).mockResolvedValue({
      text: 'bản dịch',
      lyDoLoi: null,
      provider: 'gemini',
      model: gemini31.modelName,
    });
    const result = await service.dichVanBan('text');
    expect(result.banDich).toBe('bản dịch');
  });

  it('che và khôi phục mã inline, URL đúng sau khi model còn lại dịch thành công', async () => {
    vi.mocked(gemini31.translate).mockResolvedValue({
      text: null,
      lyDoLoi: 'ai_error',
      provider: 'gemini',
      model: gemini31.modelName,
    });
    vi.mocked(gemini35.translate).mockImplementation(async (masked) => {
      expect(masked).toContain('⟦C1⟧');
      expect(masked).toContain('⟦C2⟧');
      expect(masked).not.toContain('git status');
      return {
        text: 'Xem ⟦C1⟧ tại ⟦C2⟧',
        lyDoLoi: null,
        provider: 'gemini',
        model: gemini35.modelName,
      };
    });

    const result = await service.dichVanBan('Run `git status` at https://github.com/test');
    expect(result.thanhCong).toBe(true);
    expect(result.banDich).toBe('Xem `git status` tại https://github.com/test');
  });

  it('trả null khi cả hai model lỗi, không lấy nguyên văn làm bản dịch', async () => {
    for (const provider of [gemini31, gemini35]) {
      vi.mocked(provider.translate).mockResolvedValue({
        text: null,
        lyDoLoi: 'ai_error',
        provider: 'gemini',
        model: provider.modelName,
      });
    }
    const result = await service.dichVanBan('Original English text');
    expect(result.thanhCong).toBe(false);
    expect(result.banDich).toBeNull();
  });

  it('chia batch theo kích thước, giữ toàn bộ kết quả từ hai model', async () => {
    vi.mocked(gemini31.translateBatchJson!).mockResolvedValue({
      data: { a: 'Bản dịch A', b: 'Bản dịch B' },
      lyDoLoi: null,
      provider: 'gemini',
      model: gemini31.modelName,
    });
    vi.mocked(gemini35.translateBatchJson!).mockResolvedValue({
      data: { c: 'Bản dịch C' },
      lyDoLoi: null,
      provider: 'gemini',
      model: gemini35.modelName,
    });
    const result = await service.dichGomLoJson(
      [
        { id: 'a', text: 'Text A' },
        { id: 'b', text: 'Text B' },
        { id: 'c', text: 'Text C' },
      ],
      { batchSize: 2 },
    );
    expect(result.thanhCong).toBe(true);
    expect(result.ketQua).toEqual({ a: 'Bản dịch A', b: 'Bản dịch B', c: 'Bản dịch C' });
    expect(gemini31.translateBatchJson).toHaveBeenCalledTimes(1);
    expect(gemini35.translateBatchJson).toHaveBeenCalledTimes(1);
  });
});

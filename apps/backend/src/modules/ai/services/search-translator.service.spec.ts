import { describe, expect, it, vi } from 'vitest';
import { SearchTranslatorService } from './search-translator.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../redis/cache.service';

describe('SearchTranslatorService (P2-42)', () => {
  const mockConfigService = {
    get: vi.fn((key: string, defaultVal?: string) => {
      if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
      if (key === 'GEMINI_MODEL') return 'gemini-2.0-flash';
      return defaultVal;
    }),
  } as unknown as ConfigService;

  const mockCacheStore = new Map<string, unknown>();
  const mockCacheService = {
    lay: vi.fn(async (key: string) => mockCacheStore.get(key) ?? null),
    dat: vi.fn(async (key: string, val: unknown) => {
      mockCacheStore.set(key, val);
    }),
  } as unknown as CacheService;

  it('1. ghepQueryAnToan: chỉ sử dụng các qualifier trong whitelist an toàn', () => {
    const service = new SearchTranslatorService(mockConfigService, mockCacheService);

    const query = service.ghepQueryAnToan({
      tuKhoa: ['video', 'player'],
      topics: ['video-player', 'adblock'],
      ngonNgu: 'rust',
    });

    expect(query).toBe(
      'video player topic:video-player topic:adblock language:rust stars:>=10 archived:false',
    );
  });

  it('2. ghepQueryAnToan: loại bỏ các ký tự đặc biệt có nguy cơ injection', () => {
    const service = new SearchTranslatorService(mockConfigService, mockCacheService);

    const query = service.ghepQueryAnToan({
      tuKhoa: ['notes; DROP TABLE', 'markdown'],
      topics: ['notes/injection', 'security'],
      ngonNgu: 'c++',
    });

    // Các ký tự không an toàn như ; và / bị làm sạch
    expect(query).toContain('notesDROPTABLE');
    expect(query).toContain('topic:notesinjection');
    expect(query).toContain('stars:>=10');
    expect(query).toContain('archived:false');
    expect(query).not.toContain('DROP TABLE');
  });

  it('3. fallbackTuKhoa: loại bỏ stop-words tiếng Việt cơ bản', () => {
    const service = new SearchTranslatorService(mockConfigService, mockCacheService);

    const fallback = (
      service as unknown as { fallbackTuKhoa: (q: string) => { tuKhoa: string[] } }
    ).fallbackTuKhoa('app xem phim không quảng cáo');

    expect(fallback.tuKhoa).toContain('xem');
    expect(fallback.tuKhoa).toContain('phim');
    expect(fallback.tuKhoa).toContain('quảng');
    expect(fallback.tuKhoa).toContain('cáo');
    expect(fallback.tuKhoa).not.toContain('app');
    expect(fallback.tuKhoa).not.toContain('không');
  });

  it('4. dichCauTimKiem: lấy từ cache 24h nếu đã từng được dịch trước đó', async () => {
    const service = new SearchTranslatorService(mockConfigService, mockCacheService);

    // Nạp sẵn vào mockCacheStore
    const fakeData = {
      tuKhoa: ['markdown', 'editor'],
      topics: ['notes', 'markdown'],
    };

    // Gọi lần đầu sẽ ghi cache hoặc đọc cache
    mockCacheStore.clear();
    // Giả lập cache hit
    vi.spyOn(mockCacheService, 'lay').mockResolvedValueOnce(fakeData);

    const res = await service.dichCauTimKiem('trình ghi chú markdown');
    expect(res).toEqual(fakeData);
    expect(mockCacheService.lay).toHaveBeenCalled();
  });
});

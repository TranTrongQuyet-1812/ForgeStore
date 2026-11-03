import { describe, expect, it, vi } from 'vitest';
import { SearchTranslatorService } from './search-translator.service';
import { CacheService } from '../../redis/cache.service';
import { NvidiaTranslationProvider } from '../translation/providers/nvidia-translation.provider';
import { CloudflareTranslationProvider } from '../translation/providers/cloudflare-translation.provider';
import { GroqTranslationProvider } from '../translation/providers/groq-translation.provider';

describe('SearchTranslatorService', () => {
  const cache = {
    lay: vi.fn().mockResolvedValue(null),
    dat: vi.fn().mockResolvedValue(undefined),
  } as unknown as CacheService;

  function taoDichVu(
    ketQuaNvidia: string | null,
    ketQuaCloudflare: string | null,
    ketQuaGroq: string | null = null,
  ) {
    const nvidia = {
      providerName: 'nvidia',
      isAvailable: vi.fn().mockReturnValue(true),
      translateSearchJson: vi.fn().mockResolvedValue(ketQuaNvidia),
    } as unknown as NvidiaTranslationProvider;
    const cloudflare = {
      providerName: 'cloudflare',
      isAvailable: vi.fn().mockReturnValue(true),
      translateSearchJson: vi.fn().mockResolvedValue(ketQuaCloudflare),
    } as unknown as CloudflareTranslationProvider;
    const groq = {
      providerName: 'groq',
      isAvailable: vi.fn().mockReturnValue(true),
      translateSearchJson: vi.fn().mockResolvedValue(ketQuaGroq),
    } as unknown as GroqTranslationProvider;
    return {
      service: new SearchTranslatorService(nvidia, cloudflare, groq, cache),
      nvidia,
      cloudflare,
      groq,
    };
  }

  it('chỉ dùng thứ tự NVIDIA → Cloudflare → Groq, không gọi Gemini', async () => {
    const { service, nvidia, cloudflare, groq } = taoDichVu(
      null,
      null,
      '{"tuKhoa":["markdown"],"topics":[]}',
    );
    await expect(service.dichCauTimKiem('trình ghi chú')).resolves.toEqual({
      tuKhoa: ['markdown'],
      topics: [],
    });
    expect(nvidia.translateSearchJson).toHaveBeenCalledOnce();
    expect(cloudflare.translateSearchJson).toHaveBeenCalledOnce();
    expect(groq.translateSearchJson).toHaveBeenCalledOnce();
  });

  it('dừng ở nhà dịch đầu tiên trả JSON hợp lệ và giữ cache 24 giờ', async () => {
    const { service, nvidia, cloudflare } = taoDichVu('{"tuKhoa":["editor"],"topics":[]}', null);
    await expect(service.dichCauTimKiem('trình soạn thảo')).resolves.toEqual({
      tuKhoa: ['editor'],
      topics: [],
    });
    expect(nvidia.translateSearchJson).toHaveBeenCalledOnce();
    expect(cloudflare.translateSearchJson).not.toHaveBeenCalled();
    expect(cache.dat).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 86400);
  });

  it('chỉ ghép qualifier GitHub trong danh sách an toàn', () => {
    const { service } = taoDichVu(null, null);
    expect(
      service.ghepQueryAnToan({ tuKhoa: ['notes; DROP TABLE'], topics: ['markdown/editor'] }),
    ).toBe('notesDROPTABLE topic:markdowneditor stars:>=100 archived:false');
  });

  it('dùng fallback từ khóa khi cả ba nhà dịch đều lỗi', async () => {
    const { service } = taoDichVu(null, null);
    await expect(service.dichCauTimKiem('ứng dụng ghi chú miễn phí')).resolves.toEqual({
      tuKhoa: ['ghi', 'chú'],
      topics: [],
    });
  });
});

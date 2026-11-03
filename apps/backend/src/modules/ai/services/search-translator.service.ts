import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from '../../redis/cache.service';
import { NvidiaTranslationProvider } from '../translation/providers/nvidia-translation.provider';
import { CloudflareTranslationProvider } from '../translation/providers/cloudflare-translation.provider';
import { GroqTranslationProvider } from '../translation/providers/groq-translation.provider';
import {
  PROMPT_SEARCH_TRANSLATOR_SYSTEM,
  taoPromptDichTimKiem,
} from '../prompts/search-translator.prompt';
import { KetQuaDichTimKiem, KetQuaDichTimKiemSchema } from '../dto/search-translator.dto';

@Injectable()
export class SearchTranslatorService {
  private readonly logger = new Logger(SearchTranslatorService.name);
  private readonly providers: Array<
    NvidiaTranslationProvider | CloudflareTranslationProvider | GroqTranslationProvider
  >;

  constructor(
    nvidiaProvider: NvidiaTranslationProvider,
    cloudflareProvider: CloudflareTranslationProvider,
    groqProvider: GroqTranslationProvider,
    private readonly cacheService: CacheService,
  ) {
    // Thứ tự do Chủ chốt 03/11/2026: NVIDIA kém ổn định nên đứng cuối chuỗi.
    this.providers = [cloudflareProvider, groqProvider, nvidiaProvider];
  }

  /**
   * Dịch câu tìm kiếm tiếng Việt sang từ khóa và chủ đề GitHub (P2-42.1)
   * Có bộ đệm Redis/Memory 24 giờ (86.400s) theo P2-42.3.
   */
  async dichCauTimKiem(cauTruyVan: string): Promise<KetQuaDichTimKiem> {
    const cleanQuery = cauTruyVan.trim().toLowerCase();
    if (!cleanQuery) {
      return { tuKhoa: [], topics: [] };
    }

    // Kiểm tra cache 24h (P2-42.3)
    const hash = crypto.createHash('md5').update(cleanQuery).digest('hex');
    const cacheKey = `fs:search:translate:${hash}`;
    const cached = await this.cacheService.lay<KetQuaDichTimKiem>(cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = taoPromptDichTimKiem(cleanQuery);
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        const rawJson = await provider.translateSearchJson(prompt, PROMPT_SEARCH_TRANSLATOR_SYSTEM);
        const parsed = this.kiemTraKetQua(rawJson);
        if (!parsed) continue;
        await this.cacheService.dat(cacheKey, parsed, 86400);
        return parsed;
      } catch (err: unknown) {
        this.logger.warn(
          `Nhà dịch tìm kiếm [${provider.providerName}] gặp lỗi; thử nhà tiếp theo: ${(err as Error).message}`,
        );
      }
    }
    return this.fallbackTuKhoa(cleanQuery);
  }

  private kiemTraKetQua(rawJson: string | null): KetQuaDichTimKiem | null {
    if (!rawJson) return null;
    try {
      const parsed = KetQuaDichTimKiemSchema.safeParse(JSON.parse(rawJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Ghép chuỗi truy vấn GitHub an toàn từ kết quả dịch (P2-42.2).
   * CHỈ sử dụng whitelist qualifier: topic:, language:, stars:>=100, archived:false.
   * Ngăn chặn hoàn toàn prompt injection.
   */
  ghepQueryAnToan(dich: KetQuaDichTimKiem): string {
    const parts: string[] = [];

    // 1. Từ khóa chính (làm sạch ký tự đặc biệt)
    for (const kw of dich.tuKhoa) {
      const sanitized = kw.replace(/[^a-zA-Z0-9_-]/g, '').trim();
      if (sanitized) {
        parts.push(sanitized);
      }
    }

    // 2. Topics (whitelist "topic:...")
    for (const top of dich.topics) {
      const sanitized = top
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .trim()
        .toLowerCase();
      if (sanitized) {
        parts.push(`topic:${sanitized}`);
      }
    }

    // 3. Ngôn ngữ nếu có (whitelist "language:...")
    if (dich.ngonNgu) {
      const sanitized = dich.ngonNgu
        .replace(/[^a-zA-Z0-9_#+-]/g, '')
        .trim()
        .toLowerCase();
      if (sanitized) {
        parts.push(`language:${sanitized}`);
      }
    }

    // 4. Tiêu chí bắt buộc bảo vệ chất lượng repo (stars >= 100 để bỏ repo vãng lai ít người dùng, chưa bị lưu trữ)
    parts.push('stars:>=100');
    parts.push('archived:false');

    return parts.join(' ');
  }

  /**
   * Phương thức tích hợp trọn gói: Dịch câu tìm kiếm và ghép thành GitHub Search query.
   */
  async dichVaGhepQuery(cauTruyVan: string): Promise<string> {
    const ketQuaDich = await this.dichCauTimKiem(cauTruyVan);
    return this.ghepQueryAnToan(ketQuaDich);
  }

  /**
   * Thuật toán dự phòng offline khi không có LLM:
   * Loại bỏ các từ dừng (stop-words) tiếng Việt và giữ lại các từ cốt lõi.
   */
  private fallbackTuKhoa(q: string): KetQuaDichTimKiem {
    const stopWords = new Set([
      'app',
      'ung',
      'dung',
      'ứng',
      'dụng',
      'phan',
      'mem',
      'phần',
      'mềm',
      'trinh',
      'trình',
      'cong',
      'cu',
      'công',
      'cụ',
      'cho',
      'tren',
      'trên',
      'khong',
      'không',
      'co',
      'có',
      'va',
      'và',
      'tot',
      'tốt',
      'nhat',
      'nhất',
      'nhanh',
      'de',
      'để',
      'mien',
      'phi',
      'miễn',
      'phí',
      'moi',
      'mới',
    ]);

    const words = q
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()));

    const tuKhoa = words.slice(0, 4);
    if (tuKhoa.length === 0) {
      tuKhoa.push(q.trim().slice(0, 30));
    }

    return {
      tuKhoa,
      topics: [],
    };
  }
}

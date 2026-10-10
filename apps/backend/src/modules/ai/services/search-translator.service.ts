import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import * as crypto from 'crypto';
import { CacheService } from '../../redis/cache.service';
import {
  PROMPT_SEARCH_TRANSLATOR_SYSTEM,
  taoPromptDichTimKiem,
} from '../prompts/search-translator.prompt';
import { KetQuaDichTimKiem, KetQuaDichTimKiemSchema } from '../dto/search-translator.dto';

@Injectable()
export class SearchTranslatorService {
  private readonly logger = new Logger(SearchTranslatorService.name);
  private readonly client: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

    if (apiKey && apiKey.trim() && !apiKey.startsWith('your_')) {
      try {
        this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.logger.log(`SearchTranslatorService khởi tạo với model [${this.modelName}]`);
      } catch (err) {
        this.logger.error('Lỗi khởi tạo GoogleGenAI cho SearchTranslator:', err);
      }
    } else {
      this.logger.warn('GEMINI_API_KEY chưa cấu hình. Sẽ dùng fallback từ khóa.');
    }
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

    // Nếu không có Gemini client, dùng giải pháp dự phòng
    if (!this.client) {
      return this.fallbackTuKhoa(cleanQuery);
    }

    try {
      const prompt = taoPromptDichTimKiem(cleanQuery);
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: PROMPT_SEARCH_TRANSLATOR_SYSTEM,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const rawJson = response.text?.trim() || '{}';
      let parsedObj: unknown;
      try {
        parsedObj = JSON.parse(rawJson);
      } catch {
        this.logger.warn(`Gemini trả JSON không hợp lệ: [${rawJson.slice(0, 100)}]`);
        return this.fallbackTuKhoa(cleanQuery);
      }

      const parseResult = KetQuaDichTimKiemSchema.safeParse(parsedObj);
      if (!parseResult.success) {
        this.logger.warn(`Zod validate thất bại cho kết quả dịch: ${parseResult.error.message}`);
        return this.fallbackTuKhoa(cleanQuery);
      }

      const ketQua = parseResult.data;

      // Lưu cache 24h (86.400s)
      await this.cacheService.dat(cacheKey, ketQua, 86400);

      return ketQua;
    } catch (err: unknown) {
      this.logger.warn(
        `Lỗi khi gọi Gemini dịch tìm kiếm: ${(err as Error).message}. Dùng fallback.`,
      );
      return this.fallbackTuKhoa(cleanQuery);
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { KetQuaChangelog, KetQuaChangelogSchema } from '../dto/ai-summary.dto';
import { HuongDanCaiDatAiSchema } from '../dto/cli-guide.dto';
import { INhaCungCapTomTat, TenNhaCungCap } from '../interfaces/llm-provider.interface';
import { taoPromptTomTatChangelog } from '../prompts/changelog-summary.prompt';
import { taoPromptHuongDanCaiDat } from '../prompts/cli-guide.prompt';
import { locVaChuanHoaHuongDanCaiDat } from '../tien-ich/cli-guide-extractor.util';
import type { HuongDanCaiDatDto } from '@forgestore/types';

@Injectable()
export class GeminiProvider implements INhaCungCapTomTat {
  private readonly logger = new Logger(GeminiProvider.name);
  public readonly ten: TenNhaCungCap = 'GEMINI';
  public readonly tenModel: string;
  private readonly client: GoogleGenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.tenModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

    if (apiKey && apiKey.trim() && !apiKey.startsWith('your_')) {
      try {
        this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.logger.log(`GeminiProvider khởi tạo thành công với model [${this.tenModel}]`);
      } catch (err) {
        this.logger.error('Lỗi khởi tạo GoogleGenAI client:', err);
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY chưa được cấu hình. GeminiProvider sẽ báo lỗi khi được gọi.',
      );
    }
  }

  /**
   * Tóm tắt Changelog bản phát hành (P2-34).
   */
  async tomTatChangelog(changelog: string, repoName: string): Promise<KetQuaChangelog> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY không khả dụng.');
    }

    const prompt = taoPromptTomTatChangelog(repoName, changelog);
    const rawJson = await this.goiGemini(prompt);
    const parsed = JSON.parse(rawJson);
    return KetQuaChangelogSchema.parse(parsed);
  }

  /**
   * Trích xuất hướng dẫn cài đặt qua dòng lệnh (CLI) từ README (Phase 3).
   */
  async trichXuatHuongDanCaiDat(
    installSection: string,
    repoName: string,
    rawReadme: string,
    duongDanReadmeGoc?: string,
  ): Promise<HuongDanCaiDatDto | null> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY không khả dụng.');
    }

    const prompt = taoPromptHuongDanCaiDat(repoName, installSection);

    try {
      const rawJson = await this.goiGemini(prompt);
      const parsed = JSON.parse(rawJson);
      const validated = HuongDanCaiDatAiSchema.parse(parsed);

      return locVaChuanHoaHuongDanCaiDat(validated, rawReadme, duongDanReadmeGoc);
    } catch (err: unknown) {
      if (this.laLoiRateLimit(err)) {
        throw err;
      }
      this.logger.warn(
        `Lỗi Gemini bóc tách hướng dẫn CLI [${repoName}]: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Gọi mô hình Gemini với timeout và cấu hình JSON output.
   */
  private async goiGemini(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Client Gemini chưa được cấu hình.');
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.tenModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text || !text.trim()) {
        throw new Error('Gemini trả về chuỗi rỗng.');
      }

      return text.trim();
    } catch (err: unknown) {
      const msg = (err as Error).message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        const error = new Error(`Gemini chạm giới hạn hạn mức (429): ${msg}`);
        (error as unknown as { status: number }).status = 429;
        throw error;
      }
      throw err;
    }
  }

  private laLoiRateLimit(err: unknown): boolean {
    const error = err as { status?: number; message?: string };
    return (
      error.status === 429 ||
      Boolean(error.message?.includes('429')) ||
      Boolean(error.message?.includes('RESOURCE_EXHAUSTED'))
    );
  }
}

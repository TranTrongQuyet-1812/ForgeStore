import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  KetQuaChangelog,
  KetQuaChangelogSchema,
  KetQuaTomTat,
  KetQuaTomTatSchema,
} from '../dto/ai-summary.dto';
import { INhaCungCapTomTat, TenNhaCungCap } from '../interfaces/llm-provider.interface';
import { taoPromptTomTatReadme } from '../prompts/readme-summary.prompt';
import { taoPromptTomTatChangelog } from '../prompts/changelog-summary.prompt';
import { kiemTraTrichDanHopLe, lamSachReadme } from '../utils/readme-cleaner.util';

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
   * Tóm tắt README thành JSON có cấu trúc (P2-30).
   */
  async tomTatReadme(readme: string, repoName: string): Promise<KetQuaTomTat> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY không khả dụng.');
    }

    const cleanedReadme = lamSachReadme(readme);
    const prompt = taoPromptTomTatReadme(repoName, cleanedReadme);

    // Thử gọi Gemini tối đa 2 lần nếu gặp lỗi parse JSON
    let lastError: Error | null = null;
    for (let lanThu = 1; lanThu <= 2; lanThu++) {
      try {
        const rawJson = await this.goiGemini(prompt);
        const parsed = JSON.parse(rawJson);
        const validated = KetQuaTomTatSchema.parse(parsed);

        // Code-check không dùng AI: kiểm tra trích dẫn nguyên văn (P2-30.8)
        const tinhNangHopLe = kiemTraTrichDanHopLe(validated.tinhNang, readme);

        if (tinhNangHopLe.length === 0) {
          throw new Error(
            `Không có tính năng nào có trích dẫn khớp với README cho repo [${repoName}]`,
          );
        }

        return {
          khauHieu: validated.khauHieu,
          tinhNang: tinhNangHopLe,
        };
      } catch (err: unknown) {
        lastError = err as Error;
        this.logger.warn(
          `Lần thử ${lanThu} tóm tắt README [${repoName}] thất bại: ${lastError.message}`,
        );
        if (this.laLoiRateLimit(lastError)) {
          // Bắn lỗi 429 để Bộ Xoay Tua bắt được và chuyển sang NVIDIA NIM
          throw lastError;
        }
      }
    }

    throw lastError || new Error(`Tóm tắt README thất bại cho repo [${repoName}]`);
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

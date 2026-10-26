import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  ITranslationProvider,
  KetQuaDichDoan,
  NhaCungCapDich,
} from '../interfaces/translation-provider.interface';
import { BAN_DICH_SYSTEM_PROMPT, taoPromptDich } from '../prompts/translation.prompt';
import { StructureValidator } from '../tien-ich/structure-validator.util';
import { sanitizeLogMessage } from '../tien-ich/log-sanitizer.util';
import { LlmRateLimiterService } from '../../services/llm-rate-limiter.service';
import { phanTichKetQuaBatchJson, phanLoaiLoiBatchJson } from '../tien-ich/batch-translation.util';

@Injectable()
export class GeminiTranslationProvider implements ITranslationProvider {
  private readonly logger = new Logger(GeminiTranslationProvider.name);
  public readonly providerName: NhaCungCapDich = 'gemini';
  public readonly modelName: string;
  private readonly client: GoogleGenAI | null = null;
  private readonly apiKeyConfigured: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly rateLimiterService?: LlmRateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    // P3B-05.6 / Mục 3: Khớp tên biến GEMINI_MODEL trong .env.example
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

    if (apiKey && apiKey.trim() && !apiKey.startsWith('your_')) {
      try {
        this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.apiKeyConfigured = true;
        this.logger.log(`GeminiTranslationProvider đã khởi tạo với model [${this.modelName}]`);
      } catch (err) {
        this.logger.error(
          sanitizeLogMessage(`Lỗi khởi tạo GoogleGenAI cho dịch thuật: ${(err as Error).message}`),
        );
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY chưa được cấu hình. GeminiTranslationProvider sẽ ở trạng thái không khả dụng.',
      );
    }
  }

  public isAvailable(): boolean {
    return this.apiKeyConfigured && this.client !== null;
  }

  public async checkHealth(): Promise<boolean> {
    return this.isAvailable();
  }

  public async translate(text: string, options?: { timeoutMs?: number }): Promise<KetQuaDichDoan> {
    const startTime = Date.now();
    if (!this.isAvailable() || !this.client) {
      return {
        text: null,
        lyDoLoi: 'not_configured',
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: 0,
      };
    }

    if (!text || text.trim() === '') {
      return {
        text: '',
        lyDoLoi: null,
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: 0,
      };
    }

    // P3B-04.4 / Mục 6: Đồng bộ hạn mức Token Bucket qua LlmRateLimiterService (D-15/P2-39)
    if (this.rateLimiterService) {
      const tokenResult = await this.rateLimiterService.layToken('gemini');
      if (!tokenResult.chapNhan) {
        const waitSec = Math.ceil((tokenResult.thoiGianChoMs || 5000) / 1000);
        this.logger.warn(`Gemini bị chặn bởi Token Bucket Rate Limiter (cần chờ ${waitSec}s)`);
        return {
          text: null,
          lyDoLoi: 'rate_limited',
          retryAfterSec: waitSec,
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }
    }

    const timeoutMs = options?.timeoutMs ?? 45_000;

    try {
      // P3B-05.14 / Mục 9: Tắt chế độ suy nghĩ (thinkingBudget: 0) để dịch phản hồi nhanh tức thì
      const callPromise = this.client.models.generateContent({
        model: this.modelName,
        contents: taoPromptDich(text),
        config: {
          systemInstruction: BAN_DICH_SYSTEM_PROMPT,
          temperature: 0.1,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      let timeoutTimer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          const timeoutErr = new Error('TIMEOUT');
          (timeoutErr as unknown as { code: string }).code = 'TIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
      });

      const response = await Promise.race([callPromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutTimer);
      });

      // Mục 2: Kiểm tra bản dịch bị cắt cụt do chạm giới hạn token (finishReason === 'MAX_TOKENS')
      const candidate = (response as { candidates?: Array<{ finishReason?: string }> })
        ?.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        this.logger.warn(
          `Gemini dịch bị cắt cụt do chạm giới hạn token (finishReason === 'MAX_TOKENS')`,
        );
        return {
          text: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const rawText = StructureValidator.extractText(response);
      const cleaned = StructureValidator.cleanOutput(rawText, text);

      if (!cleaned || cleaned.trim() === '') {
        return {
          text: null,
          lyDoLoi: 'empty_output',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const problem = StructureValidator.findStructureProblem(text, cleaned);
      if (problem) {
        return {
          text: null,
          lyDoLoi: problem,
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      return {
        text: cleaned,
        lyDoLoi: null,
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const error = err as { code?: string; message?: string; status?: number };
      const errMsg = error.message || '';

      if (error.code === 'TIMEOUT' || errMsg.includes('TIMEOUT')) {
        this.logger.warn(`Gemini dịch thất bại: Hết thời gian chờ (${timeoutMs}ms)`);
        return {
          text: null,
          lyDoLoi: 'timeout',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: duration,
        };
      }

      if (error.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        this.logger.warn('Gemini chạm hạn mức (429 / RESOURCE_EXHAUSTED)');
        return {
          text: null,
          lyDoLoi: 'rate_limited',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: duration,
        };
      }

      this.logger.warn(sanitizeLogMessage(`Gemini dịch gặp lỗi: ${errMsg}`));
      return {
        text: null,
        lyDoLoi: 'ai_error',
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: duration,
      };
    }
  }

  /**
   * P3B-04: Dịch gom lô JSON danh sách mô tả app qua Gemini với responseMimeType = application/json.
   */
  public async translateBatchJson(
    items: Array<{ id: string; text: string }>,
    options?: { timeoutMs?: number },
  ): Promise<import('../interfaces/translation-provider.interface').KetQuaDichBatchJson> {
    const startTime = Date.now();
    if (!this.isAvailable() || !this.client) {
      return {
        data: null,
        lyDoLoi: 'not_configured',
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: 0,
      };
    }

    if (!items || items.length === 0) {
      return {
        data: {},
        lyDoLoi: null,
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: 0,
      };
    }

    if (this.rateLimiterService) {
      const tokenResult = await this.rateLimiterService.layToken('gemini');
      if (!tokenResult.chapNhan) {
        const waitSec = Math.ceil((tokenResult.thoiGianChoMs || 5000) / 1000);
        this.logger.warn(
          `Gemini gom lô bị chặn bởi Token Bucket Rate Limiter (cần chờ ${waitSec}s)`,
        );
        return {
          data: null,
          lyDoLoi: 'rate_limited',
          retryAfterSec: waitSec,
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }
    }

    const timeoutMs = options?.timeoutMs ?? 45_000;
    const { DICH_MO_TA_SYSTEM_PROMPT, taoPromptDichGomLo } =
      await import('../prompts/translation.prompt');

    try {
      const callPromise = this.client.models.generateContent({
        model: this.modelName,
        contents: taoPromptDichGomLo(items),
        config: {
          systemInstruction: DICH_MO_TA_SYSTEM_PROMPT,
          temperature: 0.1,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      let timeoutTimer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          const timeoutErr = new Error('TIMEOUT');
          (timeoutErr as unknown as { code: string }).code = 'TIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
      });

      const response = await Promise.race([callPromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutTimer);
      });

      const candidate = (response as { candidates?: Array<{ finishReason?: string }> })
        ?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const rawText = StructureValidator.extractText(response);

      return phanTichKetQuaBatchJson(
        rawText,
        this.providerName,
        this.modelName,
        Date.now() - startTime,
        finishReason,
      );
    } catch (err: unknown) {
      return phanLoaiLoiBatchJson(
        err,
        this.providerName,
        this.modelName,
        Date.now() - startTime,
        timeoutMs,
      );
    }
  }
}

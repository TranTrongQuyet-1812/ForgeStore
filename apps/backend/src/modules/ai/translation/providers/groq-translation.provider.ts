import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITranslationProvider,
  KetQuaDichDoan,
  NhaCungCapDich,
} from '../interfaces/translation-provider.interface';
import { BAN_DICH_SYSTEM_PROMPT, taoPromptDich } from '../prompts/translation.prompt';
import { StructureValidator } from '../tien-ich/structure-validator.util';
import { sanitizeLogMessage } from '../tien-ich/log-sanitizer.util';
import { phanTichKetQuaBatchJson, phanLoaiLoiBatchJson } from '../tien-ich/batch-translation.util';

@Injectable()
export class GroqTranslationProvider implements ITranslationProvider {
  private readonly logger = new Logger(GroqTranslationProvider.name);
  public readonly providerName: NhaCungCapDich = 'groq';
  public readonly modelName: string;
  private readonly apiKey: string | null = null;
  private readonly apiUrl: string = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('GROQ_API_KEY');
    // P3B-05.6 / Mục 3: Khớp tên biến GROQ_MODEL trong .env.example
    this.modelName = this.configService.get<string>('GROQ_MODEL') || 'qwen/qwen3.8-27b';

    if (key && key.trim() && !key.startsWith('your_')) {
      this.apiKey = key.trim();
      this.logger.log(`GroqTranslationProvider đã khởi tạo với model [${this.modelName}]`);
    } else {
      this.logger.warn(
        'GROQ_API_KEY chưa được cấu hình. GroqTranslationProvider sẽ ở trạng thái không khả dụng.',
      );
    }
  }

  public isAvailable(): boolean {
    return this.apiKey !== null;
  }

  public async checkHealth(): Promise<boolean> {
    return this.isAvailable();
  }

  public async translate(text: string, options?: { timeoutMs?: number }): Promise<KetQuaDichDoan> {
    const startTime = Date.now();
    if (!this.isAvailable() || !this.apiKey) {
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

    const timeoutMs = options?.timeoutMs ?? 45_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: BAN_DICH_SYSTEM_PROMPT },
            { role: 'user', content: taoPromptDich(text) },
          ],
          temperature: 0.1,
          max_tokens: 4096,
          // P3B-05.14: Tắt chế độ suy luận để không tốn hạn mức output token và không làm rỗng kết quả
          reasoning_effort: 'none',
        }),
        signal: controller.signal,
      });

      // P3B-05.14: Xử lý 429 và trích xuất header retry-after chuẩn xác cho Groq
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const parsedSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        const retryAfterSec = Number.isFinite(parsedSec) && parsedSec > 0 ? parsedSec : 60;

        this.logger.warn(`Groq chạm hạn mức (429). Thời gian chờ yêu cầu: ${retryAfterSec}s`);
        return {
          text: null,
          lyDoLoi: 'rate_limited',
          retryAfterSec,
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.warn(sanitizeLogMessage(`Groq trả về HTTP ${response.status}: ${errText}`));
        return {
          text: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const json = (await response.json()) as Record<string, unknown>;

      // Mục 2: Kiểm tra bản dịch bị cắt cụt do chạm trần max_tokens (finish_reason === 'length')
      const choices =
        (json.choices as Array<{ message?: { content?: string }; finish_reason?: string }>) ?? [];
      const finishReason = choices[0]?.finish_reason;
      if (finishReason === 'length') {
        this.logger.warn(
          `Groq dịch bị cắt cụt do chạm giới hạn token (finish_reason === 'length')`,
        );
        return {
          text: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const rawText = StructureValidator.extractText(json);
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
      const error = err as { name?: string; message?: string };

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        this.logger.warn(`Groq dịch thất bại: Hết thời gian chờ (${timeoutMs}ms)`);
        return {
          text: null,
          lyDoLoi: 'timeout',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: duration,
        };
      }

      this.logger.warn(sanitizeLogMessage(`Groq dịch gặp lỗi: ${error.message}`));
      return {
        text: null,
        lyDoLoi: 'ai_error',
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: duration,
      };
    } finally {
      // P3B-05.14 / Mục 5: Bao trùm cả giai đoạn response.json(), chỉ hủy timer trong finally
      clearTimeout(timeoutId);
    }
  }

  /**
   * P3B-04: Dịch gom lô JSON danh sách mô tả app qua Groq với response_format = json_object.
   */
  public async translateBatchJson(
    items: Array<{ id: string; text: string }>,
    options?: { timeoutMs?: number },
  ): Promise<import('../interfaces/translation-provider.interface').KetQuaDichBatchJson> {
    const startTime = Date.now();
    if (!this.isAvailable() || !this.apiKey) {
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

    const timeoutMs = options?.timeoutMs ?? 45_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const { DICH_MO_TA_SYSTEM_PROMPT, taoPromptDichGomLo } =
      await import('../prompts/translation.prompt');

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: DICH_MO_TA_SYSTEM_PROMPT },
            { role: 'user', content: taoPromptDichGomLo(items) },
          ],
          temperature: 0.1,
          max_tokens: 4096,
          reasoning_effort: 'none',
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const parsedSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        const retryAfterSec = Number.isFinite(parsedSec) && parsedSec > 0 ? parsedSec : 60;

        this.logger.warn(`Groq gom lô chạm hạn mức (429). Chờ: ${retryAfterSec}s`);
        return {
          data: null,
          lyDoLoi: 'rate_limited',
          retryAfterSec,
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.warn(
          sanitizeLogMessage(`Groq gom lô trả về HTTP ${response.status}: ${errText}`),
        );
        return {
          data: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const json = (await response.json()) as Record<string, unknown>;
      const choices =
        (json.choices as Array<{ message?: { content?: string }; finish_reason?: string }>) ?? [];
      const finishReason = choices[0]?.finish_reason;
      const rawContent = choices[0]?.message?.content ?? '';

      return phanTichKetQuaBatchJson(
        rawContent,
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
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

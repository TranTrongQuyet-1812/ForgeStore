import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITranslationProvider,
  KetQuaDichDoan,
  NhaCungCapDich,
} from '../interfaces/translation-provider.interface';
import { BAN_DICH_SYSTEM_PROMPT, taoPromptDich } from '../prompts/translation.prompt';
import { StructureValidator } from '../utils/structure-validator.util';
import { sanitizeLogMessage } from '../utils/log-sanitizer.util';

@Injectable()
export class NvidiaTranslationProvider implements ITranslationProvider {
  private readonly logger = new Logger(NvidiaTranslationProvider.name);
  public readonly providerName: NhaCungCapDich = 'nvidia';
  public readonly modelName: string;
  private readonly apiKey: string | null = null;
  private readonly apiUrl: string = 'https://integrate.api.nvidia.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('NVIDIA_API_KEY');
    // P3B-05.6 / Mục 3: Khớp tên biến NVIDIA_NIM_MODEL trong .env.example
    this.modelName =
      this.configService.get<string>('NVIDIA_NIM_MODEL') || 'google/diffusiongemma-26b-a4b-it';

    if (key && key.trim() && !key.startsWith('your_')) {
      this.apiKey = key.trim();
      this.logger.log(`NvidiaTranslationProvider đã khởi tạo với model [${this.modelName}]`);
    } else {
      this.logger.warn(
        'NVIDIA_API_KEY chưa được cấu hình. NvidiaTranslationProvider sẽ ở trạng thái không khả dụng.',
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
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        this.logger.warn('NVIDIA NIM chạm giới hạn tỷ lệ (429)');
        return {
          text: null,
          lyDoLoi: 'rate_limited',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.warn(
          sanitizeLogMessage(`NVIDIA NIM trả về HTTP ${response.status}: ${errText}`),
        );
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
          `NVIDIA NIM dịch bị cắt cụt do chạm giới hạn token (finish_reason === 'length')`,
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
        this.logger.warn(`NVIDIA NIM dịch thất bại: Hết thời gian chờ (${timeoutMs}ms)`);
        return {
          text: null,
          lyDoLoi: 'timeout',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: duration,
        };
      }

      this.logger.warn(sanitizeLogMessage(`NVIDIA NIM dịch gặp lỗi: ${error.message}`));
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
   * P3B-04: Dịch gom lô JSON danh sách mô tả app qua NVIDIA NIM với response_format = json_object.
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
    const { DICH_MO_TA_SYSTEM_PROMPT, taoPromptDichGomLo, trichXuatJsonTuPhanHoi } =
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
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        this.logger.warn('NVIDIA NIM gom lô chạm giới hạn tỷ lệ (429)');
        return {
          data: null,
          lyDoLoi: 'rate_limited',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.warn(
          sanitizeLogMessage(`NVIDIA NIM gom lô trả về HTTP ${response.status}: ${errText}`),
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
      if (finishReason === 'length') {
        this.logger.warn(
          `NVIDIA NIM gom lô dịch bị cắt cụt do chạm giới hạn token (finish_reason === 'length')`,
        );
        return {
          data: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const rawContent = choices[0]?.message?.content ?? '';
      const parsedJson = trichXuatJsonTuPhanHoi(rawContent);

      if (!parsedJson || Object.keys(parsedJson).length === 0) {
        return {
          data: null,
          lyDoLoi: 'empty_output',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      return {
        data: parsedJson,
        lyDoLoi: null,
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const error = err as { name?: string; message?: string };

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        this.logger.warn(`NVIDIA NIM dịch gom lô thất bại: Hết thời gian chờ (${timeoutMs}ms)`);
        return {
          data: null,
          lyDoLoi: 'timeout',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: duration,
        };
      }

      this.logger.warn(sanitizeLogMessage(`NVIDIA NIM dịch gom lô gặp lỗi: ${error.message}`));
      return {
        data: null,
        lyDoLoi: 'ai_error',
        provider: this.providerName,
        model: this.modelName,
        thoiGianMs: duration,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITranslationProvider,
  KetQuaDichDoan,
  LyDoLoiDich,
  NhaCungCapDich,
} from '../interfaces/translation-provider.interface';
import { sanitizeLogMessage } from '../tien-ich/log-sanitizer.util';

interface CloudflareWorkerResponse {
  success?: boolean;
  model?: string;
  translations?: (string | null)[];
  reasons?: (string | null)[];
  translation?: string | null;
  error?: string | null;
}

@Injectable()
export class CloudflareTranslationProvider implements ITranslationProvider {
  private readonly logger = new Logger(CloudflareTranslationProvider.name);
  public readonly providerName: NhaCungCapDich = 'cloudflare';
  public readonly modelName: string;
  private readonly workerUrl: string | null = null;
  private readonly secret: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('CLOUDFLARE_TRANSLATE_URL');
    const secret = this.configService.get<string>('CLOUDFLARE_TRANSLATE_SECRET');
    this.modelName =
      this.configService.get<string>('CLOUDFLARE_TRANSLATE_MODEL') ||
      '@cf/aisingapore/gemma-sea-lion-v4-27b-it';

    if (url && url.trim() && secret && secret.trim() && !secret.startsWith('your_')) {
      const cleanUrl = url.trim();
      // P3B-05.6 / Mục 1: Đảm bảo nối /translate vào URL gốc của Worker
      this.workerUrl = cleanUrl.endsWith('/translate')
        ? cleanUrl
        : `${cleanUrl.replace(/\/+$/, '')}/translate`;
      this.secret = secret.trim();
      this.logger.log(`CloudflareTranslationProvider đã khởi tạo với model [${this.modelName}]`);
    } else {
      this.logger.warn(
        'CLOUDFLARE_TRANSLATE_URL hoặc CLOUDFLARE_TRANSLATE_SECRET chưa được cấu hình. Provider sẽ không khả dụng.',
      );
    }
  }

  public isAvailable(): boolean {
    return this.workerUrl !== null && this.secret !== null;
  }

  public async checkHealth(): Promise<boolean> {
    return this.isAvailable();
  }

  public async translate(text: string, options?: { timeoutMs?: number }): Promise<KetQuaDichDoan> {
    const startTime = Date.now();
    if (!this.isAvailable() || !this.workerUrl || !this.secret) {
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

    // P3B-05.14 / Mục 8: Đặt hạn thời gian 55 giây (lớn hơn 50 giây của Worker để tránh cả hai cùng timeout)
    const timeoutMs = options?.timeoutMs ?? 55_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ForgeStore-Secret': this.secret,
        },
        body: JSON.stringify({
          text,
          model: this.modelName,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        this.logger.warn('Cloudflare Workers AI chạm hạn mức neuron (429)');
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
          sanitizeLogMessage(`Cloudflare Worker trả về HTTP ${response.status}: ${errText}`),
        );
        return {
          text: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const data = (await response.json()) as CloudflareWorkerResponse;

      if (data.error) {
        return {
          text: null,
          lyDoLoi: 'ai_error',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      const translated = data.translation ?? data.translations?.[0];
      const rawReason = data.reasons?.[0];

      if (translated === null || translated === undefined) {
        let lyDoLoi: LyDoLoiDich = 'ai_error';
        if (
          rawReason === 'timeout' ||
          rawReason === 'placeholders_changed' ||
          rawReason === 'headings_changed' ||
          rawReason === 'table_changed' ||
          rawReason === 'empty_output'
        ) {
          lyDoLoi = rawReason;
        }

        return {
          text: null,
          lyDoLoi,
          provider: this.providerName,
          model: data.model || this.modelName,
          thoiGianMs: Date.now() - startTime,
        };
      }

      return {
        text: translated,
        lyDoLoi: null,
        provider: this.providerName,
        model: data.model || this.modelName,
        thoiGianMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const error = err as { name?: string; message?: string };

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        this.logger.warn(`Cloudflare Worker dịch thất bại: Hết thời gian chờ (${timeoutMs}ms)`);
        return {
          text: null,
          lyDoLoi: 'timeout',
          provider: this.providerName,
          model: this.modelName,
          thoiGianMs: duration,
        };
      }

      this.logger.warn(
        sanitizeLogMessage(`Cloudflare Worker dịch gặp lỗi: ${error.message || 'Unknown error'}`),
      );
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
   * P3B-04 / Lỗi 2: Cloudflare Workers AI chuyên tâm dịch Markdown phân đoạn của README.
   * Không hỗ trợ translateBatchJson để phòng chống prompt injection và tối ưu tài nguyên.
   */
  public async translateBatchJson(
    _items: Array<{ id: string; text: string }>,
    _options?: { timeoutMs?: number },
  ): Promise<import('../interfaces/translation-provider.interface').KetQuaDichBatchJson> {
    return {
      data: null,
      lyDoLoi: 'not_configured',
      provider: this.providerName,
      model: this.modelName,
      thoiGianMs: 0,
    };
  }
}

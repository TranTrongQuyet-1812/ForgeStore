import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';
import { CacheService } from '../../redis/cache.service';

export interface JevNoulCauHoi {
  instruction: string;
  criteria: {
    true: string;
    false: string;
  };
}

@Injectable()
export class JevClientService {
  private readonly logger = new Logger(JevClientService.name);
  public readonly MODEL_PHIEN_BAN = 'jev-1.13.0'; // Ghim phiên bản model (P2-37.2)
  private readonly client: TypeSafeClient | null = null;
  public readonly isEnabled: boolean;

  // Giám sát chi tiêu (P2-37.5, Post-Review #15): ngân sách 5 USD/tháng (~119 triệu tokens)
  private tongTokenInput = 0;
  private tongTokenOutput = 0;
  private readonly CANH_BAO_TOKEN = 95_000_000; // 80% của 119M tokens

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    const apiKey = this.configService.get<string>('TYPESAFE_API_KEY');
    const jevEnabled = this.configService.get<boolean | string>('JEV_ENABLED');
    const isExplicitlyEnabled = jevEnabled === true || jevEnabled === 'true' || jevEnabled === '1';
    this.isEnabled =
      isExplicitlyEnabled && Boolean(apiKey && apiKey.trim() && !apiKey.startsWith('your_'));

    if (this.isEnabled && apiKey) {
      try {
        this.client = new TypeSafeClient({
          apiKey: apiKey.trim(),
          timeout: 2000, // Timeout ngắn 2s theo P2-37.4
        });
        this.logger.log(`JevClientService khởi tạo thành công với model [${this.MODEL_PHIEN_BAN}]`);
      } catch (err) {
        this.logger.error('Lỗi khi khởi tạo TypeSafeClient:', err);
        this.isEnabled = false;
      }
    } else {
      this.logger.warn(
        'TypeSafe AI (Jev) đang bị tắt hoặc chưa cấu hình key. Sẽ dùng luật dự phòng (D-01).',
      );
    }
  }

  /**
   * Hỏi nhiều câu hỏi Noul trong CÙNG MỘT request (Gộp batch request - P2-37.4).
   * Trả về map { [key]: xác suất (0.0 -> 1.0) }.
   */
  async hoiNoulBatch(
    state: Record<string, unknown>,
    questions: Record<string, JevNoulCauHoi>,
  ): Promise<Record<string, number>> {
    if (!this.client || !this.isEnabled) {
      throw new Error('Jev client không khả dụng hoặc bị tắt.');
    }

    const questionMap: Record<string, ReturnType<typeof noul>> = {};
    for (const [key, q] of Object.entries(questions)) {
      questionMap[key] = noul(q.instruction, q.criteria);
    }

    const res = await this.goiWithRetry(state, questionMap);
    const result: Record<string, number> = {};

    for (const [key, ans] of Object.entries(res.answers)) {
      const answerObj = ans as { type: string; noul?: number; value?: number };
      const val = answerObj.noul ?? answerObj.value ?? 0.5;
      result[key] = Math.max(0, Math.min(1, val));
    }

    return result;
  }

  /**
   * Hỏi Jev primitive Choice để giải quyết tên file mơ hồ (P2-33.7 & P2-37.3).
   */
  async hoiChoice(
    state: Record<string, unknown>,
    instruction: string,
    choices: Record<string, string>,
  ): Promise<{ luaChon: string; doTinCay?: number }> {
    if (!this.client || !this.isEnabled) {
      throw new Error('Jev client không khả dụng hoặc bị tắt.');
    }

    const questionMap = {
      chon_file: choice(instruction, choices),
    };

    const res = await this.goiWithRetry(state, questionMap);
    const ans = res.answers['chon_file'] as {
      type: string;
      choice?: string;
      value?: string;
      confidence?: number;
    };

    return {
      luaChon: ans.choice || ans.value || 'KHONG_FILE_NAO_PHU_HOP',
      doTinCay: ans.confidence,
    };
  }

  /**
   * Gọi Jev System 1 với cơ chế thử lại cho 429 và 529, không thử lại 401/422 (P2-37.4).
   */
  private async goiWithRetry(
    state: Record<string, unknown>,
    questions: Record<string, unknown>,
  ): Promise<{
    answers: Record<string, unknown>;
    usage?: { input_tokens?: number; output_tokens?: number };
  }> {
    if (!this.client) {
      throw new Error('Jev client chưa khởi tạo.');
    }

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.systemOne({
          model: this.MODEL_PHIEN_BAN,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state: state as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questions: questions as any,
        });

        // Theo dõi chi tiêu token (P2-37.5, Post-Review #15)
        if (response.usage) {
          const inTokens = response.usage.input_tokens || 0;
          const outTokens = response.usage.output_tokens || 0;
          this.tongTokenInput += inTokens;
          this.tongTokenOutput += outTokens;

          const thangHienTai = new Date().toISOString().slice(0, 7);
          const redisKey = `fs:jev:usage:${thangHienTai}`;
          this.cacheService
            .lay<number>(redisKey)
            .then(async (cur) => {
              const tongMoi = (cur || 0) + inTokens;
              await this.cacheService.dat(redisKey, tongMoi, 86400 * 35);
              if (tongMoi > this.CANH_BAO_TOKEN) {
                this.logger.warn(
                  `⚠️ [Jev Quota Warning] Tổng token Jev đã dùng trong tháng [${thangHienTai}]: ${tongMoi} tokens (vượt 80% ngân sách 5$/tháng ~ 119M tokens)`,
                );
              }
            })
            .catch(() => {});
        }

        return response as {
          answers: Record<string, unknown>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
      } catch (err: unknown) {
        lastError = err as Error;
        const msg = lastError.message || '';
        const status = (lastError as { status?: number }).status;

        // Lỗi 401 và 422: không thử lại, ném ngay (P2-37.4)
        if (status === 401 || status === 422 || msg.includes('401') || msg.includes('422')) {
          this.logger.error(`Jev trả mã lỗi nghiêm trọng [${status}]: ${msg}`);
          throw lastError;
        }

        const isRetryable =
          status === 429 ||
          status === 529 ||
          msg.includes('429') ||
          msg.includes('529') ||
          msg.includes('timeout') ||
          msg.includes('ECONNRESET');

        if (isRetryable && attempt < maxRetries) {
          const waitMs = Math.pow(2, attempt) * 500; // 500ms, 1000ms
          this.logger.warn(
            `Jev lỗi tạm thời (${msg}), thử lại lần ${attempt + 1}/${maxRetries} sau ${waitMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Gọi Jev API thất bại.');
  }

  /**
   * Thống kê tổng số token đã dùng.
   */
  getUsageStats(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.tongTokenInput,
      outputTokens: this.tongTokenOutput,
    };
  }
}

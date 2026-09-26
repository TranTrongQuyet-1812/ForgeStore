import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../redis/cache.service';

export interface TokenBucketState {
  tokens: number;
  lastRefill: number; // Unix timestamp in ms
}

export interface KetQuaCapToken {
  chapNhan: boolean;
  conLai: number;
  capacity: number;
  thoiGianChoMs?: number;
}

@Injectable()
export class LlmRateLimiterService {
  private readonly logger = new Logger(LlmRateLimiterService.name);

  public readonly PREFIX_BUCKET = 'fs:llm:bucket:';

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Lấy mức giới hạn RPM cấu hình cho từng dịch vụ/nhà cung cấp (AI1).
   * Không hard-code, ưu tiên đọc từ biến môi trường.
   */
  layRpm(key: string): number {
    const k = key.toLowerCase();
    if (k.includes('embedding')) {
      return Number(this.configService.get<number>('AI_GEMINI_EMBEDDING_RPM')) || 80;
    }
    if (k.includes('gemini')) {
      return Number(this.configService.get<number>('AI_GEMINI_RPM')) || 12;
    }
    if (k.includes('nvidia') || k.includes('nim')) {
      return Number(this.configService.get<number>('AI_NVIDIA_NIM_RPM')) || 30;
    }
    return 20; // Mặc định an toàn
  }

  /**
   * Thử lấy một token từ Token Bucket trên Redis (AI1).
   * Sử dụng khóa phân tán để đảm bảo tính nguyên tử giữa nhiều instance.
   *
   * @param providerKey Định danh dịch vụ (VD: 'gemini', 'gemini_embedding', 'nvidia_nim')
   * @param timeoutMs Thời gian tối đa cho phép xếp hàng đợi nếu đang hết lượt (ms)
   */
  async layToken(providerKey: string, timeoutMs: number = 0): Promise<KetQuaCapToken> {
    const capacity = this.layRpm(providerKey);
    const refillPerSecond = capacity / 60;
    const bucketKey = `${this.PREFIX_BUCKET}${providerKey}`;
    const lockKey = `llm:ratelimit:lock:${providerKey}`;

    const thucHienKiemTra = async (): Promise<KetQuaCapToken> => {
      return this.cacheService.withLock(lockKey, 2000, async () => {
        const now = Date.now();
        const state = await this.cacheService.get<TokenBucketState>(bucketKey);

        let tokens = capacity;
        let lastRefill = now;

        if (state && typeof state.tokens === 'number') {
          const elapsedSeconds = Math.max(0, (now - state.lastRefill) / 1000);
          const recovered = elapsedSeconds * refillPerSecond;
          tokens = Math.min(capacity, state.tokens + recovered);
          lastRefill = now;
        }

        if (tokens >= 1) {
          const conLai = tokens - 1;
          await this.cacheService.set<TokenBucketState>(
            bucketKey,
            { tokens: conLai, lastRefill },
            180,
          );

          this.logger.log(
            `[RateLimiter] [${providerKey}] Cấp 1 token thành công (còn lại ${conLai.toFixed(1)}/${capacity} RPM)`,
          );

          return {
            chapNhan: true,
            conLai,
            capacity,
          };
        } else {
          // Không đủ token
          await this.cacheService.set<TokenBucketState>(bucketKey, { tokens, lastRefill }, 180);

          const canThem = 1 - tokens;
          const thoiGianChoMs = Math.ceil((canThem / refillPerSecond) * 1000);

          this.logger.warn(
            `[RateLimiter] [${providerKey}] Hết Token Bucket (${tokens.toFixed(1)} < 1.0 / ${capacity} RPM), cần chờ ${thoiGianChoMs}ms`,
          );

          return {
            chapNhan: false,
            conLai: tokens,
            capacity,
            thoiGianChoMs,
          };
        }
      });
    };

    const firstTry = await thucHienKiemTra();
    if (firstTry.chapNhan) {
      return firstTry;
    }

    // Nếu không đủ token nhưng caller cho phép chờ trong timeoutMs
    if (timeoutMs > 0 && firstTry.thoiGianChoMs && firstTry.thoiGianChoMs <= timeoutMs) {
      this.logger.log(
        `[RateLimiter] [${providerKey}] Đang đợi ${firstTry.thoiGianChoMs}ms trong hàng đợi Token Bucket...`,
      );
      await new Promise((resolve) => setTimeout(resolve, firstTry.thoiGianChoMs));
      return thucHienKiemTra();
    }

    return firstTry;
  }
}

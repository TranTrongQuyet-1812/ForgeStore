import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../redis/cache.service';

export interface TokenBucketState {
  tokens: number;
  lastRefill: number; // Dấu thời gian Unix tính bằng mili-giây
}

export interface KetQuaCapToken {
  chapNhan: boolean;
  conLai: number;
  capacity: number;
  thoiGianChoMs?: number;
}

export interface KetQuaGiuChoGemini {
  chapNhan: boolean;
  soDaDung: number;
  thoiGianChoGiay?: number;
  hetHanMucNgay?: boolean;
}

const PACIFIC_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

  /**
   * Giữ hũ riêng cho từng model Gemini, chặn ở 500 yêu cầu/ngày và cách nhau ít nhất 4 giây.
   */
  async layQuyenGemini(model: string): Promise<KetQuaGiuChoGemini> {
    const ngay = this.layNgayPacific();
    const khoaDem = `fs:llm:daily:${model}:${ngay}`;
    const khoaCuoi = `fs:llm:last-request:${model}`;
    const khoa = `fs:lock:llm:gemini:${model}`;

    while (true) {
      let ketQua: {
        chapNhan: boolean;
        soDaDung: number;
        thoiGianChoGiay?: number;
        hetHanMucNgay?: boolean;
        choMs?: number;
      };
      try {
        ketQua = await this.cacheService.withLock(khoa, 2000, async () => {
          const soDaDung = (await this.cacheService.get<number>(khoaDem)) ?? 0;
          if (soDaDung >= 500) {
            return {
              chapNhan: false,
              soDaDung,
              thoiGianChoGiay: this.layGiayDenNuaDemPacific(),
              hetHanMucNgay: true,
            };
          }

          const lanCuoi = (await this.cacheService.get<number>(khoaCuoi)) ?? 0;
          const conPhaiCho = Math.max(0, 4000 - (Date.now() - lanCuoi));
          if (conPhaiCho > 0) return { chapNhan: false, soDaDung, choMs: conPhaiCho };

          await this.cacheService.tangSo(khoaDem, 1, 172800);
          await this.cacheService.set(khoaCuoi, Date.now(), 86400);
          return { chapNhan: true, soDaDung: soDaDung + 1 };
        });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('đang bị khóa')) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if ('choMs' in ketQua) {
        await new Promise((resolve) => setTimeout(resolve, ketQua.choMs));
        continue;
      }
      return ketQua;
    }
  }

  /** Trả khóa ngày theo giờ Thái Bình Dương để hũ tự đổi đúng lúc 00:00 địa phương. */
  private layNgayPacific(moc = new Date()): string {
    return PACIFIC_DATE_FORMATTER.format(moc);
  }

  private layGiayDenNuaDemPacific(): number {
    const batDau = Date.now();
    const ngayHienTai = this.layNgayPacific(new Date(batDau));
    let thap = 0;
    let cao = 36 * 60 * 60;
    while (cao - thap > 1) {
      const giua = Math.floor((thap + cao) / 2);
      if (this.layNgayPacific(new Date(batDau + giua * 1000)) === ngayHienTai) thap = giua;
      else cao = giua;
    }
    return cao;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { HuongDanCaiDatDto } from '@forgestore/types';
import { CacheService } from '../../redis/cache.service';
import { KetQuaChangelog } from '../dto/ai-summary.dto';
import { INhaCungCapTomTat, TenNhaCungCap } from '../interfaces/llm-provider.interface';
import { GeminiProvider } from '../providers/gemini.provider';
import { NvidiaNimProvider } from '../providers/nvidia-nim.provider';
import { bocTachHuongDanTuCodeBlocks } from '../tien-ich/cli-guide-extractor.util';
import { LlmRateLimiterService } from './llm-rate-limiter.service';

export interface KetQuaChangelogKemModel {
  ketQua: KetQuaChangelog;
  moHinhTomTat: string;
}

@Injectable()
export class LlmRotationService {
  private readonly logger = new Logger(LlmRotationService.name);

  public readonly PREFIX_KHOA_LLM = 'fs:llm:khoa:';
  public readonly THOI_GIAN_KHOA_PHUT = 60; // 60 giây khi hết hạn ngạch phút (P2-39.4)
  public readonly THOI_GIAN_KHOA_NGAY = 43200; // 12 giờ khi hết hạn ngạch ngày

  private readonly providers: INhaCungCapTomTat[];

  constructor(
    private readonly geminiProvider: GeminiProvider,
    private readonly nvidiaNimProvider: NvidiaNimProvider,
    private readonly cacheService: CacheService,
    private readonly rateLimiter: LlmRateLimiterService,
  ) {
    // Thứ tự ưu tiên cố định theo D-15: [Gemini, NVIDIA NIM]
    this.providers = [this.geminiProvider, this.nvidiaNimProvider];
  }

  /**
   * Tóm tắt Changelog với cơ chế xoay tua tương tự.
   */
  async tomTatChangelog(changelog: string, repoName: string): Promise<KetQuaChangelogKemModel> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      if (!provider) continue;

      // 1. Kiểm tra khóa cứng
      const isLocked = await this.kiemTraKhoa(provider.ten);
      if (isLocked) continue;

      // 2. Kiểm tra Token Bucket chủ động (AI1, BE-02)
      let token = { chapNhan: true, conLai: 1, capacity: 12 };
      try {
        token = await this.rateLimiter.layToken(provider.ten);
      } catch (rateErr) {
        this.logger.warn(
          `Lỗi khi lấy token bucket cho [${provider.ten}]: ${rateErr}. Tạm coi như hợp lệ.`,
        );
      }

      if (!token.chapNhan) {
        const nextProvider = this.providers[i + 1];
        this.logger.warn(
          `🔄 [Xoay Tua LLM Chủ Động] ${provider.ten} hết Token Bucket cho Changelog. Chủ động xoay sang ${nextProvider ? nextProvider.ten : 'Dự phòng'}.`,
        );
        continue;
      }

      try {
        const ketQua = await provider.tomTatChangelog(changelog, repoName);
        return {
          ketQua,
          moHinhTomTat: provider.tenModel,
        };
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        const isRateLimit =
          error.status === 429 ||
          Boolean(error.message?.includes('429')) ||
          Boolean(error.message?.includes('RESOURCE_EXHAUSTED'));

        if (isRateLimit) {
          const lockTtl = this.tinhThoiGianKhoa(error.message || '');
          await this.khoaProvider(provider.ten, lockTtl);
        }
      }
    }

    return {
      ketQua: {
        diemMoi: ['Cập nhật các cải tiến hiệu năng và sửa lỗi từ nhà phát triển.'],
      },
      moHinhTomTat: 'DU_PHONG',
    };
  }

  /**
   * Trích xuất hướng dẫn cài đặt dòng lệnh qua LLM Rotation (Gemini ⇄ NVIDIA NIM) kèm code-fallback.
   */
  async trichXuatHuongDanCaiDat(
    installSection: string,
    repoName: string,
    rawReadme: string,
    duongDanReadmeGoc?: string,
  ): Promise<HuongDanCaiDatDto | null> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      if (!provider) continue;

      // 1. Kiểm tra khóa cứng
      const isLocked = await this.kiemTraKhoa(provider.ten);
      if (isLocked) {
        continue;
      }

      // 2. Kiểm tra Token Bucket chủ động (AI1, BE-02)
      let token = { chapNhan: true, conLai: 1, capacity: 12 };
      try {
        token = await this.rateLimiter.layToken(provider.ten);
      } catch (rateErr) {
        this.logger.warn(
          `Lỗi khi lấy token bucket cho [${provider.ten}]: ${rateErr}. Tạm coi như hợp lệ.`,
        );
      }

      if (!token.chapNhan) {
        this.logger.warn(
          `🔄 [Xoay Tua LLM CLI] ${provider.ten} hết Token Bucket. Xoay sang nhà cung cấp tiếp theo.`,
        );
        continue;
      }

      try {
        const kq = await provider.trichXuatHuongDanCaiDat(
          installSection,
          repoName,
          rawReadme,
          duongDanReadmeGoc,
        );
        if (kq) {
          return kq;
        }
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        const isRateLimit =
          error.status === 429 ||
          Boolean(error.message?.includes('429')) ||
          Boolean(error.message?.includes('RESOURCE_EXHAUSTED'));

        if (isRateLimit) {
          const lockTtl = this.tinhThoiGianKhoa(error.message || '');
          await this.khoaProvider(provider.ten, lockTtl);
          this.logger.warn(
            `🔄 [Xoay Tua LLM CLI] ${provider.ten} chạm hạn ngạch 429, khóa ${lockTtl}s`,
          );
        } else {
          this.logger.error(`Lỗi bóc tách CLI từ [${provider.ten}]: ${error.message}`);
        }
      }
    }

    // Fallback: nếu cả 2 provider đều không thành công, bóc tách bằng code thuần từ code blocks
    return bocTachHuongDanTuCodeBlocks(installSection, rawReadme, duongDanReadmeGoc);
  }

  /**
   * Kiểm tra nhà cung cấp có đang bị khóa (bằng Redis key fs:llm:khoa:<ten>) hay không.
   */
  async kiemTraKhoa(ten: TenNhaCungCap): Promise<boolean> {
    const key = `${this.PREFIX_KHOA_LLM}${ten}`;
    const value = await this.cacheService.lay<boolean>(key);
    return Boolean(value);
  }

  /**
   * Khóa nhà cung cấp với thời gian TTL chỉ định.
   */
  async khoaProvider(ten: TenNhaCungCap, ttlSeconds: number): Promise<void> {
    const key = `${this.PREFIX_KHOA_LLM}${ten}`;
    await this.cacheService.luu(key, true, ttlSeconds);
    this.logger.warn(`Đã khóa nhà cung cấp [${ten}] trong ${ttlSeconds} giây.`);
  }

  /**
   * Mở khóa thủ công cho nhà cung cấp.
   */
  async moKhoaProvider(ten: TenNhaCungCap): Promise<void> {
    const key = `${this.PREFIX_KHOA_LLM}${ten}`;
    await this.cacheService.xoa(key);
    this.logger.log(`Đã mở khóa nhà cung cấp [${ten}].`);
  }

  /**
   * Phân biệt khóa theo phút (60s) hoặc khóa theo ngày (reset 12h) (P2-39.4, Post-Review #11).
   */
  private tinhThoiGianKhoa(errorMessage: string): number {
    const lower = errorMessage.toLowerCase();

    // 1. Kiểm tra rõ ràng giới hạn theo phút / RPM
    if (
      lower.includes('per minute') ||
      lower.includes('perminute') ||
      lower.includes('per_minute') ||
      lower.includes('retrydelay') ||
      lower.includes('rate limit') ||
      lower.includes('ratelimit')
    ) {
      return this.THOI_GIAN_KHOA_PHUT;
    }

    // 2. Chỉ khóa 12h khi thông báo chỉ định rõ hạn mức theo ngày (PerDay / Daily)
    if (
      lower.includes('per day') ||
      lower.includes('perday') ||
      lower.includes('per_day') ||
      lower.includes('daily')
    ) {
      return this.THOI_GIAN_KHOA_NGAY;
    }

    // 3. Mặc định cho lỗi 429 tạm thời: chỉ khóa theo phút (60s) để nhanh chóng phục hồi
    return this.THOI_GIAN_KHOA_PHUT;
  }
}

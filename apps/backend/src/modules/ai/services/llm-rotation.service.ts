import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../redis/cache.service';
import { KetQuaChangelog, KetQuaTomTat } from '../dto/ai-summary.dto';
import { INhaCungCapTomTat, TenNhaCungCap } from '../interfaces/llm-provider.interface';
import { GeminiProvider } from '../providers/gemini.provider';
import { NvidiaNimProvider } from '../providers/nvidia-nim.provider';

export interface KetQuaTomTatKemModel {
  ketQua: KetQuaTomTat;
  moHinhTomTat: string; // Tên model thực tế hoặc 'DU_PHONG' (P2-39.7)
}

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
  ) {
    // Thứ tự ưu tiên cố định theo D-15: [Gemini, NVIDIA NIM]
    this.providers = [this.geminiProvider, this.nvidiaNimProvider];
  }

  /**
   * Tóm tắt README với cơ chế tự động xoay tua khi gặp lỗi 429 (P2-39.3).
   */
  async tomTatReadme(
    readme: string,
    repoName: string,
    moTaGoc?: string,
  ): Promise<KetQuaTomTatKemModel> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      if (!provider) continue;
      const isLocked = await this.kiemTraKhoa(provider.ten);

      if (isLocked) {
        this.logger.warn(`Nhà cung cấp [${provider.ten}] đang bị khóa, bỏ qua.`);
        continue;
      }

      try {
        const ketQua = await provider.tomTatReadme(readme, repoName);
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

          const nextProvider = this.providers[i + 1];
          if (nextProvider) {
            this.logger.warn(
              `🔄 [Xoay Tua LLM] ${provider.ten} -> ${nextProvider.ten} (Lý do: chạm hạn ngạch 429, khóa ${lockTtl}s)`,
            );
          } else {
            this.logger.warn(
              `🚨 [Xoay Tua LLM] Toàn bộ nhà cung cấp đã bị khóa! Chuyển sang nội dung dự phòng.`,
            );
          }
        } else {
          this.logger.error(`Lỗi không phải 429 từ [${provider.ten}]: ${error.message}`);
        }
      }
    }

    // P2-39.5: Cả 2 nhà cung cấp đều bị khóa -> trả về nội dung dự phòng
    return {
      ketQua: this.taoNoiDungDuPhong(repoName, moTaGoc),
      moHinhTomTat: 'DU_PHONG',
    };
  }

  /**
   * Tóm tắt Changelog với cơ chế xoay tua tương tự.
   */
  async tomTatChangelog(changelog: string, repoName: string): Promise<KetQuaChangelogKemModel> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      if (!provider) continue;
      const isLocked = await this.kiemTraKhoa(provider.ten);

      if (isLocked) continue;

      try {
        const ketQua = await provider.tomTatChangelog(changelog, repoName);
        return {
          ketQua,
          moHinhTomTat: provider.tenModel,
        };
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        const isRateLimit = error.status === 429 || Boolean(error.message?.includes('429'));

        if (isRateLimit) {
          await this.khoaProvider(provider.ten, this.THOI_GIAN_KHOA_PHUT);
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
   * Phân biệt khóa theo phút (60s) hoặc khóa theo ngày (reset 12h) (P2-39.4).
   */
  private tinhThoiGianKhoa(errorMessage: string): number {
    if (
      errorMessage.toLowerCase().includes('per day') ||
      errorMessage.toLowerCase().includes('daily') ||
      errorMessage.toLowerCase().includes('quota exceeded')
    ) {
      return this.THOI_GIAN_KHOA_NGAY;
    }
    return this.THOI_GIAN_KHOA_PHUT;
  }

  /**
   * Tạo nội dung tóm tắt dự phòng từ mô tả gốc của GitHub repo (P2-39.5).
   */
  private taoNoiDungDuPhong(repoName: string, moTaGoc?: string): KetQuaTomTat {
    const khauHieu = moTaGoc ? moTaGoc.slice(0, 80) : `Ứng dụng mã nguồn mở ${repoName}`;
    const trichDan = moTaGoc || repoName;

    return {
      khauHieu,
      tinhNang: [
        {
          tieuDe: 'Giới thiệu tổng quan',
          moTa: moTaGoc
            ? moTaGoc.slice(0, 200)
            : 'Ứng dụng phân phối chính thức qua ForgeStore mã nguồn mở.',
          trichDan,
        },
      ],
    };
  }
}

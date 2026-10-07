import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../redis/cache.service';
import {
  ChiTietLoiProvider,
  ITranslationProvider,
  KetQuaDichDoan,
  NhaCungCapDich,
} from '../interfaces/translation-provider.interface';
import { MarkdownMasker } from '../utils/markdown-masker.util';
import { sanitizeLogMessage } from '../utils/log-sanitizer.util';
import { GeminiTranslationProvider } from '../providers/gemini-translation.provider';
import { NvidiaTranslationProvider } from '../providers/nvidia-translation.provider';
import { CloudflareTranslationProvider } from '../providers/cloudflare-translation.provider';
import { GroqTranslationProvider } from '../providers/groq-translation.provider';

export interface KetQuaDichVanBan {
  thanhCong: boolean;
  banDich: string | null;
  provider: NhaCungCapDich | null;
  model: string | null;
  thoiGianMs: number;
  chiTietLoi: ChiTietLoiProvider[];
}

export interface KetQuaDichDanhSach {
  thanhCong: boolean;
  tongSoDoan: number;
  tongThanhCong: number;
  tongThatBai: number;
  ketQua: Array<{
    index: number;
    thanhCong: boolean;
    banDich: string | null;
    provider: NhaCungCapDich | null;
    chiTietLoi?: ChiTietLoiProvider[];
  }>;
}

export interface KetQuaDichGomLoJson {
  thanhCong: boolean;
  ketQua: Record<string, string>;
  thieuIds: string[];
  provider: NhaCungCapDich | null;
  model: string | null;
  chiTietLoi: ChiTietLoiProvider[];
}

@Injectable()
export class TranslationRotationService {
  private readonly logger = new Logger(TranslationRotationService.name);
  public static readonly PREFIX_COOLDOWN = 'fs:ai:translation:cooldown:';
  public static readonly PREFIX_CONSECUTIVE_ERRORS = 'fs:ai:translation:consecutive_errors:';
  public static readonly PREFIX_UNHEALTHY = 'fs:ai:translation:unhealthy:';
  public static readonly PREFIX_429_COUNT = 'fs:ai:translation:429_count:';

  // Danh sách 4 nhà cung cấp dịch thuật được sắp xếp cố định theo thứ tự xoay tua P3B-05.6 & D-24:
  // 1. Gemini -> 2. NVIDIA NIM -> 3. Cloudflare Workers AI -> 4. Groq
  private readonly providers: ITranslationProvider[];

  constructor(
    private readonly geminiProvider: GeminiTranslationProvider,
    private readonly nvidiaProvider: NvidiaTranslationProvider,
    private readonly cloudflareProvider: CloudflareTranslationProvider,
    private readonly groqProvider: GroqTranslationProvider,
    private readonly cacheService: CacheService,
  ) {
    this.providers = [
      this.geminiProvider,
      this.nvidiaProvider,
      this.cloudflareProvider,
      this.groqProvider,
    ];
  }

  /**
   * Lấy danh sách thông tin cấu hình của 4 providers.
   */
  public layDanhSachProviders(): Array<{
    provider: NhaCungCapDich;
    model: string;
    available: boolean;
  }> {
    return this.providers.map((p) => ({
      provider: p.providerName,
      model: p.modelName,
      available: p.isAvailable(),
    }));
  }

  /**
   * Khóa tạm một nhà cung cấp vào Redis/RAM trong khoảng thời gian quy định khi gặp rate limit (429).
   */
  public async khoaCooldown(provider: NhaCungCapDich, thoiGianGiay: number): Promise<void> {
    const key = `${TranslationRotationService.PREFIX_COOLDOWN}${provider}`;
    const ttl = Math.max(1, thoiGianGiay);
    await this.cacheService.set(key, true, ttl);
    this.logger.warn(`Đã khóa cooldown nhà dịch [${provider}] trong ${ttl} giây.`);
  }

  /**
   * Kiểm tra nhà cung cấp có đang bị khóa cooldown hay không.
   */
  public async kiemTraCooldown(provider: NhaCungCapDich): Promise<boolean> {
    const key = `${TranslationRotationService.PREFIX_COOLDOWN}${provider}`;
    const isCool = await this.cacheService.get<boolean>(key);
    return Boolean(isCool);
  }

  /**
   * P3B-05.14 / Mục 4: Kiểm tra trạng thái unhealthy của nhà cung cấp.
   */
  public async kiemTraUnhealthy(provider: NhaCungCapDich): Promise<boolean> {
    const key = `${TranslationRotationService.PREFIX_UNHEALTHY}${provider}`;
    const isUnhealthy = await this.cacheService.get<boolean>(key);
    return Boolean(isUnhealthy);
  }

  /**
   * P3B-05.14 / Mục 4: Đếm lỗi liên tiếp và tự động đánh dấu unhealthy khi lỗi >= 3 lần.
   */
  public async danhDauLoiLienTiep(provider: NhaCungCapDich): Promise<void> {
    const errKey = `${TranslationRotationService.PREFIX_CONSECUTIVE_ERRORS}${provider}`;
    const currentCount = ((await this.cacheService.get<number>(errKey)) ?? 0) + 1;
    await this.cacheService.set(errKey, currentCount, 3600); // Lưu bộ đếm trong 1 giờ

    if (currentCount >= 3) {
      const unhealthyKey = `${TranslationRotationService.PREFIX_UNHEALTHY}${provider}`;
      await this.cacheService.set(unhealthyKey, true, 1800); // Tạm bỏ nhà đó 30 phút
      this.logger.warn(
        `Nhà dịch [${provider}] đã thất bại liên tiếp ${currentCount} lần. Đánh dấu [unhealthy], tạm ngưng 30 phút.`,
      );
    }
  }

  /**
   * Reset bộ đếm lỗi và gỡ trạng thái unhealthy khi dịch thành công.
   */
  public async resetLoiLienTiep(provider: NhaCungCapDich): Promise<void> {
    const errKey = `${TranslationRotationService.PREFIX_CONSECUTIVE_ERRORS}${provider}`;
    const unhealthyKey = `${TranslationRotationService.PREFIX_UNHEALTHY}${provider}`;
    const count429Key = `${TranslationRotationService.PREFIX_429_COUNT}${provider}`;
    await this.cacheService.del(errKey);
    await this.cacheService.del(unhealthyKey);
    await this.cacheService.del(count429Key);
  }

  /**
   * P3B-05.14 / Mục 7: Tính toán thời gian cooldown tăng dần (Backoff) khi gặp 429 lặp lại.
   */
  public async tinhCooldownBackoff(
    provider: NhaCungCapDich,
    baseRetrySec?: number,
  ): Promise<number> {
    const countKey = `${TranslationRotationService.PREFIX_429_COUNT}${provider}`;
    const current429Count = ((await this.cacheService.get<number>(countKey)) ?? 0) + 1;
    await this.cacheService.set(countKey, current429Count, 86400); // Lưu trong 24h

    if (baseRetrySec && baseRetrySec > 60) {
      return baseRetrySec;
    }

    // Tăng dần thời gian chờ khi 429 lặp lại: 60s -> 120s -> 300s -> 900s -> 1800s
    const backoffTable = [60, 120, 300, 900, 1800];
    const index = Math.min(current429Count - 1, backoffTable.length - 1);
    return backoffTable[index] ?? 60;
  }

  /**
   * Dịch một văn bản Markdown hoàn chỉnh sang tiếng Việt:
   * 1. Che 6 tầng các thành phần kỹ thuật bằng MarkdownMasker (P3B-05.1).
   * 2. Xoay tua đúng thứ tự 1 -> 2 -> 3 -> 4 (Gemini -> NVIDIA -> CF -> Groq).
   * 3. Kiểm tra tính toàn vẹn cấu trúc (StructureValidator bên trong Provider).
   * 4. Khôi phục (unmask) sau khi nhận bản dịch thành công.
   * 5. TUYỆT ĐỐI KHÔNG BAO GIỜ COI BẢN GỐC LÀ BẢN DỊCH (Chốt chặn Claude): Thất bại thì trả banDich = null.
   */
  public async dichVanBan(
    rawMarkdown: string,
    options?: { timeoutMs?: number },
  ): Promise<KetQuaDichVanBan> {
    const tongStartTime = Date.now();

    if (!rawMarkdown || rawMarkdown.trim() === '') {
      return {
        thanhCong: true,
        banDich: '',
        provider: null,
        model: null,
        thoiGianMs: 0,
        chiTietLoi: [],
      };
    }

    // 1. Che 6 tầng Markdown
    const { maskedText, placeholderMap } = MarkdownMasker.mask(rawMarkdown);
    const chiTietLoi: ChiTietLoiProvider[] = [];

    // 2. Duyệt qua 4 nhà cung cấp theo đúng thứ tự xoay tua
    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        chiTietLoi.push({
          provider: provider.providerName,
          model: provider.modelName,
          lyDoLoi: 'not_configured',
        });
        continue;
      }

      // P3B-05.14 / Mục 4: Bỏ qua nếu nhà cung cấp đang ở trạng thái unhealthy (lỗi >= 3 lần liên tiếp)
      const isUnhealthy = await this.kiemTraUnhealthy(provider.providerName);
      if (isUnhealthy) {
        this.logger.warn(
          `Nhà dịch [${provider.providerName}] đang ở trạng thái [unhealthy] do lỗi liên tiếp. Bỏ qua và chuyển tiếp.`,
        );
        chiTietLoi.push({
          provider: provider.providerName,
          model: provider.modelName,
          lyDoLoi: 'unhealthy',
        });
        continue;
      }

      const isCooldown = await this.kiemTraCooldown(provider.providerName);
      if (isCooldown) {
        this.logger.warn(
          `Nhà dịch [${provider.providerName}] đang trong thời gian cooldown. Bỏ qua và chuyển tiếp.`,
        );
        chiTietLoi.push({
          provider: provider.providerName,
          model: provider.modelName,
          lyDoLoi: 'rate_limited',
        });
        continue;
      }

      this.logger.log(
        `Bắt đầu dịch bằng [${provider.providerName}] (model: ${provider.modelName})`,
      );
      const ketQua: KetQuaDichDoan = await provider.translate(maskedText, options);

      // Nếu gặp rate_limited (429) -> Khóa cooldown tăng dần (Mục 7)
      if (ketQua.lyDoLoi === 'rate_limited') {
        const retrySec = await this.tinhCooldownBackoff(
          provider.providerName,
          ketQua.retryAfterSec,
        );
        await this.khoaCooldown(provider.providerName, retrySec);
        chiTietLoi.push({
          provider: provider.providerName,
          model: provider.modelName,
          lyDoLoi: 'rate_limited',
          thoiGianMs: ketQua.thoiGianMs,
        });
        continue;
      }

      // Nếu gặp lỗi cấu trúc, timeout, hoặc rỗng -> ghi nhận lỗi liên tiếp (Mục 4) và chuyển nhà tiếp theo
      if (ketQua.lyDoLoi !== null || ketQua.text === null) {
        await this.danhDauLoiLienTiep(provider.providerName);
        this.logger.warn(
          sanitizeLogMessage(
            `Nhà dịch [${provider.providerName}] thất bại với lý do [${ketQua.lyDoLoi}]. Chuyển nhà tiếp theo.`,
          ),
        );
        chiTietLoi.push({
          provider: provider.providerName,
          model: provider.modelName,
          lyDoLoi: ketQua.lyDoLoi ?? 'ai_error',
          thoiGianMs: ketQua.thoiGianMs,
        });
        continue;
      }

      // Nhận được bản dịch hợp lệ -> Reset lỗi liên tiếp và ráp unmask triệt để
      await this.resetLoiLienTiep(provider.providerName);
      const unmasked = MarkdownMasker.unmask(ketQua.text, placeholderMap);
      const thoiGianMs = Date.now() - tongStartTime;

      this.logger.log(
        `Dịch thành công bằng [${provider.providerName}] trong ${thoiGianMs}ms (model: ${provider.modelName})`,
      );

      return {
        thanhCong: true,
        banDich: unmasked,
        provider: provider.providerName,
        model: provider.modelName,
        thoiGianMs,
        chiTietLoi,
      };
    }

    // Cả 4 nhà dịch đều thất bại:
    // TUYỆT ĐỐI KHÔNG BAO GIỜ COI BẢN GỐC LÀ BẢN DỊCH (Chốt chặn nghiêm ngặt)
    const thoiGianMs = Date.now() - tongStartTime;
    this.logger.warn(`Cả 4 nhà dịch đều thất bại sau ${thoiGianMs}ms. Không có bản dịch.`);

    return {
      thanhCong: false,
      banDich: null, // TUYỆT ĐỐI KHÔNG gán rawMarkdown vào đây
      provider: null,
      model: null,
      thoiGianMs,
      chiTietLoi,
    };
  }

  /**
   * Dịch một danh sách nhiều phân đoạn (phục vụ chia nhỏ đoạn README hoặc nạp hàng loạt).
   */
  public async dichNhieuDoan(
    texts: string[],
    options?: { timeoutMs?: number },
  ): Promise<KetQuaDichDanhSach> {
    const ketQua: Array<{
      index: number;
      thanhCong: boolean;
      banDich: string | null;
      provider: NhaCungCapDich | null;
      chiTietLoi?: ChiTietLoiProvider[];
    }> = [];

    let tongThanhCong = 0;
    let tongThatBai = 0;

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i] ?? '';
      const res = await this.dichVanBan(t, options);
      if (res.thanhCong && res.banDich !== null) {
        tongThanhCong++;
        ketQua.push({
          index: i,
          thanhCong: true,
          banDich: res.banDich,
          provider: res.provider,
        });
      } else {
        tongThatBai++;
        ketQua.push({
          index: i,
          thanhCong: false,
          banDich: null,
          provider: null,
          chiTietLoi: res.chiTietLoi,
        });
      }
    }

    return {
      thanhCong: tongThatBai === 0,
      tongSoDoan: texts.length,
      tongThanhCong,
      tongThatBai,
      ketQua,
    };
  }

  /**
   * P3B-04: Dịch gom lô danh sách mục sang JSON { [id]: "bản dịch tiếng Việt" }.
   * Áp dụng chia chunk theo batchSize (mặc định 25), xoay tua 4 nhà và bù đắp các ID bị sót.
   * TUYỆT ĐỐI KHÔNG BAO GIỜ gán bản gốc tiếng Anh làm bản dịch khi thất bại.
   */
  public async dichGomLoJson(
    items: Array<{ id: string; text: string }>,
    options?: { batchSize?: number; timeoutMs?: number },
  ): Promise<KetQuaDichGomLoJson> {
    if (!items || items.length === 0) {
      return {
        thanhCong: true,
        ketQua: {},
        thieuIds: [],
        provider: null,
        model: null,
        chiTietLoi: [],
      };
    }

    const batchSize = Math.max(1, options?.batchSize ?? 25);
    const ketQuaTong: Record<string, string> = {};
    const chiTietLoi: ChiTietLoiProvider[] = [];
    let lastProvider: NhaCungCapDich | null = null;
    let lastModel: string | null = null;

    // 1. Chia thành các batch nhỏ
    const chunks: Array<Array<{ id: string; text: string }>> = [];
    for (let i = 0; i < items.length; i += batchSize) {
      chunks.push(items.slice(i, i + batchSize));
    }

    // 2. Xử lý từng chunk
    for (const chunk of chunks) {
      let mucChuaDich = [...chunk];

      for (const provider of this.providers) {
        if (mucChuaDich.length === 0) break;

        if (!provider.isAvailable() || typeof provider.translateBatchJson !== 'function') {
          chiTietLoi.push({
            provider: provider.providerName,
            model: provider.modelName,
            lyDoLoi: 'not_configured',
          });
          continue;
        }

        const isUnhealthy = await this.kiemTraUnhealthy(provider.providerName);
        if (isUnhealthy) {
          chiTietLoi.push({
            provider: provider.providerName,
            model: provider.modelName,
            lyDoLoi: 'unhealthy',
          });
          continue;
        }

        const isCooldown = await this.kiemTraCooldown(provider.providerName);
        if (isCooldown) {
          chiTietLoi.push({
            provider: provider.providerName,
            model: provider.modelName,
            lyDoLoi: 'rate_limited',
          });
          continue;
        }

        this.logger.log(
          `Bắt đầu dịch gom lô ${mucChuaDich.length} mục bằng [${provider.providerName}] (model: ${provider.modelName})`,
        );

        const res = await provider.translateBatchJson(mucChuaDich, options);

        if (res.lyDoLoi === 'rate_limited') {
          const retrySec = await this.tinhCooldownBackoff(provider.providerName, res.retryAfterSec);
          await this.khoaCooldown(provider.providerName, retrySec);
          chiTietLoi.push({
            provider: provider.providerName,
            model: provider.modelName,
            lyDoLoi: 'rate_limited',
            thoiGianMs: res.thoiGianMs,
          });
          continue;
        }

        if (res.lyDoLoi !== null || res.data === null) {
          // Lỗi 3: Không làm tăng bộ đếm consecutive_errors chung để tránh dính lây ngắt mạch dịch README
          chiTietLoi.push({
            provider: provider.providerName,
            model: provider.modelName,
            lyDoLoi: res.lyDoLoi ?? 'ai_error',
            thoiGianMs: res.thoiGianMs,
          });
          continue;
        }

        // Nhận được dữ liệu JSON
        lastProvider = provider.providerName;
        lastModel = provider.modelName;

        // Lỗi 6: Validate ID hợp lệ, kiểu string (chống [object Object]) và khác bản gốc tiếng Anh
        const chunkMap = new Map(chunk.map((item) => [item.id, item.text]));

        for (const [id, translatedVal] of Object.entries(res.data)) {
          // 1. ID phải nằm trong chunk hiện tại
          if (!chunkMap.has(id)) continue;

          // 2. Giá trị phải là string
          if (typeof translatedVal !== 'string') continue;

          const banDichTrim = translatedVal.trim();
          if (!banDichTrim) continue;

          // 3. Chốt chặn Claude: Bản dịch phải khác bản gốc tiếng Anh
          const textGoc = chunkMap.get(id) || '';
          if (banDichTrim.toLowerCase() === textGoc.trim().toLowerCase()) {
            this.logger.warn(
              `Bản dịch cho mục [${id}] trùng 100% bản gốc tiếng Anh. Bỏ qua không nhận làm bản dịch.`,
            );
            continue;
          }

          ketQuaTong[id] = banDichTrim;
        }

        // Kiểm tra xem còn mục nào chưa có bản dịch không
        mucChuaDich = mucChuaDich.filter((m) => !ketQuaTong[m.id]);
      }
    }

    const thieuIds = items.map((i) => i.id).filter((id) => !ketQuaTong[id]);
    const thanhCong = thieuIds.length === 0;

    return {
      thanhCong,
      ketQua: ketQuaTong,
      thieuIds,
      provider: lastProvider,
      model: lastModel,
      chiTietLoi,
    };
  }
}

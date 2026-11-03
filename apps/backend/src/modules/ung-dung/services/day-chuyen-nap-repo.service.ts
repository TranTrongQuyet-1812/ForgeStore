import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { CacheService } from '../../redis/cache.service';
import { UngDungService } from '../ung-dung.service';
import { SuyGiamThinhHanhJob } from '../jobs/suy-giam-thinh-hanh.job';
import { AppDescriptionTranslationService } from '../../ai/translation/services/app-description-translation.service';
import { ReadmeTranslationService } from '../../ai/translation/services/readme-translation.service';
import { trichXuatHuongDanCliBangQuyTac } from '../../ai/tien-ich/cli-guide-extractor.util';
import { phanLoaiTep } from '../tien-ich/phan-loai-tep.util';
import {
  TrangThaiUngVienRepo,
  LyDoLoaiUngVien,
  DinhDangTep,
  TrangThaiDichReadme,
} from '@prisma/client';
import { coCachCaiCliHopLe } from '@forgestore/types';

export interface KetQuaNapLau {
  dangChay?: boolean;
  daNhayQua?: boolean;
  dungDoRateLimit?: boolean;
  lyDo?: string;
  soLuongUngVienQuet: number;
  soLuongDaNap: number;
  soLuongBiLoai: number;
  chiTietBiLoai: Record<string, number>;
  rateLimitConLai: number | null;
}

export interface KetQuaDichNen {
  daDichMoTa: number;
  daDichReadme: number;
  nganSachConLai: number;
}

export const DANH_SACH_SEED_REPOS: string[] = [
  'notepad-plus-plus/notepad-plus-plus',
  'telegramdesktop/tdesktop',
  'flameshot-org/flameshot',
  'obsproject/obs-studio',
  'rustdesk/rustdesk',
  'microsoft/winget-cli',
  'jesseduffield/lazygit',
  'charmbracelet/glow',
  'git-for-windows/git',
  'videolan/vlc',
  'localsend/localsend',
  'syncthing/syncthing',
  'audacity/audacity',
  'HandBrake/HandBrake',
  'ShareX/ShareX',
  'keepassxreboot/keepassxc',
  'transmission/transmission',
  '7-zip/7-zip',
  'fastfetch-cli/fastfetch',
  'JanDeDobbeleer/oh-my-posh',
];

/**
 * Dây chuyền nạp Repo quy mô lớn & Hàng đợi dịch nền (P3B-06 & P3B-05.4)
 *
 * 6 Chốt chặn an toàn (đã hoàn thiện theo review của Claude):
 * 1. Không xóa ứng viên bị loại: Gán BI_LOAI kèm mã LyDoLoaiUngVien. Repo có lệnh CLI hợp lệ được nạp thẳng vào Store (D-30).
 * 2. Hạn mức GitHub: Dùng token, theo dõi x-ratelimit-remaining, dừng/chờ khi sắp hết (< 100 req).
 *    Lỗi mạng / 403 / 429 tạm thời: Dừng lô và giữ CHO_SANG_LOC, không loại oan vĩnh viễn.
 * 3. Không tạo bão dịch: Nạp repo KHÔNG kích hoạt dịch ngay; dịch qua hàng đợi có giới hạn song song và ngân sách ngày.
 * 4. Chạy lại không sinh trùng: upsert theo tenRepoDayDu, khóa phân tán Redis an toàn qua withLock (SET NX PX kèm Lua script).
 * 5. Dữ liệu từ GitHub là không tin cậy: tên, mô tả, topics được giới hạn độ dài; kiểm tra giấy phép mã nguồn mở (GIAY_PHEP_KHONG_MO).
 * 6. Bật tắt được: Biến môi trường INGESTION_ENABLED khóa toàn diện cả nạp lẫn dịch nền định kỳ.
 */
@Injectable()
export class DayChuyenNapRepoService {
  private readonly logger = new Logger(DayChuyenNapRepoService.name);
  public static readonly LOCK_KEY = 'fs:ingestion:lock';
  public static readonly LOCK_TTL_SECONDS = 900; // 15 phút
  public static readonly BUDGET_PREFIX = 'fs:ai:translation:budget:readme:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
    private readonly appsService: UngDungService,
    private readonly trendingDecayJob: SuyGiamThinhHanhJob,
    private readonly appDescriptionTranslationService: AppDescriptionTranslationService,
    private readonly readmeTranslationService: ReadmeTranslationService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Kiểm tra xem tính năng nạp tự động có được bật không
   */
  public isIngestionEnabled(): boolean {
    return this.config.get<boolean>('INGESTION_ENABLED', false);
  }

  /**
   * Khử độc và chuẩn hóa tên repository (Chốt chặn 5)
   */
  public chuanHoaTenRepo(raw: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length > 100) return null;
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (!match) return null;
    return `${match[1]}/${match[2]}`;
  }

  /**
   * Nhận diện lỗi tạm thời do Rate Limit hoặc rớt mạng kết nối
   */
  private laLoiTamThoi(err: unknown): boolean {
    if (!err) return false;
    const status =
      (err as { status?: number }).status ||
      (typeof (err as { getStatus?: () => number }).getStatus === 'function'
        ? (err as { getStatus: () => number }).getStatus()
        : undefined);
    if (status === 403 || status === 429) return true;
    const msg = String((err as Error).message || err).toLowerCase();
    return (
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('timeouterror') ||
      msg.includes('fetch failed')
    );
  }

  /**
   * Pha 1: Khám phá ứng viên (P3B-06.1)
   * Nhận danh sách repo hạt giống hoặc truy vấn GitHub Search API.
   * Lưu vào bảng ung_vien_repo với trạng thái CHO_SANG_LOC (upsert chống trùng - Chốt chặn 4).
   */
  async khamPhaUngVien(
    danhSachRepos?: string[],
    nguonKhamPha = 'seed_curated',
  ): Promise<{ daThem: number; daBoQua: number; tongUngVien: number }> {
    const list = danhSachRepos && danhSachRepos.length > 0 ? danhSachRepos : DANH_SACH_SEED_REPOS;
    let daThem = 0;
    let daBoQua = 0;

    for (const item of list) {
      const tenChuan = this.chuanHoaTenRepo(item);
      if (!tenChuan) {
        daBoQua++;
        continue;
      }

      // Kiểm tra xem ứng viên đã tồn tại chưa (Idempotency)
      const existing = await this.prisma.ungVienRepo.findUnique({
        where: { tenRepoDayDu: tenChuan },
      });

      if (existing) {
        daBoQua++;
        continue;
      }

      await this.prisma.ungVienRepo.create({
        data: {
          tenRepoDayDu: tenChuan,
          nguonKhamPha,
          trangThai: TrangThaiUngVienRepo.CHO_SANG_LOC,
        },
      });
      daThem++;
    }

    const tongUngVien = await this.prisma.ungVienRepo.count();
    this.logger.log(
      `[Khám Phá] Đã thêm: ${daThem} repo, Đã bỏ qua: ${daBoQua} repo. Tổng ứng viên: ${tongUngVien}`,
    );

    return { daThem, daBoQua, tongUngVien };
  }

  /**
   * Pha 2 & Pha 3: Sàng lọc và Nạp theo lô nhỏ (P3B-06.2, P3B-06.3)
   * Tuân thủ triệt để 6 chốt chặn của Claude.
   */
  async sangLocVaNapLauNho(batchSize?: number, forceRun = false): Promise<KetQuaNapLau> {
    const isEnabled = this.isIngestionEnabled();
    const configuredLimit = this.config.get<number>('INGESTION_BATCH_SIZE', 30);
    const rawLimit = batchSize ?? configuredLimit;
    const limit = Math.max(1, Math.min(100, Number.isInteger(rawLimit) ? rawLimit : 30));

    // Chốt chặn 6: Biến môi trường bật/tắt dây chuyền nạp
    if (!isEnabled && !forceRun) {
      this.logger.log(
        'Dây chuyền nạp repo đang tắt (INGESTION_ENABLED=false). Bỏ qua lượt chạy này.',
      );
      return {
        daNhayQua: true,
        lyDo: 'ingestion_disabled',
        soLuongUngVienQuet: 0,
        soLuongDaNap: 0,
        soLuongBiLoai: 0,
        chiTietBiLoai: {},
        rateLimitConLai: null,
      };
    }

    // Chốt chặn 3: Khóa phân tán Redis an toàn qua withLock (SET NX PX kèm Lua script)
    try {
      return await this.cacheService.withLock<KetQuaNapLau>(
        DayChuyenNapRepoService.LOCK_KEY,
        DayChuyenNapRepoService.LOCK_TTL_SECONDS * 1000,
        async () => {
          return await this.thucThiSangLocVaNap(limit);
        },
      );
    } catch (err) {
      if ((err as Error).message?.includes('đang bị khóa')) {
        this.logger.warn('Dây chuyền nạp repo đang có một tiến trình khác chạy, bỏ qua lần này.');
        return {
          dangChay: true,
          lyDo: 'job_locked',
          soLuongUngVienQuet: 0,
          soLuongDaNap: 0,
          soLuongBiLoai: 0,
          chiTietBiLoai: {},
          rateLimitConLai: null,
        };
      }
      throw err;
    }
  }

  /**
   * Thực thi nội dung sàng lọc và nạp bên trong khóa phân tán
   */
  private async thucThiSangLocVaNap(limit: number): Promise<KetQuaNapLau> {
    let soLuongUngVienQuet = 0;
    let soLuongDaNap = 0;
    let soLuongBiLoai = 0;
    const chiTietBiLoai: Record<string, number> = {};

    // Chốt chặn 2: Kiểm tra hạn mức GitHub trước khi bắt đầu
    const initialRateLimit = this.githubService.getRateLimitInfo();
    if (initialRateLimit.remaining !== null && initialRateLimit.remaining < 100) {
      this.logger.warn(
        `Hạn mức GitHub API sắp hết (còn ${initialRateLimit.remaining}/5000). Dừng nạp ngay để bảo vệ token.`,
      );
      return {
        dungDoRateLimit: true,
        lyDo: 'github_rate_limited',
        soLuongUngVienQuet: 0,
        soLuongDaNap: 0,
        soLuongBiLoai: 0,
        chiTietBiLoai: {},
        rateLimitConLai: initialRateLimit.remaining,
      };
    }

    // Lấy lô ứng viên đang chờ sàng lọc
    const candidates = await this.prisma.ungVienRepo.findMany({
      where: { trangThai: TrangThaiUngVienRepo.CHO_SANG_LOC },
      orderBy: { ngayTao: 'asc' },
      take: limit,
    });

    this.logger.log(`[Dây Chuyền Nạp] Bắt đầu sàng lọc lô ${candidates.length} repo ứng viên...`);

    // Xử lý tuần tự từng repo (chốt chặn của Claude: không Promise.all cả trăm repo)
    for (const candidate of candidates) {
      soLuongUngVienQuet++;

      // Kiểm tra lại hạn mức GitHub giữa các repo
      const currentRateLimit = this.githubService.getRateLimitInfo();
      if (currentRateLimit.remaining !== null && currentRateLimit.remaining < 100) {
        this.logger.warn(
          `Hạn mức GitHub API chạm ngưỡng tối thiểu (còn ${currentRateLimit.remaining}). Tạm dừng lô nạp.`,
        );
        break;
      }

      const [owner, repo] = candidate.tenRepoDayDu.split('/');
      if (!owner || !repo) {
        await this.loaiUngVien(
          candidate.maUngVien,
          LyDoLoaiUngVien.LOI_KHI_SANG_LOC,
          chiTietBiLoai,
        );
        soLuongBiLoai++;
        continue;
      }

      // --- BƯỚC 1: SÀNG LỌC (KHÔNG DÙNG AI) ---
      let repoData;
      try {
        repoData = await this.githubService.layRepo(owner, repo);
      } catch (err) {
        this.logger.warn(`Lỗi khi lấy thông tin repo [${candidate.tenRepoDayDu}]: ${err}`);
        // Chốt chặn 2 của Claude: Lỗi tạm thời (hết hạn mức/rớt mạng) -> Dừng lô ngay và giữ CHO_SANG_LOC
        if (this.laLoiTamThoi(err)) {
          this.logger.warn(
            `Phát hiện lỗi tạm thời/rate limit khi lấy repo [${candidate.tenRepoDayDu}]. Giữ nguyên CHO_SANG_LOC và tạm dừng lô.`,
          );
          break;
        }
        await this.loaiUngVien(
          candidate.maUngVien,
          LyDoLoaiUngVien.LOI_KHI_SANG_LOC,
          chiTietBiLoai,
        );
        soLuongBiLoai++;
        continue;
      }

      // Loại nếu repo đã archived (Đã lưu trữ)
      if (repoData.archived) {
        await this.loaiUngVien(candidate.maUngVien, LyDoLoaiUngVien.DA_LUU_TRU, chiTietBiLoai);
        soLuongBiLoai++;
        continue;
      }

      // Chốt chặn 5 của Claude: Kiểm tra Giấy phép mã nguồn mở (Open Source License)
      if (
        !repoData.license ||
        !repoData.license.key ||
        repoData.license.key.toLowerCase() === 'other'
      ) {
        await this.loaiUngVien(
          candidate.maUngVien,
          LyDoLoaiUngVien.GIAY_PHEP_KHONG_MO,
          chiTietBiLoai,
        );
        soLuongBiLoai++;
        continue;
      }

      // Lấy release mới nhất để kiểm tra bộ cài
      let latestRelease;
      try {
        latestRelease = await this.githubService.layReleaseMoiNhat(owner, repo);
      } catch (err) {
        this.logger.warn(`Lỗi khi lấy release mới nhất [${candidate.tenRepoDayDu}]: ${err}`);
        if (this.laLoiTamThoi(err)) {
          this.logger.warn(
            `Phát hiện lỗi tạm thời/rate limit khi lấy release [${candidate.tenRepoDayDu}]. Giữ nguyên CHO_SANG_LOC và tạm dừng lô.`,
          );
          break;
        }
        await this.loaiUngVien(
          candidate.maUngVien,
          LyDoLoaiUngVien.LOI_KHI_SANG_LOC,
          chiTietBiLoai,
        );
        soLuongBiLoai++;
        continue;
      }

      // Không có bản phát hành nào
      if (!latestRelease || !latestRelease.assets || latestRelease.assets.length === 0) {
        // P3B-25.5 (D-30): Kiểm tra xem có hướng dẫn cài đặt CLI hợp lệ trong README không
        const ketQuaCli = await this.kiemTraCoHuongDanCli(owner, repo, candidate.tenRepoDayDu);

        // Lỗi tạm thời khi lấy README: không được loại oan repo chỉ cài bằng lệnh (D-30)
        if (ketQuaCli === 'LOI_TAM_THOI') {
          this.ghiLogTamDungLoLoiReadme(candidate.tenRepoDayDu);
          break;
        }

        if (ketQuaCli === 'KHONG') {
          await this.loaiUngVien(
            candidate.maUngVien,
            LyDoLoaiUngVien.KHONG_CO_BAN_PHAT_HANH,
            chiTietBiLoai,
          );
          soLuongBiLoai++;
          continue;
        }

        this.logger.log(
          `[CLI Ingestion] Repo [${candidate.tenRepoDayDu}] không có bản phát hành nhưng có lệnh cài CLI hợp lệ, cho phép nạp đầy đủ (D-30).`,
        );
      } else {
        // Kiểm tra xem có file cài đặt cho Windows hoặc Android không
        let hasInstallableAsset = false;
        for (const asset of latestRelease.assets) {
          const kq = phanLoaiTep(asset.name);
          if (
            !kq.boQua &&
            (kq.dinhDang === DinhDangTep.EXE ||
              kq.dinhDang === DinhDangTep.MSI ||
              kq.dinhDang === DinhDangTep.ZIP_PORTABLE ||
              kq.dinhDang === DinhDangTep.APK)
          ) {
            hasInstallableAsset = true;
            break;
          }
        }

        if (!hasInstallableAsset) {
          // P3B-25.5 (D-30): Kiểm tra xem có hướng dẫn cài đặt CLI hợp lệ trong README không
          const ketQuaCli = await this.kiemTraCoHuongDanCli(owner, repo, candidate.tenRepoDayDu);

          // Lỗi tạm thời khi lấy README: không được loại oan repo chỉ cài bằng lệnh (D-30)
          if (ketQuaCli === 'LOI_TAM_THOI') {
            this.ghiLogTamDungLoLoiReadme(candidate.tenRepoDayDu);
            break;
          }

          if (ketQuaCli === 'KHONG') {
            await this.loaiUngVien(
              candidate.maUngVien,
              LyDoLoaiUngVien.KHONG_CO_FILE_CAI,
              chiTietBiLoai,
            );
            soLuongBiLoai++;
            continue;
          }

          this.logger.log(
            `[CLI Ingestion] Repo [${candidate.tenRepoDayDu}] không có file cài Windows/Android nhưng có lệnh cài CLI hợp lệ, cho phép nạp đầy đủ (D-30).`,
          );
        }
      }

      // --- BƯỚC 2: NẠP ĐẦY ĐỦ (FULL INGESTION) ---
      try {
        // Nạp vào bảng ung_dung qua dongBoRepo (đã có bộ chấm điểm, phân loại file)
        await this.appsService.dongBoRepo(owner, repo);

        // Cập nhật ứng viên thành ĐÃ NẠP
        await this.prisma.ungVienRepo.update({
          where: { maUngVien: candidate.maUngVien },
          data: {
            trangThai: TrangThaiUngVienRepo.DA_NAP,
            lyDoLoai: null,
          },
        });

        soLuongDaNap++;
        this.logger.log(`✅ [Nạp Thành Công] ${candidate.tenRepoDayDu}`);
      } catch (err) {
        this.logger.error(`Lỗi khi nạp đầy đủ repo [${candidate.tenRepoDayDu}]:`, err);
        if (this.laLoiTamThoi(err)) {
          this.logger.warn(
            `Phát hiện lỗi tạm thời/rate limit khi nạp [${candidate.tenRepoDayDu}]. Giữ nguyên CHO_SANG_LOC và tạm dừng lô.`,
          );
          break;
        }
        await this.loaiUngVien(
          candidate.maUngVien,
          LyDoLoaiUngVien.LOI_KHI_SANG_LOC,
          chiTietBiLoai,
        );
        soLuongBiLoai++;
      }
    }

    // Chốt chặn Claude: Tính lại điểm Thịnh hành MỘT LẦN sau mỗi lô, không tính sau từng repo!
    if (soLuongDaNap > 0) {
      this.logger.log('Tính lại điểm Thịnh hành cho toàn bộ ứng dụng sau lô nạp...');
      try {
        await this.trendingDecayJob.capNhatDiemThinhHanhToanBo();
      } catch (err) {
        this.logger.error('Lỗi khi tính lại điểm Thịnh hành sau lô nạp:', err);
      }
    }

    const finalRateLimit = this.githubService.getRateLimitInfo();
    this.logger.log(
      `🏁 [Lô Nạp Hoàn Tất] Đã quét: ${soLuongUngVienQuet}, Đã nạp: ${soLuongDaNap}, Bị loại: ${soLuongBiLoai}. Quota GitHub: ${
        finalRateLimit.remaining ?? 'N/A'
      }/${finalRateLimit.limit ?? 'N/A'}`,
    );

    return {
      soLuongUngVienQuet,
      soLuongDaNap,
      soLuongBiLoai,
      chiTietBiLoai,
      rateLimitConLai: finalRateLimit.remaining,
    };
  }

  /**
   * Gán lý do loại ứng viên (Chốt chặn 1: TUYỆT ĐỐI KHÔNG XÓA DÒNG BỊ LOẠI)
   */
  private async loaiUngVien(
    maUngVien: string,
    lyDoLoai: LyDoLoaiUngVien,
    chiTietBiLoai: Record<string, number>,
  ): Promise<void> {
    await this.prisma.ungVienRepo.update({
      where: { maUngVien },
      data: {
        trangThai: TrangThaiUngVienRepo.BI_LOAI,
        lyDoLoai,
      },
    });
    chiTietBiLoai[lyDoLoai] = (chiTietBiLoai[lyDoLoai] || 0) + 1;
  }

  /**
   * Kiểm tra xem repo có hướng dẫn cài đặt CLI hợp lệ trong README không (D-30 / P3B-25.5).
   * Tách riêng LOI_TAM_THOI (rate limit / rớt mạng) khỏi KHONG để không loại oan repo chỉ cài bằng lệnh.
   */
  private async kiemTraCoHuongDanCli(
    owner: string,
    repo: string,
    tenRepoDayDu: string,
  ): Promise<'CO' | 'KHONG' | 'LOI_TAM_THOI'> {
    try {
      const readme = await this.githubService.layReadme(owner, repo);
      if (!readme) return 'KHONG';
      const cliGuide = trichXuatHuongDanCliBangQuyTac(
        readme,
        `https://github.com/${tenRepoDayDu}#readme`,
      );
      return coCachCaiCliHopLe(cliGuide) ? 'CO' : 'KHONG';
    } catch (err) {
      return this.laLoiTamThoi(err) ? 'LOI_TAM_THOI' : 'KHONG';
    }
  }

  /**
   * Ghi log khi dừng lô vì lỗi tạm thời lúc lấy README; ứng viên vẫn giữ CHO_SANG_LOC
   */
  private ghiLogTamDungLoLoiReadme(tenRepoDayDu: string): void {
    this.logger.warn(
      `Phát hiện lỗi tạm thời/rate limit khi lấy README [${tenRepoDayDu}]. Giữ nguyên CHO_SANG_LOC và tạm dừng lô.`,
    );
  }

  /**
   * Hàng đợi dịch nền & Ngân sách ngày (P3B-05.4 - Chốt chặn 3: Chống bão dịch AI)
   * 1. Mô tả: Gom 25 cái/request, tốn rất ít quota.
   * 2. README: Dịch theo ngân sách ngày (mặc định 50 README/ngày), ưu tiên repo nhiều sao và thịnh hành.
   */
  async dichNenTheoNganSachNgay(
    maxReadmeBudget?: number,
    forceRun = false,
  ): Promise<KetQuaDichNen> {
    // Chốt chặn 1: Kiểm tra công tắc kích hoạt trước khi gọi bất kỳ dịch vụ AI nào
    const isEnabled = this.isIngestionEnabled();
    if (!isEnabled && !forceRun) {
      this.logger.log('Dịch nền đang tắt (INGESTION_ENABLED=false). Bỏ qua lượt chạy này.');
      return { daDichMoTa: 0, daDichReadme: 0, nganSachConLai: 0 };
    }

    // 1. Dịch mô tả gom lô (25 items/batch theo mặc định)
    const ketQuaMoTa = await this.appDescriptionTranslationService.dichMoTaCacApp(false);
    const daDichMoTa = ketQuaMoTa.dichThanhCong;

    // 2. Dịch README có ngân sách ngày
    const today = new Date().toISOString().slice(0, 10);
    const budgetKey = `${DayChuyenNapRepoService.BUDGET_PREFIX}${today}`;
    const usedToday = (await this.cacheService.lay<number>(budgetKey)) || 0;
    const dailyLimit =
      maxReadmeBudget ?? this.config.get<number>('INGESTION_DAILY_README_BUDGET', 50);

    const remainingBudget = Math.max(0, dailyLimit - usedToday);

    if (remainingBudget <= 0) {
      this.logger.log(
        `[Ngân Sách AI] Đã chạm trần ngân sách dịch README hôm nay (${usedToday}/${dailyLimit}). Dừng dịch nền.`,
      );
      return { daDichMoTa, daDichReadme: 0, nganSachConLai: 0 };
    }

    // Chốt chặn 4 của Claude: Lọc thông minh, tránh bốc lại liên tục các repo bị lỗi
    // Ưu tiên:
    // 1. Chưa từng dịch tiếng Việt (none: { ngonNgu: 'vi' })
    // 2. Bản dịch đã cũ (DA_CU)
    // 3. Bản dịch thất bại (THAT_BAI) NHƯNG thời gian dịch phải trước ít nhất 6 tiếng
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const staleTranslationBefore = new Date(Date.now() - 10 * 60 * 1000);
    const appsToTranslate = await this.prisma.ungDung.findMany({
      where: {
        trangThai: 'HOAT_DONG',
        OR: [
          { danhSachBanDichReadme: { none: { ngonNgu: 'vi' } } },
          {
            danhSachBanDichReadme: {
              some: {
                ngonNgu: 'vi',
                trangThai: TrangThaiDichReadme.DA_CU,
              },
            },
          },
          {
            danhSachBanDichReadme: {
              some: {
                ngonNgu: 'vi',
                trangThai: TrangThaiDichReadme.THAT_BAI,
                thoiGianDich: { lte: sixHoursAgo },
              },
            },
          },
          {
            danhSachBanDichReadme: {
              some: {
                ngonNgu: 'vi',
                trangThai: TrangThaiDichReadme.DANG_DICH,
                thoiGianDich: { lte: staleTranslationBefore },
              },
            },
          },
        ],
      },
      orderBy: [{ soSaoGithub: 'desc' }, { diemThinhHanh: 'desc' }],
      // Đọc thêm ứng viên vì Redis có thể đang hoãn các README hết quota đến sau nửa đêm.
      take: Math.min(Math.max(Math.min(remainingBudget, 5) * 20, 100), 1000),
    });

    let daDichReadme = 0;
    let soLanKiemTraGithub = 0;
    // Giới hạn số probe để một lượt quét nhiều README hoãn không vét hạn mức GitHub.
    const gioiHanKiemTraGithub = 5;
    for (const app of appsToTranslate) {
      if (daDichReadme >= Math.min(remainingBudget, 5)) break;
      try {
        const ketQuaCho = await this.readmeTranslationService.dangChoDenNgayMai(
          app.maUngDung,
          app.chuSoHuu,
          app.tenKhoChua,
          soLanKiemTraGithub < gioiHanKiemTraGithub,
        );
        if (ketQuaCho.daGoiGitHub) soLanKiemTraGithub++;
        if (ketQuaCho.dangCho) continue;
        const res = await this.readmeTranslationService.layHoacKichHoatDichReadme(app.maUngDung);
        // Chốt chặn 4: Chỉ trừ ngân sách khi thực sự kích hoạt tác vụ dịch nền (res.trangThai !== THAT_BAI)
        if (res && res.trangThai !== TrangThaiDichReadme.THAT_BAI) {
          daDichReadme++;
          const newUsed = usedToday + daDichReadme;
          await this.cacheService.luu(budgetKey, newUsed, 86400); // 24 giờ TTL
        }
      } catch (err) {
        this.logger.warn(`Lỗi khi kích hoạt dịch nền README cho app [${app.tenRepoDayDu}]: ${err}`);
      }
    }

    const nganSachConLai = Math.max(0, dailyLimit - (usedToday + daDichReadme));
    this.logger.log(
      `[Dịch Nền P3B-05.4] Đã dịch ${daDichMoTa} mô tả, kích hoạt ${daDichReadme} README. Ngân sách README còn lại hôm nay: ${nganSachConLai}/${dailyLimit}`,
    );

    return { daDichMoTa, daDichReadme, nganSachConLai };
  }
}

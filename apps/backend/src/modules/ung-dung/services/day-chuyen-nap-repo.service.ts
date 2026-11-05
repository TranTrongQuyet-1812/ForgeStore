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
import {
  TrangThaiUngVienRepo,
  LyDoLoaiUngVien,
  TrangThaiDichReadme,
  UngVienRepo,
} from '@prisma/client';
import { coCachCaiCliHopLe } from '@forgestore/types';
import {
  danhGiaRelease,
  locCucBo,
  NGUONG_LOC_MAC_DINH,
  NguongLoc,
} from '../tien-ich/bo-loc-nap-repo.util';
import {
  chuyenLyDoLoc,
  docKetQuaSangLoc,
  DuLieuSangLoc,
  SO_REPO_MOI_TRUY_VAN,
  taoTruyVanSangLoc,
} from '../tien-ich/sang-loc-graphql.util';

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

/** P3B-06.7: quá số lần lỗi tạm thời này thì chuyển ứng viên sang lỗi. */
const SO_LAN_THU_TOI_DA = 3;
/** P3B-07.6: số ngày trước khi xét lại ứng viên bị loại. */
const SO_NGAY_XET_LAI = 30;

function ketQuaRong(): KetQuaNapLau {
  return {
    soLuongUngVienQuet: 0,
    soLuongDaNap: 0,
    soLuongBiLoai: 0,
    chiTietBiLoai: {},
    rateLimitConLai: null,
  };
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
 * 2. Hạn mức GitHub: dừng khi core còn dưới INGESTION_GITHUB_MIN_REMAINING (mặc định 1.000) hoặc hết ngân sách giờ.
 *    Lỗi mạng / 403 / 429 tạm thời: Dừng lô và giữ CHO_SANG_LOC, không loại oan vĩnh viễn.
 * 3. Không tạo bão dịch: Nạp repo KHÔNG kích hoạt dịch ngay; dịch qua hàng đợi có giới hạn song song và ngân sách ngày.
 * 4. Chạy lại không sinh trùng: upsert theo tenRepoDayDu, khóa phân tán Redis an toàn qua withLock (SET NX PX kèm Lua script).
 * 5. Dữ liệu từ GitHub là không tin cậy: tên, mô tả, topics được giới hạn độ dài; kiểm tra giấy phép mã nguồn mở (GIAY_PHEP_KHONG_MO).
 * 6. Bật tắt được: INGESTION_ENABLED là công tắc tổng, mỗi tầng (khám phá, sàng lọc, dịch) có công tắc riêng.
 */
@Injectable()
export class DayChuyenNapRepoService {
  private readonly logger = new Logger(DayChuyenNapRepoService.name);
  public static readonly LOCK_KEY = 'fs:ingestion:lock';
  public static readonly LOCK_TTL_SECONDS = 900; // 15 phút
  public static readonly BUDGET_PREFIX = 'fs:ai:translation:budget:readme:';
  public static readonly NGAN_SACH_GITHUB_PREFIX = 'fs:ingestion:github:';

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

  /** P3B-06.9: một tầng chỉ chạy khi cả công tắc tổng và công tắc riêng của tầng đó cùng bật. */
  public tangDuocBat(
    congTac:
      | 'INGESTION_DISCOVERY_ENABLED'
      | 'INGESTION_SCREENING_ENABLED'
      | 'INGESTION_TRANSLATION_ENABLED',
  ): boolean {
    return this.isIngestionEnabled() && this.config.get<boolean>(congTac, false);
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
   * Pha 2 & Pha 3: Sàng lọc và Nạp theo lô nhỏ (P3B-06.3 đến 06.8).
   * Chạy khi công tắc tổng và công tắc tầng sàng lọc cùng bật, hoặc khi quản trị viên ép chạy.
   */
  async sangLocVaNapLauNho(batchSize?: number, forceRun = false): Promise<KetQuaNapLau> {
    const configuredLimit = this.config.get<number>('INGESTION_BATCH_SIZE', 30);
    const rawLimit = batchSize ?? configuredLimit;
    const limit = Math.max(1, Math.min(100, Number.isInteger(rawLimit) ? rawLimit : 30));

    if (!this.tangDuocBat('INGESTION_SCREENING_ENABLED') && !forceRun) {
      this.logger.log('Tầng sàng lọc và nạp đang tắt. Bỏ qua lượt chạy này.');
      return { ...ketQuaRong(), daNhayQua: true, lyDo: 'ingestion_disabled' };
    }

    // Khóa phân tán Redis: hai tiến trình không sàng lọc cùng một hàng chờ
    try {
      return await this.cacheService.withLock<KetQuaNapLau>(
        DayChuyenNapRepoService.LOCK_KEY,
        DayChuyenNapRepoService.LOCK_TTL_SECONDS * 1000,
        () => this.thucThiSangLocVaNap(limit),
      );
    } catch (err) {
      if ((err as Error).message?.includes('đang bị khóa')) {
        this.logger.warn('Dây chuyền nạp repo đang có một tiến trình khác chạy, bỏ qua lần này.');
        return { ...ketQuaRong(), dangChay: true, lyDo: 'job_locked' };
      }
      throw err;
    }
  }

  /**
   * Sàng lọc từng nhóm 20 ứng viên bằng một yêu cầu GraphQL rồi phân loại bằng bộ lọc dùng chung.
   * Lỗi tạm thời (hạn mức, mạng) thì dừng lô và tăng số lần thử, không loại oan.
   */
  private async thucThiSangLocVaNap(limit: number): Promise<KetQuaNapLau> {
    const ketQua = ketQuaRong();
    const lyDoDung = await this.lyDoPhaiDung();
    if (lyDoDung) return this.ketThucLo({ ...ketQua, dungDoRateLimit: true, lyDo: lyDoDung });

    await this.xetLaiUngVienBiLoai();
    const ungVien = await this.prisma.ungVienRepo.findMany({
      where: { trangThai: TrangThaiUngVienRepo.CHO_SANG_LOC },
      orderBy: [{ doUuTien: 'asc' }, { ngayTao: 'asc' }],
      take: limit,
    });
    this.logger.log(`[Dây Chuyền Nạp] Bắt đầu sàng lọc lô ${ungVien.length} repo ứng viên...`);

    for (let i = 0; i < ungVien.length; i += SO_REPO_MOI_TRUY_VAN) {
      const nhom = ungVien.slice(i, i + SO_REPO_MOI_TRUY_VAN);
      const lyDo = await this.lyDoPhaiDung();
      if (lyDo) {
        ketQua.lyDo = lyDo;
        break;
      }
      const duLieu = await this.sangLocNhom(nhom);
      if (!duLieu) break;
      if (await this.xuLyNhom(nhom, duLieu, ketQua)) break;
    }
    return this.ketThucLo(ketQua);
  }

  /**
   * Một yêu cầu GraphQL cho cả nhóm. Lỗi ở đây (mạng, hạn mức GraphQL) là của cả yêu cầu chứ không của
   * ứng viên nào, nên không tăng số lần thử, chỉ trả null để dừng lô và để lượt sau thử lại.
   */
  private async sangLocNhom(
    nhom: UngVienRepo[],
  ): Promise<Map<string, DuLieuSangLoc | null> | null> {
    const ten = nhom.map((u) => u.tenRepoDayDu);
    try {
      await this.dungNganSachGithub(1);
      const data = await this.githubService.graphql<Record<string, never>>(taoTruyVanSangLoc(ten));
      return docKetQuaSangLoc(data, ten);
    } catch (err) {
      this.logger.warn(`Sàng lọc GraphQL lỗi, giữ nguyên hàng chờ và dừng lô: ${String(err)}`);
      return null;
    }
  }

  /** Trả true khi phải dừng cả lô (lỗi tạm thời hoặc chạm trần số app). */
  private async xuLyNhom(
    nhom: UngVienRepo[],
    duLieu: Map<string, DuLieuSangLoc | null>,
    ketQua: KetQuaNapLau,
  ): Promise<boolean> {
    for (const uv of nhom) {
      if (await this.datTranSoApp()) {
        ketQua.lyDo = 'dat_tran_so_app';
        return true;
      }
      ketQua.soLuongUngVienQuet++;
      const du = duLieu.get(uv.tenRepoDayDu.toLowerCase()) ?? null;
      const kq = await this.xuLyMotUngVien(uv, du, ketQua.chiTietBiLoai);
      if (kq === 'DA_NAP') ketQua.soLuongDaNap++;
      if (kq === 'BI_LOAI') ketQua.soLuongBiLoai++;
      if (kq === 'DUNG_LO') return true;
    }
    return false;
  }

  /** Bộ lọc dùng chung (P3B-06.3) rồi nạp; không có tệp cài thì xét lệnh cài trong README (D-30). */
  private async xuLyMotUngVien(
    uv: UngVienRepo,
    du: DuLieuSangLoc | null,
    chiTietBiLoai: Record<string, number>,
  ): Promise<'DA_NAP' | 'BI_LOAI' | 'DUNG_LO' | 'BO_QUA'> {
    // Repo không còn (xóa, chuyển riêng tư) thì GraphQL trả null
    if (!du) return this.loaiUngVien(uv.maUngVien, LyDoLoaiUngVien.LOI_KHI_SANG_LOC, chiTietBiLoai);
    const now = new Date();
    const nguong = this.layNguongLoc();
    const cucBo = locCucBo(du.repo, now, nguong);
    if (!cucBo.dat) return this.loaiUngVien(uv.maUngVien, chuyenLyDoLoc(cucBo.lyDo), chiTietBiLoai);
    if (await this.daCoTrongKho(du.repo.full_name)) {
      await this.datTrangThai(uv.maUngVien, TrangThaiUngVienRepo.DA_NAP);
      return 'BO_QUA';
    }
    const release = danhGiaRelease(du.releases, now, nguong);
    if (!release.dat) {
      const khongCoTepCai =
        release.lyDo === 'KHONG_CO_BAN_PHAT_HANH' || release.lyDo === 'KHONG_CO_FILE_CAI';
      if (!khongCoTepCai) {
        return this.loaiUngVien(uv.maUngVien, chuyenLyDoLoc(release.lyDo), chiTietBiLoai);
      }
      const [owner = '', repo = ''] = du.repo.full_name.split('/');
      await this.dungNganSachGithub(1);
      const cli = await this.kiemTraCoHuongDanCli(owner, repo, du.repo.full_name);
      if (cli === 'LOI_TAM_THOI') {
        this.ghiLogTamDungLoLoiReadme(du.repo.full_name);
        await this.tangSoLanThu(uv);
        return 'DUNG_LO';
      }
      if (cli === 'KHONG') {
        return this.loaiUngVien(uv.maUngVien, chuyenLyDoLoc(release.lyDo), chiTietBiLoai);
      }
    }
    return this.napDayDu(uv, du.repo.full_name, chiTietBiLoai);
  }

  /** Nạp đầy đủ qua `dongBoRepo` bằng tên chuẩn GitHub trả về (repo đổi tên vẫn lưu đúng tên mới). */
  private async napDayDu(
    uv: UngVienRepo,
    tenChuan: string,
    chiTietBiLoai: Record<string, number>,
  ): Promise<'DA_NAP' | 'BI_LOAI' | 'DUNG_LO'> {
    const [owner = '', repo = ''] = tenChuan.split('/');
    try {
      // dongBoRepo gọi khoảng 5 yêu cầu GitHub (repo, release, README, người đóng góp...)
      await this.dungNganSachGithub(5);
      await this.appsService.dongBoRepo(owner, repo);
      await this.datTrangThai(uv.maUngVien, TrangThaiUngVienRepo.DA_NAP);
      this.logger.log(`✅ [Nạp Thành Công] ${tenChuan}`);
      return 'DA_NAP';
    } catch (err) {
      this.logger.error(`Lỗi khi nạp đầy đủ repo [${tenChuan}]:`, err);
      if (this.laLoiTamThoi(err)) {
        await this.tangSoLanThu(uv);
        return 'DUNG_LO';
      }
      return this.loaiUngVien(uv.maUngVien, LyDoLoaiUngVien.LOI_KHI_SANG_LOC, chiTietBiLoai);
    }
  }

  /** Tính lại Thịnh hành một lần sau lô (không tính sau từng repo), ghi log tổng kết. */
  private async ketThucLo(ketQua: KetQuaNapLau): Promise<KetQuaNapLau> {
    if (ketQua.soLuongDaNap > 0) {
      try {
        await this.trendingDecayJob.capNhatDiemThinhHanhToanBo();
      } catch (err) {
        this.logger.error('Lỗi khi tính lại điểm Thịnh hành sau lô nạp:', err);
      }
    }
    const rate = this.githubService.getRateLimitInfo();
    ketQua.rateLimitConLai = rate.remaining;
    this.logger.log(
      `🏁 [Lô Nạp Hoàn Tất] Đã quét: ${ketQua.soLuongUngVienQuet}, Đã nạp: ${ketQua.soLuongDaNap}, Bị loại: ${ketQua.soLuongBiLoai}${ketQua.lyDo ? `, dừng vì ${ketQua.lyDo}` : ''}. Quota GitHub: ${rate.remaining ?? 'N/A'}/${rate.limit ?? 'N/A'}`,
    );
    return ketQua;
  }

  /**
   * P3B-06.8: dừng khi hạn mức core còn dưới ngưỡng (token dùng chung với người dùng mở trang và job quét)
   * hoặc đã dùng hết ngân sách yêu cầu của giờ này.
   */
  private async lyDoPhaiDung(): Promise<string | undefined> {
    const conLai = this.githubService.getRateLimitInfo().remaining;
    const nguong = this.config.get<number>('INGESTION_GITHUB_MIN_REMAINING', 1000);
    if (conLai !== null && conLai < nguong) {
      this.logger.warn(`Hạn mức GitHub còn ${conLai} (< ${nguong}). Dừng nạp để bảo vệ token.`);
      return 'github_rate_limited';
    }
    const daDung = (await this.cacheService.lay<number>(this.khoaNganSachGio())) ?? 0;
    if (daDung >= this.config.get<number>('INGESTION_GITHUB_BUDGET_PER_HOUR', 2000)) {
      return 'het_ngan_sach_gio';
    }
    return undefined;
  }

  private khoaNganSachGio(): string {
    return `${DayChuyenNapRepoService.NGAN_SACH_GITHUB_PREFIX}${new Date().toISOString().slice(0, 13)}`;
  }

  /** Cộng số yêu cầu GitHub tầng nạp đã dùng trong giờ (P3B-06.8, cũng là số liệu cho P3B-21). */
  public async dungNganSachGithub(soYeuCau: number): Promise<void> {
    await this.cacheService.tangSo(this.khoaNganSachGio(), soYeuCau, 7200);
  }

  /** P3B-06.3 lọc 11: trần tổng số app trong kho. */
  private async datTranSoApp(): Promise<boolean> {
    const tran = this.config.get<number>('INGESTION_MAX_APPS', 10000);
    return (await this.prisma.ungDung.count()) >= tran;
  }

  private async daCoTrongKho(tenRepo: string): Promise<boolean> {
    const app = await this.prisma.ungDung.findFirst({
      where: { tenRepoDayDu: { equals: tenRepo, mode: 'insensitive' } },
      select: { maUngDung: true },
    });
    return Boolean(app);
  }

  /** Ngưỡng lọc lấy từ biến môi trường, dùng chung cho tầng khám phá và tầng sàng lọc. */
  public layNguongLoc(): NguongLoc {
    return {
      ...NGUONG_LOC_MAC_DINH,
      minStars: this.config.get<number>('INGESTION_MIN_STARS', NGUONG_LOC_MAC_DINH.minStars),
      maxPushThang: this.config.get<number>(
        'INGESTION_MAX_PUSH_AGE_MONTHS',
        NGUONG_LOC_MAC_DINH.maxPushThang,
      ),
      maxReleaseThang: this.config.get<number>(
        'INGESTION_MAX_RELEASE_AGE_MONTHS',
        NGUONG_LOC_MAC_DINH.maxReleaseThang,
      ),
    };
  }

  /**
   * P3B-06.7: lỗi tạm thời không loại oan, nhưng quá 3 lần thì chuyển sang lỗi để ứng viên này
   * không nằm mãi ở đầu hàng chờ.
   */
  private async tangSoLanThu(uv: UngVienRepo): Promise<void> {
    if (uv.soLanThu + 1 > SO_LAN_THU_TOI_DA) {
      await this.loaiUngVien(uv.maUngVien, LyDoLoaiUngVien.LOI_KHI_SANG_LOC, {});
      return;
    }
    await this.prisma.ungVienRepo.update({
      where: { maUngVien: uv.maUngVien },
      data: { soLanThu: { increment: 1 } },
    });
  }

  /**
   * P3B-07.6: repo bị loại được xét lại sau 30 ngày (có thể đã ra bản cài hoặc thêm sao).
   * Không xét lại repo trong danh sách chặn hay là fork vì không tự đổi được.
   */
  private async xetLaiUngVienBiLoai(): Promise<number> {
    const kq = await this.prisma.ungVienRepo.updateMany({
      where: {
        trangThai: TrangThaiUngVienRepo.BI_LOAI,
        ngayCapNhat: { lt: new Date(Date.now() - SO_NGAY_XET_LAI * 86400000) },
        lyDoLoai: { notIn: [LyDoLoaiUngVien.TRONG_DANH_SACH_CHAN, LyDoLoaiUngVien.LA_FORK] },
      },
      data: { trangThai: TrangThaiUngVienRepo.CHO_SANG_LOC, lyDoLoai: null, soLanThu: 0 },
    });
    if (kq.count > 0) {
      this.logger.log(`[Xét lại] ${kq.count} ứng viên bị loại quá 30 ngày được đưa lại hàng chờ.`);
    }
    return kq.count;
  }

  private async datTrangThai(maUngVien: string, trangThai: TrangThaiUngVienRepo): Promise<void> {
    await this.prisma.ungVienRepo.update({
      where: { maUngVien },
      data: { trangThai, lyDoLoai: null },
    });
  }

  /**
   * Gán lý do loại ứng viên (Chốt chặn 1: TUYỆT ĐỐI KHÔNG XÓA DÒNG BỊ LOẠI)
   */
  private async loaiUngVien(
    maUngVien: string,
    lyDoLoai: LyDoLoaiUngVien,
    chiTietBiLoai: Record<string, number>,
  ): Promise<'BI_LOAI'> {
    await this.prisma.ungVienRepo.update({
      where: { maUngVien },
      data: {
        trangThai: TrangThaiUngVienRepo.BI_LOAI,
        lyDoLoai,
      },
    });
    chiTietBiLoai[lyDoLoai] = (chiTietBiLoai[lyDoLoai] || 0) + 1;
    return 'BI_LOAI';
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
    // Chốt chặn 1: Kiểm tra công tắc kích hoạt trước khi gọi bất kỳ dịch vụ AI nào (P3B-06.12)
    if (!this.tangDuocBat('INGESTION_TRANSLATION_ENABLED') && !forceRun) {
      this.logger.log('Tầng dịch nền đang tắt. Bỏ qua lượt chạy này.');
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

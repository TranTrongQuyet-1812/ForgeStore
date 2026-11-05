import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { CacheService } from '../../redis/cache.service';
import { GITHUB_CONSTANTS } from '../../github/github.constants';
import { DayChuyenNapRepoService } from './day-chuyen-nap-repo.service';
import { CHU_DE_KHAM_PHA, DAI_SAO, locCucBo, RepoUngVien } from '../tien-ich/bo-loc-nap-repo.util';
import { docTenRepoTrending } from '../tien-ich/sang-loc-graphql.util';

/** Mỗi lượt khám phá đọc tối đa chừng này trang Search, cách nhau 4 giây (khoảng 15 yêu cầu/phút, P3B-06.1). */
const SO_TRANG_SEARCH_MOI_LUOT = 10;
const GIAN_CACH_SEARCH_MS = 4000;
const TRANG_SEARCH_TOI_DA = 10; // Search chỉ trả tối đa 1.000 kết quả mỗi truy vấn
const CAC_KY_TRENDING = ['daily', 'weekly', 'monthly'] as const;

export interface ConTroKhamPha {
  dai: number;
  chuDe: number;
  trang: number;
}

export interface KetQuaKhamPha {
  daNhayQua?: boolean;
  trending: number;
  nhieuSao: number;
  dangChuY: number;
  soYeuCauSearch: number;
}

/** Bước con trỏ qua dải sao × chủ đề × trang; hết vòng thì quay lại đầu (hàm thuần để test). */
export function tienConTro(conTro: ConTroKhamPha, hetTrang: boolean): ConTroKhamPha {
  if (!hetTrang && conTro.trang < TRANG_SEARCH_TOI_DA)
    return { ...conTro, trang: conTro.trang + 1 };
  if (conTro.chuDe + 1 < CHU_DE_KHAM_PHA.length) {
    return { dai: conTro.dai, chuDe: conTro.chuDe + 1, trang: 1 };
  }
  return { dai: (conTro.dai + 1) % DAI_SAO.length, chuDe: 0, trang: 1 };
}

/**
 * Tầng khám phá (P3B-06.1, P3B-06.2): đưa ứng viên vào hàng chờ theo độ ưu tiên
 * 1 = Trending, 2 = nhiều sao, 3 = đáng chú ý. Không gọi AI, không nạp; sàng lọc làm ở tầng sau.
 */
@Injectable()
export class KhamPhaRepoService {
  private readonly logger = new Logger(KhamPhaRepoService.name);
  public static readonly KHOA_CON_TRO = 'fs:ingestion:discovery:cursor';
  public static readonly KHOA_TRENDING = 'fs:ingestion:trending:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
    private readonly dayChuyen: DayChuyenNapRepoService,
  ) {}

  async khamPhaTuDong(forceRun = false): Promise<KetQuaKhamPha> {
    const ketQua: KetQuaKhamPha = { trending: 0, nhieuSao: 0, dangChuY: 0, soYeuCauSearch: 0 };
    if (!this.dayChuyen.tangDuocBat('INGESTION_DISCOVERY_ENABLED') && !forceRun) {
      return { ...ketQua, daNhayQua: true };
    }
    ketQua.trending = await this.khamPhaTrending();
    ketQua.nhieuSao = await this.khamPhaNhieuSao(ketQua);
    ketQua.dangChuY = await this.khamPhaDangChuY(ketQua);
    this.logger.log(
      `[Khám phá] Thêm ${ketQua.trending} từ Trending, ${ketQua.nhieuSao} nhiều sao, ${ketQua.dangChuY} đáng chú ý (${ketQua.soYeuCauSearch} lượt Search).`,
    );
    return ketQua;
  }

  /**
   * P3B-06.2: đọc trang Trending tối đa 3 yêu cầu mỗi ngày (một lần cho mỗi kỳ). Bị chặn hoặc trang
   * đổi giao diện thì bỏ qua nguồn này, các nguồn khác vẫn chạy. Lọc làm ở tầng sàng lọc.
   */
  private async khamPhaTrending(): Promise<number> {
    let them = 0;
    const ngay = new Date().toISOString().slice(0, 10);
    for (const ky of CAC_KY_TRENDING) {
      const daDoc = await this.cacheService.setNx(
        `${KhamPhaRepoService.KHOA_TRENDING}${ky}:${ngay}`,
        86400,
      );
      if (!daDoc) continue;
      try {
        const res = await fetch(`https://github.com/trending?since=${ky}`, {
          headers: {
            'User-Agent': `${GITHUB_CONSTANTS.USER_AGENT} (+https://github.com/TranTrongQuyet-1812/ForgeStore_Project)`,
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          this.logger.warn(`Trending ${ky} trả ${res.status}, bỏ qua nguồn này hôm nay.`);
          continue;
        }
        const ten = docTenRepoTrending(await res.text());
        if (ten.length === 0)
          this.logger.warn(`Trending ${ky}: không đọc được repo nào (trang đổi giao diện?).`);
        them += await this.themUngVien(ten, `trending_${ky}`, 1);
      } catch (err) {
        this.logger.warn(`Không đọc được Trending ${ky}: ${String(err)}`);
      }
    }
    return them;
  }

  /** P3B-06.1: Search theo dải sao × chủ đề, sắp theo sao giảm dần; con trỏ lưu Redis để lượt sau đọc tiếp. */
  private async khamPhaNhieuSao(ketQua: KetQuaKhamPha): Promise<number> {
    let them = 0;
    let conTro = (await this.cacheService.lay<ConTroKhamPha>(KhamPhaRepoService.KHOA_CON_TRO)) ?? {
      dai: 0,
      chuDe: 0,
      trang: 1,
    };
    for (let i = 0; i < SO_TRANG_SEARCH_MOI_LUOT; i++) {
      const q =
        `stars:${DAI_SAO[conTro.dai]} archived:false fork:false pushed:>=${this.ngayPushToiThieu()} ${CHU_DE_KHAM_PHA[conTro.chuDe]}`.trim();
      const items = await this.timKiem(q, 'stars', conTro.trang, ketQua);
      if (items === null) break;
      them += await this.themUngVien(this.locSoBo(items), 'search_sao', 2);
      conTro = tienConTro(conTro, items.length < 100);
      await this.cacheService.luu(KhamPhaRepoService.KHOA_CON_TRO, conTro, 31536000);
    }
    return them;
  }

  /** "Đáng chú ý": repo đủ sao vừa push trong 7 ngày, một trang mỗi lượt (độ ưu tiên 3). */
  private async khamPhaDangChuY(ketQua: KetQuaKhamPha): Promise<number> {
    const tuanTruoc = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const q = `stars:>=${this.dayChuyen.layNguongLoc().minStars} archived:false fork:false pushed:>=${tuanTruoc}`;
    const items = await this.timKiem(q, 'updated', 1, ketQua);
    return items ? this.themUngVien(this.locSoBo(items), 'dang_chu_y', 3) : 0;
  }

  private async timKiem(
    q: string,
    sapXep: 'stars' | 'updated',
    trang: number,
    ketQua: KetQuaKhamPha,
  ): Promise<RepoUngVien[] | null> {
    try {
      await new Promise((r) => setTimeout(r, GIAN_CACH_SEARCH_MS));
      ketQua.soYeuCauSearch++;
      await this.dayChuyen.dungNganSachGithub(1);
      const kq = await this.githubService.timKiemRepo(q, 100, trang, sapXep);
      return kq.items as unknown as RepoUngVien[];
    } catch (err) {
      this.logger.warn(`Search lỗi, dừng khám phá lượt này: ${String(err)}`);
      return null;
    }
  }

  /** Bộ lọc 1–5 và 7 làm ngay trên kết quả Search (không tốn thêm yêu cầu), repo không đạt không vào hàng chờ. */
  private locSoBo(items: RepoUngVien[]): string[] {
    const nguong = this.dayChuyen.layNguongLoc();
    return items.filter((r) => locCucBo(r, new Date(), nguong).dat).map((r) => r.full_name);
  }

  /** Bộ lọc 6: bỏ repo đã có trong kho hoặc hàng chờ; `skipDuplicates` chặn trùng khi hai lượt chạy chồng. */
  private async themUngVien(ten: string[], nguon: string, doUuTien: number): Promise<number> {
    const hopLe = ten.map((t) => this.dayChuyen.chuanHoaTenRepo(t)).filter((t): t is string => !!t);
    if (hopLe.length === 0) return 0;
    const daCo = new Set(
      [
        ...(await this.prisma.ungDung.findMany({
          where: { tenRepoDayDu: { in: hopLe } },
          select: { tenRepoDayDu: true },
        })),
        ...(await this.prisma.ungVienRepo.findMany({
          where: { tenRepoDayDu: { in: hopLe } },
          select: { tenRepoDayDu: true },
        })),
      ].map((r) => r.tenRepoDayDu.toLowerCase()),
    );
    const moi = hopLe.filter((t) => !daCo.has(t.toLowerCase()));
    if (moi.length === 0) return 0;
    const kq = await this.prisma.ungVienRepo.createMany({
      data: moi.map((tenRepoDayDu) => ({ tenRepoDayDu, nguonKhamPha: nguon, doUuTien })),
      skipDuplicates: true,
    });
    return kq.count;
  }

  private ngayPushToiThieu(): string {
    const thang = this.dayChuyen.layNguongLoc().maxPushThang;
    return new Date(Date.now() - thang * 30.4375 * 86400000).toISOString().slice(0, 10);
  }
}

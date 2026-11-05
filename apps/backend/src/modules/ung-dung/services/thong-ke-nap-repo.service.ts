import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { CacheService } from '../../redis/cache.service';
import { DayChuyenNapRepoService } from './day-chuyen-nap-repo.service';
import { TheoDoiThayDoiService } from './theo-doi-thay-doi.service';

const CONG_TAC = [
  'INGESTION_ENABLED',
  'INGESTION_DISCOVERY_ENABLED',
  'INGESTION_SCREENING_ENABLED',
  'INGESTION_TRANSLATION_ENABLED',
  'INGESTION_WATCH_ENABLED',
] as const;

/** Gom kết quả groupBy của Prisma thành { giá trị: số dòng }. */
function demTheo<T extends Record<string, unknown>>(
  dong: Array<T & { _count: { _all: number } }>,
  truong: keyof T,
): Record<string, number> {
  return Object.fromEntries(dong.map((d) => [String(d[truong] ?? 'KHONG_RO'), d._count._all]));
}

/**
 * Bảng sức khỏe của nạp và theo dõi (P3B-06.11 và P3B-21.3): một chỗ xem toàn bộ số liệu
 * để quyết bật dần 20 → 50 → 100 hay dừng (tiêu chí ở P3B-21.4). Chỉ đọc.
 */
@Injectable()
export class ThongKeNapRepoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
    private readonly config: ConfigService,
  ) {}

  async laySucKhoe() {
    const [ungVien, kho, dich] = await Promise.all([
      this.thongKeUngVien(),
      this.thongKeKho(),
      this.thongKeDich(),
    ]);
    return {
      congTac: Object.fromEntries(CONG_TAC.map((k) => [k, this.config.get<boolean>(k, false)])),
      github: await this.thongKeGithub(),
      ungVien,
      kho,
      theoDoi: await this.thongKeTheoDoi(),
      dich,
    };
  }

  private async thongKeUngVien() {
    const [theoTrangThai, theoNguon, theoUuTien, theoLyDo] = await Promise.all([
      this.prisma.ungVienRepo.groupBy({ by: ['trangThai'], _count: { _all: true } }),
      this.prisma.ungVienRepo.groupBy({ by: ['nguonKhamPha'], _count: { _all: true } }),
      this.prisma.ungVienRepo.groupBy({
        by: ['doUuTien'],
        where: { trangThai: 'CHO_SANG_LOC' },
        _count: { _all: true },
      }),
      this.prisma.ungVienRepo.groupBy({
        by: ['lyDoLoai'],
        where: { trangThai: 'BI_LOAI' },
        _count: { _all: true },
      }),
    ]);
    return {
      theoTrangThai: demTheo(theoTrangThai, 'trangThai'),
      theoNguon: demTheo(theoNguon, 'nguonKhamPha'),
      dangChoTheoUuTien: demTheo(theoUuTien, 'doUuTien'),
      biLoaiTheoLyDo: demTheo(theoLyDo, 'lyDoLoai'),
    };
  }

  private async thongKeKho() {
    const [theoTrangThai, theoMucNong, denHan] = await Promise.all([
      this.prisma.ungDung.groupBy({ by: ['trangThai'], _count: { _all: true } }),
      this.prisma.ungDung.groupBy({ by: ['mucDoNong'], _count: { _all: true } }),
      this.prisma.ungDung.count({
        where: {
          trangThai: { in: ['HOAT_DONG', 'KHONG_CO_BAN_CAI'] },
          OR: [{ lanKiemTiepTheo: null }, { lanKiemTiepTheo: { lte: new Date() } }],
        },
      }),
    ]);
    return {
      theoTrangThai: demTheo(theoTrangThai, 'trangThai'),
      theoMucNong: demTheo(theoMucNong, 'mucDoNong'),
      soAppDenHanQuet: denHan,
    };
  }

  private async thongKeGithub() {
    const gio = new Date().toISOString().slice(0, 13);
    const daDung = await this.cacheService.lay<number>(
      `${DayChuyenNapRepoService.NGAN_SACH_GITHUB_PREFIX}${gio}`,
    );
    return {
      ...this.githubService.getRateLimitInfo(),
      napDaDungGioNay: daDung ?? 0,
      nganSachGio: this.config.get<number>('INGESTION_GITHUB_BUDGET_PER_HOUR', 2000),
    };
  }

  /** Số liệu theo dõi thay đổi hôm nay; tỷ lệ 304 cao nghĩa là quét cả kho gần như không tốn hạn mức. */
  private async thongKeTheoDoi() {
    const khoa = `${TheoDoiThayDoiService.KHOA_THONG_KE}${new Date().toISOString().slice(0, 10)}:`;
    const doc = async (ten: string) => (await this.cacheService.lay<number>(`${khoa}${ten}`)) ?? 0;
    const [app, coDoi, yeuCau, so304] = [
      await doc('app'),
      await doc('co_doi'),
      await doc('yeu_cau'),
      await doc('304'),
    ];
    return {
      homNay: {
        app,
        coDoi,
        yeuCau,
        so304,
        tyLe304: yeuCau ? Math.round((so304 / yeuCau) * 100) / 100 : null,
      },
    };
  }

  /** Bản dịch README theo trạng thái (DA_CU tăng liên tục là dấu hiệu dịch không theo kịp) và theo nhà dịch. */
  private async thongKeDich() {
    const [theoTrangThai, theoMoHinh] = await Promise.all([
      this.prisma.banDichReadme.groupBy({ by: ['trangThai'], _count: { _all: true } }),
      this.prisma.banDichReadme.groupBy({ by: ['moHinhDich'], _count: { _all: true } }),
    ]);
    return {
      readmeTheoTrangThai: demTheo(theoTrangThai, 'trangThai'),
      readmeTheoMoHinh: demTheo(theoMoHinh, 'moHinhDich'),
    };
  }
}

import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DinhDangTep, Prisma, TrangThaiDichReadme } from '@prisma/client';
import { coCachCaiCliHopLe } from '@forgestore/types';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { GithubRelease, GithubRepo } from '../../github/github.constants';
import { CacheService } from '../../redis/cache.service';
import { PHIEN_BAN_BOC_TACH_CLI, UngDungService } from '../ung-dung.service';
import { locTepCaiCuaBanPhatHanh } from '../tien-ich/phan-loai-tep.util';
import { NGOAI_LE_GIAY_PHEP } from '../tien-ich/bo-loc-nap-repo.util';
import { trichXuatHuongDanCliBangQuyTac } from '../../ai/tien-ich/cli-guide-extractor.util';

/** Trạng thái ẩn khỏi Store do bộ theo dõi đặt (P3B-07.5). Dữ liệu và Thư viện người dùng giữ nguyên. */
export const TRANG_THAI_AN = {
  REPO_DA_XOA: 'REPO_DA_XOA',
  REPO_DOI_TEN: 'REPO_DOI_TEN',
  KHONG_CON_GIAY_PHEP: 'KHONG_CON_GIAY_PHEP',
} as const;

export type MucDoNong = 'NONG' | 'AM' | 'LANH';

/** Lượt quét lỗi thì hẹn lại sau chừng này giờ, để app lỗi không đứng đầu hàng mỗi 10 phút. */
const GIO_HEN_LAI_KHI_LOI = 1;

/** P3B-07.9: nóng 3 giờ, ấm mỗi ngày, lạnh mỗi tuần. */
export const NHIP_QUET_GIO: Record<MucDoNong, number> = { NONG: 3, AM: 24, LANH: 168 };

export interface AppTheoDoi {
  maUngDung: string;
  tenRepoDayDu: string;
  trangThai: string;
  readmeSha: string | null;
  moTaGocTiengAnh: string | null;
  loaiGiayPhep: string | null;
  daLuuTru: boolean;
  soSaoGithub: number;
  pushedAt: Date | null;
  etagRepo: string | null;
  etagReleases: string | null;
  etagReadme: string | null;
  danhSachPhatHanh: Array<{
    tenPhienBan: string;
    ngayPhatHanh: Date;
    _count: { danhSachTepCaiDat: number };
  }>;
  _count: { danhSachDaCai: number; danhSachYeuThich: number };
}

/**
 * Mức nóng (P3B-07.9): nóng nếu có bản phát hành trong 30 ngày, có người cài hoặc yêu thích, hoặc rất nhiều sao;
 * lạnh nếu 180 ngày không push; còn lại là ấm. Hàm thuần để test.
 */
export function tinhMucDoNong(app: AppTheoDoi, now: Date): MucDoNong {
  const ngay = (d: Date | null | undefined) =>
    d ? (now.getTime() - d.getTime()) / 86400000 : Infinity;
  const banMoi = app.danhSachPhatHanh[0];
  const coNguoiDung = app._count.danhSachDaCai + app._count.danhSachYeuThich > 0;
  if (ngay(banMoi?.ngayPhatHanh) <= 30 || coNguoiDung || app.soSaoGithub >= 20000) return 'NONG';
  if (ngay(app.pushedAt) > 180) return 'LANH';
  return 'AM';
}

/** Bản phát hành mới nhất (bỏ bản nháp), theo ngày đăng. */
export function banMoiNhat(releases: GithubRelease[]): GithubRelease | null {
  const ban = releases
    .filter((r) => !r.draft)
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0];
  return ban ?? null;
}

/**
 * Cần đồng bộ lại khi có bản mới hơn, hoặc cùng bản nhưng số tệp cài hợp lệ khác DB: nhiều repo tạo bản phát hành
 * trước rồi CI mới tải tệp lên. Không đồng bộ chỉ vì ETag đổi, vì ETag đổi cả khi số lượt tải thay đổi.
 */
export function canDongBoLai(
  banGithub: GithubRelease | null,
  banDb: AppTheoDoi['danhSachPhatHanh'][number] | undefined,
): boolean {
  if (!banGithub) return false;
  if (banGithub.tag_name !== banDb?.tenPhienBan) return true;
  return locTepCaiCuaBanPhatHanh(banGithub.assets ?? []).length !== banDb._count.danhSachTepCaiDat;
}

export interface KetQuaQuet {
  daNhayQua?: boolean;
  soApp: number;
  soKhongDoi: number;
  soCoDoi: number;
  soYeuCau: number;
  so304: number;
  dungVi?: string;
}

/**
 * Bộ theo dõi thay đổi bằng ETag (P3B-07), thay job quét bản phát hành cũ khi bật `INGESTION_WATCH_ENABLED`.
 * Hỏi có điều kiện 3 nguồn (thông tin repo, danh sách bản phát hành, README) bằng ETag lưu trong DB;
 * GitHub trả 304 thì không tốn hạn mức. Có đổi thì chỉ cập nhật phần đổi.
 */
@Injectable()
export class TheoDoiThayDoiService {
  private readonly logger = new Logger(TheoDoiThayDoiService.name);
  public static readonly KHOA_THONG_KE = 'fs:watch:stats:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
    private readonly appsService: UngDungService,
    private readonly config: ConfigService,
  ) {}

  dangBat(): boolean {
    return this.config.get<boolean>('INGESTION_WATCH_ENABLED', false);
  }

  /** Quét các app đến hạn (lan_kiem_tiep_theo đã qua hoặc chưa có), sớm nhất trước. */
  async quetMotLuot(soApp?: number, forceRun = false): Promise<KetQuaQuet> {
    const ketQua: KetQuaQuet = { soApp: 0, soKhongDoi: 0, soCoDoi: 0, soYeuCau: 0, so304: 0 };
    if (!this.dangBat() && !forceRun) return { ...ketQua, daNhayQua: true };
    const apps = await this.layAppDenHan(soApp ?? this.config.get<number>('WATCH_BATCH_SIZE', 100));
    for (const app of apps) {
      const nguong = this.config.get<number>('INGESTION_GITHUB_MIN_REMAINING', 1000);
      const conLai = this.githubService.getRateLimitInfo().remaining;
      if (conLai !== null && conLai < nguong) {
        ketQua.dungVi = 'github_rate_limited';
        break;
      }
      try {
        const coDoi = await this.kiemMotApp(app, ketQua);
        ketQua.soApp++;
        if (coDoi) ketQua.soCoDoi++;
        else ketQua.soKhongDoi++;
      } catch (err) {
        this.logger.warn(`Quét thay đổi [${app.tenRepoDayDu}] lỗi: ${String(err)}`);
        await this.henQuetLaiKhiLoi(app);
        if (String(err).includes('hạn mức')) {
          ketQua.dungVi = 'github_rate_limited';
          break;
        }
      }
    }
    await this.ghiThongKe(ketQua);
    this.logger.log(
      `[Theo dõi thay đổi] ${ketQua.soApp} app: ${ketQua.soKhongDoi} không đổi, ${ketQua.soCoDoi} có đổi; ${ketQua.so304}/${ketQua.soYeuCau} yêu cầu trả 304.`,
    );
    return ketQua;
  }

  private layAppDenHan(soApp: number): Promise<AppTheoDoi[]> {
    return this.prisma.ungDung.findMany({
      where: {
        trangThai: { in: ['HOAT_DONG', 'KHONG_CO_BAN_CAI'] },
        OR: [{ lanKiemTiepTheo: null }, { lanKiemTiepTheo: { lte: new Date() } }],
      },
      orderBy: { lanKiemTiepTheo: { sort: 'asc', nulls: 'first' } },
      take: soApp,
      select: {
        maUngDung: true,
        tenRepoDayDu: true,
        trangThai: true,
        readmeSha: true,
        moTaGocTiengAnh: true,
        loaiGiayPhep: true,
        daLuuTru: true,
        soSaoGithub: true,
        pushedAt: true,
        etagRepo: true,
        etagReleases: true,
        etagReadme: true,
        danhSachPhatHanh: {
          orderBy: { ngayPhatHanh: 'desc' },
          take: 1,
          select: {
            tenPhienBan: true,
            ngayPhatHanh: true,
            _count: { select: { danhSachTepCaiDat: true } },
          },
        },
        _count: { select: { danhSachDaCai: true, danhSachYeuThich: true } },
      },
    });
  }

  /** Trả true nếu có thay đổi người dùng thấy được. Luôn đặt lần quét kế tiếp theo mức nóng. */
  async kiemMotApp(app: AppTheoDoi, ketQua: KetQuaQuet): Promise<boolean> {
    const repo = await this.kiemThongTinRepo(app, ketQua);
    if (repo === 'DA_AN') return true;
    const banMoi = await this.kiemBanPhatHanh(app, ketQua);
    const readmeDoi = await this.kiemReadme(app, ketQua);
    const now = new Date();
    const muc = tinhMucDoNong(app, now);
    await this.prisma.ungDung.update({
      where: { maUngDung: app.maUngDung },
      data: {
        mucDoNong: muc,
        lanKiemTiepTheo: new Date(now.getTime() + NHIP_QUET_GIO[muc] * 3600000),
      },
    });
    const coDoi = repo === 'DOI_HIEN_THI' || banMoi || readmeDoi;
    if (repo === 'DOI_HIEN_THI' || readmeDoi) await this.xoaCacheHienThi(app);
    return coDoi;
  }

  /**
   * Nguồn 1, thông tin repo. 404 thì repo đã xóa; tên trả về khác tên đã lưu thì repo đổi tên hoặc chuyển chủ;
   * mất giấy phép thì ẩn. Repo archive vẫn hiện kèm nhãn (D-29), chỉ đặt cờ.
   */
  private async kiemThongTinRepo(
    app: AppTheoDoi,
    ketQua: KetQuaQuet,
  ): Promise<'KHONG_DOI' | 'DOI_NGAM' | 'DOI_HIEN_THI' | 'DA_AN'> {
    const kq = await this.hoi<GithubRepo>(`/repos/${app.tenRepoDayDu}`, app.etagRepo, ketQua);
    if (kq.trangThai === 304) return 'KHONG_DOI';
    if (kq.trangThai === 404) return this.anApp(app, TRANG_THAI_AN.REPO_DA_XOA);
    const r = kq.duLieu!;
    if (r.full_name.toLowerCase() !== app.tenRepoDayDu.toLowerCase()) {
      // Tên mới đã có trong kho (nạp riêng trước đó) thì ẩn bản trùng; chưa có thì đổi tên tại chỗ để giữ bản dịch,
      // phân tích và Thư viện của người dùng. Hàng chờ ứng viên chỉ được xử lý khi dây chuyền nạp bật, nên không
      // dựa vào nó nữa.
      const daCoTenMoi = await this.prisma.ungDung.findUnique({
        where: { tenRepoDayDu: r.full_name },
        select: { maUngDung: true },
      });
      if (daCoTenMoi) return this.anApp(app, TRANG_THAI_AN.REPO_DOI_TEN);
      await this.prisma.ungDung.update({
        where: { maUngDung: app.maUngDung },
        data: {
          tenRepoDayDu: r.full_name,
          chuSoHuu: r.full_name.split('/')[0] ?? '',
          tenKhoChua: r.full_name.split('/')[1] ?? '',
          duongDanGithub: `https://github.com/${r.full_name}`,
        },
      });
      this.logger.log(`[Theo dõi thay đổi] [${app.tenRepoDayDu}] đổi tên thành [${r.full_name}].`);
      await this.xoaCacheHienThi(app);
      app.tenRepoDayDu = r.full_name;
    }
    if (!r.license && !NGOAI_LE_GIAY_PHEP.has(r.full_name.toLowerCase()))
      return this.anApp(app, TRANG_THAI_AN.KHONG_CON_GIAY_PHEP);
    const doiHienThi =
      (r.description ?? null) !== app.moTaGocTiengAnh || Boolean(r.archived) !== app.daLuuTru;
    await this.prisma.ungDung.update({
      where: { maUngDung: app.maUngDung },
      data: {
        etagRepo: kq.etag ?? null,
        moTaGocTiengAnh: r.description ?? null,
        daLuuTru: Boolean(r.archived),
        soSaoGithub: r.stargazers_count,
        soLuotFork: r.forks_count,
        loaiGiayPhep: r.license?.name ?? 'Giấy phép riêng',
        pushedAt: r.pushed_at ? new Date(r.pushed_at) : app.pushedAt,
      },
    });
    app.pushedAt = r.pushed_at ? new Date(r.pushed_at) : app.pushedAt;
    app.soSaoGithub = r.stargazers_count;
    return doiHienThi ? 'DOI_HIEN_THI' : 'DOI_NGAM';
  }

  /** Nguồn 2, danh sách bản phát hành: có bản mới hay thêm tệp cài thì đồng bộ qua `dongBoRepo` (tự tính cột tính sẵn, xóa cache). */
  private async kiemBanPhatHanh(app: AppTheoDoi, ketQua: KetQuaQuet): Promise<boolean> {
    const kq = await this.hoi<GithubRelease[]>(
      `/repos/${app.tenRepoDayDu}/releases?per_page=15`,
      app.etagReleases,
      ketQua,
    );
    if (kq.trangThai !== 200) return false;
    const banMoi = banMoiNhat(kq.duLieu ?? []);
    const coBanMoi = canDongBoLai(banMoi, app.danhSachPhatHanh[0]);
    if (coBanMoi && banMoi) {
      const [owner = '', repo = ''] = app.tenRepoDayDu.split('/');
      this.logger.log(
        `✨ [${app.tenRepoDayDu}] bản ${banMoi.tag_name} mới hoặc thêm tệp cài, đồng bộ lại.`,
      );
      await this.appsService.dongBoRepo(owner, repo);
      // Mức nóng tính theo bản vừa đồng bộ, không theo bản cũ trong DB
      app.danhSachPhatHanh[0] = {
        tenPhienBan: banMoi.tag_name,
        ngayPhatHanh: new Date(banMoi.published_at),
        _count: { danhSachTepCaiDat: locTepCaiCuaBanPhatHanh(banMoi.assets ?? []).length },
      };
    }
    await this.prisma.ungDung.update({
      where: { maUngDung: app.maUngDung },
      data: { etagReleases: kq.etag ?? null },
    });
    return coBanMoi;
  }

  /**
   * Nguồn 3, README: nội dung đổi thì đánh dấu bản dịch cũ là DA_CU để hàng đợi dịch làm lại,
   * và bóc tách lại lệnh cài từ chính nội dung mới (hướng dẫn đã lưu có thể đã lỗi thời).
   */
  private async kiemReadme(app: AppTheoDoi, ketQua: KetQuaQuet): Promise<boolean> {
    const kq = await this.hoi<{ content?: string; encoding?: string }>(
      `/repos/${app.tenRepoDayDu}/readme`,
      app.etagReadme,
      ketQua,
    );
    if (kq.trangThai !== 200 || kq.duLieu?.encoding !== 'base64' || !kq.duLieu.content)
      return false;
    const noiDung = Buffer.from(kq.duLieu.content, 'base64').toString('utf-8');
    // Cùng cách băm với ReadmeTranslationService.tinhMaBam để so được với bản dịch đã lưu
    const sha = createHash('sha256').update(noiDung.trim()).digest('hex');
    const cu = await this.prisma.banDichReadme.updateMany({
      where: {
        maUngDung: app.maUngDung,
        trangThai: TrangThaiDichReadme.HOAN_TAT,
        readmeSha: { not: sha },
      },
      data: { trangThai: TrangThaiDichReadme.DA_CU },
    });
    await this.prisma.ungDung.update({
      where: { maUngDung: app.maUngDung },
      data: { etagReadme: kq.etag ?? null, readmeSha: sha },
    });
    const trangThaiDoi = sha !== app.readmeSha && (await this.capNhatHuongDanCli(app, noiDung));
    return cu.count > 0 || trangThaiDoi;
  }

  /**
   * P3B-25.9: README đổi thì lệnh cài đã lưu có thể không còn. Bóc tách lại bằng quy tắc (không AI) rồi suy lại
   * trạng thái hiển thị theo D-30: có tệp cài hoặc lệnh cài hợp lệ thì hiện, không thì ẩn. Trả true nếu trạng thái đổi.
   */
  private async capNhatHuongDanCli(app: AppTheoDoi, readme: string): Promise<boolean> {
    const huongDan = trichXuatHuongDanCliBangQuyTac(
      readme,
      `https://github.com/${app.tenRepoDayDu}#readme`,
    );
    const coLenh = coCachCaiCliHopLe(huongDan);
    const giaTri = coLenh
      ? huongDan
      : { khongCoHuongDan: true, phienBanBocTach: PHIEN_BAN_BOC_TACH_CLI, cachCai: [] };
    await this.prisma.phanTichAI.updateMany({
      where: { maUngDung: app.maUngDung },
      data: { huongDanCaiDat: giaTri as unknown as Prisma.InputJsonValue },
    });
    const soTepCai = await this.prisma.tepCaiDat.count({
      where: {
        banPhatHanh: { maUngDung: app.maUngDung },
        dinhDangTep: {
          in: [DinhDangTep.EXE, DinhDangTep.MSI, DinhDangTep.ZIP_PORTABLE, DinhDangTep.APK],
        },
      },
    });
    const trangThai = soTepCai > 0 || coLenh ? 'HOAT_DONG' : 'KHONG_CO_BAN_CAI';
    if (trangThai === app.trangThai) return false;
    await this.prisma.ungDung.update({ where: { maUngDung: app.maUngDung }, data: { trangThai } });
    this.logger.log(
      `[Theo dõi thay đổi] [${app.tenRepoDayDu}] README đổi: ${app.trangThai} → ${trangThai}.`,
    );
    return true;
  }

  private async hoi<T>(endpoint: string, etag: string | null, ketQua: KetQuaQuet) {
    ketQua.soYeuCau++;
    const kq = await this.githubService.hoiCoDieuKien<T>(endpoint, etag);
    if (kq.trangThai === 304) ketQua.so304++;
    return kq;
  }

  /** Lỗi giữa lượt quét: vẫn hẹn lần sau, không thì app lỗi đứng đầu hàng và bị hỏi lại mỗi 10 phút. */
  private async henQuetLaiKhiLoi(app: AppTheoDoi): Promise<void> {
    try {
      await this.prisma.ungDung.update({
        where: { maUngDung: app.maUngDung },
        data: { lanKiemTiepTheo: new Date(Date.now() + GIO_HEN_LAI_KHI_LOI * 3600000) },
      });
    } catch (err) {
      this.logger.warn(`Không hẹn lại được lượt quét [${app.tenRepoDayDu}]: ${String(err)}`);
    }
  }

  private async anApp(app: AppTheoDoi, trangThai: string): Promise<'DA_AN'> {
    await this.prisma.ungDung.update({ where: { maUngDung: app.maUngDung }, data: { trangThai } });
    this.logger.warn(`[Theo dõi thay đổi] Ẩn [${app.tenRepoDayDu}] khỏi Store: ${trangThai}.`);
    await this.xoaCacheHienThi(app);
    return 'DA_AN';
  }

  /** P3B-07.10: xóa đúng các khóa người dùng đọc, nếu không họ thấy dữ liệu cũ tới 1 giờ. */
  private async xoaCacheHienThi(app: AppTheoDoi): Promise<void> {
    await this.cacheService.xoaTheoPrefix(`fs:apps:detail:${app.maUngDung}`);
    await this.cacheService.xoaTheoPrefix(`fs:apps:detail:${app.tenRepoDayDu.toLowerCase()}`);
    await this.cacheService.xoaTheoPrefix('fs:apps:list:');
    await this.cacheService.xoaTheoPrefix('fs:categories:');
  }

  /** P3B-21.1: cộng dồn số liệu theo ngày (giữ 8 ngày) cho bảng sức khỏe. */
  private async ghiThongKe(kq: KetQuaQuet): Promise<void> {
    const khoa = `${TheoDoiThayDoiService.KHOA_THONG_KE}${new Date().toISOString().slice(0, 10)}:`;
    const giu = 8 * 86400;
    await this.cacheService.tangSo(`${khoa}app`, kq.soApp, giu);
    await this.cacheService.tangSo(`${khoa}co_doi`, kq.soCoDoi, giu);
    await this.cacheService.tangSo(`${khoa}yeu_cau`, kq.soYeuCau, giu);
    await this.cacheService.tangSo(`${khoa}304`, kq.so304, giu);
  }
}

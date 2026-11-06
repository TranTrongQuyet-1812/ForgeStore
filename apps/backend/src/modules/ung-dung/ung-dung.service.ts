import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  DinhDangTep,
  KienTrucChip,
  NenTangHoTro,
  Prisma,
  TepCaiDat,
  TrangThaiNapRepo,
} from '@prisma/client';
import {
  DanhMucDto,
  HeDieuHanhCli,
  HuongDanCaiDatDto,
  InspectRepoResponseDto,
  MucDoUyTin,
  ResolveAssetResponseDto,
  TepCaiDatDto,
  TimKiemResponseDto,
  TrangKetQua,
  UngDungChiTietDto,
  UngDungTomTatDto,
  YeuToRuiRoItem,
  coCachCaiCliHopLe,
} from '@forgestore/types';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { GithubService } from '../github/github.service';
import { YeuThichService } from '../yeu-thich/yeu-thich.service';
import { TrustScoreService } from '../ai/services/trust-score.service';
import { ApkInspectorService } from '../ai/services/apk-inspector.service';
import { MO_HINH_EMBEDDING, SemanticSearchService } from '../ai/services/semantic-search.service';
import { SearchTranslatorService } from '../ai/services/search-translator.service';
import {
  phanLoaiTep,
  locTepCaiCuaBanPhatHanh,
  tinhDiemUuTienTep,
} from './tien-ich/phan-loai-tep.util';
import { anhXaDanhMuc, doanTenGoiAndroid, DANH_MUC_CHUAN } from './tien-ich/anh-xa-danh-muc.util';
import {
  locVaSapXepBanPhatHanh,
  layBanPhatHanhMoiNhat,
  trichXuatDinhDangVaKienTruc,
  BanPhatHanhToiThieu,
} from './tien-ich/chon-ban-phat-hanh.util';
import { phanLuongInput, laCumTuMoTaNhuCauTiengViet } from './tien-ich/dieu-phoi-dau-vao.util';
import {
  sapXepCachCai,
  trichXuatHuongDanCliBangQuyTac,
} from '../ai/tien-ich/cli-guide-extractor.util';
import {
  AppSortOption,
  PlatformFilter,
  QueryAppsDto,
  TimeWindowFilter,
} from './dto/truy-van-ung-dung.dto';
import { ResolveAssetDto } from './dto/giai-quyet-tai-san.dto';
import { SearchQueryDto } from './dto/tim-kiem.dto';
import { InspectRepoDto } from './dto/kiem-tra-repo.dto';
import { tinhDiemThinhHanh } from './tien-ich/thinh-hanh.util';
import { taoDieuKienNenTang } from './tien-ich/dieu-kien-nen-tang.util';
import { locCucBo, LyDoLoc } from './tien-ich/bo-loc-nap-repo.util';
import { GithubRepo } from '../github/github.constants';

/** Lý do "Dán link GitHub" không nhận repo, viết bằng lời đời thường để hiện cho người dùng. */
const LY_DO_KHONG_NHAN: Partial<Record<LyDoLoc, string>> = {
  IT_SAO: 'chưa đủ 1.000 sao trên GitHub',
  LA_FORK: 'là bản sao (fork) của một repo khác',
  DA_LUU_TRU: 'đã ngừng phát triển',
  KHONG_CON_CAP_NHAT: 'đã lâu không được cập nhật',
  KHONG_CO_GIAY_PHEP: 'không có giấy phép mã nguồn mở',
  TRONG_DANH_SACH_CHAN: 'thuộc nhóm phần mềm ForgeStore không nhận',
};

/**
 * Phiên bản bộ bóc tách CLI. Dấu "không có hướng dẫn" ghi bởi bản cũ (thiếu phienBanBocTach)
 * bị coi là lỗi thời và được bóc tách lại một lần (VD: README có `$ winget install ...` từng bị bỏ sót).
 * Phiên bản 3 (P3B-25): bộ bóc tách nhận thêm hậu tố `@latest`, dấu nhắc shell, `py -m pip`, `uv tool`,
 * nên các dấu "không có hướng dẫn" ghi từ phiên bản 2 (VD: README ghi `npm install -g x@latest`) được tính lại.
 * Phiên bản 4 (P3B-25): quy tắc chạy trên toàn README, không còn chờ tìm được mục "Cài đặt" (tiktoken, sharp...).
 * Phiên bản 5 (P3B-25.12): thêm bước quét cả README nhưng chỉ nhận gói khớp tên repo (pandas, fzf...),
 * nên các dấu "không có hướng dẫn" ghi từ phiên bản 4 được tính lại.
 * Phiên bản 6 (05/11/2026): đọc cả khối code rào `~~~` và khối code thụt lề (instaloader, shellharden...).
 */
export const PHIEN_BAN_BOC_TACH_CLI = 6;

export function daCoKetQuaBocTachCli(hd: unknown): boolean {
  if (hd === null || hd === undefined) return false;
  const obj = hd as {
    khongCoHuongDan?: boolean;
    phienBanBocTach?: number;
    cachCai?: Array<{ buoc?: Array<{ lenh?: string }> }>;
  };
  if (obj.khongCoHuongDan) {
    return (obj.phienBanBocTach ?? 0) >= PHIEN_BAN_BOC_TACH_CLI;
  }
  // Hướng dẫn bóc bằng luật cũ còn lệnh cài thư viện npm vào dự án (không -g): coi là lỗi thời để bóc lại
  return !(obj.cachCai ?? []).some((c) => (c.buoc ?? []).some((b) => laLenhNpmCucBo(b.lenh)));
}

/** `npm install x`, `yarn add x`... không có -g/--global: cài thư viện vào dự án, không phải cài app (06/11/2026). */
export function laLenhNpmCucBo(lenh?: string): boolean {
  const l = (lenh ?? '').trim();
  return (
    /^(npm\s+(i|install)|pnpm\s+(add|i|install)|yarn\s+add|bun\s+(add|i))\s/i.test(l) &&
    !/\s(?:-g|--global)(?=\s|$)/i.test(l)
  );
}

/**
 * Lọc và chuẩn hóa hướng dẫn cài đặt dòng lệnh theo nền tảng được yêu cầu (Section 3.4).
 */
export function locHuongDanCaiDatTheoNenTang(
  rawGuide: HuongDanCaiDatDto | null | undefined,
  platform?: PlatformFilter | string,
): HuongDanCaiDatDto | null {
  if (
    !rawGuide ||
    rawGuide.khongCoHuongDan ||
    !Array.isArray(rawGuide.cachCai) ||
    rawGuide.cachCai.length === 0
  ) {
    return null;
  }

  const pLower = (platform || '').toLowerCase();
  // Android: không trả hướng dẫn cài đặt qua dòng lệnh
  if (pLower === 'android') {
    return null;
  }

  let filteredCachCai = rawGuide.cachCai;
  // Windows: loại bỏ các cách cài đặt chỉ dành cho Linux/macOS
  if (pLower === 'windows') {
    filteredCachCai = filteredCachCai.filter((c) => c.heDieuHanh !== HeDieuHanhCli.LINUX_MAC);
  }

  if (filteredCachCai.length === 0) {
    return null;
  }

  return {
    ...rawGuide,
    cachCai: sapXepCachCai(filteredCachCai),
  };
}

/**
 * Chuẩn hóa mã băm SHA256: bỏ tiền tố sha256:, chỉ giữ 64 ký tự hex chữ thường.
 */
export function chuanHoaSha256(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  const hex = cleaned.startsWith('sha256:') ? cleaned.slice(7) : cleaned;
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

@Injectable()
export class UngDungService {
  private readonly logger = new Logger(UngDungService.name);

  public readonly CACHE_KEY_LIST = 'fs:apps:list:';
  public readonly CACHE_KEY_DETAIL = 'fs:apps:detail:';
  public readonly CACHE_TTL = 3600; // 1 giờ

  // ARCH-02: Single-Flight in-flight map ngăn chặn bão request AI phân tích đồng thời
  private readonly inFlightPhanTichMap = new Map<string, Promise<void>>();

  private layMoTaViHienTai(app: {
    moTaVi?: string | null;
    moTaGocTiengAnh?: string | null;
    maBamMoTa?: string | null;
  }): string | null {
    if (!app.moTaVi) return null;
    if (!app.moTaGocTiengAnh || !app.maBamMoTa) return app.moTaVi;
    const maBamNguon = createHash('sha256').update(app.moTaGocTiengAnh.trim()).digest('hex');
    // Giữ bản dịch cũ trong DB để có thể đối chiếu, nhưng không hiển thị khi nguồn đã đổi.
    return maBamNguon === app.maBamMoTa ? app.moTaVi : null;
  }

  private layKhauHieuHienThi(
    app: { moTaGocTiengAnh?: string | null; maBamMoTa?: string | null },
    khauHieuCu?: string | null,
  ): string | null {
    if (app.maBamMoTa && app.moTaGocTiengAnh) return app.moTaGocTiengAnh;
    return khauHieuCu || app.moTaGocTiengAnh || null;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
    private readonly trustScoreService: TrustScoreService,
    private readonly apkInspectorService: ApkInspectorService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly searchTranslatorService: SearchTranslatorService,
    @Optional() private readonly favoritesService?: YeuThichService,
  ) {}

  /**
   * Phân tích chuỗi URL hoặc slug của GitHub Repo thành { owner, repo }.
   * Hỗ trợ các định dạng:
   * - rustdesk/rustdesk
   * - https://github.com/rustdesk/rustdesk
   * - https://github.com/rustdesk/rustdesk.git
   * - git@github.com:rustdesk/rustdesk.git
   */
  phanTichUrlRepo(rawUrl: string): { owner: string; repo: string } {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new BadRequestException('Đường dẫn GitHub repository không được để trống.');
    }

    let cleaned = rawUrl.trim();

    // Loại bỏ các dấu gạch chéo cuối cùng
    while (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }

    // Loại bỏ đuôi .git nếu có
    if (cleaned.endsWith('.git')) {
      cleaned = cleaned.slice(0, -4);
    }

    while (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }

    let extracted: { owner: string; repo: string } | null = null;

    // Trường hợp git@github.com:owner/repo
    if (cleaned.startsWith('git@github.com:')) {
      const parts = cleaned.replace('git@github.com:', '').split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        let repo = parts[1];
        if (repo.endsWith('.git')) repo = repo.slice(0, -4);
        extracted = { owner: parts[0], repo };
      }
    }

    // Trường hợp URL HTTP/HTTPS
    if (!extracted && (cleaned.startsWith('http://') || cleaned.startsWith('https://'))) {
      try {
        const u = new URL(cleaned);
        if (u.hostname.toLowerCase() !== 'github.com') {
          throw new BadRequestException('Chỉ hỗ trợ repository lưu trữ trên github.com.');
        }
        const segments = u.pathname.split('/').filter(Boolean);
        const owner = segments[0];
        let repo = segments[1];
        if (repo && repo.endsWith('.git')) {
          repo = repo.slice(0, -4);
        }
        if (owner && repo) {
          extracted = { owner, repo };
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('URL repository không hợp lệ.');
      }
    }

    // Trường hợp slug "owner/repo"
    if (!extracted) {
      const slugParts = cleaned.split('/');
      if (slugParts.length === 2 && slugParts[0] && slugParts[1]) {
        let repo = slugParts[1];
        if (repo.endsWith('.git')) repo = repo.slice(0, -4);
        extracted = { owner: slugParts[0], repo };
      }
    }

    if (!extracted) {
      throw new BadRequestException(
        'Định dạng kho GitHub không hợp lệ. Vui lòng nhập dạng "owner/repo" hoặc URL đầy đủ.',
      );
    }

    const GITHUB_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
    if (!GITHUB_NAME_REGEX.test(extracted.owner) || !GITHUB_NAME_REGEX.test(extracted.repo)) {
      throw new BadRequestException('Tên chủ sở hữu hoặc tên repository chứa ký tự không hợp lệ.');
    }

    return extracted;
  }

  /**
   * Đồng bộ Repository, Releases và các tệp cài đặt vào CSDL (P2-21).
   * Chạy trọn vẹn trong MỘT Prisma Transaction nguyên tử.
   *
   * @param owner Chủ sở hữu repo (VD: rustdesk)
   * @param repo Tên repo (VD: rustdesk)
   * @param maNguoiDungYeuCau UUID người dùng yêu cầu nạp (nếu có)
   */
  async dongBoRepo(
    owner: string,
    repo: string,
    maNguoiDungYeuCau?: string,
  ): Promise<UngDungChiTietDto> {
    this.logger.log(`Bắt đầu đồng bộ repository [${owner}/${repo}]...`);

    const ungDungHienTai = await this.prisma.ungDung.findUnique({
      where: { tenRepoDayDu: `${owner}/${repo}` },
      select: {
        trangThai: true,
        phanTichAI: { select: { huongDanCaiDat: true } },
      },
    });

    // 1. Kéo dữ liệu từ GitHub Facade (được bảo vệ bởi ETag & Rate Limit)
    const repoData = await this.githubService.layRepo(owner, repo);
    const rawReleases = await this.githubService.layDanhSachRelease(owner, repo, 15);

    // Bỏ qua các bản phát hành nháp (draft === true)
    const activeReleases = rawReleases.filter((r) => !r.draft);

    // Repo đổi tên: đổi tên bản ghi đang có. Nếu tên mới đã là một app khác thì không đổi (khóa duy nhất sẽ chặn),
    // đồng bộ vào chính app mang tên mới
    let khoaBanGhi = repoData.full_name;
    if (ungDungHienTai && repoData.full_name !== `${owner}/${repo}`) {
      const daCoTenMoi = await this.prisma.ungDung.findUnique({
        where: { tenRepoDayDu: repoData.full_name },
        select: { maUngDung: true },
      });
      if (!daCoTenMoi) khoaBanGhi = `${owner}/${repo}`;
    }

    // 2. Phân loại toàn bộ các file đính kèm trong các bản phát hành
    let hasWindows = false;
    let hasAndroid = false;
    const danhSachFileApk: string[] = [];

    // Cấu trúc phân loại trước khi vào transaction (bộ lọc dùng chung với bộ theo dõi thay đổi)
    const parsedReleases = activeReleases.map((release) => ({
      release,
      validAssets: locTepCaiCuaBanPhatHanh(release.assets || []),
    }));
    for (const item of parsedReleases.flatMap((r) => r.validAssets)) {
      if (item.dinhDang === DinhDangTep.APK) {
        hasAndroid = true;
        danhSachFileApk.push(item.tenTep);
      } else if (
        item.dinhDang === DinhDangTep.EXE ||
        item.dinhDang === DinhDangTep.MSI ||
        item.dinhDang === DinhDangTep.ZIP_PORTABLE
      ) {
        hasWindows = true;
      }
    }

    // 3. Suy luận nền tảng hỗ trợ và trạng thái ứng dụng (P2-21.4, L1)
    let nenTangHoTro: NenTangHoTro = NenTangHoTro.WINDOWS;
    let trangThai = 'HOAT_DONG';

    if (hasWindows && hasAndroid) {
      nenTangHoTro = NenTangHoTro.DA_NEN_TANG;
    } else if (hasAndroid) {
      nenTangHoTro = NenTangHoTro.ANDROID;
    } else if (hasWindows) {
      nenTangHoTro = NenTangHoTro.WINDOWS;
    } else {
      // P3B-16 trước đây dùng cờ laUngDungCli từ caller; nay suy từ README để mọi luồng đồng bộ thống nhất.
      // Khi thiếu bộ cài desktop, README là nguồn xác định ứng dụng CLI có thể dùng được.
      trangThai = await this.suyTrangThaiKhongCoTepCai(owner, repo, ungDungHienTai);
      const topics = (repoData.topics || []).map((t) => t.toLowerCase());
      if (topics.includes('android')) {
        nenTangHoTro = NenTangHoTro.ANDROID;
      }
    }

    // 4. Ánh xạ danh mục chính từ topics và mô tả (P2-21.5, N2)
    const danhMucChinh = anhXaDanhMuc(repoData.topics, repoData.description, repoData.full_name);

    // 5. Dự đoán Android package name (D-13)
    const tenGoiAndroid = doanTenGoiAndroid(repoData.full_name, danhSachFileApk);

    // 6. Thực thi cập nhật CSDL trong một Transaction nguyên tử (P2-21.6, timeout 20s per Post-Review #13)
    const ungDungUpdated = await this.prisma.$transaction(
      async (tx) => {
        // 6.1. Upsert bảng UngDung
        // Repo đã đổi tên hoặc chuyển chủ thì GitHub trả tên mới: cập nhật đúng bản ghi đang có (theo tên cũ) và đổi
        // tên nó, không tạo app thứ hai thiếu bản dịch và phân tích
        const app = await tx.ungDung.upsert({
          where: { tenRepoDayDu: khoaBanGhi },
          update: {
            tenRepoDayDu: repoData.full_name,
            chuSoHuu: repoData.owner.login,
            tenKhoChua: repoData.name,
            duongDanGithub: repoData.html_url,
            moTaGocTiengAnh: repoData.description,
            duongDanIcon: repoData.owner.avatar_url || null,
            soSaoGithub: repoData.stargazers_count,
            soLuotFork: repoData.forks_count,
            loaiGiayPhep: repoData.license?.name || repoData.license?.spdx_id || null,
            ngonNguChinh: repoData.language || null,
            danhSachChuDe: repoData.topics || [],
            danhMucChinh,
            nenTangHoTro,
            trangThai,
            daLuuTru: Boolean(repoData.archived),
            tenGoiAndroid: tenGoiAndroid || undefined,
            dongBoLanCuoi: new Date(),
          },
          create: {
            tenRepoDayDu: repoData.full_name,
            chuSoHuu: repoData.owner.login,
            tenKhoChua: repoData.name,
            duongDanGithub: repoData.html_url,
            moTaGocTiengAnh: repoData.description,
            duongDanIcon: repoData.owner.avatar_url || null,
            soSaoGithub: repoData.stargazers_count,
            soLuotFork: repoData.forks_count,
            loaiGiayPhep: repoData.license?.name || repoData.license?.spdx_id || null,
            ngonNguChinh: repoData.language || null,
            danhSachChuDe: repoData.topics || [],
            danhMucChinh,
            nenTangHoTro,
            trangThai,
            daLuuTru: Boolean(repoData.archived),
            tenGoiAndroid: tenGoiAndroid || null,
            dongBoLanCuoi: new Date(),
          },
        });

        // 6.2. Đồng bộ các bản phát hành và tệp cài đặt đính kèm
        for (const { release, validAssets } of parsedReleases) {
          const releaseRecord = await tx.banPhatHanh.upsert({
            where: {
              maUngDung_tenPhienBan: {
                maUngDung: app.maUngDung,
                tenPhienBan: release.tag_name,
              },
            },
            update: {
              maReleaseGithub: BigInt(release.id),
              tieuDePhatHanh: release.name || release.tag_name,
              nhatKyThayDoiGoc: release.body || null,
              laBanThuNghiem: release.prerelease,
              ngayPhatHanh: new Date(release.published_at || release.created_at),
            },
            create: {
              maUngDung: app.maUngDung,
              maReleaseGithub: BigInt(release.id),
              tenPhienBan: release.tag_name,
              tieuDePhatHanh: release.name || release.tag_name,
              nhatKyThayDoiGoc: release.body || null,
              laBanThuNghiem: release.prerelease,
              ngayPhatHanh: new Date(release.published_at || release.created_at),
            },
          });

          // P2-21 & Post-Review (#7, #8): Upsert tệp cài đặt theo compound unique maPhatHanh_tenTep,
          // chỉ xóa những file thật sự không còn trên GitHub để bảo toàn maTep trong ung_dung_da_cai.
          const currentAssetNames = new Set(validAssets.map(({ asset }) => asset.name));
          const existingAssets = await tx.tepCaiDat.findMany({
            where: { maPhatHanh: releaseRecord.maPhatHanh },
            select: { maTep: true, tenTep: true },
          });

          const staleAssetIds = existingAssets
            .filter((f) => !currentAssetNames.has(f.tenTep))
            .map((f) => f.maTep);

          if (staleAssetIds.length > 0) {
            await tx.tepCaiDat.deleteMany({
              where: { maTep: { in: staleAssetIds } },
            });
          }

          for (const { asset, dinhDang, kienTruc } of validAssets) {
            const maBamSha256 = chuanHoaSha256(asset.digest || asset.sha256);
            await tx.tepCaiDat.upsert({
              where: {
                maPhatHanh_tenTep: {
                  maPhatHanh: releaseRecord.maPhatHanh,
                  tenTep: asset.name,
                },
              },
              update: {
                duongDanTaiVe: asset.browser_download_url,
                dungLuongBytes: BigInt(asset.size),
                dinhDangTep: dinhDang,
                kienTrucChip: kienTruc,
                maBamSha256,
                soLuotTai: asset.download_count || 0,
              },
              create: {
                maPhatHanh: releaseRecord.maPhatHanh,
                tenTep: asset.name,
                duongDanTaiVe: asset.browser_download_url,
                dungLuongBytes: BigInt(asset.size),
                dinhDangTep: dinhDang,
                kienTrucChip: kienTruc,
                maBamSha256,
                soLuotTai: asset.download_count || 0,
              },
            });
          }
        }

        // 6.3. Giới hạn lưu trữ tối đa 15 bản phát hành mới nhất cho mỗi repo (P3B-03.5)
        const excessReleases =
          (await tx.banPhatHanh.findMany({
            where: { maUngDung: app.maUngDung },
            orderBy: { ngayPhatHanh: 'desc' },
            skip: 15,
            select: { maPhatHanh: true },
          })) || [];

        if (excessReleases.length > 0) {
          const excessIds = excessReleases.map((r) => r.maPhatHanh);
          await tx.tepCaiDat.deleteMany({
            where: { maPhatHanh: { in: excessIds } },
          });
          await tx.banPhatHanh.deleteMany({
            where: { maPhatHanh: { in: excessIds } },
          });
        }

        // 6.4. Tính sẵn điểm thịnh hành và metadata nền tảng lưu vào CSDL (P3B-03.1, P3B-03.2, D-19)
        const currentReleases =
          (await tx.banPhatHanh.findMany({
            where: { maUngDung: app.maUngDung },
            orderBy: { ngayPhatHanh: 'desc' },
            take: 15,
            include: {
              danhSachTepCaiDat: {
                select: {
                  dinhDangTep: true,
                  kienTrucChip: true,
                },
              },
            },
          })) || [];

        const banMoiWindows = layBanPhatHanhMoiNhat(currentReleases, PlatformFilter.WINDOWS);
        const banMoiAndroid = layBanPhatHanhMoiNhat(currentReleases, PlatformFilter.ANDROID);
        const banMoiChung = layBanPhatHanhMoiNhat(currentReleases);

        const setDinhDang = new Set<DinhDangTep>();
        const setKienTruc = new Set<KienTrucChip>();

        const dsTepMoi = [
          ...(banMoiWindows?.danhSachTepCaiDat || []),
          ...(banMoiAndroid?.danhSachTepCaiDat || []),
        ];
        if (dsTepMoi.length === 0 && banMoiChung?.danhSachTepCaiDat) {
          dsTepMoi.push(...banMoiChung.danhSachTepCaiDat);
        }

        for (const t of dsTepMoi) {
          if (t.dinhDangTep) setDinhDang.add(t.dinhDangTep as DinhDangTep);
          if (t.kienTrucChip) setKienTruc.add(t.kienTrucChip as KienTrucChip);
        }

        const dinhDangCoSan = Array.from(setDinhDang);
        const kienTrucCoSan = Array.from(setKienTruc);
        const banMoiNhatWindows = banMoiWindows?.tenPhienBan || null;
        const banMoiNhatAndroid = banMoiAndroid?.tenPhienBan || null;

        // Tính điểm thịnh hành: log10(sao + 1) / (số ngày + 2)^1.5 * hệ số thưởng bản mới (<= 7 ngày)
        const now = Date.now();
        const sao = repoData.stargazers_count || 0;
        const banMoiNhat = banMoiChung || banMoiWindows || banMoiAndroid;
        const thoiGianGoc = banMoiNhat?.ngayPhatHanh
          ? new Date(banMoiNhat.ngayPhatHanh).getTime()
          : now;
        const soNgay = Math.max(0, (now - thoiGianGoc) / (1000 * 60 * 60 * 24));
        let heSoThuongBanMoi = 1.0;
        if (soNgay <= 7) {
          heSoThuongBanMoi = 1.0 + 0.3 * (1 - soNgay / 7);
        }
        const diemThinhHanh = tinhDiemThinhHanh(
          sao,
          soNgay,
          heSoThuongBanMoi,
          Boolean(repoData.archived),
        );

        const appUpdated = await tx.ungDung.update({
          where: { maUngDung: app.maUngDung },
          data: {
            diemThinhHanh,
            banMoiNhatWindows,
            banMoiNhatAndroid,
            dinhDangCoSan,
            kienTrucCoSan,
          },
        });

        // 6.5. Nếu có người dùng yêu cầu nạp repo, ghi nhật ký (Module 6)
        if (maNguoiDungYeuCau) {
          await tx.nhatKyNapRepo.create({
            data: {
              maNguoiDungYeuCau,
              duongDanRepoNhap: `${owner}/${repo}`,
              trangThai: TrangThaiNapRepo.THANH_CONG,
              maUngDungTaoRa: app.maUngDung,
            },
          });
        }

        return appUpdated;
      },
      { timeout: 20000, maxWait: 5000 },
    );

    // 7. Xóa sạch Cache liên quan sau khi đồng bộ thành công (P2-23.5)
    await this.cacheService.xoaTheoPrefix(this.CACHE_KEY_LIST);
    await this.cacheService.xoaTheoPrefix('fs:categories:');
    // Xóa theo tiền tố để dọn cả các khóa có đuôi :platform:arch (nếu không Desktop thấy dữ liệu cũ tới 1 giờ)
    await this.cacheService.xoaTheoPrefix(this.CACHE_KEY_DETAIL + ungDungUpdated.maUngDung);
    await this.cacheService.xoaTheoPrefix(
      this.CACHE_KEY_DETAIL + ungDungUpdated.tenRepoDayDu.toLowerCase(),
    );
    // Repo đổi tên: khóa cache theo tên cũ cũng phải xóa, không thì trang cũ còn hiện dữ liệu cũ tới 1 giờ
    await this.cacheService.xoaTheoPrefix(this.CACHE_KEY_DETAIL + `${owner}/${repo}`.toLowerCase());

    this.logger.log(`Đồng bộ thành công [${owner}/${repo}] (UUID: ${ungDungUpdated.maUngDung})`);

    // 8. Trả về chi tiết ứng dụng đầy đủ
    return this.layChiTietApp(ungDungUpdated.maUngDung);
  }

  private async suyTrangThaiKhongCoTepCai(
    owner: string,
    repo: string,
    ungDungHienTai: {
      trangThai?: string | null;
      phanTichAI?: { huongDanCaiDat?: unknown } | null;
    } | null,
  ): Promise<string> {
    const huongDanCu = ungDungHienTai?.phanTichAI?.huongDanCaiDat as
      HuongDanCaiDatDto | null | undefined;
    if (coCachCaiCliHopLe(huongDanCu)) return 'HOAT_DONG';

    try {
      const readme = await this.githubService.layReadme(owner, repo);
      if (readme === null) {
        this.logger.warn(`Repository [${owner}/${repo}] không có README.`);
        return 'KHONG_CO_BAN_CAI';
      }
      const huongDan = trichXuatHuongDanCliBangQuyTac(readme);
      return coCachCaiCliHopLe(huongDan) ? 'HOAT_DONG' : 'KHONG_CO_BAN_CAI';
    } catch (error) {
      this.logger.warn(`Lỗi lấy README [${owner}/${repo}]: ${String(error)}`);
      return ungDungHienTai?.trangThai || 'KHONG_CO_BAN_CAI';
    }
  }

  /**
   * Lấy danh sách danh mục có ít nhất một ứng dụng khả dụng theo nền tảng kèm số lượng app thật (K3).
   *
   * @param platform Nền tảng lọc (windows/android)
   */
  async layDanhSachDanhMuc(platform?: PlatformFilter): Promise<DanhMucDto[]> {
    const cacheKey = `fs:categories:${platform || 'all'}`;
    const cached = await this.cacheService.lay<DanhMucDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: Prisma.UngDungWhereInput = {
      trangThai: 'HOAT_DONG',
      ...taoDieuKienNenTang(platform),
    };

    const grouped = await this.prisma.ungDung.groupBy({
      by: ['danhMucChinh'],
      where,
      _count: {
        _all: true,
      },
    });

    const categoryMap = new Map<string, number>();
    for (const item of grouped) {
      if (item._count._all > 0) {
        categoryMap.set(item.danhMucChinh, item._count._all);
      }
    }

    // Giữ thứ tự ưu tiên hiển thị ổn định theo DANH_MUC_CHUAN
    const result: DanhMucDto[] = [];
    for (const dm of DANH_MUC_CHUAN) {
      const count = categoryMap.get(dm);
      if (count !== undefined && count > 0) {
        result.push({ ten: dm, soLuong: count });
        categoryMap.delete(dm);
      }
    }
    for (const [dm, count] of categoryMap.entries()) {
      if (count > 0) {
        result.push({ ten: dm, soLuong: count });
      }
    }

    await this.cacheService.luu(cacheKey, result, 300);
    return result;
  }

  /**
   * API Duyệt Store (GET /ung-dung) với bộ lọc, phân trang, sắp xếp và Cache (P2-23).
   * Hỗ trợ bổ sung cờ daYeuThich nếu người dùng đã đăng nhập (P2-50.4).
   */
  async layDanhSachApps(
    query: QueryAppsDto,
    userId?: string,
  ): Promise<TrangKetQua<UngDungTomTatDto>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 20;
    const sort = query.sort || AppSortOption.TRENDING;
    const platform = query.platform;
    const category = query.category;
    const featured = query.featured;

    const windowFilter = query.window;

    // Khóa cache duy nhất cho tổ hợp bộ lọc kèm khung thời gian (B1 & B2)
    const cacheKey = `${this.CACHE_KEY_LIST}${platform || 'all'}:${category || 'all'}:${sort}:${windowFilter || 'all'}:${page}:${limit}:${
      featured !== undefined ? (featured ? '1' : '0') : 'all'
    }`;

    const cached = await this.cacheService.lay<TrangKetQua<UngDungTomTatDto>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Xây dựng điều kiện WHERE
    const where: Prisma.UngDungWhereInput = {
      trangThai: 'HOAT_DONG',
    };

    if (featured !== undefined) {
      where.duocNoiBat = featured;
    }

    if (category) {
      where.danhMucChinh = category;
    }

    Object.assign(where, taoDieuKienNenTang(platform));

    // Xác định tiêu chí sắp xếp đẩy trực tiếp xuống PostgreSQL (P3B-03.3, P3B-03.4)
    let orderBy: Prisma.UngDungOrderByWithRelationInput[];
    if (sort === AppSortOption.TRENDING) {
      orderBy = [{ diemThinhHanh: 'desc' }, { soSaoGithub: 'desc' }];
    } else if (sort === AppSortOption.STARS) {
      orderBy = [{ soSaoGithub: 'desc' }, { dongBoLanCuoi: 'desc' }];
    } else {
      // RECENT
      orderBy = [{ dongBoLanCuoi: 'desc' }];
    }

    // Đẩy lọc khung thời gian xuống CSDL qua index ban_phat_hanh (ma_ung_dung, ngay_phat_hanh DESC)
    if (windowFilter) {
      const maxNgay =
        windowFilter === TimeWindowFilter.TODAY
          ? 1
          : windowFilter === TimeWindowFilter.WEEK
            ? 7
            : 30;
      const minDate = new Date(Date.now() - maxNgay * 24 * 60 * 60 * 1000);
      where.danhSachPhatHanh = {
        some: {
          ngayPhatHanh: { gte: minDate },
        },
      };
    }

    // Truy vấn trực tiếp PostgreSQL với skip/take, không tải toàn bộ app lên RAM (P3B-03.4)
    const [danhSach, tongSo] = await Promise.all([
      this.prisma.ungDung.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          phanTichAI: {
            select: {
              khauHieuTiengViet: true,
              diemUyTin: true,
              mucDoAnToan: true,
            },
          },
        },
      }),
      this.prisma.ungDung.count({ where }),
    ]);

    // Chuẩn hóa định dạng UngDungTomTatDto đọc từ các cột tính sẵn (D-19, P3B-03.1, P3B-03.2)
    const duLieu: UngDungTomTatDto[] = danhSach.map((app) => {
      let phienBanMoiNhat: string | null = null;
      if (platform === PlatformFilter.WINDOWS) {
        phienBanMoiNhat = app.banMoiNhatWindows || app.banMoiNhatAndroid || null;
      } else if (platform === PlatformFilter.ANDROID) {
        phienBanMoiNhat = app.banMoiNhatAndroid || null;
      } else {
        phienBanMoiNhat = app.banMoiNhatWindows || app.banMoiNhatAndroid || null;
      }

      // Đọc từ các cột tính sẵn (D-19). Fallback an toàn nếu có danhSachPhatHanh (hỗ trợ mocks)
      let dinhDangCoSan: string[] = [];
      let kienTrucCoSan: string[] = [];

      const appWithReleases = app as typeof app & {
        danhSachPhatHanh?: BanPhatHanhToiThieu[];
      };

      if (
        (app.dinhDangCoSan && app.dinhDangCoSan.length > 0) ||
        (app.kienTrucCoSan && app.kienTrucCoSan.length > 0)
      ) {
        const extracted = trichXuatDinhDangVaKienTruc([
          ...(app.dinhDangCoSan || []).map((d) => ({ dinhDangTep: d })),
          ...(app.kienTrucCoSan || []).map((k) => ({ dinhDangTep: '', kienTrucChip: k })),
        ]);
        dinhDangCoSan = extracted.dinhDangCoSan;
        kienTrucCoSan = extracted.kienTrucCoSan;
      } else if ('danhSachPhatHanh' in app && Array.isArray(appWithReleases.danhSachPhatHanh)) {
        const banMoi = layBanPhatHanhMoiNhat(appWithReleases.danhSachPhatHanh, platform);
        if (!phienBanMoiNhat && banMoi?.tenPhienBan) {
          phienBanMoiNhat = banMoi.tenPhienBan;
        }
        const extracted = trichXuatDinhDangVaKienTruc(banMoi?.danhSachTepCaiDat);
        dinhDangCoSan = extracted.dinhDangCoSan;
        kienTrucCoSan = extracted.kienTrucCoSan;
      }

      return {
        maUngDung: app.maUngDung,
        tenRepoDayDu: app.tenRepoDayDu,
        chuSoHuu: app.chuSoHuu,
        tenKhoChua: app.tenKhoChua,
        duongDanGithub: app.duongDanGithub,
        duongDanIcon: app.duongDanIcon,
        soSaoGithub: app.soSaoGithub,
        danhMucChinh: app.danhMucChinh,
        nenTangHoTro: app.nenTangHoTro,
        duocNoiBat: app.duocNoiBat,
        daXacMinh: app.daXacMinh,
        daLuuTru: Boolean(app.daLuuTru),
        tenGoiAndroid: app.tenGoiAndroid,
        khauHieuTiengViet:
          this.layMoTaViHienTai(app) ||
          this.layKhauHieuHienThi(app, app.phanTichAI?.khauHieuTiengViet),
        diemUyTin: app.phanTichAI?.diemUyTin ?? null,
        mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
        phienBanMoiNhat,
        dinhDangCoSan,
        kienTrucCoSan,
        loaiGiayPhep: app.loaiGiayPhep || null,
        moTaGocTiengAnh: app.moTaGocTiengAnh || null,
        moTaVi: this.layMoTaViHienTai(app),
        maBamMoTa: app.maBamMoTa || null,
        ngayCapNhat: app.dongBoLanCuoi.toISOString(),
      };
    });

    const result: TrangKetQua<UngDungTomTatDto> = {
      duLieu,
      tongSo,
      trangHienTai: page,
      tongSoTrang: Math.ceil(tongSo / limit) || 1,
      kichThuocTrang: limit,
    };

    // Lưu vào Cache với TTL 1 giờ
    await this.cacheService.luu(cacheKey, result, this.CACHE_TTL);

    // Nếu người dùng đã đăng nhập, nạp cờ daYeuThich vào danh sách từ Redis Cache (P2-50.4, L-12)
    if (userId && result.duLieu.length > 0) {
      const likedSet = await this.layTapHopYeuThichCuaUser(userId);
      return {
        ...result,
        duLieu: result.duLieu.map((item) => ({
          ...item,
          daYeuThich: likedSet.has(item.maUngDung),
        })),
      };
    }

    return result;
  }

  /**
   * Lấy tập hợp mã ứng dụng đã yêu thích của user từ Redis Cache (TTL 5 phút)
   * Tái sử dụng qua YeuThichService để khử trùng lặp code (R-05).
   */
  private async layTapHopYeuThichCuaUser(userId: string): Promise<Set<string>> {
    if (this.favoritesService) {
      return await this.favoritesService.layTapHopUngDungDaYeuThich(userId);
    }
    const cacheKey = `user:favs:${userId}`;
    const cached = await this.cacheService.lay<string[]>(cacheKey);
    if (cached) {
      return new Set(cached);
    }
    const yeuThichs = await this.prisma.khoYeuThich.findMany({
      where: { maNguoiDung: userId },
      select: { maUngDung: true },
    });
    const ids = yeuThichs.map((y) => y.maUngDung);
    await this.cacheService.luu(cacheKey, ids, 300);
    return new Set(ids);
  }

  /**
   * API Chi tiết Ứng dụng (GET /ung-dung/:id) theo UUID hoặc owner/repo slug (P2-24).
   * Hỗ trợ bổ sung cờ laYeuThich nếu người dùng đã đăng nhập (P2-50.4).
   */
  async layChiTietApp(
    idOrSlug: string,
    userId?: string,
    platform?: PlatformFilter | string,
    arch?: string,
  ): Promise<UngDungChiTietDto> {
    if (!idOrSlug || !idOrSlug.trim()) {
      throw new BadRequestException('Mã định danh ứng dụng không được để trống.');
    }

    const cleanId = decodeURIComponent(idOrSlug.trim());
    const cacheKey = this.taoKhoaCacheChiTiet(cleanId.toLowerCase(), platform, arch);

    const cached = await this.cacheService.lay<UngDungChiTietDto>(cacheKey);
    if (cached) {
      if (userId) {
        const likedSet = await this.layTapHopYeuThichCuaUser(userId);
        return {
          ...cached,
          laYeuThich: likedSet.has(cached.maUngDung),
        };
      }
      return cached;
    }

    // Kiểm tra định dạng UUID v4
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    const app = await this.prisma.ungDung.findFirst({
      where: isUuid
        ? { maUngDung: cleanId }
        : { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
      include: {
        phanTichAI: true,
        danhSachPhatHanh: {
          orderBy: { ngayPhatHanh: 'desc' },
          take: 20,
          include: {
            danhSachTepCaiDat: true,
          },
        },
      },
    });

    if (!app) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với định danh: ${cleanId}`);
    }

    // Lazy AI & CLI Backfill (P2-31.3 & BE-R6-01): Chạy nền non-blocking nếu chưa phân tích AI hoặc chưa có hướng dẫn CLI
    if (!app.phanTichAI || !daCoKetQuaBocTachCli(app.phanTichAI.huongDanCaiDat)) {
      this.phanTichUngDung(app.maUngDung).catch((err: unknown) => {
        this.logger.warn(
          `Bổ sung phân tích AI / CLI nền cho [${app.tenRepoDayDu}] thất bại: ${(err as Error).message}`,
        );
      });
    }

    // N1 + K1: Lọc và sắp xếp các bản phát hành theo platform và SemVer
    const danhSachBanPhatHanhDaLoc = locVaSapXepBanPhatHanh(app.danhSachPhatHanh, platform, {
      uuTienBanChinhThuc: false, // Giữ cả các bản thử nghiệm trong lịch sử phiên bản
      chiGiuTepTheoNenTang: true, // Chỉ giữ lại các tệp thuộc nền tảng đang xem
    });

    const banPhatHanhMoiNhatDaLoc = layBanPhatHanhMoiNhat(app.danhSachPhatHanh, platform);
    const phienBanMoiNhat = banPhatHanhMoiNhatDaLoc?.tenPhienBan || null;

    const mapTepCaiDat = (f: TepCaiDat) => {
      const thongTin = tinhDiemUuTienTep(f.tenTep, f.dinhDangTep, f.kienTrucChip, arch);
      return {
        maTep: f.maTep,
        maPhatHanh: f.maPhatHanh,
        tenTep: f.tenTep,
        duongDanTaiVe: f.duongDanTaiVe,
        dungLuongBytes: f.dungLuongBytes.toString(),
        dinhDangTep: f.dinhDangTep,
        kienTrucChip: f.kienTrucChip,
        maBamSha256: f.maBamSha256,
        soLuotTai: f.soLuotTai,
        ngayTao: f.ngayTao.toISOString(),
        diemUuTien: thongTin.diem,
        hopMay: thongTin.hopMay,
      };
    };

    // Chuẩn hóa DTO và chuyển đổi BigInt sang string/number
    const result: UngDungChiTietDto = {
      maUngDung: app.maUngDung,
      tenRepoDayDu: app.tenRepoDayDu,
      chuSoHuu: app.chuSoHuu,
      tenKhoChua: app.tenKhoChua,
      duongDanGithub: app.duongDanGithub,
      duongDanIcon: app.duongDanIcon,
      soSaoGithub: app.soSaoGithub,
      soLuotFork: app.soLuotFork,
      loaiGiayPhep: app.loaiGiayPhep,
      ngonNguChinh: app.ngonNguChinh,
      danhSachChuDe: app.danhSachChuDe,
      danhMucChinh: app.danhMucChinh,
      nenTangHoTro: app.nenTangHoTro,
      duocNoiBat: app.duocNoiBat,
      daXacMinh: app.daXacMinh,
      daLuuTru: Boolean(app.daLuuTru),
      tenGoiAndroid: app.tenGoiAndroid,
      trangThai: app.trangThai,
      dongBoLanCuoi: app.dongBoLanCuoi.toISOString(),
      ngayTao: app.ngayTao.toISOString(),
      moTaGocTiengAnh: app.moTaGocTiengAnh,
      moTaVi: this.layMoTaViHienTai(app),
      maBamMoTa: app.maBamMoTa || null,
      khauHieuTiengViet:
        this.layMoTaViHienTai(app) ||
        this.layKhauHieuHienThi(app, app.phanTichAI?.khauHieuTiengViet),
      diemUyTin: app.phanTichAI?.diemUyTin ?? null,
      mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
      phienBanMoiNhat,
      ngayCapNhat: app.dongBoLanCuoi.toISOString(),
      phanTichAi: app.phanTichAI
        ? {
            maPhanTich: app.phanTichAI.maPhanTich,
            maUngDung: app.phanTichAI.maUngDung,
            khauHieuTiengViet:
              this.layMoTaViHienTai(app) ||
              this.layKhauHieuHienThi(app, app.phanTichAI.khauHieuTiengViet) ||
              app.phanTichAI.khauHieuTiengViet,
            tomTatTinhNangVi: app.phanTichAI.tomTatTinhNangVi,
            diemUyTin: app.phanTichAI.diemUyTin,
            mucDoAnToan: app.phanTichAI.mucDoAnToan,
            yeuToRuiRo: (app.phanTichAI.yeuToRuiRo as unknown as YeuToRuiRoItem[]) || [],
            quyenHanDaKiemTra: (app.phanTichAI.quyenHanDaKiemTra as unknown as string[]) || [],
            moHinhTomTat: app.phanTichAI.moHinhTomTat,
            huongDanCaiDat: locHuongDanCaiDatTheoNenTang(
              app.phanTichAI.huongDanCaiDat as unknown as HuongDanCaiDatDto,
              platform,
            ),
            thoiGianPhanTich: app.phanTichAI.thoiGianPhanTich.toISOString(),
          }
        : null,
      huongDanCaiDat: locHuongDanCaiDatTheoNenTang(
        app.phanTichAI?.huongDanCaiDat as unknown as HuongDanCaiDatDto,
        platform,
      ),

      banPhatHanhMoiNhat: banPhatHanhMoiNhatDaLoc
        ? {
            maPhatHanh: banPhatHanhMoiNhatDaLoc.maPhatHanh,
            maUngDung: banPhatHanhMoiNhatDaLoc.maUngDung,
            maReleaseGithub: banPhatHanhMoiNhatDaLoc.maReleaseGithub
              ? banPhatHanhMoiNhatDaLoc.maReleaseGithub.toString()
              : null,
            tenPhienBan: banPhatHanhMoiNhatDaLoc.tenPhienBan,
            tieuDePhatHanh: banPhatHanhMoiNhatDaLoc.tieuDePhatHanh,
            nhatKyThayDoiGoc: banPhatHanhMoiNhatDaLoc.nhatKyThayDoiGoc,
            tomTatNangCapVi: banPhatHanhMoiNhatDaLoc.tomTatNangCapVi,
            laBanThuNghiem: banPhatHanhMoiNhatDaLoc.laBanThuNghiem,
            ngayPhatHanh: banPhatHanhMoiNhatDaLoc.ngayPhatHanh.toISOString(),
            danhSachTepCaiDat: banPhatHanhMoiNhatDaLoc.danhSachTepCaiDat
              .map(mapTepCaiDat)
              .sort((a, b) => b.diemUuTien - a.diemUuTien),
          }
        : null,
      danhSachBanPhatHanh: danhSachBanPhatHanhDaLoc.map((r) => ({
        maPhatHanh: r.maPhatHanh,
        maUngDung: r.maUngDung,
        maReleaseGithub: r.maReleaseGithub ? r.maReleaseGithub.toString() : null,
        tenPhienBan: r.tenPhienBan,
        tieuDePhatHanh: r.tieuDePhatHanh,
        // Không trả changelog cho lịch sử phiên bản: Desktop không hiện (D-34) mà nó chiếm phần lớn phản hồi
        // (stablyai/orca 565 KB, đo 05/11/2026). Bản mới nhất vẫn có ở `banPhatHanhMoiNhat`.
        tomTatNangCapVi: r.tomTatNangCapVi,
        laBanThuNghiem: r.laBanThuNghiem,
        ngayPhatHanh: r.ngayPhatHanh.toISOString(),
        danhSachTepCaiDat: r.danhSachTepCaiDat
          .map(mapTepCaiDat)
          .sort((a, b) => b.diemUuTien - a.diemUuTien),
      })),
    };

    // Lưu vào Cache (bản lưu không gắn cờ người dùng cụ thể)
    await this.cacheService.luu(cacheKey, result, this.CACHE_TTL);
    if (!isUuid) {
      await this.cacheService.luu(
        this.taoKhoaCacheChiTiet(app.maUngDung, platform, arch),
        result,
        this.CACHE_TTL,
      );
    }

    if (userId) {
      const likedSet = await this.layTapHopYeuThichCuaUser(userId);
      return {
        ...result,
        laYeuThich: likedSet.has(app.maUngDung),
      };
    }

    return result;
  }

  /**
   * Phân giải tệp cài đặt phù hợp nhất theo nền tảng và kiến trúc phần cứng (P2-33).
   * Chỉ dùng luật (P2-70): tên file mơ hồ thì trả danh sách để người dùng tự chọn, không đoán.
   */
  async giaiQuyetFileCaiDat(dto: ResolveAssetDto): Promise<ResolveAssetResponseDto> {
    const { maUngDung, nenTang, abis, choPhepBanThuNghiem = false, phienBan } = dto;
    const cleanId = decodeURIComponent(maUngDung.trim());
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    // 1. Tìm ứng dụng
    const app = await this.prisma.ungDung.findFirst({
      where: isUuid
        ? { maUngDung: cleanId }
        : { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
    });

    if (!app) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với mã hoặc slug: ${cleanId}`);
    }

    // 2. Tìm bản phát hành phù hợp
    const releases = await this.prisma.banPhatHanh.findMany({
      where: {
        maUngDung: app.maUngDung,
        ...(phienBan ? { tenPhienBan: phienBan } : {}),
        ...(choPhepBanThuNghiem ? {} : { laBanThuNghiem: false }),
      },
      orderBy: { ngayPhatHanh: 'desc' },
      include: {
        danhSachTepCaiDat: true,
      },
      take: 5,
    });

    if (releases.length === 0) {
      throw new NotFoundException({
        maLoi: 'KHONG_CO_RELEASE',
        thongBao: 'Không tìm thấy bản phát hành phù hợp cho ứng dụng này.',
      });
    }

    // Repo nhiều nền tảng hay phát hành riêng từng bản (vd. bản Android mới hơn bản Windows): lấy bản mới nhất
    // có tệp của đúng nền tảng được hỏi, không phải bản mới nhất có tệp bất kỳ
    const DINH_DANG_WINDOWS: DinhDangTep[] = [
      DinhDangTep.EXE,
      DinhDangTep.MSI,
      DinhDangTep.ZIP_PORTABLE,
    ];
    const laTepCuaNenTang = (f: { dinhDangTep: DinhDangTep }) =>
      nenTang === 'ANDROID'
        ? f.dinhDangTep === DinhDangTep.APK
        : DINH_DANG_WINDOWS.includes(f.dinhDangTep);
    const targetRelease =
      releases.find((r) => r.danhSachTepCaiDat.some(laTepCuaNenTang)) ??
      releases.find((r) => r.danhSachTepCaiDat.length > 0);
    if (!targetRelease) {
      throw new NotFoundException({
        maLoi: 'KHONG_CO_FILE_PHU_HOP',
        thongBao: 'Bản phát hành hiện tại không có tệp cài đặt nào.',
      });
    }

    const allFiles = targetRelease.danhSachTepCaiDat;

    // 3. Phân giải trên Android (P2-33.3)
    if (nenTang === 'ANDROID') {
      const apkFiles = allFiles.filter((f) => f.dinhDangTep === DinhDangTep.APK);

      if (apkFiles.length === 0) {
        throw new NotFoundException({
          maLoi: 'KHONG_CO_FILE_PHU_HOP',
          thongBao: 'Bản phát hành không chứa tệp cài đặt định dạng APK cho Android.',
          details: { abisHienCo: Array.from(new Set(allFiles.map((f) => f.kienTrucChip))) },
        });
      }

      // 3.1. Thử khớp theo thứ tự ưu tiên ABI của máy khách
      for (const rawAbi of abis) {
        const targetChip = this.chuyenDoiAbiSangEnum(rawAbi);
        const match = apkFiles.find((f) => f.kienTrucChip === targetChip);
        if (match) {
          return this.dongGoiTaiSanPhanHoi(match, 'LUAT');
        }
      }

      // 3.2. Thử khớp bản dùng chung (Universal APK)
      const universalMatch = apkFiles.find((f) => f.kienTrucChip === KienTrucChip.DUNG_CHUNG);
      if (universalMatch) {
        return this.dongGoiTaiSanPhanHoi(universalMatch, 'LUAT');
      }

      // 3.3. Tên file mơ hồ: không đoán, trả danh sách để người dùng tự chọn (P2-70.3).
      // Dữ liệu phụ phải nằm trong `details`: bộ lọc lỗi chung chỉ chuyển trường này về máy khách (thành `chiTiet`).
      const ambiguousFiles = apkFiles.filter((f) => f.kienTrucChip === KienTrucChip.KHONG_XAC_DINH);
      throw new NotFoundException({
        maLoi: 'KHONG_CO_FILE_PHU_HOP',
        thongBao: `Không tìm thấy tệp APK tương thích với các kiến trúc thiết bị: ${abis.join(', ')}`,
        details: {
          abisHienCo: Array.from(new Set(apkFiles.map((f) => f.kienTrucChip))),
          tepDeNguoiDungChon: ambiguousFiles.map((f) => ({ maTep: f.maTep, tenTep: f.tenTep })),
        },
      });
    }

    // 4. Phân giải trên Windows (P2-33.4)
    if (nenTang === 'WINDOWS') {
      const winFiles = allFiles.filter(
        (f) =>
          f.dinhDangTep === DinhDangTep.EXE ||
          f.dinhDangTep === DinhDangTep.MSI ||
          f.dinhDangTep === DinhDangTep.ZIP_PORTABLE,
      );

      if (winFiles.length === 0) {
        throw new NotFoundException({
          maLoi: 'KHONG_CO_FILE_PHU_HOP',
          thongBao: 'Bản phát hành không chứa tệp cài đặt cho Windows.',
          details: { abisHienCo: Array.from(new Set(allFiles.map((f) => f.kienTrucChip))) },
        });
      }

      // Ưu tiên các file GUI/Installer tiêu chuẩn trước bản CLI, debug, unsigned
      const laTepUuTien = (fileName: string) => {
        const lower = fileName.toLowerCase();
        return !lower.includes('cli') && !lower.includes('debug') && !lower.includes('unsigned');
      };

      // 4.1. MSI hoặc EXE X86_64
      const msiX64 =
        winFiles.find(
          (f) =>
            f.dinhDangTep === DinhDangTep.MSI &&
            f.kienTrucChip === KienTrucChip.X86_64 &&
            laTepUuTien(f.tenTep),
        ) ||
        winFiles.find(
          (f) => f.dinhDangTep === DinhDangTep.MSI && f.kienTrucChip === KienTrucChip.X86_64,
        );
      if (msiX64) return this.dongGoiTaiSanPhanHoi(msiX64, 'LUAT');

      const exeX64 =
        winFiles.find(
          (f) =>
            f.dinhDangTep === DinhDangTep.EXE &&
            f.kienTrucChip === KienTrucChip.X86_64 &&
            laTepUuTien(f.tenTep),
        ) ||
        winFiles.find(
          (f) => f.dinhDangTep === DinhDangTep.EXE && f.kienTrucChip === KienTrucChip.X86_64,
        );
      if (exeX64) return this.dongGoiTaiSanPhanHoi(exeX64, 'LUAT');

      // 4.2. ZIP_PORTABLE X86_64
      const zipX64 = winFiles.find(
        (f) => f.dinhDangTep === DinhDangTep.ZIP_PORTABLE && f.kienTrucChip === KienTrucChip.X86_64,
      );
      if (zipX64) return this.dongGoiTaiSanPhanHoi(zipX64, 'LUAT');

      // 4.3. EXE hoặc MSI X86 (32-bit)
      const exeX86 = winFiles.find(
        (f) =>
          (f.dinhDangTep === DinhDangTep.EXE || f.dinhDangTep === DinhDangTep.MSI) &&
          f.kienTrucChip === KienTrucChip.X86,
      );
      if (exeX86) return this.dongGoiTaiSanPhanHoi(exeX86, 'LUAT');

      // 4.4. ZIP_PORTABLE X86
      const zipX86 = winFiles.find(
        (f) => f.dinhDangTep === DinhDangTep.ZIP_PORTABLE && f.kienTrucChip === KienTrucChip.X86,
      );
      if (zipX86) return this.dongGoiTaiSanPhanHoi(zipX86, 'LUAT');

      // 4.5. File Windows còn lại (tên không ghi kiến trúc, như "Setup.exe"): ưu tiên bộ cài, rồi tới bản không
      // phải ARM, vì thứ tự tệp trong CSDL không cố định và máy x64 không chạy được bản ARM
      const laArm = (f: TepCaiDat) => /arm64|aarch64/i.test(f.tenTep);
      const conLai =
        winFiles.find((f) => f.dinhDangTep !== DinhDangTep.ZIP_PORTABLE && !laArm(f)) ??
        winFiles.find((f) => !laArm(f)) ??
        winFiles[0];
      if (conLai) {
        return this.dongGoiTaiSanPhanHoi(conLai, 'LUAT');
      }

      throw new NotFoundException({
        maLoi: 'KHONG_CO_FILE_PHU_HOP',
        thongBao: 'Không tìm thấy tệp cài đặt phù hợp cho Windows.',
      });
    }

    throw new BadRequestException(`Nền tảng không hỗ trợ: ${nenTang}`);
  }

  private chuyenDoiAbiSangEnum(abi: string): KienTrucChip {
    const norm = abi.toLowerCase().replace(/[-_]/g, '');
    if (norm.includes('arm64') || norm.includes('v8a')) return KienTrucChip.ARM64_V8A;
    if (norm.includes('armeabi') || norm.includes('v7a')) return KienTrucChip.ARMEABI_V7A;
    if (norm.includes('x8664') || norm.includes('x64') || norm.includes('amd64'))
      return KienTrucChip.X86_64;
    if (norm.includes('x86') || norm.includes('i386') || norm.includes('i686'))
      return KienTrucChip.X86;
    return KienTrucChip.KHONG_XAC_DINH;
  }

  private dongGoiTaiSanPhanHoi(file: TepCaiDat, nguonQuyetDinh: 'LUAT'): ResolveAssetResponseDto {
    return {
      tepCaiDat: {
        maTep: file.maTep,
        maPhatHanh: file.maPhatHanh,
        tenTep: file.tenTep,
        duongDanTaiVe: file.duongDanTaiVe,
        dungLuongBytes: file.dungLuongBytes.toString(),
        dinhDangTep: file.dinhDangTep,
        kienTrucChip: file.kienTrucChip,
        maBamSha256: file.maBamSha256,
        soLuotTai: file.soLuotTai,
        ngayTao: file.ngayTao.toISOString(),
      },
      nguonQuyetDinh,
    };
  }

  /**
   * Xóa mọi biến thể cache chi tiết của một app (theo mã và theo tên repo, kể cả đuôi :platform:arch)
   * để Desktop luôn thấy dữ liệu mới nhất sau khi dữ liệu app thay đổi.
   */
  /**
   * Khóa cache chi tiết có số phiên bản bộ bóc tách (P3B-25.15): bản cache lấy trả sớm, bỏ qua bước kiểm
   * "cần bóc tách lại", nên khi tăng phiên bản mà còn cache cũ theo tên repo thì việc tính lại không chạy.
   * Đổi phiên bản là đổi khóa, cache cũ tự hết hiệu lực. Giữ tiền tố `<mã hoặc tên repo>` để xóa theo tiền tố.
   */
  private taoKhoaCacheChiTiet(id: string, platform?: string, arch?: string): string {
    return `${this.CACHE_KEY_DETAIL}${id}:${platform || 'all'}:${arch || 'all'}:v${PHIEN_BAN_BOC_TACH_CLI}`;
  }

  private async xoaCacheChiTietApp(app: {
    maUngDung: string;
    tenRepoDayDu: string;
  }): Promise<void> {
    await this.cacheService.xoaTheoPrefix(`${this.CACHE_KEY_DETAIL}${app.maUngDung}`);
    await this.cacheService.xoaTheoPrefix(
      `${this.CACHE_KEY_DETAIL}${app.tenRepoDayDu.toLowerCase()}`,
    );
  }

  /**
   * Phân tích Dual-AI cho ứng dụng (Lazy AI & Distributed Lock - P2-31).
   * Bọc trong withLock("fs:ai:<id>") đảm bảo 10 request đồng thời chỉ chạy AI 1 lần.
   */
  async phanTichUngDung(maUngDung: string): Promise<void> {
    // ARCH-02: Single-Flight pattern ngăn chặn request đồng thời kích hoạt nhiều job AI
    const existingPromise = this.inFlightPhanTichMap.get(maUngDung);
    if (existingPromise) {
      return existingPromise;
    }

    const task = (async () => {
      const lockKey = `fs:ai:${maUngDung}`;

      try {
        await this.cacheService.withLock(lockKey, 60000, async () => {
          // Double-check xem đã có ai phân tích xong chưa
          const existing = await this.prisma.phanTichAI.findUnique({
            where: { maUngDung },
          });

          // Nếu đã có phân tích AI và đã có hướng dẫn cài đặt CLI -> hoàn tất, không làm lại
          if (existing && daCoKetQuaBocTachCli(existing.huongDanCaiDat)) {
            return;
          }

          const app = await this.prisma.ungDung.findUnique({
            where: { maUngDung },
            include: {
              danhSachPhatHanh: {
                orderBy: { ngayPhatHanh: 'desc' },
                take: 1,
                include: { danhSachTepCaiDat: true },
              },
            },
          });

          if (!app) return;

          const owner = app.chuSoHuu || app.tenRepoDayDu.split('/')[0] || '';
          const repo = app.tenKhoChua || app.tenRepoDayDu.split('/')[1] || '';

          // Trường hợp app đã có phân tích AI nhưng thiếu hướng dẫn CLI:
          // Bổ sung hướng dẫn CLI mà không cần chạy lại toàn bộ quy trình AI
          if (existing && !daCoKetQuaBocTachCli(existing.huongDanCaiDat)) {
            let readme = '';
            let fetchReadmeLoi = false;
            try {
              readme = (await this.githubService.layReadme(owner, repo)) || '';
            } catch (err: unknown) {
              fetchReadmeLoi = true;
              this.logger.warn(
                `Không lấy được README cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
              );
            }

            // CHỈ xử lý nếu lấy README thành công
            if (fetchReadmeLoi) {
              this.logger.warn(
                `Bỏ qua đánh dấu CLI cho [${app.tenRepoDayDu}] do lỗi tải README, giữ null cho lần sau thử lại.`,
              );
              return;
            }

            if (!readme) {
              // Repo thật sự không có README trên GitHub -> đánh dấu khongCoHuongDan để dừng vòng lặp ngầm
              await this.prisma.phanTichAI.update({
                where: { maUngDung },
                data: {
                  huongDanCaiDat: {
                    khongCoHuongDan: true,
                    phienBanBocTach: PHIEN_BAN_BOC_TACH_CLI,
                    cachCai: [],
                  } as unknown as Prisma.InputJsonValue,
                },
              });
              await this.xoaCacheChiTietApp(app);
              this.logger.log(
                `ℹ️ [${app.tenRepoDayDu}] không có README trên GitHub, đã đánh dấu khongCoHuongDan`,
              );
              return;
            }

            let huongDanCaiDat: HuongDanCaiDatDto | null = null;
            let aiBiLoi = false;

            // Bộ quy tắc chạy trên toàn README, không chờ tìm được mục "Cài đặt": nhiều README (tiktoken, sharp...)
            // không có tiêu đề kiểu đó nhưng vẫn có lệnh cài hợp lệ (P3B-25).
            try {
              const readmeUrl = `https://github.com/${app.tenRepoDayDu}#readme`;
              // P3B-16.3: Trích xuất câu lệnh cài đặt từ README bằng quy tắc thuần (KHÔNG dùng AI)
              huongDanCaiDat = trichXuatHuongDanCliBangQuyTac(readme, readmeUrl);
            } catch (err: unknown) {
              aiBiLoi = true;
              this.logger.warn(
                `Lỗi bổ sung hướng dẫn CLI cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
              );
            }

            // NẾU AI hoặc bóc tách gặp lỗi (429, timeout, network error):
            // Giữ NULL để lần sau thử lại, tuyệt đối KHÔNG lưu khongCoHuongDan: true!
            if (aiBiLoi) {
              this.logger.warn(
                `AI gặp lỗi khi bóc tách CLI cho [${app.tenRepoDayDu}], giữ null để lần sau thử lại.`,
              );
              return;
            }

            // Chỉ lưu khi đã đọc được README thành công và xác nhận:
            // 1. Có hướng dẫn CLI trích xuất thành công và có ít nhất 1 cách cài hợp lệ có trinhQuanLy và tenGoi (D-23) -> lưu huongDanCaiDat
            // 2. Không có install section hoặc bóc tách thành công nhưng không có lệnh CLI hợp lệ -> lưu marker { khongCoHuongDan: true, cachCai: [] }
            const coCachCaiHopLe = coCachCaiCliHopLe(huongDanCaiDat);
            const giaTriLuu = coCachCaiHopLe
              ? huongDanCaiDat
              : { khongCoHuongDan: true, phienBanBocTach: PHIEN_BAN_BOC_TACH_CLI, cachCai: [] };

            await this.prisma.phanTichAI.update({
              where: { maUngDung },
              data: {
                huongDanCaiDat: giaTriLuu as unknown as Prisma.InputJsonValue,
              },
            });
            await this.xoaCacheChiTietApp(app);
            if (coCachCaiHopLe) {
              this.logger.log(`✅ Đã cập nhật bổ sung hướng dẫn CLI cho app [${app.tenRepoDayDu}]`);
            } else {
              this.logger.log(
                `ℹ️ [${app.tenRepoDayDu}] không có hướng dẫn CLI hợp lệ, đã đánh dấu cache`,
              );
            }
            return;
          }

          // 1. Lấy README từ GitHub
          let readme = '';
          let fetchReadmeLoi = false;
          try {
            readme = (await this.githubService.layReadme(owner, repo)) || '';
          } catch (err: unknown) {
            fetchReadmeLoi = true;
            this.logger.warn(
              `Không lấy được README cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
            );
          }

          // 2. Khẩu hiệu tiếng Việt (D-17 & P3B-02.6: lấy từ mô tả tiếng Việt đã dịch, fallback mô tả gốc hoặc tên app)
          const khauHieuTiengViet =
            this.layMoTaViHienTai(app) ||
            (app.moTaGocTiengAnh && app.moTaGocTiengAnh.length > 80
              ? `${app.moTaGocTiengAnh.slice(0, 77)}...`
              : app.moTaGocTiengAnh) ||
            app.tenKhoChua;

          // 3. Đọc quyền Android qua APK HTTP Range Request nếu có APK (P2-35)
          let danhSachQuyen: string[] = [];
          let coAccessibilityService = false;
          const latestRelease = app.danhSachPhatHanh[0];
          const apkFile = latestRelease?.danhSachTepCaiDat?.find(
            (f) => f.dinhDangTep === DinhDangTep.APK,
          );

          if (apkFile && apkFile.duongDanTaiVe) {
            try {
              const kqApk = await this.apkInspectorService.docQuyenApkTuUrl(apkFile.duongDanTaiVe);
              if (kqApk.thanhCong) {
                danhSachQuyen = kqApk.permissions;
                coAccessibilityService = kqApk.coAccessibilityService;
                if (kqApk.packageName && !app.tenGoiAndroid) {
                  await this.prisma.ungDung.update({
                    where: { maUngDung },
                    data: { tenGoiAndroid: kqApk.packageName },
                  });
                }
              }
            } catch (err: unknown) {
              this.logger.warn(
                `Lỗi phân tích APK cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
              );
            }
          }

          // 4. Lấy dữ liệu sống từ GitHub và tính điểm uy tín bằng luật (P2-32, D-01, P2-70)
          let daArchived = false;
          let ngayPushCuoi = app.dongBoLanCuoi;
          let soContributor = 1;

          try {
            const [repoInfo, contributorsCount] = await Promise.all([
              this.githubService.layRepo(owner, repo),
              this.githubService.laySoLuongContributor(owner, repo),
            ]);

            if (repoInfo) {
              daArchived = Boolean(repoInfo.archived);
              if (repoInfo.pushed_at) {
                ngayPushCuoi = new Date(repoInfo.pushed_at);
              }
            }

            if (typeof contributorsCount === 'number' && contributorsCount > 0) {
              soContributor = contributorsCount;
            }
          } catch (err: unknown) {
            this.logger.warn(
              `Không lấy được thông tin repo/contributors sống cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
            );
          }

          const trustScore = await this.trustScoreService.tinhTrustScore({
            soSaoGithub: app.soSaoGithub,
            soLuotFork: app.soLuotFork,
            loaiGiayPhep: app.loaiGiayPhep,
            daArchived,
            ngayPushCuoi,
            soContributor,
            danhSachQuyenAndroid: danhSachQuyen,
            coAccessibilityService,
          });

          // 4b. Trích xuất hướng dẫn cài đặt qua dòng lệnh CLI từ README (Section 3.3, P3B-16.3, D-23)
          let huongDanCaiDat: HuongDanCaiDatDto | null = null;
          let aiCliBiLoi = false;
          if (!fetchReadmeLoi && readme) {
            // Chạy quy tắc trên toàn README, không phụ thuộc có tìm được mục "Cài đặt" hay không (P3B-25)
            try {
              const readmeUrl = `https://github.com/${app.tenRepoDayDu}#readme`;

              // P3B-16.3: Trích xuất câu lệnh cài đặt từ README bằng quy tắc thuần (KHÔNG dùng AI)
              huongDanCaiDat = trichXuatHuongDanCliBangQuyTac(readme, readmeUrl);
            } catch (err: unknown) {
              aiCliBiLoi = true;
              this.logger.warn(
                `Lỗi bóc tách hướng dẫn CLI [${app.tenRepoDayDu}]: ${(err as Error).message}`,
              );
            }
          }

          // 5. Lưu kết quả vào phan_tich_ai (P3B-10: bỏ tomTatTinhNangVi và moHinhTomTat theo D-17)
          let giaTriLuuCli: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
            Prisma.DbNull;
          const coCachCaiHopLe = coCachCaiCliHopLe(huongDanCaiDat);
          if (coCachCaiHopLe) {
            giaTriLuuCli = huongDanCaiDat as unknown as Prisma.InputJsonValue;
          } else if (!fetchReadmeLoi && readme && !aiCliBiLoi) {
            // Chỉ đánh dấu khi đã đọc được README thành công và bóc tách không bị lỗi
            giaTriLuuCli = {
              khongCoHuongDan: true,
              phienBanBocTach: PHIEN_BAN_BOC_TACH_CLI,
              cachCai: [],
            } as unknown as Prisma.InputJsonValue;
          } else {
            // Gặp lỗi tải README hoặc lỗi bóc tách -> để null cho lần sau thử lại
            giaTriLuuCli = Prisma.DbNull;
          }

          const phanTich = await this.prisma.phanTichAI.upsert({
            where: { maUngDung },
            create: {
              maUngDung,
              khauHieuTiengViet,
              tomTatTinhNangVi: null,
              diemUyTin: trustScore.diemUyTin,
              mucDoAnToan: trustScore.mucDoAnToan,
              yeuToRuiRo: trustScore.yeuToRuiRo as unknown as Prisma.InputJsonValue,
              quyenHanDaKiemTra: danhSachQuyen as unknown as Prisma.InputJsonValue,
              moHinhTomTat: null,
              huongDanCaiDat: giaTriLuuCli,
            },
            update: {
              khauHieuTiengViet,
              tomTatTinhNangVi: null,
              diemUyTin: trustScore.diemUyTin,
              mucDoAnToan: trustScore.mucDoAnToan,
              yeuToRuiRo: trustScore.yeuToRuiRo as unknown as Prisma.InputJsonValue,
              quyenHanDaKiemTra: danhSachQuyen as unknown as Prisma.InputJsonValue,
              moHinhTomTat: null,
              huongDanCaiDat: giaTriLuuCli,
            },
          });

          // 6. Sinh vector 768 chiều & lưu pgvector (P2-36), mỗi mô hình Embedding một cột (P3B-28.3)
          const textEmbed = this.semanticSearchService.chuanBiVanBanNhung({
            tenKhoChua: app.tenKhoChua,
            moTa: app.moTaVi || app.moTaGocTiengAnh,
            topics: app.danhSachChuDe,
            danhMuc: app.danhMucChinh,
          });
          let duVector = true;
          for (const moHinh of MO_HINH_EMBEDDING) {
            // Mô hình nào lỗi hay hết lượt thì cột đó để trống, lệnh `data-repo sinh-vector` bổ sung sau.
            try {
              const vector = await this.semanticSearchService.sinhEmbedding(textEmbed, moHinh);
              await this.semanticSearchService.luuVectorNguNghia(
                phanTich.maPhanTich,
                vector,
                moHinh,
              );
            } catch (err: unknown) {
              duVector = false;
              this.logger.warn(`Lỗi sinh/lưu vector ${moHinh.model}: ${(err as Error).message}`);
            }
          }
          // P3B-09.3: ghi mã băm văn bản để job 2:00 biết khi nào văn bản đổi mà sinh lại
          if (duVector) {
            await this.semanticSearchService.ghiMaBamVanBan(phanTich.maPhanTich, textEmbed);
          }

          // D-34: Không dịch hoặc tóm tắt changelog; giữ cột tóm tắt để tương thích dữ liệu cũ.
          // 7. Làm sạch cache chi tiết app (ARCH-01: dùng xoaTheoPrefix dọn sạch mọi biến thể :platform:arch)
          await this.xoaCacheChiTietApp(app);
          await this.cacheService.del([
            `${this.CACHE_KEY_DETAIL}${app.maUngDung}`,
            `${this.CACHE_KEY_DETAIL}${app.tenRepoDayDu.toLowerCase()}`,
          ]);
          this.logger.log(`Hoàn thành phân tích Dual-AI cho [${app.tenRepoDayDu}]`);
        });
      } catch (err: unknown) {
        this.logger.error(
          `Lỗi phân tích AI cho ứng dụng [${maUngDung}]: ${(err as Error).message}`,
        );
      }
    })();

    this.inFlightPhanTichMap.set(maUngDung, task);
    try {
      await task;
    } finally {
      this.inFlightPhanTichMap.delete(maUngDung);
    }
  }

  /**
   * Prewarm phân tích Dual-AI cho các ứng dụng (P2-31.5, phục vụ demo P6-07).
   */
  async chayLamNongAI(danhSachAppIds?: string[]): Promise<{ daChay: number; thanhCong: number }> {
    let appsToWarm: { maUngDung: string }[];
    if (danhSachAppIds && danhSachAppIds.length > 0) {
      appsToWarm = await this.prisma.ungDung.findMany({
        where: {
          OR: [{ maUngDung: { in: danhSachAppIds } }, { tenRepoDayDu: { in: danhSachAppIds } }],
        },
        select: { maUngDung: true },
      });
    } else {
      // Prewarm các app chưa có phân tích AI
      appsToWarm = await this.prisma.ungDung.findMany({
        where: { phanTichAI: null },
        select: { maUngDung: true },
        take: 20,
      });
    }

    let thanhCong = 0;
    for (const app of appsToWarm) {
      try {
        await this.phanTichUngDung(app.maUngDung);
        thanhCong++;
      } catch (err: unknown) {
        this.logger.warn(`Lỗi prewarm app [${app.maUngDung}]: ${(err as Error).message}`);
      }
    }

    return { daChay: appsToWarm.length, thanhCong };
  }

  /**
   * P2-40: Tìm kiếm thông minh (Smart Input Dispatcher - GET /tim-kiem).
   * Phân luồng câu nhập:
   * 1. URL GitHub: Phát hiện link GitHub -> trả trạng thái nhận diện để Paste & Play.
   * 2. TEN_APP: Tìm kiếm trực tiếp trong CSDL Store qua ILIKE (tên, mô tả, slogan) -> fallback GitHub Search.
   * 3. Y_DINH: Tìm kiếm ngữ nghĩa pgvector + Gemini dịch câu tìm kiếm thành query GitHub an toàn.
   */
  async timKiemThongMinh(query: SearchQueryDto): Promise<TimKiemResponseDto> {
    const rawQ = query.q?.trim() || '';
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 50) : 20;

    if (!rawQ) {
      return {
        duLieu: [],
        tongSo: 0,
        trangHienTai: page,
        tongSoTrang: 0,
        kichThuocTrang: limit,
        loaiTruyVan: 'TEN_APP',
        nguonKetQua: 'CSDL',
      };
    }

    // Cache key cho kết quả tìm kiếm với TTL 300s (5 phút)
    const queryHash = Buffer.from(
      `${rawQ.toLowerCase()}_${query.platform || 'all'}_${page}_${limit}`,
    ).toString('base64');
    const cacheKey = `fs:search:query:${queryHash}`;
    const cached = await this.cacheService.lay<TimKiemResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const phanLuong = phanLuongInput(rawQ);

    // LUỒNG 1: URL GITHUB (P2-40.2)
    if (phanLuong.loai === 'URL' && phanLuong.owner && phanLuong.repo) {
      const fullSlug = `${phanLuong.owner}/${phanLuong.repo}`;
      const app = await this.prisma.ungDung.findUnique({
        where: { tenRepoDayDu: fullSlug },
        include: {
          phanTichAI: true,
          danhSachPhatHanh: {
            orderBy: { ngayPhatHanh: 'desc' },
            take: 10,
            include: { danhSachTepCaiDat: true },
          },
        },
      });

      let res: TimKiemResponseDto;
      if (app && app.trangThai !== 'KHONG_CO_BAN_CAI') {
        const banMoiNhat = layBanPhatHanhMoiNhat(app.danhSachPhatHanh, query.platform);
        const { dinhDangCoSan, kienTrucCoSan } = trichXuatDinhDangVaKienTruc(
          banMoiNhat?.danhSachTepCaiDat,
        );
        const item: UngDungTomTatDto = {
          maUngDung: app.maUngDung,
          tenRepoDayDu: app.tenRepoDayDu,
          chuSoHuu: app.chuSoHuu,
          tenKhoChua: app.tenKhoChua,
          duongDanGithub: app.duongDanGithub,
          duongDanIcon: app.duongDanIcon,
          soSaoGithub: app.soSaoGithub,
          danhMucChinh: app.danhMucChinh,
          nenTangHoTro: app.nenTangHoTro,
          duocNoiBat: app.duocNoiBat,
          daXacMinh: app.daXacMinh,
          daLuuTru: Boolean(app.daLuuTru),
          tenGoiAndroid: app.tenGoiAndroid,
          moTaGocTiengAnh: app.moTaGocTiengAnh || null,
          moTaVi: this.layMoTaViHienTai(app),
          khauHieuTiengViet:
            this.layMoTaViHienTai(app) ||
            this.layKhauHieuHienThi(app, app.phanTichAI?.khauHieuTiengViet),
          diemUyTin: app.phanTichAI?.diemUyTin ?? null,
          mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
          phienBanMoiNhat: banMoiNhat?.tenPhienBan || null,
          dinhDangCoSan,
          kienTrucCoSan,
          loaiGiayPhep: app.loaiGiayPhep || null,
          ngayCapNhat: app.dongBoLanCuoi.toISOString(),
        };

        res = {
          duLieu: [item],
          tongSo: 1,
          trangHienTai: 1,
          tongSoTrang: 1,
          kichThuocTrang: query.limit,
          loaiTruyVan: 'URL',
          thongDiep: 'Ứng dụng đã có sẵn trong ForgeStore.',
          duongDanUrl: {
            owner: phanLuong.owner,
            repo: phanLuong.repo,
            urlGoc: rawQ,
            daCoTrongStore: true,
          },
          nguonKetQua: 'URL',
        };
      } else {
        res = {
          duLieu: [],
          tongSo: 0,
          trangHienTai: 1,
          tongSoTrang: 0,
          kichThuocTrang: limit,
          loaiTruyVan: 'URL',
          thongDiep: 'Đã nhận diện liên kết GitHub. Sẵn sàng thẩm định và nạp (Paste & Play).',
          duongDanUrl: {
            owner: phanLuong.owner,
            repo: phanLuong.repo,
            urlGoc: rawQ,
            daCoTrongStore: false,
          },
          nguonKetQua: 'URL',
        };
      }

      await this.cacheService.dat(cacheKey, res, 300);
      return res;
    }

    // LUỒNG 2: TÊN ỨNG DỤNG (P2-40.3)
    if (phanLuong.loai === 'TEN_APP') {
      const skip = (page - 1) * limit;
      const where: Prisma.UngDungWhereInput = {
        trangThai: 'HOAT_DONG',
        OR: [
          { tenKhoChua: { contains: phanLuong.tuKhoa, mode: 'insensitive' } },
          { tenRepoDayDu: { contains: phanLuong.tuKhoa, mode: 'insensitive' } },
          { moTaGocTiengAnh: { contains: phanLuong.tuKhoa, mode: 'insensitive' } },
        ],
      };

      if (query.platform && query.platform !== NenTangHoTro.DA_NEN_TANG) {
        where.nenTangHoTro = { in: [query.platform, NenTangHoTro.DA_NEN_TANG] };
      }

      const [dbApps, tongSo] = await Promise.all([
        this.prisma.ungDung.findMany({
          where,
          skip,
          take: limit,
          orderBy: { soSaoGithub: 'desc' },
          include: {
            phanTichAI: true,
            danhSachPhatHanh: {
              orderBy: { ngayPhatHanh: 'desc' },
              take: 10,
              include: { danhSachTepCaiDat: true },
            },
          },
        }),
        this.prisma.ungDung.count({ where }),
      ]);

      if (dbApps.length > 0) {
        const duLieu: UngDungTomTatDto[] = dbApps.map((app) => {
          const banMoiNhat = layBanPhatHanhMoiNhat(app.danhSachPhatHanh, query.platform);
          const { dinhDangCoSan, kienTrucCoSan } = trichXuatDinhDangVaKienTruc(
            banMoiNhat?.danhSachTepCaiDat,
          );
          return {
            maUngDung: app.maUngDung,
            tenRepoDayDu: app.tenRepoDayDu,
            chuSoHuu: app.chuSoHuu,
            tenKhoChua: app.tenKhoChua,
            duongDanGithub: app.duongDanGithub,
            duongDanIcon: app.duongDanIcon,
            soSaoGithub: app.soSaoGithub,
            danhMucChinh: app.danhMucChinh,
            nenTangHoTro: app.nenTangHoTro,
            duocNoiBat: app.duocNoiBat,
            daXacMinh: app.daXacMinh,
            daLuuTru: Boolean(app.daLuuTru),
            tenGoiAndroid: app.tenGoiAndroid,
            moTaGocTiengAnh: app.moTaGocTiengAnh || null,
            moTaVi: this.layMoTaViHienTai(app),
            khauHieuTiengViet:
              this.layMoTaViHienTai(app) ||
              this.layKhauHieuHienThi(app, app.phanTichAI?.khauHieuTiengViet),
            diemUyTin: app.phanTichAI?.diemUyTin ?? null,
            mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
            phienBanMoiNhat: banMoiNhat?.tenPhienBan || null,
            dinhDangCoSan,
            kienTrucCoSan,
            loaiGiayPhep: app.loaiGiayPhep || null,
            ngayCapNhat: app.dongBoLanCuoi.toISOString(),
          };
        });

        const res: TimKiemResponseDto = {
          duLieu,
          tongSo,
          trangHienTai: page,
          tongSoTrang: Math.ceil(tongSo / limit) || 1,
          kichThuocTrang: limit,
          loaiTruyVan: 'TEN_APP',
          nguonKetQua: 'CSDL',
        };

        await this.cacheService.dat(cacheKey, res, 300);
        return res;
      }

      // Cụm 2 đến 3 từ tiếng Việt mà Store không có app tên giống (ví dụ "chụp màn hình") là mô tả nhu cầu,
      // không phải tên app: chuyển sang luồng ý định thay vì tìm chữ đó trên GitHub (ra repo vãng lai).
      if (laCumTuMoTaNhuCauTiengViet(phanLuong.tuKhoa)) {
        return this.timKiemThongMinh({ ...query, q: `ứng dụng ${rawQ}` });
      }

      // Nếu không có trong DB Store -> gọi GitHub Search API (P2-40.3)
      try {
        const ghSearch = await this.githubService.timKiemRepo(phanLuong.tuKhoa, limit, page);
        const duLieu: UngDungTomTatDto[] = ghSearch.items.map((r) => ({
          maUngDung: r.html_url,
          tenRepoDayDu: r.full_name,
          chuSoHuu: r.owner.login,
          tenKhoChua: r.name,
          duongDanGithub: r.html_url,
          duongDanIcon: r.owner.avatar_url || null,
          soSaoGithub: r.stargazers_count,
          danhMucChinh: anhXaDanhMuc(r.topics, r.description, r.full_name),
          nenTangHoTro: null,
          chuaThamDinh: true, // Kết quả trực tiếp từ GitHub, chưa thẩm định vào Store
          duocNoiBat: false,
          daXacMinh: false,
          daLuuTru: Boolean(r.archived),
          khauHieuTiengViet: null,
          diemUyTin: null,
          mucDoAnToan: null,
          phienBanMoiNhat: null,
          ngayCapNhat: r.updated_at,
        }));

        const res: TimKiemResponseDto = {
          duLieu,
          tongSo: ghSearch.total_count,
          trangHienTai: page,
          tongSoTrang: Math.ceil(ghSearch.total_count / limit) || 1,
          kichThuocTrang: limit,
          loaiTruyVan: 'TEN_APP',
          thongDiep: 'Kết quả tìm kiếm trực tiếp từ GitHub.',
          nguonKetQua: 'GITHUB',
        };

        await this.cacheService.dat(cacheKey, res, 300);
        return res;
      } catch (err) {
        this.logger.warn(`Lỗi GitHub search: ${(err as Error).message}`);
        return {
          duLieu: [],
          tongSo: 0,
          trangHienTai: page,
          tongSoTrang: 0,
          kichThuocTrang: limit,
          loaiTruyVan: 'TEN_APP',
          nguonKetQua: 'CSDL',
        };
      }
    }

    // LUỒNG 3: Ý ĐỊNH TỰ NHIÊN (P2-40.4 & P2-42)
    // 3.1: Tìm kiếm pgvector trong DB
    let semanticApps: UngDungTomTatDto[] = [];
    try {
      const vectorMatches = await this.semanticSearchService.timKiemNguNghia(
        rawQ,
        limit,
        query.platform,
      );
      if (vectorMatches.length > 0) {
        semanticApps = vectorMatches.map((m) => ({
          maUngDung: m.maUngDung,
          tenRepoDayDu: m.tenRepoDayDu,
          chuSoHuu: m.chuSoHuu,
          tenKhoChua: m.tenKhoChua,
          duongDanGithub: `https://github.com/${m.tenRepoDayDu}`,
          duongDanIcon: m.duongDanIcon,
          soSaoGithub: m.soSaoGithub,
          danhMucChinh: m.danhMucChinh,
          nenTangHoTro: m.nenTangHoTro as NenTangHoTro,
          duocNoiBat: false,
          daXacMinh: m.daXacMinh, // Giá trị thật từ DB (AI2)
          daLuuTru: Boolean(m.daLuuTru),
          moTaGocTiengAnh: m.moTaGocTiengAnh || null,
          moTaVi: this.layMoTaViHienTai(m),
          khauHieuTiengViet:
            this.layMoTaViHienTai(m) || this.layKhauHieuHienThi(m, m.khauHieuTiengViet),
          diemUyTin: m.diemUyTin,
          mucDoAnToan: (m.mucDoAnToan as MucDoUyTin) || null,
          ngayCapNhat: m.ngayCapNhat
            ? new Date(m.ngayCapNhat).toISOString()
            : new Date().toISOString(), // Ngày cập nhật thật từ DB (AI2)
        }));
      }
    } catch (err) {
      this.logger.warn(`Lỗi tìm kiếm pgvector: ${(err as Error).message}`);
    }

    // 3.2: Dịch câu tìm kiếm sang GitHub Search Query qua Gemini (P2-42)
    let ghQuery = '';
    let githubItems: UngDungTomTatDto[] = [];
    try {
      ghQuery = await this.searchTranslatorService.dichVaGhepQuery(rawQ);
      const ghRes = await this.githubService.timKiemRepo(ghQuery, 10, 1);
      githubItems = ghRes.items
        .filter(
          (r) =>
            !semanticApps.some((sa) => sa.tenRepoDayDu.toLowerCase() === r.full_name.toLowerCase()),
        )
        .map((r) => ({
          maUngDung: r.html_url,
          tenRepoDayDu: r.full_name,
          chuSoHuu: r.owner.login,
          tenKhoChua: r.name,
          duongDanGithub: r.html_url,
          duongDanIcon: r.owner.avatar_url || null,
          soSaoGithub: r.stargazers_count,
          danhMucChinh: anhXaDanhMuc(r.topics, r.description, r.full_name),
          nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
          duocNoiBat: false,
          daXacMinh: false,
          daLuuTru: Boolean(r.archived),
          khauHieuTiengViet: null,
          diemUyTin: null,
          mucDoAnToan: null,
          phienBanMoiNhat: null,
          ngayCapNhat: r.updated_at,
        }));
    } catch (err) {
      this.logger.warn(`Lỗi Gemini dịch tìm kiếm: ${(err as Error).message}`);
    }

    const duLieu = [...semanticApps, ...githubItems].slice(0, limit);
    const res: TimKiemResponseDto = {
      duLieu,
      tongSo: duLieu.length,
      trangHienTai: page,
      tongSoTrang: 1,
      kichThuocTrang: limit,
      loaiTruyVan: 'Y_DINH',
      truyVanDich: ghQuery,
      thongDiep: 'Kết quả tìm kiếm ý định tự nhiên kết hợp Kho ForgeStore và GitHub.',
      nguonKetQua: semanticApps.length > 0 ? 'KET_HOP' : 'GITHUB',
    };

    await this.cacheService.dat(cacheKey, res, 300);
    return res;
  }

  /**
   * P2-41: Thẩm định và nạp Repository (Paste & Play - POST /kho-chua/kiem-tra).
   * Kiểm tra điều kiện:
   * 1. URL hợp lệ.
   * 2. Repo tồn tại trên GitHub.
   * 3. Có bản phát hành (release).
   * 4. Bản phát hành có file cài đặt tương thích với nền tảng được chọn.
   * Ghi nhận đầy đủ vào CSDL nhật ký nạp repo (NhatKyNapRepo).
   */
  async kiemDinhVaNapRepo(dto: InspectRepoDto, userId?: string): Promise<InspectRepoResponseDto> {
    const rawUrl = dto.urlRepo?.trim() || '';
    if (!rawUrl) {
      throw new BadRequestException('Đường dẫn repository không được để trống.');
    }

    // 1. Phân tích URL repo bằng smart-input-dispatcher (P2-40 & P2-41.1)
    const phanLuong = phanLuongInput(rawUrl);
    let owner = phanLuong.owner;
    let repo = phanLuong.repo;

    // Nếu không match URL regex, thử dùng hàm phanTichUrlRepo hiện có
    if (!owner || !repo) {
      try {
        const parsed = this.phanTichUrlRepo(rawUrl);
        owner = parsed.owner;
        repo = parsed.repo;
      } catch {
        await this.ghiNhatKyNapRepo({
          duongDan: rawUrl,
          trangThai: TrangThaiNapRepo.LINK_KHONG_HOP_LE,
          thongBaoLoi: 'Đường dẫn GitHub không đúng định dạng.',
          userId,
        });
        throw new BadRequestException('Đường dẫn GitHub không đúng định dạng.');
      }
    }

    const fullSlug = `${owner}/${repo}`;

    // 2. Kiểm tra xem Repo đã có trong CSDL Store chưa (P2-41.2)
    const existingApp = await this.prisma.ungDung.findUnique({
      where: { tenRepoDayDu: fullSlug },
      include: {
        phanTichAI: true,
        danhSachPhatHanh: {
          orderBy: { ngayPhatHanh: 'desc' },
          take: 5,
          include: { danhSachTepCaiDat: true },
        },
      },
    });

    if (existingApp) {
      if (existingApp.trangThai === 'KHONG_CO_BAN_CAI') {
        const huongDanCli = locHuongDanCaiDatTheoNenTang(
          existingApp.phanTichAI?.huongDanCaiDat as unknown as HuongDanCaiDatDto,
          dto.nenTang,
        );

        if (huongDanCli && huongDanCli.cachCai.length > 0) {
          await this.ghiNhatKyNapRepo({
            duongDan: rawUrl,
            trangThai: TrangThaiNapRepo.THANH_CONG,
            thongBaoLoi: 'Ứng dụng chỉ có hướng dẫn cài đặt qua dòng lệnh (CLI).',
            maUngDung: existingApp.maUngDung,
            userId,
          });

          const appChiTiet = await this.layChiTietApp(existingApp.maUngDung, userId, dto.nenTang);
          return {
            trangThai: TrangThaiNapRepo.THANH_CONG,
            thongBao:
              'Ứng dụng không có bộ cài 1-chạm nhưng có hướng dẫn cài đặt qua dòng lệnh (CLI).',
            ungDung: appChiTiet,
            chiCoHuongDanCli: true,
            huongDanCaiDat: huongDanCli,
          };
        }

        const thongBaoLoi = dto.nenTang
          ? `Bản phát hành của [${fullSlug}] không có tệp cài đặt phù hợp với ${dto.nenTang}.`
          : `Bản phát hành của [${fullSlug}] không chứa tệp cài đặt hợp lệ cho Windows hoặc Android.`;
        await this.ghiNhatKyNapRepo({
          duongDan: rawUrl,
          trangThai: TrangThaiNapRepo.KHONG_CO_FILE_CAI_DAT,
          thongBaoLoi,
          maUngDung: existingApp.maUngDung,
          userId,
        });
        throw new BadRequestException(thongBaoLoi);
      }

      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.THANH_CONG,
        thongBaoLoi: 'Ứng dụng đã có sẵn trong Store.',
        maUngDung: existingApp.maUngDung,
        userId,
      });

      const appChiTiet = await this.layChiTietApp(existingApp.maUngDung);

      let tepPhuHop: TepCaiDatDto | undefined = undefined;
      if (dto.nenTang && dto.abis && dto.abis.length > 0) {
        try {
          const resAsset = await this.giaiQuyetFileCaiDat({
            maUngDung: existingApp.maUngDung,
            nenTang: dto.nenTang,
            abis: dto.abis,
            choPhepBanThuNghiem: dto.choPhepBanThuNghiem,
          });
          tepPhuHop = resAsset.tepCaiDat;
        } catch {
          // Bỏ qua lỗi giải quyết asset nếu không khớp
        }
      }

      return {
        trangThai: TrangThaiNapRepo.THANH_CONG,
        thongBao: 'Ứng dụng đã có sẵn trong ForgeStore.',
        ungDung: appChiTiet,
        banPhatHanh: appChiTiet.banPhatHanhMoiNhat ?? undefined,
        tepPhuHop,
      };
    }

    // 3. Repo chưa có: Thẩm định trực tiếp từ GitHub Releases (P2-41.3)
    // 3.1: Kiểm tra repo tồn tại
    let repoInfo: GithubRepo;
    try {
      repoInfo = await this.githubService.layRepo(owner, repo);
    } catch (err: unknown) {
      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.THAT_BAI,
        thongBaoLoi: `Không tìm thấy repository trên GitHub: ${(err as Error).message}`,
        userId,
      });
      throw new NotFoundException(`Không tìm thấy repository [${fullSlug}] trên GitHub.`);
    }

    // 3.1b: Cùng bộ lọc với dây chuyền nạp (≥ 1.000 sao, không fork, còn cập nhật, có giấy phép) để người dùng
    // không đưa được repo dưới chuẩn của kho vào CSDL production (D-28, ngưỡng sao cố định)
    const loc = locCucBo({
      ...repoInfo,
      fork: Boolean(repoInfo.fork),
      archived: Boolean(repoInfo.archived),
      pushed_at: repoInfo.pushed_at ?? null,
    });
    if (!loc.dat) {
      const lyDo = LY_DO_KHONG_NHAN[loc.lyDo ?? 'IT_SAO'] ?? 'chưa đạt tiêu chuẩn của kho';
      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.THAT_BAI,
        thongBaoLoi: `Không đạt bộ lọc: ${loc.lyDo}`,
        userId,
      });
      throw new BadRequestException(`ForgeStore chưa nhận [${fullSlug}] vì repo ${lyDo}.`);
    }

    // 3.2: Kiểm tra bản phát hành
    let releases;
    try {
      releases = await this.githubService.layDanhSachRelease(owner, repo, 5);
    } catch (err: unknown) {
      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.THAT_BAI,
        thongBaoLoi: `Lỗi truy vấn releases: ${(err as Error).message}`,
        userId,
      });
      throw new BadRequestException(`Lỗi khi lấy danh sách release của [${fullSlug}].`);
    }

    const validReleases = (releases || []).filter(
      (r) => !r.draft && (dto.choPhepBanThuNghiem || !r.prerelease),
    );

    if (validReleases.length === 0) {
      // Kiểm tra xem repo có hướng dẫn cài đặt CLI từ README không (Section 3.5)
      let readme = '';
      try {
        readme = (await this.githubService.layReadme(owner, repo)) || '';
      } catch {
        // bỏ qua
      }

      const cliGuide = readme
        ? trichXuatHuongDanCliBangQuyTac(readme, `https://github.com/${fullSlug}#readme`)
        : null;
      if (coCachCaiCliHopLe(cliGuide)) {
        const newApp = await this.dongBoRepo(owner, repo);
        await this.phanTichUngDung(newApp.maUngDung).catch((err) => {
          this.logger.error(`Lỗi phân tích AI cho [${newApp.tenRepoDayDu}]:`, err);
        });

        const appChiTiet = await this.layChiTietApp(newApp.maUngDung, userId, dto.nenTang);
        const huongDanCli = locHuongDanCaiDatTheoNenTang(appChiTiet.huongDanCaiDat, dto.nenTang);

        if (coCachCaiCliHopLe(huongDanCli)) {
          await this.ghiNhatKyNapRepo({
            duongDan: rawUrl,
            trangThai: TrangThaiNapRepo.THANH_CONG,
            thongBaoLoi: 'Ứng dụng chỉ có hướng dẫn cài đặt qua dòng lệnh (CLI).',
            maUngDung: newApp.maUngDung,
            userId,
          });

          return {
            trangThai: TrangThaiNapRepo.THANH_CONG,
            thongBao:
              'Ứng dụng không có bộ cài 1-chạm nhưng có hướng dẫn cài đặt qua dòng lệnh (CLI).',
            ungDung: appChiTiet,
            chiCoHuongDanCli: true,
            huongDanCaiDat: huongDanCli ?? undefined,
          };
        }
      }

      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.KHONG_CO_RELEASE,
        thongBaoLoi: 'Repository không có bản phát hành nào.',
        userId,
      });
      throw new BadRequestException(
        `Repository [${fullSlug}] chưa có bản phát hành (releases) hợp lệ nào.`,
      );
    }

    // 3.3: Kiểm tra tệp cài đặt phù hợp với nền tảng
    const latestRelease = validReleases[0];
    if (!latestRelease) {
      throw new BadRequestException(
        `Repository [${fullSlug}] chưa có bản phát hành (releases) hợp lệ nào.`,
      );
    }
    const assets = latestRelease.assets || [];

    // 3.3: Kiểm tra tệp cài đặt phù hợp với nền tảng (P2-41.3, Post-Review #14)
    const coFileHopLe = assets.some((a) => {
      const classified = phanLoaiTep(a.name);
      if (!classified || classified.boQua) return false;

      if (dto.nenTang === 'ANDROID') {
        return classified.dinhDang === DinhDangTep.APK;
      }
      if (dto.nenTang === 'WINDOWS') {
        return (
          classified.dinhDang === DinhDangTep.EXE ||
          classified.dinhDang === DinhDangTep.MSI ||
          classified.dinhDang === DinhDangTep.ZIP_PORTABLE
        );
      }

      // Khi không chỉ định nền tảng: phải có ít nhất 1 file cài đặt cho Windows hoặc Android
      return (
        classified.dinhDang === DinhDangTep.APK ||
        classified.dinhDang === DinhDangTep.EXE ||
        classified.dinhDang === DinhDangTep.MSI ||
        classified.dinhDang === DinhDangTep.ZIP_PORTABLE
      );
    });

    if (!coFileHopLe) {
      // Kiểm tra xem repo có hướng dẫn cài đặt CLI từ README không (Section 3.5)
      let readme = '';
      try {
        readme = (await this.githubService.layReadme(owner, repo)) || '';
      } catch {
        // bỏ qua
      }

      const cliGuide = readme
        ? trichXuatHuongDanCliBangQuyTac(readme, `https://github.com/${fullSlug}#readme`)
        : null;
      if (coCachCaiCliHopLe(cliGuide)) {
        const newApp = await this.dongBoRepo(owner, repo);
        await this.phanTichUngDung(newApp.maUngDung).catch((err) => {
          this.logger.error(`Lỗi phân tích AI cho [${newApp.tenRepoDayDu}]:`, err);
        });

        const appChiTiet = await this.layChiTietApp(newApp.maUngDung, userId, dto.nenTang);
        const huongDanCli = locHuongDanCaiDatTheoNenTang(appChiTiet.huongDanCaiDat, dto.nenTang);

        if (coCachCaiCliHopLe(huongDanCli)) {
          await this.ghiNhatKyNapRepo({
            duongDan: rawUrl,
            trangThai: TrangThaiNapRepo.THANH_CONG,
            thongBaoLoi: 'Ứng dụng chỉ có hướng dẫn cài đặt qua dòng lệnh (CLI).',
            maUngDung: newApp.maUngDung,
            userId,
          });

          return {
            trangThai: TrangThaiNapRepo.THANH_CONG,
            thongBao:
              'Ứng dụng không có bộ cài 1-chạm nhưng có hướng dẫn cài đặt qua dòng lệnh (CLI).',
            ungDung: appChiTiet,
            chiCoHuongDanCli: true,
            huongDanCaiDat: huongDanCli ?? undefined,
          };
        }
      }

      const thongBaoLoi = dto.nenTang
        ? `Bản phát hành không chứa file cài đặt cho nền tảng ${dto.nenTang}.`
        : 'Bản phát hành không chứa bất kỳ tệp cài đặt hợp lệ nào cho Windows hoặc Android.';
      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.KHONG_CO_FILE_CAI_DAT,
        thongBaoLoi,
        userId,
      });
      throw new BadRequestException(
        dto.nenTang
          ? `Bản phát hành của [${fullSlug}] không có tệp cài đặt phù hợp với ${dto.nenTang}.`
          : `Bản phát hành của [${fullSlug}] không chứa tệp cài đặt hợp lệ cho Windows hoặc Android.`,
      );
    }

    // 4. Đồng bộ repo vào CSDL (P2-21 & P2-41.4)
    const newApp = await this.dongBoRepo(owner, repo);

    // Kích hoạt Lazy AI chạy nền non-blocking (P2-31)
    this.phanTichUngDung(newApp.maUngDung).catch((err) => {
      this.logger.error(`Lỗi phân tích AI nền cho [${newApp.tenRepoDayDu}]:`, err);
    });

    // 5. Phân giải tệp cài đặt phù hợp (P2-33)
    let tepPhuHop: TepCaiDatDto | undefined = undefined;
    if (dto.nenTang && dto.abis && dto.abis.length > 0) {
      try {
        const resAsset = await this.giaiQuyetFileCaiDat({
          maUngDung: newApp.maUngDung,
          nenTang: dto.nenTang,
          abis: dto.abis,
          choPhepBanThuNghiem: dto.choPhepBanThuNghiem,
        });
        tepPhuHop = resAsset.tepCaiDat;
      } catch {
        // Bỏ qua lỗi asset
      }
    }

    // 6. Ghi nhật ký thành công (P2-41.5)
    await this.ghiNhatKyNapRepo({
      duongDan: rawUrl,
      trangThai: TrangThaiNapRepo.THANH_CONG,
      thongBaoLoi: 'Thẩm định và nạp ứng dụng thành công',
      maUngDung: newApp.maUngDung,
      userId,
    });

    return {
      trangThai: TrangThaiNapRepo.THANH_CONG,
      thongBao: 'Thẩm định và nạp ứng dụng vào ForgeStore thành công.',
      ungDung: newApp,
      banPhatHanh: newApp.banPhatHanhMoiNhat ?? undefined,
      tepPhuHop,
    };
  }

  private async ghiNhatKyNapRepo(params: {
    duongDan: string;
    trangThai: TrangThaiNapRepo;
    thongBaoLoi?: string;
    maUngDung?: string;
    userId?: string;
  }): Promise<void> {
    try {
      await this.prisma.nhatKyNapRepo.create({
        data: {
          duongDanRepoNhap: params.duongDan,
          trangThai: params.trangThai,
          thongBaoLoi: params.thongBaoLoi,
          maUngDungTaoRa: params.maUngDung,
          maNguoiDungYeuCau: params.userId,
        },
      });
    } catch (err) {
      this.logger.warn(`Lỗi ghi nhật ký nạp repo: ${(err as Error).message}`);
    }
  }
}

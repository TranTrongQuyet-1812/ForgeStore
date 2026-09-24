import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DinhDangTep,
  KienTrucChip,
  NenTangHoTro,
  Prisma,
  TepCaiDat,
  TrangThaiNapRepo,
} from '@prisma/client';
import {
  InspectRepoResponseDto,
  MucDoUyTin,
  ResolveAssetResponseDto,
  TepCaiDatDto,
  TimKiemResponseDto,
  TrangKetQua,
  UngDungChiTietDto,
  UngDungTomTatDto,
  YeuToRuiRoItem,
} from '@forgestore/types';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { GithubService } from '../github/github.service';
import { JevClientService } from '../ai/services/jev-client.service';
import { LlmRotationService, KetQuaTomTatKemModel } from '../ai/services/llm-rotation.service';
import { TrustScoreService } from '../ai/services/trust-score.service';
import { ApkInspectorService } from '../ai/services/apk-inspector.service';
import { SemanticSearchService } from '../ai/services/semantic-search.service';
import { SearchTranslatorService } from '../ai/services/search-translator.service';
import { phanLoaiTep } from './utils/file-classifier.util';
import { anhXaDanhMuc, doanTenGoiAndroid } from './utils/category-mapper.util';
import { phanLuongInput } from './utils/smart-input-dispatcher.util';
import { AppSortOption, PlatformFilter, QueryAppsDto } from './dto/query-apps.dto';
import { ResolveAssetDto } from './dto/resolve-asset.dto';
import { SearchQueryDto } from './dto/search.dto';
import { InspectRepoDto } from './dto/inspect-repo.dto';

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
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  public readonly CACHE_KEY_LIST = 'fs:apps:list:';
  public readonly CACHE_KEY_DETAIL = 'fs:apps:detail:';
  public readonly CACHE_TTL = 3600; // 1 giờ

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
    private readonly jevClientService: JevClientService,
    private readonly llmRotationService: LlmRotationService,
    private readonly trustScoreService: TrustScoreService,
    private readonly apkInspectorService: ApkInspectorService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly searchTranslatorService: SearchTranslatorService,
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

    // 1. Kéo dữ liệu từ GitHub Facade (được bảo vệ bởi ETag & Rate Limit)
    const repoData = await this.githubService.layRepo(owner, repo);
    const rawReleases = await this.githubService.layDanhSachRelease(owner, repo, 10);

    // Bỏ qua các bản phát hành nháp (draft === true)
    const activeReleases = rawReleases.filter((r) => !r.draft);

    // 2. Phân loại toàn bộ các file đính kèm trong các bản phát hành
    let hasWindows = false;
    let hasAndroid = false;
    const danhSachFileApk: string[] = [];

    // Cấu trúc phân loại trước khi vào transaction
    const parsedReleases = activeReleases.map((release) => {
      const validAssets = (release.assets || [])
        .map((asset) => {
          const phanLoai = phanLoaiTep(asset.name);
          if (phanLoai.boQua || !phanLoai.dinhDang) {
            return null;
          }

          if (phanLoai.dinhDang === DinhDangTep.APK) {
            hasAndroid = true;
            danhSachFileApk.push(asset.name);
          } else if (
            phanLoai.dinhDang === DinhDangTep.EXE ||
            phanLoai.dinhDang === DinhDangTep.MSI ||
            phanLoai.dinhDang === DinhDangTep.ZIP_PORTABLE
          ) {
            hasWindows = true;
          }

          return {
            asset,
            dinhDang: phanLoai.dinhDang,
            kienTruc: phanLoai.kienTruc,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        release,
        validAssets,
      };
    });

    // 3. Suy luận nền tảng hỗ trợ (P2-21.4)
    let nenTangHoTro: NenTangHoTro = NenTangHoTro.WINDOWS;
    if (hasWindows && hasAndroid) {
      nenTangHoTro = NenTangHoTro.DA_NEN_TANG;
    } else if (hasAndroid) {
      nenTangHoTro = NenTangHoTro.ANDROID;
    } else if (hasWindows) {
      nenTangHoTro = NenTangHoTro.WINDOWS;
    } else {
      // Nếu chưa có file cài rõ ràng, thử suy đoán qua topics
      const topics = (repoData.topics || []).map((t) => t.toLowerCase());
      if (topics.includes('android')) {
        nenTangHoTro = NenTangHoTro.ANDROID;
      }
    }

    // 4. Ánh xạ danh mục chính từ topics và mô tả (P2-21.5)
    const danhMucChinh = anhXaDanhMuc(repoData.topics, repoData.description);

    // 5. Dự đoán Android package name (D-13)
    const tenGoiAndroid = doanTenGoiAndroid(repoData.full_name, danhSachFileApk);

    // 6. Thực thi cập nhật CSDL trong một Transaction nguyên tử (P2-21.6, timeout 20s per Post-Review #13)
    const ungDungUpdated = await this.prisma.$transaction(
      async (tx) => {
        // 6.1. Upsert bảng UngDung
        const app = await tx.ungDung.upsert({
          where: { tenRepoDayDu: repoData.full_name },
          update: {
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

        // 6.3. Nếu có người dùng yêu cầu nạp repo, ghi nhật ký (Module 6)
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

        return app;
      },
      { timeout: 20000, maxWait: 5000 },
    );

    // 7. Xóa sạch Cache liên quan sau khi đồng bộ thành công (P2-23.5)
    await this.cacheService.xoaTheoPrefix(this.CACHE_KEY_LIST);
    await this.cacheService.xoa(this.CACHE_KEY_DETAIL + ungDungUpdated.maUngDung);
    await this.cacheService.xoa(this.CACHE_KEY_DETAIL + ungDungUpdated.tenRepoDayDu.toLowerCase());

    this.logger.log(`Đồng bộ thành công [${owner}/${repo}] (UUID: ${ungDungUpdated.maUngDung})`);

    // 8. Trả về chi tiết ứng dụng đầy đủ
    return this.layChiTietApp(ungDungUpdated.maUngDung);
  }

  /**
   * API Duyệt Store (GET /apps) với bộ lọc, phân trang, sắp xếp và Cache (P2-23).
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

    // Khóa cache duy nhất cho tổ hợp bộ lọc
    const cacheKey = `${this.CACHE_KEY_LIST}${platform || 'all'}:${category || 'all'}:${sort}:${page}:${limit}:${
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

    if (platform === PlatformFilter.ANDROID) {
      where.nenTangHoTro = { in: [NenTangHoTro.ANDROID, NenTangHoTro.DA_NEN_TANG] };
      where.danhSachPhatHanh = {
        some: {
          danhSachTepCaiDat: {
            some: { dinhDangTep: DinhDangTep.APK },
          },
        },
      };
    } else if (platform === PlatformFilter.WINDOWS) {
      where.nenTangHoTro = { in: [NenTangHoTro.WINDOWS, NenTangHoTro.DA_NEN_TANG] };
      where.danhSachPhatHanh = {
        some: {
          danhSachTepCaiDat: {
            some: {
              dinhDangTep: {
                in: [DinhDangTep.EXE, DinhDangTep.MSI, DinhDangTep.ZIP_PORTABLE],
              },
            },
          },
        },
      };
    }

    // Xây dựng điều kiện ORDER BY
    let orderBy: Prisma.UngDungOrderByWithRelationInput[];
    if (sort === AppSortOption.STARS) {
      orderBy = [{ soSaoGithub: 'desc' }, { dongBoLanCuoi: 'desc' }];
    } else if (sort === AppSortOption.RECENT) {
      orderBy = [{ dongBoLanCuoi: 'desc' }];
    } else {
      // TRENDING (D-04): Kết hợp sao và thời điểm cập nhật mới nhất
      orderBy = [{ soSaoGithub: 'desc' }, { dongBoLanCuoi: 'desc' }];
    }

    // Truy vấn song song dữ liệu và tổng số lượng
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
          danhSachPhatHanh: {
            orderBy: { ngayPhatHanh: 'desc' },
            take: 1,
            select: {
              tenPhienBan: true,
              ngayPhatHanh: true,
            },
          },
        },
      }),
      this.prisma.ungDung.count({ where }),
    ]);

    // Chuẩn hóa định dạng UngDungTomTatDto
    const duLieu: UngDungTomTatDto[] = danhSach.map((app) => ({
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
      tenGoiAndroid: app.tenGoiAndroid,
      khauHieuTiengViet: app.phanTichAI?.khauHieuTiengViet || null,
      diemUyTin: app.phanTichAI?.diemUyTin ?? null,
      mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
      phienBanMoiNhat: app.danhSachPhatHanh[0]?.tenPhienBan || null,
      ngayCapNhat: app.dongBoLanCuoi.toISOString(),
    }));

    const result: TrangKetQua<UngDungTomTatDto> = {
      duLieu,
      tongSo,
      trangHienTai: page,
      tongSoTrang: Math.ceil(tongSo / limit) || 1,
      kichThuocTrang: limit,
    };

    // Lưu vào Cache với TTL 1 giờ
    await this.cacheService.luu(cacheKey, result, this.CACHE_TTL);

    // Nếu người dùng đã đăng nhập, nạp cờ daYeuThich vào danh sách (P2-50.4)
    if (userId && result.duLieu.length > 0) {
      const appIds = result.duLieu.map((a) => a.maUngDung);
      const yeuThichs = await this.prisma.khoYeuThich.findMany({
        where: {
          maNguoiDung: userId,
          maUngDung: { in: appIds },
        },
        select: { maUngDung: true },
      });
      const likedSet = new Set(yeuThichs.map((y) => y.maUngDung));

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
   * API Chi tiết Ứng dụng (GET /apps/:id) theo UUID hoặc owner/repo slug (P2-24).
   * Hỗ trợ bổ sung cờ laYeuThich nếu người dùng đã đăng nhập (P2-50.4).
   */
  async layChiTietApp(idOrSlug: string, userId?: string): Promise<UngDungChiTietDto> {
    if (!idOrSlug || !idOrSlug.trim()) {
      throw new BadRequestException('Mã định danh ứng dụng không được để trống.');
    }

    const cleanId = decodeURIComponent(idOrSlug.trim());
    const cacheKey = `${this.CACHE_KEY_DETAIL}${cleanId.toLowerCase()}`;

    const cached = await this.cacheService.lay<UngDungChiTietDto>(cacheKey);
    if (cached) {
      if (userId) {
        const daThich = await this.prisma.khoYeuThich.findUnique({
          where: {
            maNguoiDung_maUngDung: {
              maNguoiDung: userId,
              maUngDung: cached.maUngDung,
            },
          },
          select: { maYeuThich: true },
        });
        return {
          ...cached,
          laYeuThich: Boolean(daThich),
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
          take: 10,
          include: {
            danhSachTepCaiDat: true,
          },
        },
      },
    });

    if (!app) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với định danh: ${cleanId}`);
    }

    if (!app.phanTichAI) {
      // Lazy AI (P2-31.3): Chạy nền non-blocking không bắt request chi tiết app phải chờ
      this.phanTichUngDung(app.maUngDung).catch((err: unknown) => {
        this.logger.warn(
          `Phân tích AI nền cho [${app.tenRepoDayDu}] thất bại: ${(err as Error).message}`,
        );
      });
    }

    const phienBanMoiNhat = app.danhSachPhatHanh[0]?.tenPhienBan || null;

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
      tenGoiAndroid: app.tenGoiAndroid,
      trangThai: app.trangThai,
      dongBoLanCuoi: app.dongBoLanCuoi.toISOString(),
      ngayTao: app.ngayTao.toISOString(),
      moTaGocTiengAnh: app.moTaGocTiengAnh,
      khauHieuTiengViet: app.phanTichAI?.khauHieuTiengViet || null,
      diemUyTin: app.phanTichAI?.diemUyTin ?? null,
      mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
      phienBanMoiNhat,
      ngayCapNhat: app.dongBoLanCuoi.toISOString(),
      phanTichAi: app.phanTichAI
        ? {
            maPhanTich: app.phanTichAI.maPhanTich,
            maUngDung: app.phanTichAI.maUngDung,
            khauHieuTiengViet: app.phanTichAI.khauHieuTiengViet,
            tomTatTinhNangVi: app.phanTichAI.tomTatTinhNangVi,
            diemUyTin: app.phanTichAI.diemUyTin,
            mucDoAnToan: app.phanTichAI.mucDoAnToan,
            daThamDinhJev: app.phanTichAI.daThamDinhJev,
            yeuToRuiRo: (app.phanTichAI.yeuToRuiRo as unknown as YeuToRuiRoItem[]) || [],
            quyenHanDaKiemTra: (app.phanTichAI.quyenHanDaKiemTra as unknown as string[]) || [],
            moHinhTomTat: app.phanTichAI.moHinhTomTat,
            thoiGianPhanTich: app.phanTichAI.thoiGianPhanTich.toISOString(),
          }
        : null,
      banPhatHanhMoiNhat: app.danhSachPhatHanh[0]
        ? {
            maPhatHanh: app.danhSachPhatHanh[0].maPhatHanh,
            maUngDung: app.danhSachPhatHanh[0].maUngDung,
            maReleaseGithub: app.danhSachPhatHanh[0].maReleaseGithub
              ? app.danhSachPhatHanh[0].maReleaseGithub.toString()
              : null,
            tenPhienBan: app.danhSachPhatHanh[0].tenPhienBan,
            tieuDePhatHanh: app.danhSachPhatHanh[0].tieuDePhatHanh,
            nhatKyThayDoiGoc: app.danhSachPhatHanh[0].nhatKyThayDoiGoc,
            tomTatNangCapVi: app.danhSachPhatHanh[0].tomTatNangCapVi,
            laBanThuNghiem: app.danhSachPhatHanh[0].laBanThuNghiem,
            ngayPhatHanh: app.danhSachPhatHanh[0].ngayPhatHanh.toISOString(),
            danhSachTepCaiDat: app.danhSachPhatHanh[0].danhSachTepCaiDat.map((f) => ({
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
            })),
          }
        : null,
      danhSachBanPhatHanh: app.danhSachPhatHanh.map((r) => ({
        maPhatHanh: r.maPhatHanh,
        maUngDung: r.maUngDung,
        maReleaseGithub: r.maReleaseGithub ? r.maReleaseGithub.toString() : null,
        tenPhienBan: r.tenPhienBan,
        tieuDePhatHanh: r.tieuDePhatHanh,
        nhatKyThayDoiGoc: r.nhatKyThayDoiGoc,
        tomTatNangCapVi: r.tomTatNangCapVi,
        laBanThuNghiem: r.laBanThuNghiem,
        ngayPhatHanh: r.ngayPhatHanh.toISOString(),
        danhSachTepCaiDat: r.danhSachTepCaiDat.map((f) => ({
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
        })),
      })),
    };

    // Lưu vào Cache (bản lưu không gắn cờ người dùng cụ thể)
    await this.cacheService.luu(cacheKey, result, this.CACHE_TTL);
    if (!isUuid) {
      await this.cacheService.luu(
        `${this.CACHE_KEY_DETAIL}${app.maUngDung}`,
        result,
        this.CACHE_TTL,
      );
    }

    if (userId) {
      const daThich = await this.prisma.khoYeuThich.findUnique({
        where: {
          maNguoiDung_maUngDung: {
            maNguoiDung: userId,
            maUngDung: app.maUngDung,
          },
        },
        select: { maYeuThich: true },
      });
      return {
        ...result,
        laYeuThich: Boolean(daThich),
      };
    }

    return result;
  }

  /**
   * Phân giải tệp cài đặt phù hợp nhất theo nền tảng và kiến trúc phần cứng (P2-33).
   * Luật xử lý tên file rõ ràng; Jev AI Choice xử lý tên file mơ hồ.
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

    const targetRelease = releases.find((r) => r.danhSachTepCaiDat.length > 0);
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
          abisHienCo: Array.from(new Set(allFiles.map((f) => f.kienTrucChip))),
        });
      }

      // 3.1. Thử khớp theo thứ tự ưu tiên ABI của máy khách
      for (const rawAbi of abis) {
        const targetChip = this.chuyenDoiAbiSangEnum(rawAbi);
        const match = apkFiles.find((f) => f.kienTrucChip === targetChip);
        if (match) {
          return this.dongGoiResponseAsset(match, 'LUAT');
        }
      }

      // 3.2. Thử khớp bản dùng chung (Universal APK)
      const universalMatch = apkFiles.find((f) => f.kienTrucChip === KienTrucChip.DUNG_CHUNG);
      if (universalMatch) {
        return this.dongGoiResponseAsset(universalMatch, 'LUAT');
      }

      // 3.3. Tên file mơ hồ -> Hỏi Jev AI primitive Choice (P2-33.7)
      const ambiguousFiles = apkFiles.filter((f) => f.kienTrucChip === KienTrucChip.KHONG_XAC_DINH);
      if (ambiguousFiles.length > 0 && this.jevClientService.isEnabled) {
        try {
          const choiceOptions: Record<string, string> = {
            KHONG_FILE_NAO_PHU_HOP: 'Không có tệp nào phù hợp với kiến trúc này',
          };
          for (const file of ambiguousFiles) {
            choiceOptions[file.maTep] = file.tenTep;
          }

          const prompt = `Chọn tệp APK phù hợp nhất để cài đặt trên thiết bị Android có kiến trúc ABI chính là [${abis[0]}]:`;

          const resJev = await this.jevClientService.hoiChoice(
            {
              app: app.tenRepoDayDu,
              nenTang: 'ANDROID',
              clientAbis: abis,
            },
            prompt,
            choiceOptions,
          );

          if (resJev.luaChon && resJev.luaChon !== 'KHONG_FILE_NAO_PHU_HOP') {
            const selected = ambiguousFiles.find((f) => f.maTep === resJev.luaChon);
            if (selected) {
              const primaryAbi = abis[0] || 'arm64-v8a';
              const inferredChip = this.chuyenDoiAbiSangEnum(primaryAbi);
              await this.prisma.tepCaiDat.update({
                where: { maTep: selected.maTep },
                data: { kienTrucChip: inferredChip },
              });
              return this.dongGoiResponseAsset(selected, 'JEV', resJev.doTinCay);
            }
          }
        } catch (err: unknown) {
          this.logger.warn(`Jev Choice giải quyết file thất bại: ${(err as Error).message}`);
        }
      }

      throw new NotFoundException({
        maLoi: 'KHONG_CO_FILE_PHU_HOP',
        thongBao: `Không tìm thấy tệp APK tương thích với các kiến trúc thiết bị: ${abis.join(', ')}`,
        abisHienCo: Array.from(new Set(apkFiles.map((f) => f.kienTrucChip))),
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
          abisHienCo: Array.from(new Set(allFiles.map((f) => f.kienTrucChip))),
        });
      }

      // Ưu tiên các file GUI/Installer tiêu chuẩn trước bản CLI, debug, unsigned
      const isPreferredFile = (fileName: string) => {
        const lower = fileName.toLowerCase();
        return !lower.includes('cli') && !lower.includes('debug') && !lower.includes('unsigned');
      };

      // 4.1. MSI hoặc EXE X86_64
      const msiX64 =
        winFiles.find(
          (f) =>
            f.dinhDangTep === DinhDangTep.MSI &&
            f.kienTrucChip === KienTrucChip.X86_64 &&
            isPreferredFile(f.tenTep),
        ) ||
        winFiles.find(
          (f) => f.dinhDangTep === DinhDangTep.MSI && f.kienTrucChip === KienTrucChip.X86_64,
        );
      if (msiX64) return this.dongGoiResponseAsset(msiX64, 'LUAT');

      const exeX64 =
        winFiles.find(
          (f) =>
            f.dinhDangTep === DinhDangTep.EXE &&
            f.kienTrucChip === KienTrucChip.X86_64 &&
            isPreferredFile(f.tenTep),
        ) ||
        winFiles.find(
          (f) => f.dinhDangTep === DinhDangTep.EXE && f.kienTrucChip === KienTrucChip.X86_64,
        );
      if (exeX64) return this.dongGoiResponseAsset(exeX64, 'LUAT');

      // 4.2. ZIP_PORTABLE X86_64
      const zipX64 = winFiles.find(
        (f) => f.dinhDangTep === DinhDangTep.ZIP_PORTABLE && f.kienTrucChip === KienTrucChip.X86_64,
      );
      if (zipX64) return this.dongGoiResponseAsset(zipX64, 'LUAT');

      // 4.3. EXE hoặc MSI X86 (32-bit)
      const exeX86 = winFiles.find(
        (f) =>
          (f.dinhDangTep === DinhDangTep.EXE || f.dinhDangTep === DinhDangTep.MSI) &&
          f.kienTrucChip === KienTrucChip.X86,
      );
      if (exeX86) return this.dongGoiResponseAsset(exeX86, 'LUAT');

      // 4.4. ZIP_PORTABLE X86
      const zipX86 = winFiles.find(
        (f) => f.dinhDangTep === DinhDangTep.ZIP_PORTABLE && f.kienTrucChip === KienTrucChip.X86,
      );
      if (zipX86) return this.dongGoiResponseAsset(zipX86, 'LUAT');

      // 4.5. File Windows bất kỳ còn lại
      if (winFiles.length > 0 && winFiles[0]) {
        return this.dongGoiResponseAsset(winFiles[0], 'LUAT');
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

  private dongGoiResponseAsset(
    file: TepCaiDat,
    nguonQuyetDinh: 'LUAT' | 'JEV' | 'DU_PHONG',
    doTinCay?: number,
  ): ResolveAssetResponseDto {
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
      doTinCay,
    };
  }

  /**
   * Phân tích Dual-AI cho ứng dụng (Lazy AI & Distributed Lock - P2-31).
   * Bọc trong withLock("fs:ai:<id>") đảm bảo 10 request đồng thời chỉ chạy AI 1 lần.
   */
  async phanTichUngDung(maUngDung: string): Promise<void> {
    const lockKey = `fs:ai:${maUngDung}`;

    try {
      await this.cacheService.withLock(lockKey, 60000, async () => {
        // Double-check xem đã có ai phân tích xong chưa
        const existing = await this.prisma.phanTichAI.findUnique({
          where: { maUngDung },
        });
        if (existing) {
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

        // 1. Lấy README từ GitHub
        let readme = '';
        try {
          readme = (await this.githubService.layReadme(owner, repo)) || '';
        } catch (err: unknown) {
          this.logger.warn(
            `Không lấy được README cho [${app.tenRepoDayDu}]: ${(err as Error).message}`,
          );
        }

        // 2. Tóm tắt README qua LLM Rotation (Gemini ⇄ NVIDIA NIM) (P2-30, P2-39)
        let ketQuaTomTat: KetQuaTomTatKemModel;
        try {
          ketQuaTomTat = await this.llmRotationService.tomTatReadme(
            readme,
            repo,
            app.moTaGocTiengAnh || undefined,
          );
        } catch (err: unknown) {
          this.logger.error(`Lỗi tóm tắt README [${app.tenRepoDayDu}]: ${(err as Error).message}`);
          ketQuaTomTat = {
            ketQua: {
              khauHieu: app.moTaGocTiengAnh?.slice(0, 80) || app.tenKhoChua,
              tinhNang: [
                {
                  tieuDe: app.tenKhoChua,
                  moTa: app.moTaGocTiengAnh || 'Ứng dụng nguồn mở chất lượng cao',
                  trichDan: app.moTaGocTiengAnh || app.tenKhoChua,
                },
              ],
            },
            moHinhTomTat: 'DU_PHONG',
          };
        }

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

        // 4. Lấy dữ liệu sống từ GitHub và tính toán Trust Score lai (Rule Engine + Jev Noul) (P2-32)
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
          tenApp: app.tenKhoChua,
          moTaApp: app.moTaGocTiengAnh || '',
          topics: app.danhSachChuDe,
          soSaoGithub: app.soSaoGithub,
          soLuotFork: app.soLuotFork,
          loaiGiayPhep: app.loaiGiayPhep,
          daArchived,
          ngayPushCuoi,
          soContributor,
          danhSachQuyenAndroid: danhSachQuyen,
          coAccessibilityService,
        });

        // 5. Lưu kết quả vào phan_tich_ai
        const chuoiTinhNangVi = ketQuaTomTat.ketQua.tinhNang
          .map((t) => `- **${t.tieuDe}**: ${t.moTa}`)
          .join('\n');

        const phanTich = await this.prisma.phanTichAI.upsert({
          where: { maUngDung },
          create: {
            maUngDung,
            khauHieuTiengViet: ketQuaTomTat.ketQua.khauHieu,
            tomTatTinhNangVi: chuoiTinhNangVi,
            diemUyTin: trustScore.diemUyTin,
            mucDoAnToan: trustScore.mucDoAnToan,
            daThamDinhJev: trustScore.daThamDinhJev,
            yeuToRuiRo: trustScore.yeuToRuiRo as unknown as Prisma.InputJsonValue,
            quyenHanDaKiemTra: danhSachQuyen as unknown as Prisma.InputJsonValue,
            moHinhTomTat: ketQuaTomTat.moHinhTomTat,
          },
          update: {
            khauHieuTiengViet: ketQuaTomTat.ketQua.khauHieu,
            tomTatTinhNangVi: chuoiTinhNangVi,
            diemUyTin: trustScore.diemUyTin,
            mucDoAnToan: trustScore.mucDoAnToan,
            daThamDinhJev: trustScore.daThamDinhJev,
            yeuToRuiRo: trustScore.yeuToRuiRo as unknown as Prisma.InputJsonValue,
            quyenHanDaKiemTra: danhSachQuyen as unknown as Prisma.InputJsonValue,
            moHinhTomTat: ketQuaTomTat.moHinhTomTat,
          },
        });

        // 6. Sinh vector 768 chiều & lưu pgvector (P2-36)
        try {
          const textEmbed = this.semanticSearchService.chuanBiVanBanNhung({
            tenKhoChua: app.tenKhoChua,
            slogan: ketQuaTomTat.ketQua.khauHieu,
            tinhNang: ketQuaTomTat.ketQua.tinhNang.map((t) => `${t.tieuDe}: ${t.moTa}`),
            topics: app.danhSachChuDe,
            moTa: app.moTaGocTiengAnh,
          });
          const vector = await this.semanticSearchService.sinhEmbedding(textEmbed);
          await this.semanticSearchService.luuVectorNguNghia(phanTich.maPhanTich, vector);
        } catch (err: unknown) {
          this.logger.warn(`Lỗi sinh/lưu vector embedding: ${(err as Error).message}`);
        }

        // 7. Tóm tắt changelog nếu có release mới nhất (P2-34)
        if (latestRelease && latestRelease.nhatKyThayDoiGoc && !latestRelease.tomTatNangCapVi) {
          try {
            const changelogRes = await this.llmRotationService.tomTatChangelog(
              latestRelease.nhatKyThayDoiGoc,
              app.tenKhoChua,
            );
            await this.prisma.banPhatHanh.update({
              where: { maPhatHanh: latestRelease.maPhatHanh },
              data: {
                tomTatNangCapVi: changelogRes.ketQua.diemMoi.join('\n- '),
              },
            });
          } catch (err: unknown) {
            this.logger.warn(`Lỗi tóm tắt changelog: ${(err as Error).message}`);
          }
        }

        // 8. Làm sạch cache chi tiết app
        await this.cacheService.del([
          `${this.CACHE_KEY_DETAIL}${app.maUngDung}`,
          `${this.CACHE_KEY_DETAIL}${app.tenRepoDayDu.toLowerCase()}`,
        ]);
        this.logger.log(`Hoàn thành phân tích Dual-AI cho [${app.tenRepoDayDu}]`);
      });
    } catch (err: unknown) {
      this.logger.error(`Lỗi phân tích AI cho ứng dụng [${maUngDung}]: ${(err as Error).message}`);
    }
  }

  /**
   * Prewarm phân tích Dual-AI cho các ứng dụng (P2-31.5, phục vụ demo P6-07).
   */
  async chayPrewarmAI(danhSachAppIds?: string[]): Promise<{ daChay: number; thanhCong: number }> {
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
   * P2-40: Tìm kiếm thông minh (Smart Input Dispatcher - GET /search).
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
            take: 1,
            select: { tenPhienBan: true },
          },
        },
      });

      let res: TimKiemResponseDto;
      if (app) {
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
          tenGoiAndroid: app.tenGoiAndroid,
          khauHieuTiengViet: app.phanTichAI?.khauHieuTiengViet || null,
          diemUyTin: app.phanTichAI?.diemUyTin ?? null,
          mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
          phienBanMoiNhat: app.danhSachPhatHanh[0]?.tenPhienBan || null,
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
              take: 1,
              select: { tenPhienBan: true },
            },
          },
        }),
        this.prisma.ungDung.count({ where }),
      ]);

      if (dbApps.length > 0) {
        const duLieu: UngDungTomTatDto[] = dbApps.map((app) => ({
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
          tenGoiAndroid: app.tenGoiAndroid,
          khauHieuTiengViet: app.phanTichAI?.khauHieuTiengViet || null,
          diemUyTin: app.phanTichAI?.diemUyTin ?? null,
          mucDoAnToan: app.phanTichAI?.mucDoAnToan || null,
          phienBanMoiNhat: app.danhSachPhatHanh[0]?.tenPhienBan || null,
          ngayCapNhat: app.dongBoLanCuoi.toISOString(),
        }));

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
          danhMucChinh: anhXaDanhMuc(r.topics, r.description),
          nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
          duocNoiBat: false,
          daXacMinh: false,
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
      const vectorMatches = await this.semanticSearchService.timKiemNguNghia(rawQ, limit);
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
          daXacMinh: true,
          khauHieuTiengViet: m.khauHieuTiengViet,
          diemUyTin: m.diemUyTin,
          mucDoAnToan: (m.mucDoAnToan as MucDoUyTin) || null,
          ngayCapNhat: new Date().toISOString(),
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
          danhMucChinh: anhXaDanhMuc(r.topics, r.description),
          nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
          duocNoiBat: false,
          daXacMinh: false,
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
   * P2-41: Thẩm định và nạp Repository (Paste & Play - POST /repos/inspect).
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
    try {
      await this.githubService.layRepo(owner, repo);
    } catch (err: unknown) {
      await this.ghiNhatKyNapRepo({
        duongDan: rawUrl,
        trangThai: TrangThaiNapRepo.THAT_BAI,
        thongBaoLoi: `Không tìm thấy repository trên GitHub: ${(err as Error).message}`,
        userId,
      });
      throw new NotFoundException(`Không tìm thấy repository [${fullSlug}] trên GitHub.`);
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

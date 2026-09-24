import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DinhDangTep, NenTangHoTro, Prisma, TrangThaiNapRepo } from '@prisma/client';
import {
  TrangKetQua,
  UngDungChiTietDto,
  UngDungTomTatDto,
  YeuToRuiRoItem,
} from '@forgestore/types';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { GithubService } from '../github/github.service';
import { phanLoaiTep } from './utils/file-classifier.util';
import { anhXaDanhMuc, doanTenGoiAndroid } from './utils/category-mapper.util';
import { AppSortOption, PlatformFilter, QueryAppsDto } from './dto/query-apps.dto';

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

    // Trường hợp git@github.com:owner/repo
    if (cleaned.startsWith('git@github.com:')) {
      const parts = cleaned.replace('git@github.com:', '').split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        let repo = parts[1];
        if (repo.endsWith('.git')) repo = repo.slice(0, -4);
        return { owner: parts[0], repo };
      }
    }

    // Trường hợp URL HTTP/HTTPS
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
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
          return { owner, repo };
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('URL repository không hợp lệ.');
      }
    }

    // Trường hợp slug "owner/repo"
    const slugParts = cleaned.split('/');
    if (slugParts.length === 2 && slugParts[0] && slugParts[1]) {
      let repo = slugParts[1];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);
      return { owner: slugParts[0], repo };
    }

    throw new BadRequestException(
      'Định dạng kho GitHub không hợp lệ. Vui lòng nhập dạng "owner/repo" hoặc URL đầy đủ.',
    );
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

    // 6. Thực thi cập nhật CSDL trong một Transaction nguyên tử (P2-21.6)
    const ungDungUpdated = await this.prisma.$transaction(async (tx) => {
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

        // Xóa tệp cũ của phiên bản này để cập nhật tệp mới sạch sẽ
        await tx.tepCaiDat.deleteMany({
          where: { maPhatHanh: releaseRecord.maPhatHanh },
        });

        // Thêm các file cài đặt đã được phân loại
        if (validAssets.length > 0) {
          await tx.tepCaiDat.createMany({
            data: validAssets.map(({ asset, dinhDang, kienTruc }) => ({
              maPhatHanh: releaseRecord.maPhatHanh,
              tenTep: asset.name,
              duongDanTaiVe: asset.browser_download_url,
              dungLuongBytes: BigInt(asset.size),
              dinhDangTep: dinhDang,
              kienTrucChip: kienTruc,
              maBamSha256: asset.digest || asset.sha256 || null,
              soLuotTai: asset.download_count || 0,
            })),
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
    });

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
   */
  async layDanhSachApps(query: QueryAppsDto): Promise<TrangKetQua<UngDungTomTatDto>> {
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

    return result;
  }

  /**
   * API Chi tiết Ứng dụng (GET /apps/:id) theo UUID hoặc owner/repo slug (P2-24).
   */
  async layChiTietApp(idOrSlug: string): Promise<UngDungChiTietDto> {
    if (!idOrSlug || !idOrSlug.trim()) {
      throw new BadRequestException('Mã định danh ứng dụng không được để trống.');
    }

    const cleanId = decodeURIComponent(idOrSlug.trim());
    const cacheKey = `${this.CACHE_KEY_DETAIL}${cleanId.toLowerCase()}`;

    const cached = await this.cacheService.lay<UngDungChiTietDto>(cacheKey);
    if (cached) {
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

    // Lưu vào Cache
    await this.cacheService.luu(cacheKey, result, this.CACHE_TTL);
    if (!isUuid) {
      await this.cacheService.luu(
        `${this.CACHE_KEY_DETAIL}${app.maUngDung}`,
        result,
        this.CACHE_TTL,
      );
    }

    return result;
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CreateReviewDto } from './dto/tao-danh-gia.dto';
import { UpdateReviewDto } from './dto/cap-nhat-danh-gia.dto';
import { QueryReviewsDto, ReviewSortOption } from './dto/truy-van-danh-gia.dto';
import { DanhGiaDto, TrangKetQua } from '@forgestore/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class DanhGiaService {
  private readonly logger = new Logger(DanhGiaService.name);
  private readonly HELPFUL_TTL = 30 * 24 * 60 * 60; // 30 ngày (2.592.000s)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Lấy danh sách nhận xét, đánh giá của một ứng dụng (GET /ung-dung/:id/danh-gia - P2-53.1).
   */
  async layDanhSachDanhGia(
    idOrSlug: string,
    query: QueryReviewsDto,
  ): Promise<TrangKetQua<DanhGiaDto>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 10;
    const sort = query.sort || ReviewSortOption.MOI_NHAT;

    // Tìm ứng dụng theo UUID hoặc slug
    const cleanId = decodeURIComponent(idOrSlug.trim());
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    const ungDung = await this.prisma.ungDung.findFirst({
      where: isUuid
        ? { maUngDung: cleanId }
        : { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
      select: { maUngDung: true },
    });

    if (!ungDung) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với định danh [${cleanId}]`);
    }

    const maUngDung = ungDung.maUngDung;

    // Xác định thứ tự sắp xếp
    let orderBy:
      | Prisma.DanhGiaUngDungOrderByWithRelationInput
      | Prisma.DanhGiaUngDungOrderByWithRelationInput[];

    switch (sort) {
      case ReviewSortOption.HUU_ICH_NHAT:
        orderBy = [{ soLuotHuuIch: 'desc' }, { ngayDanhGia: 'desc' }];
        break;
      case ReviewSortOption.SO_SAO_CAO:
        orderBy = [{ soSao: 'desc' }, { ngayDanhGia: 'desc' }];
        break;
      case ReviewSortOption.SO_SAO_THAP:
        orderBy = [{ soSao: 'asc' }, { ngayDanhGia: 'desc' }];
        break;
      case ReviewSortOption.MOI_NHAT:
      default:
        orderBy = { ngayDanhGia: 'desc' };
        break;
    }

    const skip = (page - 1) * limit;

    const [danhSach, tongSo] = await Promise.all([
      this.prisma.danhGiaUngDung.findMany({
        where: { maUngDung },
        orderBy,
        skip,
        take: limit,
        include: {
          nguoiDung: {
            select: {
              maNguoiDung: true,
              tenHienThi: true,
              tenDangNhap: true,
              duongDanAvatar: true,
            },
          },
        },
      }),
      this.prisma.danhGiaUngDung.count({
        where: { maUngDung },
      }),
    ]);

    const duLieu: DanhGiaDto[] = danhSach.map((dg) => ({
      maDanhGia: dg.maDanhGia,
      maNguoiDung: dg.maNguoiDung,
      maUngDung: dg.maUngDung,
      soSao: dg.soSao,
      tieuDe: dg.tieuDe,
      noiDungNhanXet: dg.noiDungNhanXet,
      phienBanDanhGia: dg.phienBanDanhGia,
      thietBiDanhGia: dg.thietBiDanhGia,
      soLuotHuuIch: dg.soLuotHuuIch,
      ngayDanhGia: dg.ngayDanhGia.toISOString(),
      ngayCapNhat: dg.ngayCapNhat.toISOString(),
      tenNguoiDung: dg.nguoiDung?.tenHienThi || dg.nguoiDung?.tenDangNhap || null,
      duongDanAvatar: dg.nguoiDung?.duongDanAvatar || null,
    }));

    return {
      duLieu,
      tongSo,
      trangHienTai: page,
      kichThuocTrang: limit,
      tongSoTrang: Math.ceil(tongSo / limit) || 1,
    };
  }

  /**
   * Tạo bài đánh giá mới cho ứng dụng (POST /ung-dung/:id/danh-gia - P2-53.1 & P2-53.2).
   */
  async taoDanhGia(
    maNguoiDung: string,
    idOrSlug: string,
    dto: CreateReviewDto,
  ): Promise<DanhGiaDto> {
    const cleanId = decodeURIComponent(idOrSlug.trim());
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    const ungDung = await this.prisma.ungDung.findFirst({
      where: isUuid
        ? { maUngDung: cleanId }
        : { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
      include: {
        danhSachPhatHanh: {
          orderBy: { ngayPhatHanh: 'desc' },
          take: 1,
          select: { tenPhienBan: true },
        },
      },
    });

    if (!ungDung) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với định danh [${cleanId}]`);
    }

    const maUngDung = ungDung.maUngDung;
    const phienBan =
      dto.phienBanDanhGia?.trim() || ungDung.danhSachPhatHanh[0]?.tenPhienBan || '1.0.0';

    // Kiểm tra xem người dùng đã đánh giá phiên bản này chưa (P2-53.2: UNIQUE)
    const daTonTai = await this.prisma.danhGiaUngDung.findUnique({
      where: {
        maNguoiDung_maUngDung_phienBanDanhGia: {
          maNguoiDung,
          maUngDung,
          phienBanDanhGia: phienBan,
        },
      },
    });

    if (daTonTai) {
      throw new ConflictException(
        `Bạn đã gửi đánh giá cho phiên bản [${phienBan}] rồi. Vui lòng cập nhật nhận xét hiện tại thay vì tạo mới.`,
      );
    }

    // Tạo bản ghi đánh giá
    const taoMoi = await this.prisma.danhGiaUngDung.create({
      data: {
        maNguoiDung,
        maUngDung,
        soSao: dto.soSao,
        tieuDe: dto.tieuDe?.trim() || null,
        noiDungNhanXet: dto.noiDungNhanXet.trim(),
        phienBanDanhGia: phienBan,
        thietBiDanhGia: dto.thietBiDanhGia?.trim() || 'Windows',
      },
      include: {
        nguoiDung: {
          select: {
            maNguoiDung: true,
            tenHienThi: true,
            tenDangNhap: true,
            duongDanAvatar: true,
          },
        },
      },
    });

    // Cập nhật điểm trung bình và số lượt đánh giá của ứng dụng
    await this.capNhatDiemDanhGiaUngDung(maUngDung);

    // Xóa cache chi tiết của ứng dụng
    await this.cacheService.xoa(`fs:apps:detail:${maUngDung}`);
    await this.cacheService.xoa(`fs:apps:detail:${ungDung.tenRepoDayDu.toLowerCase()}`);

    this.logger.log(
      `Người dùng [${maNguoiDung}] đã gửi đánh giá ${dto.soSao}⭐ cho [${ungDung.tenRepoDayDu}] (v${phienBan})`,
    );

    return {
      maDanhGia: taoMoi.maDanhGia,
      maNguoiDung: taoMoi.maNguoiDung,
      maUngDung: taoMoi.maUngDung,
      soSao: taoMoi.soSao,
      tieuDe: taoMoi.tieuDe,
      noiDungNhanXet: taoMoi.noiDungNhanXet,
      phienBanDanhGia: taoMoi.phienBanDanhGia,
      thietBiDanhGia: taoMoi.thietBiDanhGia,
      soLuotHuuIch: taoMoi.soLuotHuuIch,
      ngayDanhGia: taoMoi.ngayDanhGia.toISOString(),
      ngayCapNhat: taoMoi.ngayCapNhat.toISOString(),
      tenNguoiDung: taoMoi.nguoiDung?.tenHienThi || taoMoi.nguoiDung?.tenDangNhap || null,
      duongDanAvatar: taoMoi.nguoiDung?.duongDanAvatar || null,
    };
  }

  /**
   * Cập nhật đánh giá của chính mình (PATCH /danh-gia/:id - P2-53.1).
   */
  async suaDanhGia(
    maNguoiDung: string,
    maDanhGia: string,
    dto: UpdateReviewDto,
    laQuanTri: boolean = false,
  ): Promise<DanhGiaDto> {
    const danhGia = await this.prisma.danhGiaUngDung.findUnique({
      where: { maDanhGia },
      include: { ungDung: true },
    });

    if (!danhGia) {
      throw new NotFoundException(`Không tìm thấy nhận xét với mã [${maDanhGia}]`);
    }

    if (danhGia.maNguoiDung !== maNguoiDung && !laQuanTri) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa nhận xét của người khác.');
    }

    const capNhat = await this.prisma.danhGiaUngDung.update({
      where: { maDanhGia },
      data: {
        ...(dto.soSao !== undefined ? { soSao: dto.soSao } : {}),
        ...(dto.tieuDe !== undefined ? { tieuDe: dto.tieuDe.trim() || null } : {}),
        ...(dto.noiDungNhanXet !== undefined ? { noiDungNhanXet: dto.noiDungNhanXet.trim() } : {}),
        ngayCapNhat: new Date(),
      },
      include: {
        nguoiDung: {
          select: {
            maNguoiDung: true,
            tenHienThi: true,
            tenDangNhap: true,
            duongDanAvatar: true,
          },
        },
      },
    });

    if (dto.soSao !== undefined) {
      await this.capNhatDiemDanhGiaUngDung(danhGia.maUngDung);
    }

    // Xóa cache chi tiết
    await this.cacheService.xoa(`fs:apps:detail:${danhGia.maUngDung}`);
    await this.cacheService.xoa(`fs:apps:detail:${danhGia.ungDung.tenRepoDayDu.toLowerCase()}`);

    return {
      maDanhGia: capNhat.maDanhGia,
      maNguoiDung: capNhat.maNguoiDung,
      maUngDung: capNhat.maUngDung,
      soSao: capNhat.soSao,
      tieuDe: capNhat.tieuDe,
      noiDungNhanXet: capNhat.noiDungNhanXet,
      phienBanDanhGia: capNhat.phienBanDanhGia,
      thietBiDanhGia: capNhat.thietBiDanhGia,
      soLuotHuuIch: capNhat.soLuotHuuIch,
      ngayDanhGia: capNhat.ngayDanhGia.toISOString(),
      ngayCapNhat: capNhat.ngayCapNhat.toISOString(),
      tenNguoiDung: capNhat.nguoiDung?.tenHienThi || capNhat.nguoiDung?.tenDangNhap || null,
      duongDanAvatar: capNhat.nguoiDung?.duongDanAvatar || null,
    };
  }

  /**
   * Xóa đánh giá (DELETE /danh-gia/:id - P2-53.1).
   */
  async xoaDanhGia(
    maNguoiDung: string,
    maDanhGia: string,
    laQuanTri: boolean = false,
  ): Promise<{ daXoa: boolean }> {
    const danhGia = await this.prisma.danhGiaUngDung.findUnique({
      where: { maDanhGia },
      include: { ungDung: true },
    });

    if (!danhGia) {
      throw new NotFoundException(`Không tìm thấy nhận xét với mã [${maDanhGia}]`);
    }

    if (danhGia.maNguoiDung !== maNguoiDung && !laQuanTri) {
      throw new ForbiddenException('Bạn không có quyền xóa nhận xét của người khác.');
    }

    await this.prisma.danhGiaUngDung.delete({
      where: { maDanhGia },
    });

    // Cập nhật lại điểm trung bình
    await this.capNhatDiemDanhGiaUngDung(danhGia.maUngDung);

    // Xóa cache chi tiết
    await this.cacheService.xoa(`fs:apps:detail:${danhGia.maUngDung}`);
    await this.cacheService.xoa(`fs:apps:detail:${danhGia.ungDung.tenRepoDayDu.toLowerCase()}`);

    this.logger.log(`Đã xóa bài đánh giá [${maDanhGia}] của app [${danhGia.ungDung.tenRepoDayDu}]`);

    return { daXoa: true };
  }

  /**
   * Bình chọn nhận xét hữu ích (POST /danh-gia/:id/huu-ich - P2-53.3).
   * Mỗi người chỉ được bấm 1 lần, kiểm soát bằng Redis Key.
   */
  async binhChonHuuIch(
    maNguoiDung: string,
    maDanhGia: string,
  ): Promise<{ daBinhChon: boolean; soLuotHuuIch: number }> {
    const danhGia = await this.prisma.danhGiaUngDung.findUnique({
      where: { maDanhGia },
      select: { maDanhGia: true, soLuotHuuIch: true },
    });

    if (!danhGia) {
      throw new NotFoundException(`Không tìm thấy nhận xét với mã [${maDanhGia}]`);
    }

    const redisKey = `fs:review:helpful:${maDanhGia}:${maNguoiDung}`;
    const daBinhChon = await this.cacheService.lay<string>(redisKey);

    if (daBinhChon) {
      throw new BadRequestException('Bạn đã bình chọn hữu ích cho nhận xét này rồi.');
    }

    // Tăng số lượt hữu ích trong CSDL
    const capNhat = await this.prisma.danhGiaUngDung.update({
      where: { maDanhGia },
      data: { soLuotHuuIch: { increment: 1 } },
      select: { soLuotHuuIch: true },
    });

    // Lưu vào Redis để chặn bấm nhiều lần (TTL 30 ngày)
    await this.cacheService.luu(redisKey, '1', this.HELPFUL_TTL);

    this.logger.log(`Người dùng [${maNguoiDung}] đã vote hữu ích cho đánh giá [${maDanhGia}]`);

    return {
      daBinhChon: true,
      soLuotHuuIch: capNhat.soLuotHuuIch,
    };
  }

  /**
   * Tính điểm trung bình và số lượt đánh giá cập nhật vào bảng UngDung (P2-53.4).
   */
  private async capNhatDiemDanhGiaUngDung(maUngDung: string): Promise<void> {
    try {
      const thongKe = await this.prisma.danhGiaUngDung.aggregate({
        where: { maUngDung },
        _avg: { soSao: true },
        _count: { maDanhGia: true },
      });

      const soSaoTrungBinh = thongKe._avg.soSao ? Number(thongKe._avg.soSao.toFixed(1)) : 0;
      const soLuotDanhGia = thongKe._count.maDanhGia;

      // Lưu kết quả thống kê vào Redis cache để truy xuất nhanh
      await this.cacheService.luu(
        `fs:apps:rating:${maUngDung}`,
        { soSaoTrungBinh, soLuotDanhGia },
        86400,
      );

      this.logger.log(
        `Đã tính lại điểm app [${maUngDung}]: ${soSaoTrungBinh}⭐ (${soLuotDanhGia} lượt đánh giá)`,
      );
    } catch (err) {
      this.logger.error(`Lỗi cập nhật điểm trung bình cho app [${maUngDung}]:`, err);
    }
  }
}

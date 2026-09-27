import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { TrangKetQua, UngDungTomTatDto } from '@forgestore/types';
import { trichXuatDinhDangVaKienTruc } from '../apps/utils/release-selector.util';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Lấy danh sách ứng dụng yêu thích của người dùng kèm phân trang.
   * Bản ghi mới thích nhất được xếp lên đầu.
   */
  async layDanhSachYeuThich(
    maNguoiDung: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<TrangKetQua<UngDungTomTatDto>> {
    const skip = (page - 1) * limit;

    const [danhSachYeuThich, tongSo] = await Promise.all([
      this.prisma.khoYeuThich.findMany({
        where: { maNguoiDung },
        include: {
          ungDung: {
            include: {
              phanTichAI: true,
              danhSachPhatHanh: {
                orderBy: { ngayPhatHanh: 'desc' },
                take: 1,
                include: { danhSachTepCaiDat: true },
              },
            },
          },
        },
        orderBy: { ngayThem: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.khoYeuThich.count({
        where: { maNguoiDung },
      }),
    ]);

    const duLieu: UngDungTomTatDto[] = danhSachYeuThich.map((item) => {
      const app = item.ungDung;
      const banMoiNhat = app.danhSachPhatHanh?.[0];
      const { dinhDangCoSan, kienTrucCoSan } = trichXuatDinhDangVaKienTruc(
        banMoiNhat?.danhSachTepCaiDat,
      );
      return {
        maUngDung: app.maUngDung,
        chuSoHuu: app.chuSoHuu,
        tenKhoChua: app.tenKhoChua,
        tenRepoDayDu: app.tenRepoDayDu,
        duongDanGithub: app.duongDanGithub,
        duongDanIcon: app.duongDanIcon ?? null,
        soSaoGithub: app.soSaoGithub,
        danhMucChinh: app.danhMucChinh,
        nenTangHoTro: app.nenTangHoTro,
        khauHieuTiengViet: app.phanTichAI?.khauHieuTiengViet ?? app.moTaGocTiengAnh ?? '',
        phienBanMoiNhat: banMoiNhat?.tenPhienBan ?? null,
        ngayCapNhat: banMoiNhat?.ngayPhatHanh?.toISOString() ?? app.ngayCapNhat.toISOString(),
        diemUyTin: app.phanTichAI?.diemUyTin ?? null,
        mucDoAnToan: app.phanTichAI?.mucDoAnToan ?? null,
        daXacMinh: app.daXacMinh,
        duocNoiBat: app.duocNoiBat,
        tenGoiAndroid: app.tenGoiAndroid ?? null,
        dinhDangCoSan,
        kienTrucCoSan,
        loaiGiayPhep: app.loaiGiayPhep || null,
        daYeuThich: true,
      };
    });

    const tongSoTrang = Math.ceil(tongSo / limit);

    return {
      duLieu,
      tongSo,
      trangHienTai: page,
      kichThuocTrang: limit,
      tongSoTrang,
    };
  }

  /**
   * Bật hoặc tắt trạng thái yêu thích của một ứng dụng cho người dùng.
   * Nếu đã thích -> xóa khỏi danh sách (trả về false).
   * Nếu chưa thích -> thêm vào danh sách (trả về true).
   */
  /**
   * Xác định loại thiết bị bấm thích từ bản ghi thiết bị của phiên (JWT `did`),
   * thay vì tin vào header do client tự gửi.
   */
  async xacDinhThietBiThem(maThietBi?: string): Promise<'MAY_TINH' | 'DIEN_THOAI'> {
    if (!maThietBi) return 'MAY_TINH';
    const thietBi = await this.prisma.thietBi
      .findUnique({ where: { maThietBi }, select: { loaiThietBi: true } })
      .catch(() => null);
    return thietBi?.loaiThietBi === 'DIEN_THOAI_ANDROID' ? 'DIEN_THOAI' : 'MAY_TINH';
  }

  async chuyenDoiYeuThich(
    maNguoiDung: string,
    idOrSlug: string,
    thietBiThem: string = 'MAY_TINH',
  ): Promise<{ daYeuThich: boolean }> {
    const cleanId = decodeURIComponent(idOrSlug.trim());
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

    // 1. Gộp tìm ứng dụng theo mã UUID hoặc tên/slug trong MỘT truy vấn duy nhất (L-11)
    const orConditions: Prisma.UngDungWhereInput[] = [
      { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
      { tenKhoChua: { equals: cleanId, mode: 'insensitive' } },
    ];
    if (isUuid) {
      orConditions.unshift({ maUngDung: cleanId });
    }

    const ungDung = await this.prisma.ungDung.findFirst({
      where: { OR: orConditions },
      select: { maUngDung: true, tenRepoDayDu: true },
    });

    if (!ungDung) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với mã hoặc tên [${idOrSlug}]`);
    }

    const maUngDung = ungDung.maUngDung;

    // 2. Bật / tắt yêu thích trong MỘT truy vấn (L-11):
    // Thử xóa trước bằng deleteMany. Nếu đã thích thì count > 0 -> chuyển sang false.
    const xoaResult = await this.prisma.khoYeuThich.deleteMany({
      where: {
        maNguoiDung,
        maUngDung,
      },
    });

    if (xoaResult.count > 0) {
      this.logger.log(`Người dùng [${maNguoiDung}] đã bỏ thích ứng dụng [${ungDung.tenRepoDayDu}]`);
      if (this.cacheService) {
        await this.cacheService.del(`user:favs:${maNguoiDung}`);
      }
      return { daYeuThich: false };
    }

    // 3. Nếu count === 0 nghĩa là chưa thích -> Tạo mới (xử lý idempotent P2002)
    try {
      await this.prisma.khoYeuThich.create({
        data: {
          maNguoiDung,
          maUngDung,
          thietBiThem: thietBiThem || 'MAY_TINH',
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        if (this.cacheService) {
          await this.cacheService.del(`user:favs:${maNguoiDung}`);
        }
        return { daYeuThich: true };
      }
      throw err;
    }

    this.logger.log(
      `Người dùng [${maNguoiDung}] đã thích ứng dụng [${ungDung.tenRepoDayDu}] từ thiết bị [${thietBiThem}]`,
    );
    if (this.cacheService) {
      await this.cacheService.del(`user:favs:${maNguoiDung}`);
    }
    return { daYeuThich: true };
  }

  /**
   * Kiểm tra một người dùng đã yêu thích một ứng dụng cụ thể chưa.
   */
  async kiemTraDaYeuThich(maNguoiDung: string, maUngDung: string): Promise<boolean> {
    const record = await this.prisma.khoYeuThich.findUnique({
      where: {
        maNguoiDung_maUngDung: {
          maNguoiDung,
          maUngDung,
        },
      },
      select: { maYeuThich: true },
    });
    return Boolean(record);
  }

  /**
   * Lấy tập hợp các ID ứng dụng mà người dùng đã yêu thích trong danh sách cho trước.
   * Sử dụng Redis Cache theo user để tránh truy vấn DB lặp lại (L-12).
   */
  async layTapHopUngDungDaYeuThich(
    maNguoiDung: string,
    danhSachMaUngDung: string[],
  ): Promise<Set<string>> {
    if (!maNguoiDung || danhSachMaUngDung.length === 0) {
      return new Set<string>();
    }

    const cacheKey = `user:favs:${maNguoiDung}`;
    if (this.cacheService) {
      const cached = await this.cacheService.lay<string[]>(cacheKey);
      if (cached) {
        return new Set(cached);
      }
    }

    const records = await this.prisma.khoYeuThich.findMany({
      where: { maNguoiDung },
      select: { maUngDung: true },
    });

    const ids = records.map((r) => r.maUngDung);
    if (this.cacheService) {
      await this.cacheService.luu(cacheKey, ids, 300);
    }

    return new Set(ids);
  }
}

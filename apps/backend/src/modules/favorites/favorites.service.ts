import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrangKetQua, UngDungTomTatDto } from '@forgestore/types';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        diemUyTin: app.phanTichAI?.diemUyTin ?? 100,
        mucDoAnToan: app.phanTichAI?.mucDoAnToan ?? null,
        daXacMinh: app.daXacMinh,
        duocNoiBat: app.duocNoiBat,
        tenGoiAndroid: app.tenGoiAndroid ?? null,
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

    // 1. Kiểm tra ứng dụng có tồn tại trong Store không (hỗ trợ cả UUID lẫn Repo Slug)
    let ungDung = await this.prisma.ungDung
      .findUnique({
        where: { maUngDung: cleanId },
        select: { maUngDung: true, tenRepoDayDu: true },
      })
      .catch(() => null);

    if (!ungDung && typeof this.prisma.ungDung?.findFirst === 'function') {
      ungDung = await this.prisma.ungDung.findFirst({
        where: {
          OR: [
            { tenRepoDayDu: { equals: cleanId, mode: 'insensitive' } },
            { tenKhoChua: { equals: cleanId, mode: 'insensitive' } },
          ],
        },
        select: { maUngDung: true, tenRepoDayDu: true },
      });
    }

    if (!ungDung) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với mã hoặc tên [${idOrSlug}]`);
    }

    const maUngDung = ungDung.maUngDung;

    // 2. Tìm bản ghi yêu thích hiện tại
    const daCo = await this.prisma.khoYeuThich.findUnique({
      where: {
        maNguoiDung_maUngDung: {
          maNguoiDung,
          maUngDung,
        },
      },
    });

    if (daCo) {
      // Đã có -> Hủy yêu thích
      await this.prisma.khoYeuThich.delete({
        where: {
          maNguoiDung_maUngDung: {
            maNguoiDung,
            maUngDung,
          },
        },
      });

      this.logger.log(`Người dùng [${maNguoiDung}] đã bỏ thích ứng dụng [${ungDung.tenRepoDayDu}]`);
      return { daYeuThich: false };
    }

    // Chưa có -> Thêm yêu thích. Hai lần bấm gần như đồng thời có thể cùng tới đây:
    // lần sau vấp ràng buộc UNIQUE (P2002) thì coi như đã thích, không trả lỗi 500.
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
        return { daYeuThich: true };
      }
      throw err;
    }

    this.logger.log(
      `Người dùng [${maNguoiDung}] đã thích ứng dụng [${ungDung.tenRepoDayDu}] từ thiết bị [${thietBiThem}]`,
    );
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
   */
  async layTapHopUngDungDaYeuThich(
    maNguoiDung: string,
    danhSachMaUngDung: string[],
  ): Promise<Set<string>> {
    if (!maNguoiDung || danhSachMaUngDung.length === 0) {
      return new Set<string>();
    }

    const records = await this.prisma.khoYeuThich.findMany({
      where: {
        maNguoiDung,
        maUngDung: { in: danhSachMaUngDung },
      },
      select: { maUngDung: true },
    });

    return new Set(records.map((r) => r.maUngDung));
  }
}

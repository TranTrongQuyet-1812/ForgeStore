import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { LoaiThietBi } from '@prisma/client';
import { layBanPhatHanhMoiNhat, BanPhatHanhToiThieu } from '../apps/utils/release-selector.util';
import { coBanMoiHon } from '../updater/utils/version-comparator.util';

export interface DangKyThietBiParams {
  dinhDanhPhanCung: string;
  tenThietBi: string;
  loaiThietBi?: LoaiThietBi;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Đăng ký hoặc cập nhật thiết bị vật lý gắn với người dùng.
   * Tuân thủ Quyết định D-02: @@unique([maNguoiDung, dinhDanhPhanCung]).
   * Nếu đã tồn tại thiết bị trên tài khoản này, cập nhật tên và thời gian hoạt động.
   */
  async dangKyThietBi(maNguoiDung: string, params: DangKyThietBiParams) {
    const loai = params.loaiThietBi || LoaiThietBi.KHAC;

    const thietBi = await this.prisma.thietBi.upsert({
      where: {
        maNguoiDung_dinhDanhPhanCung: {
          maNguoiDung,
          dinhDanhPhanCung: params.dinhDanhPhanCung,
        },
      },
      create: {
        maNguoiDung,
        dinhDanhPhanCung: params.dinhDanhPhanCung,
        tenThietBi: params.tenThietBi,
        loaiThietBi: loai,
      },
      update: {
        tenThietBi: params.tenThietBi,
        loaiThietBi: loai,
        hoatDongLanCuoi: new Date(),
      },
    });

    this.logger.log(
      `Đã ghi nhận thiết bị [${thietBi.maThietBi}] (${thietBi.tenThietBi}) cho người dùng [${maNguoiDung}]`,
    );

    return thietBi;
  }

  /**
   * Lấy danh sách toàn bộ thiết bị vật lý của người dùng.
   */
  async layDanhSachThietBi(maNguoiDung: string) {
    return await this.prisma.thietBi.findMany({
      where: { maNguoiDung },
      orderBy: { hoatDongLanCuoi: 'desc' },
    });
  }

  /**
   * Đổi tên thiết bị (PATCH /devices/:id).
   * Kiểm tra quyền sở hữu thiết bị: nếu không phải của mình thì từ chối.
   */
  async doiTenThietBi(maNguoiDung: string, maThietBi: string, tenMoi: string) {
    const thietBi = await this.prisma.thietBi.findUnique({
      where: { maThietBi },
    });

    if (!thietBi) {
      throw new NotFoundException('Không tìm thấy thiết bị yêu cầu');
    }

    if (thietBi.maNguoiDung !== maNguoiDung) {
      throw new ForbiddenException('Bạn không có quyền quản lý thiết bị này');
    }

    return await this.prisma.thietBi.update({
      where: { maThietBi },
      data: {
        tenThietBi: tenMoi,
        hoatDongLanCuoi: new Date(),
      },
    });
  }

  /**
   * Cập nhật thời gian hoạt động gần nhất của thiết bị khi làm mới token hoặc kiểm tra cập nhật.
   */
  async capNhatHoatDong(maThietBi: string) {
    try {
      await this.prisma.thietBi.update({
        where: { maThietBi },
        data: { hoatDongLanCuoi: new Date() },
      });
    } catch (err) {
      this.logger.warn(
        `Không thể cập nhật hoatDongLanCuoi cho thiết bị [${maThietBi}]: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Tìm thiết bị theo ID.
   */
  async timTheoId(maThietBi: string) {
    return await this.prisma.thietBi.findUnique({
      where: { maThietBi },
    });
  }

  /**
   * Kiểm tra quyền sở hữu thiết bị của người dùng (P2-51.4).
   * Ném 404 nếu không tìm thấy thiết bị, ném 403 nếu thiết bị thuộc người dùng khác.
   */
  async kiemTraQuyenSoHuu(maNguoiDung: string, maThietBi: string) {
    const thietBi = await this.prisma.thietBi.findUnique({
      where: { maThietBi },
    });

    if (!thietBi) {
      throw new NotFoundException(`Không tìm thấy thiết bị với mã [${maThietBi}]`);
    }

    if (thietBi.maNguoiDung !== maNguoiDung) {
      throw new ForbiddenException('Bạn không có quyền quản lý thiết bị này');
    }

    return thietBi;
  }

  /**
   * Xóa cache danh sách ứng dụng đã cài đặt của thiết bị (R-02).
   */
  private async xoaCacheThietBi(maThietBi: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.del(`device:installed:${maThietBi}`);
    }
  }

  /**
   * Lấy danh sách ứng dụng đã cài đặt trên thiết bị, kèm cờ coBanMoi (P2-51.1, R-02).
   * Tối ưu truy vấn tinh gọn, lọc bản mới nhất theo nền tảng, so sánh SemVer và cache Redis 120s.
   */
  async layDanhSachAppDaCai(maNguoiDung: string, maThietBi: string) {
    const thietBi = await this.kiemTraQuyenSoHuu(maNguoiDung, maThietBi);

    const cacheKey = `device:installed:${maThietBi}`;
    if (this.cacheService) {
      const cached = await this.cacheService.get<Array<Record<string, unknown>>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const platform = thietBi.loaiThietBi === LoaiThietBi.DIEN_THOAI_ANDROID ? 'android' : 'windows';

    const danhSach = await this.prisma.ungDungDaCai.findMany({
      where: { maThietBi },
      select: {
        maBanGhi: true,
        maNguoiDung: true,
        maUngDung: true,
        maThietBi: true,
        phienBanHienTai: true,
        maTepDaCai: true,
        duongDanThuMuc: true,
        khoaRegistry: true,
        tenHienThiRegistry: true,
        ngayCaiDat: true,
        ngayCapNhatCuoi: true,
        ungDung: {
          select: {
            maUngDung: true,
            tenKhoChua: true,
            tenRepoDayDu: true,
            duongDanIcon: true,
            soSaoGithub: true,
            danhMucChinh: true,
            nenTangHoTro: true,
            moTaGocTiengAnh: true,
            daXacMinh: true,
            phanTichAI: {
              select: {
                khauHieuTiengViet: true,
                diemUyTin: true,
                mucDoAnToan: true,
              },
            },
            danhSachPhatHanh: {
              where: { laBanThuNghiem: false },
              orderBy: { ngayPhatHanh: 'desc' },
              take: 10,
              select: {
                maPhatHanh: true,
                tenPhienBan: true,
                ngayPhatHanh: true,
                laBanThuNghiem: true,
                danhSachTepCaiDat: {
                  select: {
                    maTep: true,
                    tenTep: true,
                    dinhDangTep: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { ngayCapNhatCuoi: 'desc' },
    });

    const result = danhSach.map((item) => {
      const app = item.ungDung;
      const banMoiNhat = layBanPhatHanhMoiNhat(
        app.danhSachPhatHanh as unknown as BanPhatHanhToiThieu[],
        platform,
      );
      const phienBanMoi = banMoiNhat?.tenPhienBan ?? null;

      // Cờ có bản mới: so sánh SemVer bằng coBanMoiHon theo nền tảng
      const coBanMoi = Boolean(phienBanMoi && coBanMoiHon(item.phienBanHienTai, phienBanMoi));

      return {
        maBanGhi: item.maBanGhi,
        maNguoiDung: item.maNguoiDung,
        maUngDung: item.maUngDung,
        maThietBi: item.maThietBi,
        phienBanHienTai: item.phienBanHienTai,
        maTepDaCai: item.maTepDaCai,
        duongDanThuMuc: item.duongDanThuMuc,
        khoaRegistry: item.khoaRegistry ?? null,
        tenHienThiRegistry: item.tenHienThiRegistry ?? null,
        ngayCaiDat: item.ngayCaiDat.toISOString(),
        ngayCapNhatCuoi: item.ngayCapNhatCuoi.toISOString(),
        coBanMoi,
        phienBanMoiNhat: phienBanMoi,
        ungDung: {
          maUngDung: app.maUngDung,
          tenKhoChua: app.tenKhoChua,
          tenRepoDayDu: app.tenRepoDayDu,
          duongDanIcon: app.duongDanIcon ?? null,
          soSaoGithub: app.soSaoGithub,
          danhMucChinh: app.danhMucChinh,
          nenTangHoTro: app.nenTangHoTro,
          khauHieuTiengViet: app.phanTichAI?.khauHieuTiengViet ?? app.moTaGocTiengAnh ?? '',
          diemUyTin: app.phanTichAI?.diemUyTin ?? null,
          mucDoAnToan: app.phanTichAI?.mucDoAnToan ?? null,
          daXacMinh: app.daXacMinh,
        },
      };
    });

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, result, 120);
    }

    return result;
  }

  /**
   * Ghi nhận hoặc cập nhật ứng dụng vừa cài đặt trên thiết bị (P2-51.2).
   */
  async ghiNhanCaiDat(
    maNguoiDung: string,
    maThietBi: string,
    dto: {
      maUngDung: string;
      phienBanHienTai: string;
      maTepDaCai?: string;
      duongDanThuMuc?: string;
      khoaRegistry?: string;
      tenHienThiRegistry?: string;
    },
  ) {
    await this.kiemTraQuyenSoHuu(maNguoiDung, maThietBi);

    // Kiểm tra ứng dụng có tồn tại trong Store không
    const ungDung = await this.prisma.ungDung.findUnique({
      where: { maUngDung: dto.maUngDung },
      select: { maUngDung: true, tenRepoDayDu: true },
    });

    if (!ungDung) {
      throw new NotFoundException(`Không tìm thấy ứng dụng với mã [${dto.maUngDung}]`);
    }

    const daCai = await this.prisma.ungDungDaCai.upsert({
      where: {
        maThietBi_maUngDung: {
          maThietBi,
          maUngDung: dto.maUngDung,
        },
      },
      create: {
        maNguoiDung,
        maThietBi,
        maUngDung: dto.maUngDung,
        phienBanHienTai: dto.phienBanHienTai,
        maTepDaCai: dto.maTepDaCai || null,
        duongDanThuMuc: dto.duongDanThuMuc || null,
        khoaRegistry: dto.khoaRegistry || null,
        tenHienThiRegistry: dto.tenHienThiRegistry || null,
      },
      update: {
        phienBanHienTai: dto.phienBanHienTai !== undefined ? dto.phienBanHienTai : undefined,
        maTepDaCai: dto.maTepDaCai !== undefined ? dto.maTepDaCai || null : undefined,
        duongDanThuMuc: dto.duongDanThuMuc !== undefined ? dto.duongDanThuMuc || null : undefined,
        khoaRegistry: dto.khoaRegistry !== undefined ? dto.khoaRegistry || null : undefined,
        tenHienThiRegistry:
          dto.tenHienThiRegistry !== undefined ? dto.tenHienThiRegistry || null : undefined,
        ngayCapNhatCuoi:
          dto.phienBanHienTai !== undefined || dto.maTepDaCai !== undefined
            ? new Date()
            : undefined,
      },
    });

    // Tăng số lượt tải của tệp cài đặt nếu có (SEC-R7-09: chỉ tăng nếu tệp thuộc ứng dụng đang ghi nhận)
    if (dto.maTepDaCai) {
      const tepThuocApp = await this.prisma.tepCaiDat.findFirst({
        where: {
          maTep: dto.maTepDaCai,
          banPhatHanh: { maUngDung: dto.maUngDung },
        },
        select: { maTep: true },
      });

      if (tepThuocApp) {
        await this.prisma.tepCaiDat
          .update({
            where: { maTep: dto.maTepDaCai },
            data: { soLuotTai: { increment: 1 } },
          })
          .catch((err) => {
            this.logger.warn(
              `Lỗi tăng soLuotTai cho tệp cài đặt [${dto.maTepDaCai}]: ${(err as Error).message}`,
            );
          });
      }
    }

    await this.xoaCacheThietBi(maThietBi);

    this.logger.log(
      `Đã ghi nhận cài đặt [${ungDung.tenRepoDayDu}] (v${dto.phienBanHienTai}) trên thiết bị [${maThietBi}]`,
    );

    return daCai;
  }

  /**
   * Gỡ cài đặt ứng dụng khỏi thiết bị (P2-51.3).
   */
  async goCaiDat(maNguoiDung: string, maThietBi: string, maUngDung: string) {
    await this.kiemTraQuyenSoHuu(maNguoiDung, maThietBi);

    const xoa = await this.prisma.ungDungDaCai.deleteMany({
      where: {
        maThietBi,
        maUngDung,
      },
    });

    await this.xoaCacheThietBi(maThietBi);

    this.logger.log(
      `Đã gỡ cài đặt app [${maUngDung}] khỏi thiết bị [${maThietBi}] (Số lượng xóa: ${xoa.count})`,
    );

    return {
      daGo: true,
      soLuong: xoa.count,
    };
  }

  /**
   * Cập nhật riêng thông tin Registry Windows cho ứng dụng đã cài đặt (P2-51.4).
   * Tuyệt đối không đụng vào maTepDaCai, duongDanThuMuc, phienBanHienTai, ngayCapNhatCuoi.
   */
  async capNhatKhoaRegistry(
    maNguoiDung: string,
    maThietBi: string,
    maUngDung: string,
    dto: { khoaRegistry: string; tenHienThiRegistry?: string },
  ) {
    await this.kiemTraQuyenSoHuu(maNguoiDung, maThietBi);

    const tonTai = await this.prisma.ungDungDaCai.findUnique({
      where: {
        maThietBi_maUngDung: {
          maThietBi,
          maUngDung,
        },
      },
    });

    if (!tonTai) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi cài đặt cho ứng dụng [${maUngDung}] trên thiết bị [${maThietBi}]`,
      );
    }

    const ketQua = await this.prisma.ungDungDaCai.update({
      where: {
        maThietBi_maUngDung: {
          maThietBi,
          maUngDung,
        },
      },
      data: {
        khoaRegistry: dto.khoaRegistry,
        tenHienThiRegistry: dto.tenHienThiRegistry ?? null,
      },
    });

    await this.xoaCacheThietBi(maThietBi);

    return ketQua;
  }
}

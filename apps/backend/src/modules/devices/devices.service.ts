import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoaiThietBi } from '@prisma/client';

export interface DangKyThietBiParams {
  dinhDanhPhanCung: string;
  tenThietBi: string;
  loaiThietBi?: LoaiThietBi;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}

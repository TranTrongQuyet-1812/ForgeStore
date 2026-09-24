import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckUpdatesDto } from './dto/check-updates.dto';
import { coBanMoiHon } from './utils/version-comparator.util';
import {
  BanPhatHanhDto,
  CheckUpdatesItemDto,
  CheckUpdatesResponseDto,
  DinhDangTep,
  KienTrucChip,
} from '@forgestore/types';
import { TepCaiDat, VaiTro } from '@prisma/client';

@Injectable()
export class UpdaterService {
  private readonly logger = new Logger(UpdaterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra bản cập nhật cho thiết bị (POST /apps/check-updates - P2-52).
   */
  async kiemTraCapNhat(
    dto: CheckUpdatesDto,
    maNguoiDung?: string,
    vaiTro?: VaiTro,
  ): Promise<CheckUpdatesResponseDto> {
    const { maThietBi } = dto;

    // 1. Kiểm tra thiết bị có tồn tại trong CSDL không và xác thực quyền sở hữu (Post-Review #10)
    const thietBi = await this.prisma.thietBi.findUnique({
      where: { maThietBi },
      select: { maThietBi: true, tenThietBi: true, loaiThietBi: true, maNguoiDung: true },
    });

    if (!thietBi) {
      throw new NotFoundException(`Không tìm thấy thiết bị với mã [${maThietBi}]`);
    }

    if (
      maNguoiDung &&
      vaiTro !== VaiTro.QUAN_TRI_VIEN &&
      thietBi.maNguoiDung &&
      thietBi.maNguoiDung !== maNguoiDung
    ) {
      throw new ForbiddenException('Bạn không có quyền kiểm tra cập nhật trên thiết bị này');
    }

    // Cập nhật thời gian hoạt động gần nhất của thiết bị
    await this.prisma.thietBi
      .update({
        where: { maThietBi },
        data: { hoatDongLanCuoi: new Date() },
      })
      .catch(() => {});

    // 2. Xác định danh sách app cần kiểm tra
    let danhSachKiemTra: Array<{
      maUngDung?: string;
      tenGoiAndroid?: string;
      phienBanHienTai: string;
      maTepDaCai?: string | null;
    }> = [];

    if (dto.ungDung && dto.ungDung.length > 0) {
      // Client tự gửi danh sách app đang chạy
      danhSachKiemTra = dto.ungDung.map((item) => ({
        maUngDung: item.maUngDung,
        tenGoiAndroid: item.tenGoiAndroid,
        phienBanHienTai: item.phienBan,
      }));
    } else {
      // Lấy từ CSDL ung_dung_da_cai của thiết bị
      const daCai = await this.prisma.ungDungDaCai.findMany({
        where: { maThietBi },
        select: {
          maUngDung: true,
          phienBanHienTai: true,
          maTepDaCai: true,
          ungDung: {
            select: { tenGoiAndroid: true },
          },
        },
      });

      danhSachKiemTra = daCai.map((item) => ({
        maUngDung: item.maUngDung,
        tenGoiAndroid: item.ungDung?.tenGoiAndroid ?? undefined,
        phienBanHienTai: item.phienBanHienTai,
        maTepDaCai: item.maTepDaCai,
      }));
    }

    if (danhSachKiemTra.length === 0) {
      return { danhSachCapNhat: [] };
    }

    // 3. Quét từng ứng dụng đối chiếu với Store
    const danhSachCapNhat: CheckUpdatesItemDto[] = [];

    for (const item of danhSachKiemTra) {
      // Tìm ứng dụng trong Store
      let app = null;

      if (item.maUngDung) {
        app = await this.prisma.ungDung.findUnique({
          where: { maUngDung: item.maUngDung },
          include: {
            danhSachPhatHanh: {
              where: { laBanThuNghiem: false },
              orderBy: { ngayPhatHanh: 'desc' },
              take: 1,
              include: { danhSachTepCaiDat: true },
            },
          },
        });
      } else if (item.tenGoiAndroid) {
        app = await this.prisma.ungDung.findFirst({
          where: { tenGoiAndroid: item.tenGoiAndroid },
          include: {
            danhSachPhatHanh: {
              where: { laBanThuNghiem: false },
              orderBy: { ngayPhatHanh: 'desc' },
              take: 1,
              include: { danhSachTepCaiDat: true },
            },
          },
        });
      }

      if (!app || !app.danhSachPhatHanh || app.danhSachPhatHanh.length === 0) {
        continue;
      }

      const banMoiNhat = app.danhSachPhatHanh[0]!;
      const phienBanMoi = banMoiNhat.tenPhienBan;

      // So sánh phiên bản:
      // A. Nếu có maTepDaCai đã ghi nhận trong DB (Android hoặc Windows qua ForgeStore):
      // Ưu tiên kiểm tra xem ngày phát hành của release mới có sau ngày phát hành của file đã cài không (P2-52.3)
      let daXacDinhQuaTep = false;
      let coBanMoi = false;

      if (item.maTepDaCai) {
        const tepDaCai = await this.prisma.tepCaiDat.findUnique({
          where: { maTep: item.maTepDaCai },
          include: { banPhatHanh: true },
        });

        if (tepDaCai && tepDaCai.banPhatHanh) {
          daXacDinhQuaTep = true;
          // So sánh mã release hoặc ngày phát hành
          if (banMoiNhat.maPhatHanh !== tepDaCai.maPhatHanh) {
            coBanMoi = banMoiNhat.ngayPhatHanh > tepDaCai.banPhatHanh.ngayPhatHanh;
          } else {
            // Máy đang cài đúng release mới nhất trong Store
            coBanMoi = false;
          }
        }
      }

      // B. Nếu chưa xác định được qua maTepDaCai (do client tự gửi danh sách hoặc file không tìm thấy) -> so sánh chuỗi
      if (!daXacDinhQuaTep) {
        coBanMoi = coBanMoiHon(item.phienBanHienTai, phienBanMoi);
      }

      if (coBanMoi) {
        const banPhatHanhDto: BanPhatHanhDto = {
          maPhatHanh: banMoiNhat.maPhatHanh,
          maUngDung: banMoiNhat.maUngDung,
          maReleaseGithub: banMoiNhat.maReleaseGithub
            ? banMoiNhat.maReleaseGithub.toString()
            : null,
          tenPhienBan: banMoiNhat.tenPhienBan,
          tieuDePhatHanh: banMoiNhat.tieuDePhatHanh,
          nhatKyThayDoiGoc: banMoiNhat.nhatKyThayDoiGoc,
          tomTatNangCapVi: banMoiNhat.tomTatNangCapVi,
          laBanThuNghiem: banMoiNhat.laBanThuNghiem,
          ngayPhatHanh: banMoiNhat.ngayPhatHanh.toISOString(),
          danhSachTepCaiDat: banMoiNhat.danhSachTepCaiDat.map((f: TepCaiDat) => ({
            maTep: f.maTep,
            maPhatHanh: f.maPhatHanh,
            tenTep: f.tenTep,
            duongDanTaiVe: f.duongDanTaiVe,
            dungLuongBytes: f.dungLuongBytes.toString(),
            dinhDangTep: f.dinhDangTep as unknown as DinhDangTep,
            kienTrucChip: f.kienTrucChip as unknown as KienTrucChip,
            maBamSha256: f.maBamSha256,
            soLuotTai: f.soLuotTai,
            ngayTao: f.ngayTao.toISOString(),
          })),
        };

        danhSachCapNhat.push({
          maUngDung: app.maUngDung,
          phienBanHienTai: item.phienBanHienTai,
          phienBanMoiNhat: phienBanMoi,
          coBanCapNhat: true,
          tomTatNangCapVi: banMoiNhat.tomTatNangCapVi,
          banPhatHanhMoiNhat: banPhatHanhDto,
        });
      }
    }

    this.logger.log(
      `Thiết bị [${maThietBi}] đã kiểm tra cập nhật: tìm thấy ${danhSachCapNhat.length} ứng dụng có bản mới`,
    );

    return { danhSachCapNhat };
  }
}

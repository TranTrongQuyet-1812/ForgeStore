import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckUpdatesDto } from './dto/kiem-tra-cap-nhat.dto';
import { kiemTraCoBanCapNhat, parseBigIntAnToan } from './tien-ich/so-sanh-phien-ban.util';
import { layBanPhatHanhMoiNhat } from '../ung-dung/tien-ich/chon-ban-phat-hanh.util';
import {
  BanPhatHanhDto,
  CheckUpdatesItemDto,
  CheckUpdatesResponseDto,
  DinhDangTep,
  KienTrucChip,
  taoMauTenTepWildcard,
  khopMauTenTep,
} from '@forgestore/types';
import { TepCaiDat, VaiTro } from '@prisma/client';

/**
 * Tìm tệp trong bản phát hành mới tương đồng nhất với tệp đã cài (P3B-17 Polish - Điểm Vàng 2)
 * Tránh so nhầm chéo file khác kiến trúc (ví dụ x64 vs arm64) khi cùng release có nhiều file cùng định dạng.
 */
export function timTepTuongDong(
  tepDaCai: {
    maTep?: string | null;
    tenTep?: string | null;
    dinhDangTep?: string | null;
    kienTrucChip?: string | null;
  },
  danhSachTepMoi: TepCaiDat[],
  phienBanCu?: string | null,
): TepCaiDat | undefined {
  if (!danhSachTepMoi || danhSachTepMoi.length === 0) {
    return undefined;
  }

  // 1. Khớp maTep (nếu cùng release)
  if (tepDaCai.maTep) {
    const theoMaTep = danhSachTepMoi.find((f) => f.maTep === tepDaCai.maTep);
    if (theoMaTep) return theoMaTep;
  }

  // 2. Khớp tên tệp chính xác (case-insensitive)
  if (tepDaCai.tenTep) {
    const theoTenChinhXac = danhSachTepMoi.find(
      (f) => f.tenTep.toLowerCase() === tepDaCai.tenTep!.toLowerCase(),
    );
    if (theoTenChinhXac) return theoTenChinhXac;
  }

  // 3. Khớp theo mẫu Wildcard Pattern (P3B-17.1)
  if (tepDaCai.tenTep) {
    const mauWildcard = taoMauTenTepWildcard(tepDaCai.tenTep, phienBanCu || undefined);
    const theoWildcard = danhSachTepMoi.find((f) => khopMauTenTep(f.tenTep, mauWildcard));
    if (theoWildcard) return theoWildcard;
  }

  // 4. Khớp cùng kiến trúc chip và cùng định dạng tệp
  if (tepDaCai.kienTrucChip && tepDaCai.dinhDangTep) {
    const theoChipVaDinhDang = danhSachTepMoi.find(
      (f) => f.kienTrucChip === tepDaCai.kienTrucChip && f.dinhDangTep === tepDaCai.dinhDangTep,
    );
    if (theoChipVaDinhDang) return theoChipVaDinhDang;
  }

  // 4b. Suy đoán chip từ tên tệp nếu DB không có kienTrucChip
  if (tepDaCai.tenTep && tepDaCai.dinhDangTep) {
    const tenLower = tepDaCai.tenTep.toLowerCase();
    const isArm64 = tenLower.includes('arm64') || tenLower.includes('aarch64');
    const isX64 =
      tenLower.includes('x64') ||
      tenLower.includes('x86_64') ||
      tenLower.includes('amd64') ||
      tenLower.includes('win64');

    if (isArm64 || isX64) {
      const theoSuyDoanChip = danhSachTepMoi.find((f) => {
        if (f.dinhDangTep !== tepDaCai.dinhDangTep) return false;
        const fTenLower = f.tenTep.toLowerCase();
        if (isArm64) {
          return fTenLower.includes('arm64') || fTenLower.includes('aarch64');
        }
        return (
          fTenLower.includes('x64') ||
          fTenLower.includes('x86_64') ||
          fTenLower.includes('amd64') ||
          fTenLower.includes('win64')
        );
      });
      if (theoSuyDoanChip) return theoSuyDoanChip;
    }
  }

  // 5. Khớp cùng định dạng tệp
  if (tepDaCai.dinhDangTep) {
    const theoDinhDang = danhSachTepMoi.find((f) => f.dinhDangTep === tepDaCai.dinhDangTep);
    if (theoDinhDang) return theoDinhDang;
  }

  // 6. Fallback về tệp đầu tiên
  return danhSachTepMoi[0];
}

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

    // Xác định nền tảng của thiết bị
    const platformThietBi =
      thietBi.loaiThietBi === 'MAY_TINH_WINDOWS'
        ? 'windows'
        : thietBi.loaiThietBi === 'DIEN_THOAI_ANDROID'
          ? 'android'
          : null;

    // Cập nhật thời gian hoạt động gần nhất của thiết bị
    await this.prisma.thietBi
      .update({
        where: { maThietBi },
        data: { hoatDongLanCuoi: new Date() },
      })
      .catch(() => {});

    // 2. Xác định danh sách app cần kiểm tra (hỗ trợ cả danhSachCaiDat và ungDung - BE-02)
    let danhSachKiemTra: Array<{
      maUngDung?: string;
      tenGoiAndroid?: string;
      phienBanHienTai: string;
      maTepDaCai?: string | null;
    }> = [];

    const danhSachDauVao = dto.danhSachCaiDat || dto.ungDung;
    if (danhSachDauVao && danhSachDauVao.length > 0) {
      // Client tự gửi danh sách app đang chạy
      danhSachKiemTra = danhSachDauVao.map((item) => ({
        maUngDung: item.maUngDung,
        tenGoiAndroid: item.tenGoiAndroid,
        phienBanHienTai: item.phienBanHienTai || item.phienBan || '',
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
              take: 10,
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
              take: 10,
              include: { danhSachTepCaiDat: true },
            },
          },
        });
      }

      if (!app || !app.danhSachPhatHanh || app.danhSachPhatHanh.length === 0) {
        continue;
      }

      // N1: Chọn bản mới nhất theo nền tảng thiết bị
      const banMoiNhat = layBanPhatHanhMoiNhat(app.danhSachPhatHanh, platformThietBi);
      if (!banMoiNhat) {
        continue;
      }
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
          if (banMoiNhat.maPhatHanh === tepDaCai.maPhatHanh) {
            // Máy đang cài đúng release này.
            // Kiểm tra xem file có bị đóng gói lại không (P3B-17.4 & P3B-17 Polish Điểm Vàng 2):
            const matchedNewFile = timTepTuongDong(
              tepDaCai,
              banMoiNhat.danhSachTepCaiDat,
              tepDaCai.banPhatHanh.tenPhienBan,
            );
            const hashNew = matchedNewFile?.maBamSha256?.trim().toLowerCase();
            const hashOld = tepDaCai.maBamSha256?.trim().toLowerCase();
            const bytesNew = parseBigIntAnToan(matchedNewFile?.dungLuongBytes);
            const bytesOld = parseBigIntAnToan(tepDaCai.dungLuongBytes);

            if (
              matchedNewFile &&
              ((hashNew && hashOld && hashNew !== hashOld) ||
                (bytesNew !== null && bytesOld !== null && bytesNew !== bytesOld))
            ) {
              coBanMoi = true;
            } else {
              coBanMoi = false;
            }
          } else {
            // Khác mã release -> kiểm tra toàn diện
            const matchedNewFile =
              timTepTuongDong(
                tepDaCai,
                banMoiNhat.danhSachTepCaiDat,
                tepDaCai.banPhatHanh.tenPhienBan,
              ) || banMoiNhat.danhSachTepCaiDat[0];

            const ketQua = kiemTraCoBanCapNhat(
              {
                tenPhienBan: tepDaCai.banPhatHanh.tenPhienBan || item.phienBanHienTai,
                ngayPhatHanh: tepDaCai.banPhatHanh.ngayPhatHanh,
                maBamSha256: tepDaCai.maBamSha256,
                dungLuongBytes: tepDaCai.dungLuongBytes,
              },
              {
                tenPhienBan: banMoiNhat.tenPhienBan,
                ngayPhatHanh: banMoiNhat.ngayPhatHanh,
                maBamSha256: matchedNewFile?.maBamSha256,
                dungLuongBytes: matchedNewFile?.dungLuongBytes,
              },
            );
            coBanMoi = ketQua.coBanCapNhat;
          }
        }
      }

      // B. Nếu chưa xác định được qua maTepDaCai (do client tự gửi danh sách hoặc file không tìm thấy) -> kiểm tra toàn diện
      if (!daXacDinhQuaTep) {
        const defaultNewFile = banMoiNhat.danhSachTepCaiDat[0];
        const ketQua = kiemTraCoBanCapNhat(
          {
            tenPhienBan: item.phienBanHienTai,
          },
          {
            tenPhienBan: phienBanMoi,
            ngayPhatHanh: banMoiNhat.ngayPhatHanh,
            maBamSha256: defaultNewFile?.maBamSha256,
            dungLuongBytes: defaultNewFile?.dungLuongBytes,
          },
        );
        coBanMoi = ketQua.coBanCapNhat;
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

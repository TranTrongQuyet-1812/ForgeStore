import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DinhDangTep } from '@prisma/client';
import { coCachCaiCliHopLe, HuongDanCaiDatDto } from '@forgestore/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';

/**
 * Kiểu dữ liệu thu gọn của ứng dụng phục vụ đối soát tính nhất quán trạng thái hiển thị
 */
interface UngDungDoiSoat {
  maUngDung: string;
  tenRepoDayDu: string;
  trangThai: string;
  phanTichAI?: {
    huongDanCaiDat: unknown;
  } | null;
  danhSachPhatHanh: Array<{
    danhSachTepCaiDat: Array<{ maTep: string }>;
  }>;
}

/**
 * Job chốt chặn tự động hằng ngày kiểm tra tính nhất quán trạng thái hiển thị (P3B-25.8, D-30).
 *
 * Nhiệm vụ:
 * 1. (a) Đang KHONG_CO_BAN_CAI nhưng có tệp cài hoặc lệnh CLI hợp lệ -> TỰ ĐỘNG SỬA sang HOAT_DONG và xóa cache.
 * 2. (b) Đang HOAT_DONG nhưng không có tệp cài và không có lệnh CLI hợp lệ -> CHỈ CẢNH BÁO trong log, không tự đổi.
 */
@Injectable()
export class KiemNhatQuanHienThiJob {
  private readonly logger = new Logger(KiemNhatQuanHienThiJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Chạy định kỳ vào 2:00 sáng mỗi ngày sau các đợt quét release và suy giảm điểm thịnh hành
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron(): Promise<void> {
    this.logger.log('Bắt đầu chu kỳ quét kiểm tra tính nhất quán trạng thái hiển thị...');
    await this.kiemTraVaSuaNhatQuanHienThi();
  }

  /**
   * Quét và đối soát tính nhất quán hiển thị trên toàn bộ ứng dụng trong CSDL
   */
  async kiemTraVaSuaNhatQuanHienThi(
    gioiHan = 200,
  ): Promise<{ soLuongDaSua: number; soLuongCanhBao: number }> {
    // Chống chạy chồng lấn giữa các chu kỳ cron
    if (this.isRunning) {
      this.logger.warn('Tác vụ kiểm tra nhất quán hiển thị đang chạy dở, bỏ qua chu kỳ này.');
      return { soLuongDaSua: 0, soLuongCanhBao: 0 };
    }

    this.isRunning = true;
    let soLuongDaSua = 0;
    let soLuongCanhBao = 0;

    try {
      soLuongDaSua = await this.xuLyAppBiAnNham(gioiHan);
      soLuongCanhBao = await this.xuLyAppHienNham(gioiHan);

      this.logger.log(
        `[Chốt chặn hoàn tất] Tổng số app đã tự sửa (a): ${soLuongDaSua}, Tổng số app cảnh báo (b): ${soLuongCanhBao}`,
      );
    } catch (error) {
      // Bắt lỗi để sự cố DB không làm sập tiến trình backend
      this.logger.error('Lỗi khi kiểm tra tính nhất quán hiển thị:', error);
    } finally {
      this.isRunning = false;
    }

    return { soLuongDaSua, soLuongCanhBao };
  }

  /**
   * (a) Xử lý ứng dụng đang KHONG_CO_BAN_CAI nhưng thực tế đủ điều kiện hiển thị
   */
  private async xuLyAppBiAnNham(gioiHan: number): Promise<number> {
    const appsBiAn = await this.layDanhSachAppTheoTrangThai('KHONG_CO_BAN_CAI', gioiHan);
    let daSua = 0;

    for (const app of appsBiAn) {
      const coTep = this.coTepCaiWindowsHoacAndroid(app.danhSachPhatHanh);
      const coCli = this.coHuongDanCliHopLe(app.phanTichAI?.huongDanCaiDat);

      // Nếu có tệp cài đặt hợp lệ HOẶC có lệnh cài CLI thì phải cho hiện (D-30)
      if (coTep || coCli) {
        await this.prisma.ungDung.update({
          where: { maUngDung: app.maUngDung },
          data: { trangThai: 'HOAT_DONG' },
        });

        daSua++;
        this.logger.log(
          `[Chốt chặn (a)] Tự sửa trạng thái repo [${app.tenRepoDayDu}]: KHONG_CO_BAN_CAI -> HOAT_DONG (Tệp: ${coTep}, CLI: ${coCli})`,
        );
      }
    }

    // Xóa cache danh sách, chi tiết và danh mục nếu có thay đổi trạng thái
    if (daSua > 0) {
      await this.xoaCacheHienThi();
    }

    return daSua;
  }

  /**
   * (b) Xử lý ứng dụng đang HOAT_DONG nhưng không có tệp cài và không có lệnh CLI
   */
  private async xuLyAppHienNham(gioiHan: number): Promise<number> {
    const appsHoatDong = await this.layDanhSachAppTheoTrangThai('HOAT_DONG', gioiHan);
    let canhBao = 0;

    for (const app of appsHoatDong) {
      const coTep = this.coTepCaiWindowsHoacAndroid(app.danhSachPhatHanh);
      const coCli = this.coHuongDanCliHopLe(app.phanTichAI?.huongDanCaiDat);

      // Nếu không có tệp cài và không có lệnh CLI thì cảnh báo (không tự ý đổi)
      if (!coTep && !coCli) {
        canhBao++;
        this.logger.warn(
          `[Chốt chặn (b)] Cảnh báo: Repo [${app.tenRepoDayDu}] đang HOAT_DONG nhưng không có tệp cài và không có hướng dẫn CLI hợp lệ.`,
        );
      }
    }

    return canhBao;
  }

  /**
   * Truy vấn danh sách ứng dụng theo trạng thái kèm tệp cài đặt và hướng dẫn CLI
   */
  private async layDanhSachAppTheoTrangThai(
    trangThai: string,
    gioiHan: number,
  ): Promise<UngDungDoiSoat[]> {
    return this.prisma.ungDung.findMany({
      where: { trangThai },
      take: gioiHan,
      select: {
        maUngDung: true,
        tenRepoDayDu: true,
        trangThai: true,
        phanTichAI: {
          select: {
            huongDanCaiDat: true,
          },
        },
        danhSachPhatHanh: {
          select: {
            danhSachTepCaiDat: {
              where: {
                dinhDangTep: {
                  in: [DinhDangTep.EXE, DinhDangTep.MSI, DinhDangTep.ZIP_PORTABLE, DinhDangTep.APK],
                },
              },
              select: { maTep: true },
              take: 1,
            },
          },
        },
      },
    });
  }

  /**
   * Kiểm tra xem các bản phát hành có tệp cài đặt Windows hoặc Android không
   */
  private coTepCaiWindowsHoacAndroid(
    danhSachPhatHanh: Array<{ danhSachTepCaiDat: Array<{ maTep: string }> }>,
  ): boolean {
    return danhSachPhatHanh.some((ph) => ph.danhSachTepCaiDat.length > 0);
  }

  /**
   * Kiểm tra xem hướng dẫn cài đặt có lệnh CLI hợp lệ không
   */
  private coHuongDanCliHopLe(huongDanCaiDat: unknown): boolean {
    return coCachCaiCliHopLe(huongDanCaiDat as HuongDanCaiDatDto | null | undefined);
  }

  /**
   * Xóa sạch cache danh sách, chi tiết app và danh mục để giao diện nhận trạng thái mới ngay
   */
  private async xoaCacheHienThi(): Promise<void> {
    await this.cacheService.xoaTheoPrefix('fs:apps:list:');
    await this.cacheService.xoaTheoPrefix('fs:apps:detail:');
    await this.cacheService.xoaTheoPrefix('fs:categories:');
  }
}

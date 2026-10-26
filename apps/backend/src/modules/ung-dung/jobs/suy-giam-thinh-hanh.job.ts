import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';

@Injectable()
export class TrendingDecayJob {
  private readonly logger = new Logger(TrendingDecayJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Tác vụ định kỳ quét và tính lại điểm thịnh hành suy giảm theo thời gian (P3B-03.4, DELIV-72.4).
   * Mặc định chạy vào nửa đêm mỗi ngày.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron(): Promise<void> {
    this.logger.log('Bắt đầu chu kỳ quét suy giảm điểm thịnh hành...');
    await this.capNhatDiemThinhHanhToanBo();
  }

  /**
   * Quét toàn bộ ứng dụng đang hoạt động và cập nhật lại diemThinhHanh theo thời gian thực.
   */
  async capNhatDiemThinhHanhToanBo(): Promise<{ soLuongCapNhat: number }> {
    if (this.isRunning) {
      this.logger.warn('Tác vụ cập nhật điểm thịnh hành đang chạy dở, bỏ qua chu kỳ này.');
      return { soLuongCapNhat: 0 };
    }

    this.isRunning = true;
    let soLuongCapNhat = 0;

    try {
      const apps = await this.prisma.ungDung.findMany({
        where: { trangThai: 'HOAT_DONG' },
        select: {
          maUngDung: true,
          soSaoGithub: true,
          dongBoLanCuoi: true,
          danhSachPhatHanh: {
            orderBy: { ngayPhatHanh: 'desc' },
            take: 1,
            select: { ngayPhatHanh: true },
          },
        },
      });

      this.logger.log(
        `Tìm thấy ${apps.length} ứng dụng đang hoạt động cần tính lại điểm thịnh hành.`,
      );

      const now = Date.now();

      for (const app of apps) {
        const sao = app.soSaoGithub || 0;
        const banMoi = app.danhSachPhatHanh[0];
        const thoiGianGoc = banMoi?.ngayPhatHanh
          ? new Date(banMoi.ngayPhatHanh).getTime()
          : app.dongBoLanCuoi
            ? new Date(app.dongBoLanCuoi).getTime()
            : now;

        const soNgay = Math.max(0, (now - thoiGianGoc) / (1000 * 60 * 60 * 24));
        let heSoThuongBanMoi = 1.0;
        if (soNgay <= 7) {
          heSoThuongBanMoi = 1.0 + 0.3 * (1 - soNgay / 7);
        }

        const diemThinhHanh = (Math.log10(sao + 1) / Math.pow(soNgay + 2, 1.5)) * heSoThuongBanMoi;

        await this.prisma.ungDung.update({
          where: { maUngDung: app.maUngDung },
          data: { diemThinhHanh },
        });

        soLuongCapNhat++;
      }

      // Xóa cache danh sách app để người dùng thấy thứ tự mới ngay lập tức
      await this.cacheService.xoaTheoPrefix('fs:apps:list:');

      this.logger.log(`Hoàn tất cập nhật suy giảm điểm thịnh hành cho ${soLuongCapNhat} ứng dụng.`);
    } catch (error) {
      this.logger.error('Lỗi khi cập nhật suy giảm điểm thịnh hành:', error);
    } finally {
      this.isRunning = false;
    }

    return { soLuongCapNhat };
  }
}

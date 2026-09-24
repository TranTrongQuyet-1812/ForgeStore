import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { AppsService } from '../apps.service';

@Injectable()
export class ReleaseScannerJob {
  private readonly logger = new Logger(ReleaseScannerJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly appsService: AppsService,
  ) {}

  /**
   * Tác vụ nền định kỳ quét kiểm tra bản phát hành mới (P2-25).
   * Chạy mỗi 2 giờ một lần (hoặc có thể kích hoạt thủ công qua scanReleases).
   */
  @Cron(CronExpression.EVERY_2_HOURS)
  async handleCron(): Promise<void> {
    this.logger.log('Bắt đầu chu kỳ quét Release định kỳ...');
    await this.scanReleases(10);
  }

  /**
   * Quét các ứng dụng trong CSDL để tìm bản phát hành mới.
   * Ưu tiên các ứng dụng đang có người dùng cài đặt hoặc yêu thích (P2-25.2).
   *
   * @param batchSize Giới hạn số repo quét mỗi lần để tiết kiệm hạn mức API (P2-25.3)
   */
  async scanReleases(batchSize = 10): Promise<{
    soRepoDaQuet: number;
    soReleaseMoi: number;
    quotaConLai: number | null;
  }> {
    if (this.isRunning) {
      this.logger.warn('Tác vụ quét Release đang chạy dở, bỏ qua chu kỳ này.');
      return { soRepoDaQuet: 0, soReleaseMoi: 0, quotaConLai: null };
    }

    this.isRunning = true;
    let soRepoDaQuet = 0;
    let soReleaseMoi = 0;

    try {
      // 1. Tìm các ứng dụng được cài đặt hoặc yêu thích nhiều nhất
      const uuTienApps = await this.prisma.ungDung.findMany({
        where: {
          trangThai: 'HOAT_DONG',
          OR: [{ danhSachDaCai: { some: {} } }, { danhSachYeuThich: { some: {} } }],
        },
        orderBy: { dongBoLanCuoi: 'asc' }, // Quét những app lâu chưa đồng bộ trước
        take: batchSize,
        include: {
          danhSachPhatHanh: {
            orderBy: { ngayPhatHanh: 'desc' },
            take: 1,
            select: { tenPhienBan: true },
          },
        },
      });

      // Nếu số lượng app ưu tiên chưa đủ batchSize, bổ sung thêm các app khác
      let danhSachCanQuet = [...uuTienApps];
      if (danhSachCanQuet.length < batchSize) {
        const remainingSlots = batchSize - danhSachCanQuet.length;
        const appIdsDaChon = danhSachCanQuet.map((a) => a.maUngDung);

        const otherApps = await this.prisma.ungDung.findMany({
          where: {
            trangThai: 'HOAT_DONG',
            maUngDung: { notIn: appIdsDaChon },
          },
          orderBy: { dongBoLanCuoi: 'asc' },
          take: remainingSlots,
          include: {
            danhSachPhatHanh: {
              orderBy: { ngayPhatHanh: 'desc' },
              take: 1,
              select: { tenPhienBan: true },
            },
          },
        });

        danhSachCanQuet = danhSachCanQuet.concat(otherApps);
      }

      this.logger.log(`Số lượng ứng dụng đưa vào hàng đợi kiểm tra: ${danhSachCanQuet.length}`);

      // 2. Lần lượt kiểm tra Release mới qua GitHub Facade (ETag bảo vệ)
      for (const app of danhSachCanQuet) {
        try {
          const [owner, repo] = app.tenRepoDayDu.split('/');
          if (!owner || !repo) continue;

          soRepoDaQuet++;

          // Lấy release mới nhất từ GitHub
          const latestRelease = await this.githubService.layReleaseMoiNhat(owner, repo);
          if (!latestRelease) continue;

          const currentLatestVersion = app.danhSachPhatHanh[0]?.tenPhienBan;

          // Nếu có release mới khác với phiên bản cao nhất hiện có trong DB
          if (latestRelease.tag_name !== currentLatestVersion) {
            this.logger.log(
              `✨ Phát hiện bản phát hành mới cho [${app.tenRepoDayDu}]: ${latestRelease.tag_name} (bản cũ: ${currentLatestVersion || 'chưa có'})`,
            );

            // Đồng bộ toàn diện phiên bản mới vào DB
            await this.appsService.dongBoRepo(owner, repo);
            soReleaseMoi++;
          }
        } catch (err: unknown) {
          this.logger.warn(`Lỗi khi quét release cho [${app.tenRepoDayDu}]: ${String(err)}`);
        }
      }

      const rateLimitInfo = this.githubService.getRateLimitInfo();

      this.logger.log(
        `🏁 [Release Scanner Hoàn Tất] Đã quét: ${soRepoDaQuet} repos, Bản mới phát hiện: ${soReleaseMoi}, Quota API còn lại: ${
          rateLimitInfo.remaining ?? 'N/A'
        }/${rateLimitInfo.limit ?? 'N/A'}`,
      );

      return {
        soRepoDaQuet,
        soReleaseMoi,
        quotaConLai: rateLimitInfo.remaining,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

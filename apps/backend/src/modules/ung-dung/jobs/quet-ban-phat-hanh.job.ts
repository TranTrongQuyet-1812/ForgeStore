import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { CacheService } from '../../redis/cache.service';
import { UngDungService } from '../ung-dung.service';

type AppCanQuet = {
  maUngDung: string;
  tenRepoDayDu: string;
  daLuuTru: boolean;
  danhSachPhatHanh: Array<{ tenPhienBan: string }>;
};

@Injectable()
export class QuetBanPhatHanhJob {
  private readonly khoaConTroUuTien = 'fs:jobs:release-scan:priority-cursor';
  private readonly khoaConTroThuong = 'fs:jobs:release-scan:regular-cursor';
  private readonly logger = new Logger(QuetBanPhatHanhJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly appsService: UngDungService,
    private readonly cacheService: CacheService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /**
   * Tác vụ nền định kỳ quét kiểm tra bản phát hành mới (P2-25).
   * Chạy mỗi 2 giờ một lần (hoặc có thể kích hoạt thủ công qua scanReleases).
   */
  @Cron(CronExpression.EVERY_2_HOURS)
  async handleCron(): Promise<void> {
    // P3B-07.1: khi bật bộ theo dõi thay đổi bằng ETag thì job cũ đứng ngoài để không quét trùng
    if (this.config?.get<boolean>('INGESTION_WATCH_ENABLED', false)) return;
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
      // Chừa nửa batch cho ứng dụng được cài/yêu thích, để nhóm này không chặn nhóm còn lại.
      const soUuTien = Math.floor(batchSize / 2);
      const uuTienApps = await this.layRepoTheoConTro(
        {
          trangThai: 'HOAT_DONG',
          OR: [{ danhSachDaCai: { some: {} } }, { danhSachYeuThich: { some: {} } }],
        },
        this.khoaConTroUuTien,
        soUuTien,
      );

      // Luân phiên cả nhóm thường và loại trừ repo ưu tiên đã lấy ở nửa batch đầu.
      const appIdsDaChon = uuTienApps.map((app) => app.maUngDung);
      const otherApps = await this.layRepoTheoConTro(
        {
          AND: [
            {
              trangThai: 'HOAT_DONG',
              maUngDung: { notIn: appIdsDaChon },
            },
          ],
        },
        this.khoaConTroThuong,
        batchSize - uuTienApps.length,
      );
      const danhSachCanQuet = [...uuTienApps, ...otherApps];

      this.logger.log(`Số lượng ứng dụng đưa vào hàng đợi kiểm tra: ${danhSachCanQuet.length}`);

      // 2. Lần lượt kiểm tra Release mới qua GitHub Facade (ETag bảo vệ)
      for (const app of danhSachCanQuet) {
        const khoaConTro = appIdsDaChon.includes(app.maUngDung)
          ? this.khoaConTroUuTien
          : this.khoaConTroThuong;
        // Repo bị cắt ngang vì Rate Limit chưa quét xong nên không được tiến con trỏ qua nó.
        let giuConTro = false;
        try {
          const [owner, repo] = app.tenRepoDayDu.split('/');
          if (!owner || !repo) continue;

          soRepoDaQuet++;

          try {
            const repoInfo = await this.githubService.layRepo(owner, repo);
            const daLuuTru = Boolean(repoInfo.archived);
            if (Boolean(app.daLuuTru) !== daLuuTru) {
              await this.prisma.ungDung.update({
                where: { maUngDung: app.maUngDung },
                data: { daLuuTru },
              });
              await this.cacheService.xoaTheoPrefix('fs:apps:list:');
              await this.cacheService.xoaTheoPrefix('fs:apps:detail:');
            }
          } catch (err) {
            this.logger.warn(
              `Không cập nhật được cờ lưu trữ [${app.tenRepoDayDu}]: ${String(err)}`,
            );
          }

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
          const errMsg = String(err);
          this.logger.warn(`Lỗi khi quét release cho [${app.tenRepoDayDu}]: ${errMsg}`);
          // ARCH-05: Circuit Breaker - Ngắt ngay vòng lặp nếu bị GitHub Rate Limit (403/429) chống spam
          if (
            errMsg.includes('403') ||
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('rate limit')
          ) {
            this.logger.error(
              '🚨 GitHub Rate Limit Exceeded (403/429)! Dừng quét ngay để bảo vệ IP và Token.',
            );
            giuConTro = true;
            break;
          }
        } finally {
          // Chỉ tiến con trỏ tới repo đã xử lý xong để lần chạy sau tiếp tục luân phiên ổn định.
          if (!giuConTro) await this.cacheService.luu(khoaConTro, app.maUngDung, 31536000);
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

  private async layRepoTheoConTro(
    where: Prisma.UngDungWhereInput,
    khoaConTro: string,
    gioiHan: number,
  ): Promise<AppCanQuet[]> {
    if (gioiHan <= 0) return [];
    const conTro = await this.cacheService.lay<string>(khoaConTro);
    const apps = await this.timVongRepo(where, conTro, gioiHan);
    return apps;
  }

  private async timVongRepo(
    where: Prisma.UngDungWhereInput,
    conTro: string | null,
    gioiHan: number,
  ): Promise<AppCanQuet[]> {
    const dieuKien = conTro ? { AND: [where, { maUngDung: { gt: conTro } }] } : where;
    const ketQua = await this.prisma.ungDung.findMany({
      where: dieuKien,
      orderBy: { maUngDung: 'asc' },
      take: gioiHan,
      include: {
        danhSachPhatHanh: {
          orderBy: { ngayPhatHanh: 'desc' },
          take: 1,
          select: { tenPhienBan: true },
        },
      },
    });
    if (ketQua.length === gioiHan || !conTro) return ketQua;
    return this.timRepoDauVong(where, conTro, gioiHan, ketQua);
  }

  private async timRepoDauVong(
    where: Prisma.UngDungWhereInput,
    conTro: string,
    gioiHan: number,
    daLay: AppCanQuet[],
  ): Promise<AppCanQuet[]> {
    const maDaLay = daLay.map((app) => app.maUngDung);
    const ketQua = await this.prisma.ungDung.findMany({
      where: {
        AND: [where, { maUngDung: { lte: conTro } }, { maUngDung: { notIn: maDaLay } }],
      },
      orderBy: { maUngDung: 'asc' },
      take: gioiHan - daLay.length,
      include: {
        danhSachPhatHanh: {
          orderBy: { ngayPhatHanh: 'desc' },
          take: 1,
          select: { tenPhienBan: true },
        },
      },
    });
    return [...daLay, ...ketQua];
  }
}

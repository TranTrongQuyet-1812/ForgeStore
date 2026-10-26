import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DayChuyenNapRepoService } from '../services/day-chuyen-nap-repo.service';

@Injectable()
export class NapRepoJob {
  private readonly logger = new Logger(NapRepoJob.name);

  constructor(private readonly pipelineService: DayChuyenNapRepoService) {}

  /**
   * Tác vụ định kỳ mỗi giờ: chạy dây chuyền nạp lô nhỏ và dịch nền (P3B-06 & P3B-05.4)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    this.logger.log('Bắt đầu chu kỳ nạp repo và dịch nền định kỳ...');
    await this.chayChuKyDinhKy();
  }

  /**
   * Thực thi chu kỳ nạp định kỳ
   */
  async chayChuKyDinhKy(force = false): Promise<{
    ketQuaNap: Awaited<ReturnType<DayChuyenNapRepoService['sangLocVaNapLauNho']>>;
    ketQuaDich: Awaited<ReturnType<DayChuyenNapRepoService['dichNenTheoNganSachNgay']>>;
  }> {
    // Chốt chặn 1 từ Claude: Công tắc tắt toàn diện.
    // Nếu INGESTION_ENABLED=false và không force, không chạy bất kỳ tác vụ nào (kể cả AI dịch nền)
    if (!this.pipelineService.isIngestionEnabled() && !force) {
      this.logger.log(
        'Dây chuyền nạp và dịch nền đang tắt (INGESTION_ENABLED=false). Bỏ qua chu kỳ định kỳ.',
      );
      return {
        ketQuaNap: {
          daNhayQua: true,
          lyDo: 'ingestion_disabled',
          soLuongUngVienQuet: 0,
          soLuongDaNap: 0,
          soLuongBiLoai: 0,
          chiTietBiLoai: {},
          rateLimitConLai: null,
        },
        ketQuaDich: {
          daDichMoTa: 0,
          daDichReadme: 0,
          nganSachConLai: 0,
        },
      };
    }

    // 1. Tự động nạp danh sách hạt giống nếu kho ứng viên còn ít
    await this.pipelineService.khamPhaUngVien();

    // 2. Sàng lọc và nạp một lô nhỏ
    const ketQuaNap = await this.pipelineService.sangLocVaNapLauNho(undefined, force);

    // 3. Dịch nền theo ngân sách ngày (chống bão AI)
    const ketQuaDich = await this.pipelineService.dichNenTheoNganSachNgay(undefined, force);

    return { ketQuaNap, ketQuaDich };
  }
}

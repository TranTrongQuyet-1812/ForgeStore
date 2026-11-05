import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheService } from '../../redis/cache.service';
import { TheoDoiThayDoiService } from '../services/theo-doi-thay-doi.service';

/**
 * Job theo dõi thay đổi (P3B-07.7): 10 phút một lượt, tách riêng khỏi luồng khám phá và có công tắc riêng
 * `INGESTION_WATCH_ENABLED`. Khóa Redis để hai bản backend không quét trùng.
 */
@Injectable()
export class TheoDoiThayDoiJob {
  private readonly logger = new Logger(TheoDoiThayDoiJob.name);
  public static readonly KHOA = 'fs:watch:lock';

  constructor(
    private readonly theoDoi: TheoDoiThayDoiService,
    private readonly cacheService: CacheService,
  ) {}

  @Cron('0 */10 * * * *')
  async handleCron(): Promise<void> {
    if (!this.theoDoi.dangBat()) return;
    try {
      await this.cacheService.withLock(TheoDoiThayDoiJob.KHOA, 15 * 60 * 1000, () =>
        this.theoDoi.quetMotLuot(),
      );
    } catch (err) {
      if (!String(err).includes('đang bị khóa'))
        this.logger.error('Lượt theo dõi thay đổi lỗi:', err);
    }
  }
}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';
import { AiModule } from '../ai/ai.module';
import { YeuThichModule } from '../yeu-thich/yeu-thich.module';
import { UngDungController } from './ung-dung.controller';
import { AiQuanTriController } from './controllers/ai-quan-tri.controller';
import { TimKiemController } from './controllers/tim-kiem.controller';
import { KhoChuaController } from './controllers/kho-chua.controller';
import { DanhMucController } from './controllers/danh-muc.controller';
import { UngDungService } from './ung-dung.service';
import { QuetBanPhatHanhJob } from './jobs/quet-ban-phat-hanh.job';
import { SuyGiamThinhHanhJob } from './jobs/suy-giam-thinh-hanh.job';
import { DayChuyenNapRepoService } from './services/day-chuyen-nap-repo.service';
import { NapRepoJob } from './jobs/nap-repo.job';
import { KiemNhatQuanHienThiJob } from './jobs/kiem-nhat-quan-hien-thi.job';
import { KhamPhaRepoService } from './services/kham-pha-repo.service';
import { TheoDoiThayDoiService } from './services/theo-doi-thay-doi.service';
import { TheoDoiThayDoiJob } from './jobs/theo-doi-thay-doi.job';
import { ThongKeNapRepoService } from './services/thong-ke-nap-repo.service';

@Module({
  imports: [PrismaModule, RedisModule, GithubModule, AiModule, YeuThichModule],
  controllers: [
    UngDungController,
    AiQuanTriController,
    TimKiemController,
    KhoChuaController,
    DanhMucController,
  ],
  providers: [
    UngDungService,
    QuetBanPhatHanhJob,
    SuyGiamThinhHanhJob,
    DayChuyenNapRepoService,
    NapRepoJob,
    KiemNhatQuanHienThiJob,
    KhamPhaRepoService,
    TheoDoiThayDoiService,
    TheoDoiThayDoiJob,
    ThongKeNapRepoService,
  ],
  exports: [
    UngDungService,
    QuetBanPhatHanhJob,
    SuyGiamThinhHanhJob,
    DayChuyenNapRepoService,
    NapRepoJob,
    KiemNhatQuanHienThiJob,
  ],
})
export class UngDungModule {}

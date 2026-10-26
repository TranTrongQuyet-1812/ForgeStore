import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';
import { AiModule } from '../ai/ai.module';
import { FavoritesModule } from '../yeu-thich/yeu-thich.module';
import { AppsController } from './ung-dung.controller';
import { AiAdminController } from './controllers/ai-quan-tri.controller';
import { SearchController } from './controllers/tim-kiem.controller';
import { ReposController } from './controllers/kho-chua.controller';
import { CategoriesController } from './controllers/danh-muc.controller';
import { AppsService } from './ung-dung.service';
import { ReleaseScannerJob } from './jobs/quet-ban-phat-hanh.job';
import { TrendingDecayJob } from './jobs/suy-giam-thinh-hanh.job';
import { RepoIngestionPipelineService } from './services/day-chuyen-nap-repo.service';
import { RepoIngestionJob } from './jobs/nap-repo.job';

@Module({
  imports: [PrismaModule, RedisModule, GithubModule, AiModule, FavoritesModule],
  controllers: [
    AppsController,
    AiAdminController,
    SearchController,
    ReposController,
    CategoriesController,
  ],
  providers: [
    AppsService,
    ReleaseScannerJob,
    TrendingDecayJob,
    RepoIngestionPipelineService,
    RepoIngestionJob,
  ],
  exports: [
    AppsService,
    ReleaseScannerJob,
    TrendingDecayJob,
    RepoIngestionPipelineService,
    RepoIngestionJob,
  ],
})
export class AppsModule {}

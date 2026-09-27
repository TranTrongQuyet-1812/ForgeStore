import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';
import { AiModule } from '../ai/ai.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { AppsController } from './apps.controller';
import { AiAdminController } from './controllers/ai-admin.controller';
import { SearchController } from './controllers/search.controller';
import { ReposController } from './controllers/repos.controller';
import { CategoriesController } from './controllers/categories.controller';
import { AppsService } from './apps.service';
import { ReleaseScannerJob } from './jobs/release-scanner.job';

@Module({
  imports: [PrismaModule, RedisModule, GithubModule, AiModule, FavoritesModule],
  controllers: [
    AppsController,
    AiAdminController,
    SearchController,
    ReposController,
    CategoriesController,
  ],
  providers: [AppsService, ReleaseScannerJob],
  exports: [AppsService, ReleaseScannerJob],
})
export class AppsModule {}

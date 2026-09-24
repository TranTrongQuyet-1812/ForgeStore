import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { ReleaseScannerJob } from './jobs/release-scanner.job';

@Module({
  imports: [PrismaModule, RedisModule, GithubModule],
  controllers: [AppsController],
  providers: [AppsService, ReleaseScannerJob],
  exports: [AppsService, ReleaseScannerJob],
})
export class AppsModule {}

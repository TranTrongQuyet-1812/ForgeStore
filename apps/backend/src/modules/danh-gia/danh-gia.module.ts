import { Module } from '@nestjs/common';
import { ReviewsController } from './danh-gia.controller';
import { ReviewsService } from './danh-gia.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}

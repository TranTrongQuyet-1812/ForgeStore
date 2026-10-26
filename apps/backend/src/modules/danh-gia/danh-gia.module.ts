import { Module } from '@nestjs/common';
import { DanhGiaController } from './danh-gia.controller';
import { DanhGiaService } from './danh-gia.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [DanhGiaController],
  providers: [DanhGiaService],
  exports: [DanhGiaService],
})
export class DanhGiaModule {}

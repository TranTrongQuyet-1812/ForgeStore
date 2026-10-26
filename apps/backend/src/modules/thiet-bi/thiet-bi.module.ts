import { Module } from '@nestjs/common';
import { ThietBiService } from './thiet-bi.service';
import { ThietBiController } from './thiet-bi.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [ThietBiController],
  providers: [ThietBiService],
  exports: [ThietBiService],
})
export class ThietBiModule {}

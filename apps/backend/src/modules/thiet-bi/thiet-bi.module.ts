import { Module } from '@nestjs/common';
import { DevicesService } from './thiet-bi.service';
import { DevicesController } from './thiet-bi.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}

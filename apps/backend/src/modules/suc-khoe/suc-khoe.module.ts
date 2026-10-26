import { Module } from '@nestjs/common';
import { HealthController } from './suc-khoe.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}

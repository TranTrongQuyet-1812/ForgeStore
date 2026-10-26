import { Module } from '@nestjs/common';
import { SucKhoeController } from './suc-khoe.controller';

@Module({
  controllers: [SucKhoeController],
})
export class SucKhoeModule {}

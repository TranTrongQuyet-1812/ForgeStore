import { Module } from '@nestjs/common';
import { YeuThichService } from './yeu-thich.service';
import { YeuThichController } from './yeu-thich.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [YeuThichController],
  providers: [YeuThichService],
  exports: [YeuThichService],
})
export class YeuThichModule {}

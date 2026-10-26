import { Module } from '@nestjs/common';
import { CapNhatService } from './cap-nhat.service';
import { CapNhatController } from './cap-nhat.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CapNhatController],
  providers: [CapNhatService],
  exports: [CapNhatService],
})
export class CapNhatModule {}

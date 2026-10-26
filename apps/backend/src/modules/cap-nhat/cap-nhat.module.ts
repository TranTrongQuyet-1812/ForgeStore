import { Module } from '@nestjs/common';
import { UpdaterService } from './cap-nhat.service';
import { UpdaterController } from './cap-nhat.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UpdaterController],
  providers: [UpdaterService],
  exports: [UpdaterService],
})
export class UpdaterModule {}

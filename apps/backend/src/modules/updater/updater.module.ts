import { Module } from '@nestjs/common';
import { UpdaterService } from './updater.service';
import { UpdaterController } from './updater.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UpdaterController],
  providers: [UpdaterService],
  exports: [UpdaterService],
})
export class UpdaterModule {}

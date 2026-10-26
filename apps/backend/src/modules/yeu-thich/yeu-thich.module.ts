import { Module } from '@nestjs/common';
import { FavoritesService } from './yeu-thich.service';
import { FavoritesController } from './yeu-thich.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}

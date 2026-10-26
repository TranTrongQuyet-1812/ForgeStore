import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { validateEnv } from './common/config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/suc-khoe/suc-khoe.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DevicesModule } from './modules/thiet-bi/thiet-bi.module';
import { AuthModule } from './modules/xac-thuc/xac-thuc.module';
import { GithubModule } from './modules/github/github.module';
import { AppsModule } from './modules/ung-dung/ung-dung.module';
import { AiModule } from './modules/ai/ai.module';
import { FavoritesModule } from './modules/yeu-thich/yeu-thich.module';
import { UpdaterModule } from './modules/cap-nhat/cap-nhat.module';
import { ReviewsModule } from './modules/danh-gia/danh-gia.module';
import { JwtAuthGuard } from './modules/xac-thuc/guards/jwt-auth.guard';
import { RolesGuard } from './modules/xac-thuc/guards/roles.guard';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 giây
        limit: 100, // 100 requests per minute
      },
    ]),
    PrismaModule,
    RedisModule,
    HealthModule,
    DevicesModule,
    AuthModule,
    GithubModule,
    AppsModule,
    AiModule,
    FavoritesModule,
    UpdaterModule,
    ReviewsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

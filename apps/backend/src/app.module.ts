import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { validateEnv } from './common/config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { SucKhoeModule } from './modules/suc-khoe/suc-khoe.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThietBiModule } from './modules/thiet-bi/thiet-bi.module';
import { XacThucModule } from './modules/xac-thuc/xac-thuc.module';
import { GithubModule } from './modules/github/github.module';
import { UngDungModule } from './modules/ung-dung/ung-dung.module';
import { AiModule } from './modules/ai/ai.module';
import { YeuThichModule } from './modules/yeu-thich/yeu-thich.module';
import { CapNhatModule } from './modules/cap-nhat/cap-nhat.module';
import { DanhGiaModule } from './modules/danh-gia/danh-gia.module';
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
        limit: 100, // Giới hạn 100 yêu cầu mỗi phút
      },
    ]),
    PrismaModule,
    RedisModule,
    SucKhoeModule,
    ThietBiModule,
    XacThucModule,
    GithubModule,
    // Phải đứng trước UngDungModule: Nest đăng ký route theo thứ tự module, và GET `ung-dung/:owner/:repo`
    // của UngDungModule sẽ nuốt GET `ung-dung/:id/danh-gia` nếu được đăng ký trước (trả 404 cho mọi app)
    DanhGiaModule,
    UngDungModule,
    AiModule,
    YeuThichModule,
    CapNhatModule,
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

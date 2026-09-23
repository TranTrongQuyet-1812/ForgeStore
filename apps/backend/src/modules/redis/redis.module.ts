import { Global, Module, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');

        const redis = new Redis(redisUrl, {
          lazyConnect: false,
          enableOfflineQueue: false,
          commandTimeout: 300,
          connectTimeout: 1000,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => {
            const delay = Math.min(times * 200, 3000);
            logger.warn(`Đang thử kết nối lại Redis lần ${times} sau ${delay}ms...`);
            return delay;
          },
        });

        redis.on('connect', async () => {
          logger.log(`✅ Kết nối thành công Redis Swarm!`);

          // P2-05.5: Cấu hình giới hạn bộ nhớ 256MB và chính sách dọn dẹp LRU
          try {
            await redis.config('SET', 'maxmemory', '256mb');
            await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
            logger.log(
              '⚙️ Đã áp dụng cấu hình Redis: maxmemory=256mb, maxmemory-policy=allkeys-lru',
            );
          } catch (cfgErr) {
            logger.warn(
              `Không thể cấu hình tự động maxmemory (có thể do quyền hạn Redis): ${(cfgErr as Error).message}`,
            );
          }
        });

        redis.on('error', (err) => {
          logger.error(`Lỗi kết nối Redis: ${err.message}`);
        });

        return redis;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  onApplicationShutdown() {
    this.logger.log('Đang đóng kết nối Redis client...');
  }
}

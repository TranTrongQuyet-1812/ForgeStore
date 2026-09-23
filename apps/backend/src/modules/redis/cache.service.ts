import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Lấy giá trị từ Cache theo Key.
   * Nếu Redis mất kết nối hoặc lỗi, trả về null để caller truy vấn trực tiếp DB.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn(
        `Lỗi đọc cache key [${key}], chuyển tiếp truy vấn: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Lưu giá trị vào Cache kèm TTL (giây).
   * Bắt lỗi an toàn nếu Redis không phản hồi.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(`Lỗi ghi cache key [${key}]: ${(error as Error).message}`);
    }
  }

  /**
   * Xóa một hoặc nhiều Key khỏi Cache.
   */
  async del(keys: string | string[]): Promise<void> {
    try {
      const keyList = Array.isArray(keys) ? keys : [keys];
      if (keyList.length > 0) {
        await this.redisClient.del(...keyList);
      }
    } catch (error) {
      this.logger.warn(`Lỗi xóa cache key: ${(error as Error).message}`);
    }
  }

  /**
   * Lazy Cache Pattern: Đọc từ cache trước, nếu miss thì gọi fetcher và lưu kết quả.
   * Nếu Redis sập, gọi thẳng fetcher mà KHÔNG ném lỗi 500.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetcher();
    if (freshData !== undefined && freshData !== null) {
      await this.set(key, freshData, ttlSeconds);
    }
    return freshData;
  }

  /**
   * Distributed Lock phân tán dùng SET key token NX PX ttlMs (P2-05.3, P2-31).
   * Đảm bảo chỉ 1 tác vụ được thực thi đồng thời trên cùng một tài nguyên.
   */
  async withLock<T>(key: string, ttlMs: number, action: () => Promise<T>): Promise<T> {
    const lockToken = randomUUID();
    const lockKey = key.startsWith('fs:lock:') ? key : `fs:lock:${key}`;

    let acquired = false;
    try {
      const result = await this.redisClient.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
      acquired = result === 'OK';
    } catch (error) {
      this.logger.warn(
        `Không thể lấy khóa Redis [${lockKey}], cho phép thực thi fallback: ${(error as Error).message}`,
      );
      return await action();
    }

    if (!acquired) {
      throw new Error(
        `Tài nguyên [${key}] đang bị khóa bởi tiến trình khác. Vui lòng thử lại sau.`,
      );
    }

    try {
      return await action();
    } finally {
      // Giải phóng khóa an toàn bằng Lua script (chỉ xóa nếu đúng lockToken của mình)
      try {
        const releaseScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await this.redisClient.eval(releaseScript, 1, lockKey, lockToken);
      } catch (releaseError) {
        this.logger.warn(`Lỗi giải phóng khóa [${lockKey}]: ${(releaseError as Error).message}`);
      }
    }
  }

  /**
   * Health check nhanh Redis PING
   */
  async ping(): Promise<boolean> {
    try {
      const res = await this.redisClient.ping();
      return res === 'PONG';
    } catch (error) {
      this.logger.warn(`Kiểm tra Redis ping thất bại: ${(error as Error).message}`);
      return false;
    }
  }
}

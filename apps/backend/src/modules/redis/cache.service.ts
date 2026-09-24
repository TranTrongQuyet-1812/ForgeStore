import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from './redis.constants';

interface MemoryCacheEntry {
  data: string;
  expiresAt: number; // Unix timestamp in ms
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  // Giới hạn số lượng key tối đa trong RAM để chống tràn bộ nhớ khi Redis offline kéo dài (Điểm C)
  public static readonly GIOI_HAN_KEY_BO_NHO = 1000;

  // In-Memory Fallback Map phục vụ kịch bản Redis offline / Demo tại trường (D-05)
  private readonly memoryFallback = new Map<string, MemoryCacheEntry>();

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Helper: Dọn dẹp key hết hạn trong memory fallback để tránh rò rỉ bộ nhớ.
   */
  private cleanExpiredMemoryKeys(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryFallback.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryFallback.delete(key);
      }
    }
  }

  /**
   * Lấy số lượng key hiện tại trong bộ nhớ dự phòng (phục vụ kiểm thử & giám sát).
   */
  laySoLuongKeyFallback(): number {
    this.cleanExpiredMemoryKeys();
    return this.memoryFallback.size;
  }

  /**
   * Lấy giá trị từ Cache theo Key.
   * Nếu Redis mất kết nối hoặc lỗi, tự động fallback đọc từ Memory Store (D-05).
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (error) {
      this.logger.warn(
        `Lỗi đọc cache key [${key}], chuyển tiếp sang memory fallback: ${(error as Error).message}`,
      );
    }

    // In-memory fallback
    const memEntry = this.memoryFallback.get(key);
    if (memEntry) {
      if (memEntry.expiresAt > Date.now()) {
        try {
          return JSON.parse(memEntry.data) as T;
        } catch {
          return null;
        }
      }
      this.memoryFallback.delete(key);
    }

    return null;
  }

  /**
   * Lưu giá trị vào Cache kèm TTL (giây).
   * Tự động lưu vào Memory Store nếu Redis không phản hồi (D-05).
   * Điểm C: Giới hạn tối đa 1.000 key trong RAM, tự động giải phóng key cũ nhất khi đầy.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    let redisSuccess = false;

    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, serialized);
      }
      redisSuccess = true;
    } catch (error) {
      this.logger.warn(`Lỗi ghi cache key [${key}]: ${(error as Error).message}`);
    }

    // Nếu Redis ghi thất bại hoặc để đảm bảo fallback luôn có dữ liệu khi Redis sập giữa chừng:
    if (!redisSuccess) {
      this.cleanExpiredMemoryKeys();

      // Điểm C: Kiểm soát trần bộ nhớ RAM. Nếu đầy trần 1.000 key, xóa key cũ nhất (FIFO eviction)
      if (
        !this.memoryFallback.has(key) &&
        this.memoryFallback.size >= CacheService.GIOI_HAN_KEY_BO_NHO
      ) {
        const oldestKey = this.memoryFallback.keys().next().value;
        if (oldestKey) {
          this.memoryFallback.delete(oldestKey);
        }
      }

      const effectiveTtl = ttlSeconds !== undefined ? ttlSeconds : 3600;
      const expiresAt = Date.now() + effectiveTtl * 1000;
      this.memoryFallback.set(key, { data: serialized, expiresAt });
      this.logger.log(`Đã lưu key [${key}] vào In-Memory Fallback Map (TTL ${effectiveTtl}s)`);
    }
  }

  /**
   * Lấy và xóa giá trị nguyên tử (Atomic GETDEL, Redis >= 6.2).
   * Điểm 3 & Điểm 4: Ngăn chặn triệt để race condition khi đổi mã và hỗ trợ fallback in-memory khi Redis sập.
   */
  async layVaXoa<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redisClient.getdel(key);
      if (data) {
        this.memoryFallback.delete(key);
        return JSON.parse(data) as T;
      }
    } catch (error) {
      this.logger.warn(
        `Lỗi GETDEL key [${key}], chuyển sang In-Memory Fallback: ${(error as Error).message}`,
      );
    }

    // Fallback nguyên tử trong Single Thread Node.js Event Loop
    const memEntry = this.memoryFallback.get(key);
    if (!memEntry) {
      return null;
    }

    // Xóa ngay lập tức (Atomic in event loop)
    this.memoryFallback.delete(key);

    if (memEntry.expiresAt <= Date.now()) {
      return null;
    }

    try {
      return JSON.parse(memEntry.data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Xóa một hoặc nhiều Key khỏi Cache.
   */
  async del(keys: string | string[]): Promise<void> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    if (keyList.length === 0) return;

    try {
      await this.redisClient.del(...keyList);
    } catch (error) {
      this.logger.warn(`Lỗi xóa cache key: ${(error as Error).message}`);
    }

    for (const key of keyList) {
      this.memoryFallback.delete(key);
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

  // =============================================================
  // CÁC HÀM BÍ DANH TIẾNG VIỆT (TƯƠNG THÍCH ĐẶC TẢ THUẦN VIỆT)
  // =============================================================

  /**
   * Đọc giá trị từ Cache (Bí danh tiếng Việt của get)
   */
  async lay<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  /**
   * Lưu giá trị vào Cache kèm TTL giây (Bí danh tiếng Việt của set)
   */
  async luu<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.set<T>(key, value, ttlSeconds);
  }

  /**
   * Xóa một hoặc nhiều Key (Bí danh tiếng Việt của del)
   */
  async xoa(keys: string | string[]): Promise<void> {
    return this.del(keys);
  }

  /**
   * Xóa tất cả các Key bắt đầu bằng một tiền tố (prefix) nhất định.
   * Dùng để dọn dẹp cache danh sách (VD: fs:apps:list:*) khi có app mới đồng bộ.
   */
  async xoaTheoPrefix(prefix: string): Promise<void> {
    try {
      // Dùng SCAN để tìm key an toàn mà không chặn Redis Event Loop
      let cursor = '0';
      do {
        const [nextCursor, matchingKeys] = await this.redisClient.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (matchingKeys.length > 0) {
          await this.redisClient.del(...matchingKeys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Lỗi xóa key theo prefix [${prefix}]: ${(error as Error).message}`);
    }

    // Dọn dẹp cả trong In-Memory Fallback Map
    for (const key of this.memoryFallback.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryFallback.delete(key);
      }
    }
  }
}

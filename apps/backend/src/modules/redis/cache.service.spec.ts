import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from './cache.service';
import { Redis } from 'ioredis';

type MockFn = ReturnType<typeof vi.fn>;

interface MockRedis {
  get: MockFn;
  set: MockFn;
  del: MockFn;
  getdel: MockFn;
  ping: MockFn;
}

describe('CacheService (Resilience & Atomic GETDEL)', () => {
  let service: CacheService;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      getdel: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
    };

    service = new CacheService(mockRedis as unknown as Redis);
  });

  describe('layVaXoa (Atomic GETDEL)', () => {
    it('lấy và xóa giá trị nguyên tử thành công từ Redis', async () => {
      mockRedis.getdel.mockResolvedValue(JSON.stringify({ code: 'test-123' }));

      const result = await service.layVaXoa<{ code: string }>('fs:auth:exchange:123');

      expect(result).toEqual({ code: 'test-123' });
      expect(mockRedis.getdel).toHaveBeenCalledWith('fs:auth:exchange:123');
    });

    it('Điểm 3 & 4: Fallback In-Memory khi Redis sập — lấy và xóa nguyên tử từ memory map', async () => {
      // Giả lập Redis sập: set ném lỗi
      mockRedis.set.mockRejectedValue(new Error('Connection refused'));
      mockRedis.getdel.mockRejectedValue(new Error('Connection refused'));

      // Lưu giá trị vào cache (sẽ tự động fallback vào Memory Map)
      await service.set('fs:auth:state:456', { challenge: 'pkce-challenge' }, 60);

      // Lần 1: Lấy và xóa nguyên tử từ Memory Fallback
      const res1 = await service.layVaXoa<{ challenge: string }>('fs:auth:state:456');
      expect(res1).toEqual({ challenge: 'pkce-challenge' });

      // Lần 2: Lấy lại cùng key -> Phải trả về null (vì đã bị xóa ở lần 1, chống replay attack)
      const res2 = await service.layVaXoa<{ challenge: string }>('fs:auth:state:456');
      expect(res2).toBeNull();
    });
  });

  describe('In-Memory Fallback Map (D-05 Offline Demo)', () => {
    it('đọc và ghi bình thường qua In-Memory khi Redis hoàn toàn offline', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis is down'));
      mockRedis.get.mockRejectedValue(new Error('Redis is down'));

      await service.set('test:key', { data: 'hello' }, 10);
      const val = await service.get<{ data: string }>('test:key');

      expect(val).toEqual({ data: 'hello' });
    });

    it('tự động xóa key memory khi hết hạn TTL', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis is down'));
      mockRedis.get.mockRejectedValue(new Error('Redis is down'));

      // Set với TTL âm (đã hết hạn)
      await service.set('expired:key', { val: 1 }, -1);
      const val = await service.get('expired:key');

      expect(val).toBeNull();
    });

    it('Điểm C: giới hạn trần bộ nhớ RAM 1.000 key và tự động xóa key cũ nhất (FIFO eviction) khi đầy', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis is down'));
      mockRedis.get.mockRejectedValue(new Error('Redis is down'));

      // Đẩy 1.005 key vào cache khi Redis offline
      for (let i = 1; i <= 1005; i++) {
        await service.set(`bulk:key:${i}`, { index: i }, 3600);
      }

      // Số lượng key tối đa trong RAM không vượt quá 1.000
      expect(service.laySoLuongKeyFallback()).toBe(1000);

      // Các key đầu tiên (bulk:key:1 đến bulk:key:5) đã bị giải phóng theo FIFO
      expect(await service.get('bulk:key:1')).toBeNull();
      expect(await service.get('bulk:key:5')).toBeNull();

      // Key mới nhất vẫn còn nguyên
      expect(await service.get('bulk:key:6')).toEqual({ index: 6 });
      expect(await service.get('bulk:key:1005')).toEqual({ index: 1005 });
    });
  });
});

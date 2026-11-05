import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CacheService } from '../src/modules/redis/cache.service';

/** Tiện ích dùng chung cho các file test e2e (P2-61, P3B-25.9). */

/** Chặn tuyệt đối việc chạy trên DB hay Redis thật: test xóa sạch bảng trước khi chạy. */
export function chanMoiTruongThat(): void {
  const tenDb = new URL(process.env.DATABASE_URL ?? 'postgresql://x/khong-ro').pathname.slice(1);
  if (!tenDb.includes('e2e')) {
    throw new Error(`Từ chối chạy e2e trên DB "${tenDb}": tên DB phải chứa "e2e".`);
  }
  // Thiếu REDIS_URL thì Nest sẽ lấy Redis production từ .env, nên phải đặt rõ, không đoán là máy cục bộ.
  if (!process.env.REDIS_URL) {
    throw new Error('Phải đặt REDIS_URL cho e2e (Redis cục bộ, hoặc Redis ngoài với DB số 15).');
  }
  const redis = new URL(process.env.REDIS_URL);
  const laMayCucBo = ['localhost', '127.0.0.1'].includes(redis.hostname);
  if (!laMayCucBo && redis.pathname !== '/15') {
    throw new Error('Redis ngoài máy cục bộ chỉ được dùng DB số 15 cho e2e.');
  }
}

/** Bản giả GitHub: mọi hàm trả null, không có `then` để Nest không tưởng là Promise. */
export const githubGia = new Proxy(
  {},
  { get: (_t, khoa) => (khoa === 'then' ? undefined : async () => null) },
);

export async function lamSachDuLieu(app: INestApplication): Promise<void> {
  await app
    .get(PrismaService)
    .$executeRawUnsafe('TRUNCATE TABLE ung_dung, nguoi_dung, ung_vien_repo CASCADE');
  await app.get(CacheService).xoaTheoPrefix('fs:');
}

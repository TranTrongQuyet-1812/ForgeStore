import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UngDungService } from '../src/modules/ung-dung/ung-dung.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Script quét CSDL và cập nhật hướng dẫn cài đặt CLI thật từ README cho các ứng dụng.
 */
async function main() {
  console.info('===========================================================');
  console.info('🚀 BẮT ĐẦU ĐỒNG BỘ HƯỚNG DẪN CÀI ĐẶT CLI CHO CSDL');
  console.info('===========================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const appsService = app.get(UngDungService);
  const prisma = app.get(PrismaService);

  // Lấy toàn bộ các app trong CSDL để kiểm tra và đồng bộ hướng dẫn CLI
  const apps = await prisma.ungDung.findMany({
    select: {
      maUngDung: true,
      tenRepoDayDu: true,
      tenKhoChua: true,
      phanTichAI: {
        select: {
          huongDanCaiDat: true,
        },
      },
    },
    orderBy: { soSaoGithub: 'desc' },
  });

  console.info(`Tìm thấy ${apps.length} ứng dụng trong CSDL để kiểm tra hướng dẫn CLI...`);

  let count = 0;
  for (const a of apps) {
    if (!a.phanTichAI?.huongDanCaiDat) {
      console.info(`\n⏳ Đang phân tích hướng dẫn CLI cho: [${a.tenRepoDayDu}]...`);
      try {
        await appsService.phanTichUngDung(a.maUngDung);
        const check = await prisma.phanTichAI.findUnique({
          where: { maUngDung: a.maUngDung },
          select: { huongDanCaiDat: true },
        });
        if (check?.huongDanCaiDat) {
          console.info(`  ✅ Thành công trích xuất hướng dẫn CLI cho [${a.tenRepoDayDu}]`);
          count++;
        } else {
          console.info(`  ℹ️ [${a.tenRepoDayDu}] không có mục cài đặt CLI trong README`);
        }
      } catch (err: unknown) {
        console.warn(`  ❌ Lỗi khi phân tích CLI [${a.tenRepoDayDu}]: ${(err as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      console.info(`  ✓ [${a.tenRepoDayDu}] đã có sẵn hướng dẫn CLI`);
    }
  }

  console.info(`\n🏁 Hoàn tất: Đã kiểm tra xong. Tổng số app cập nhật mới: ${count}`);
  await app.close();
}

main().catch((e) => {
  console.error('Lỗi thực thi:', e);
  process.exit(1);
});

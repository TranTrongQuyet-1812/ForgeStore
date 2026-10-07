import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AppDescriptionTranslationService } from '../modules/ai/translation/services/app-description-translation.service';

async function main() {
  console.info('--- KHỞI TẠO NESTJS CONTEXT ĐỂ DỊCH MÔ TẢ 22 APPS DOKPLOY ---');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const service = app.get(AppDescriptionTranslationService);
    console.info('Bắt đầu quét và dịch mô tả kho ứng dụng...');
    const result = await service.dichMoTaCacApp(false);
    console.info('--- KẾT QUẢ DỊCH MÔ TẢ KHO ỨNG DỤNG ---');
    console.info(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Lỗi khi chạy dịch mô tả:', err);
  } finally {
    await app.close();
  }
}

main();

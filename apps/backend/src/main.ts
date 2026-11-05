import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { cauHinhUngDung } from './cau-hinh-ung-dung';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Bật trust proxy để nhận diện đúng IP client qua Cloudflare Tunnel / Reverse Proxy (Fix Claude DELIV-77.7)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // P2-04.1 đến P2-04.6: tiền tố, ValidationPipe, bộ lọc lỗi, X-Request-Id (dùng chung với test e2e)
  cauHinhUngDung(app);

  // P2-04.4: CORS cho phép Desktop (Tauri) và Landing page (kết hợp tĩnh và cấu hình động)
  const desktopOrigin = configService.get<string>('DESKTOP_ORIGIN', 'tauri://localhost');
  const landingOrigin = configService.get<string>('LANDING_ORIGIN', 'http://localhost:3000');

  const allowedOrigins = Array.from(
    new Set([
      desktopOrigin,
      landingOrigin,
      'tauri://localhost',
      'http://tauri.localhost',
      'https://tauri.localhost',
      'http://localhost:1420',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:1420',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ]),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Hardware-Id'],
    // Cho Desktop đọc được thời gian chờ khi bị giới hạn tốc độ (429)
    exposedHeaders: ['Retry-After'],
  });

  // P2-04.5: Swagger tại /api/docs chỉ bật ngoài production (Chủ chốt 05/11/2026: không mở công khai danh sách API)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ForgeStore Central Backend API')
      .setDescription(
        'Hệ thống API của kho ứng dụng mã nguồn mở ForgeStore: lấy phần mềm từ GitHub Releases, chấm điểm uy tín bằng luật, dịch mô tả và README sang tiếng Việt.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Nhập JWT Access Token (Bearer <token>)',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Health - Kiểm Tra Sức Khỏe', 'Kiểm tra trạng thái sẵn sàng của máy chủ, DB và Redis')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'ForgeStore API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Cho phép đóng kết nối gọn gàng khi nhận tín hiệu SIGTERM/SIGINT
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Máy chủ Central Backend đang hoạt động tại: http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    logger.log(`📚 Tài liệu Swagger UI khả dụng tại: http://localhost:${port}/api/docs`);
  }
  logger.log(`🌱 Môi trường thực thi: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi nghiêm trọng khi khởi động NestJS:', err);
  process.exit(1);
});

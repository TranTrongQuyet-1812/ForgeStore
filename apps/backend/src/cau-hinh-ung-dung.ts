import { INestApplication, ValidationPipe } from '@nestjs/common';
import { headerBaoMat } from './common/middleware/header-bao-mat.middleware';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Polyfill BigInt để hỗ trợ tuần tự hóa JSON an toàn (tránh lỗi TypeError: Do not know how to serialize a BigInt)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/**
 * Cấu hình dùng chung cho máy chủ thật và test e2e (P2-61), để hai nơi không lệch nhau:
 * tiền tố /api/v1, kiểm tra dữ liệu vào, chuẩn hóa lỗi và gắn X-Request-Id.
 */
export function cauHinhUngDung(app: INestApplication): void {
  // Quét ZAP 06/11/2026: không lộ framework qua X-Powered-By, thêm nosniff và HSTS
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(headerBaoMat);

  // P2-04.1: Tiền tố chung /api/v1 cho mọi route (ngoại trừ root / chào mừng)
  app.setGlobalPrefix('api/v1', { exclude: ['/'] });

  // P2-04.2: ValidationPipe toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // P2-04.3: Exception Filter chuẩn hóa lỗi thống nhất
  app.useGlobalFilters(new GlobalExceptionFilter());

  // P2-04.6: Logging Interceptor gắn X-Request-Id
  app.useGlobalInterceptors(new LoggingInterceptor());
}

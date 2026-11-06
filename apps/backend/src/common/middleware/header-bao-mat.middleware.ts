import { NextFunction, Request, Response } from 'express';

/**
 * Header bảo mật tối thiểu cho API chỉ trả JSON (kết quả quét ZAP 06/11/2026).
 * Không dùng helmet mặc định vì CSP và chính sách cross-origin của nó có thể chặn Desktop (Tauri) gọi API.
 * HSTS để 6 tháng, không includeSubDomains/preload: lỡ cấu hình sai thì không khóa cả tên miền.
 */
export function headerBaoMat(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
}

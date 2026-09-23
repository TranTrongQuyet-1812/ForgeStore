import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase PostgreSQL
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc (kết nối pooler cổng 6543)'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL là bắt buộc (kết nối trực tiếp cổng 5432)'),

  // Redis Cache (Hỗ trợ REDIS_URL chuỗi kết nối chuẩn hoặc các biến riêng lẻ)
  REDIS_URL: z.string().min(1, 'REDIS_URL là bắt buộc (kết nối Redis cache)'),

  // JWT & Phiên làm việc
  JWT_ACCESS_SECRET: z.string().min(8, 'JWT_ACCESS_SECRET phải có ít nhất 8 ký tự'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  // GitHub Integration
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID là bắt buộc'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET là bắt buộc'),
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN là bắt buộc (Personal Access Token)'),
  GITHUB_CALLBACK_URL: z.string().optional(),

  // Dual-AI Engine (Gemini là bắt buộc, các model khác tùy chọn)
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY là bắt buộc'),
  TYPESAFE_API_KEY: z.string().optional(),
  JEV_ENABLED: z.coerce.boolean().default(true),
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_NIM_MODEL: z.string().optional(),

  // Google OAuth (Tùy chọn)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // App & Deep Link
  APP_DEEP_LINK_SCHEME: z.string().default('forgestore'),
  DESKTOP_ORIGIN: z.string().default('tauri://localhost'),
  LANDING_ORIGIN: z.string().default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Hàm kiểm tra biến môi trường lúc khởi động ứng dụng NestJS.
 * Dừng ngay lập tức (fail-fast) nếu thiếu hoặc sai biến bắt buộc.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => {
      const path = err.path.join('.');
      return `  - [${path}]: ${err.message}`;
    });

    const errorMessage = [
      '\n======================================================',
      '❌ LỖI KHỞI ĐỘNG: CẤU HÌNH BIẾN MÔI TRƯỜNG KHÔNG HỢP LỆ',
      '======================================================',
      ...errorDetails,
      '======================================================\n',
    ].join('\n');

    throw new Error(errorMessage);
  }

  return result.data;
}

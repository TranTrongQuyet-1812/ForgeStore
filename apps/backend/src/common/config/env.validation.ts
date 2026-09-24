import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase PostgreSQL
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL là bắt buộc (kết nối pooler cổng 6543)' })
    .min(1, 'DATABASE_URL không được để trống'),
  DIRECT_URL: z
    .string({ required_error: 'DIRECT_URL là bắt buộc (kết nối trực tiếp cổng 5432)' })
    .min(1, 'DIRECT_URL không được để trống'),

  // Redis Cache (Hỗ trợ REDIS_URL chuỗi kết nối chuẩn hoặc các biến riêng lẻ)
  REDIS_URL: z
    .string({ required_error: 'REDIS_URL là bắt buộc (kết nối Redis cache)' })
    .min(1, 'REDIS_URL không được để trống'),

  // JWT & Phiên làm việc
  JWT_ACCESS_SECRET: z
    .string({ required_error: 'JWT_ACCESS_SECRET là bắt buộc' })
    .min(32, 'JWT_ACCESS_SECRET phải có ít nhất 32 ký tự (256-bit entropy)'),
  JWT_ACCESS_TTL: z.string().default('15m'),

  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  // GitHub Integration
  GITHUB_CLIENT_ID: z
    .string({ required_error: 'GITHUB_CLIENT_ID là bắt buộc' })
    .min(1, 'GITHUB_CLIENT_ID không được để trống'),
  GITHUB_CLIENT_SECRET: z
    .string({ required_error: 'GITHUB_CLIENT_SECRET là bắt buộc' })
    .min(1, 'GITHUB_CLIENT_SECRET không được để trống'),
  GITHUB_TOKEN: z
    .string({ required_error: 'GITHUB_TOKEN là bắt buộc (Personal Access Token)' })
    .min(1, 'GITHUB_TOKEN không được để trống'),
  GITHUB_CALLBACK_URL: z.string().optional(),

  // Dual-AI Engine (Gemini là bắt buộc, các model khác tùy chọn)
  GEMINI_API_KEY: z
    .string({ required_error: 'GEMINI_API_KEY là bắt buộc' })
    .min(1, 'GEMINI_API_KEY không được để trống'),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  TYPESAFE_API_KEY: z.string().optional(),
  JEV_ENABLED: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
      z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]),
    )
    .default(true)
    .transform((v) => v === true || v === 'true' || v === '1'),
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

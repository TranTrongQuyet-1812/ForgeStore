import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

describe('EnvValidation', () => {
  const baseValidConfig = {
    PORT: '3000',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:pass@localhost:6543/postgres?pgbouncer=true',
    DIRECT_URL: 'postgresql://postgres:pass@localhost:5432/postgres',
    REDIS_URL: 'redis://default:pass@localhost:6379',
    JWT_ACCESS_SECRET: 'super-secure-jwt-access-secret-32-chars-long!',
    GITHUB_CLIENT_ID: 'gh_client_123',
    GITHUB_CLIENT_SECRET: 'gh_secret_123',
    GITHUB_TOKEN: 'ghp_token_123',
    GEMINI_API_KEY: 'gemini_key_123',
  };

  it('xác thực thành công cấu hình hợp lệ với giá trị mặc định', () => {
    const config = validateEnv(baseValidConfig);
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('test');
    expect(config.JEV_ENABLED).toBe(true);
    expect(config.APP_DEEP_LINK_SCHEME).toBe('forgestore');
  });

  describe('Phân tích cú pháp JEV_ENABLED (Fix bug z.coerce.boolean)', () => {
    it('chuyển đổi "false" thành boolean false', () => {
      const config = validateEnv({ ...baseValidConfig, JEV_ENABLED: 'false' });
      expect(config.JEV_ENABLED).toBe(false);
    });

    it('chuyển đổi "0" thành boolean false', () => {
      const config = validateEnv({ ...baseValidConfig, JEV_ENABLED: '0' });
      expect(config.JEV_ENABLED).toBe(false);
    });

    it('chuyển đổi boolean false thành boolean false', () => {
      const config = validateEnv({ ...baseValidConfig, JEV_ENABLED: false });
      expect(config.JEV_ENABLED).toBe(false);
    });

    it('chuyển đổi "true" thành boolean true', () => {
      const config = validateEnv({ ...baseValidConfig, JEV_ENABLED: 'true' });
      expect(config.JEV_ENABLED).toBe(true);
    });

    it('chuyển đổi "1" thành boolean true', () => {
      const config = validateEnv({ ...baseValidConfig, JEV_ENABLED: '1' });
      expect(config.JEV_ENABLED).toBe(true);
    });

    it('mặc định là true khi không truyền JEV_ENABLED', () => {
      const config = validateEnv({ ...baseValidConfig });
      expect(config.JEV_ENABLED).toBe(true);
    });
  });

  describe('Fail-fast khi thiếu cấu hình bắt buộc', () => {
    it('ném lỗi khi thiếu GEMINI_API_KEY', () => {
      const invalid = { ...baseValidConfig };
      delete (invalid as Record<string, unknown>).GEMINI_API_KEY;
      expect(() => validateEnv(invalid)).toThrow('GEMINI_API_KEY là bắt buộc');
    });

    it('ném lỗi khi JWT_ACCESS_SECRET dưới 32 ký tự', () => {
      const invalid = { ...baseValidConfig, JWT_ACCESS_SECRET: 'short-secret' };
      expect(() => validateEnv(invalid)).toThrow('JWT_ACCESS_SECRET phải có ít nhất 32 ký tự');
    });

    it('ném lỗi khi thiếu DATABASE_URL', () => {
      const invalid = { ...baseValidConfig };
      delete (invalid as Record<string, unknown>).DATABASE_URL;
      expect(() => validateEnv(invalid)).toThrow('DATABASE_URL là bắt buộc');
    });
  });
});

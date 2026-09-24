import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { DevicesService } from '../devices/devices.service';
import { LoaiThietBi, VaiTro } from '@prisma/client';
import { DEFAULT_TTL } from '../redis/redis.constants';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  nguoiDung: {
    upsert: MockFn;
    findUnique: MockFn;
    findUniqueOrThrow: MockFn;
  };
  thietBi: {
    findUniqueOrThrow: MockFn;
    delete?: MockFn;
  };
  phienDangNhap: {
    create: MockFn;
    findUnique: MockFn;
    update: MockFn;
    delete: MockFn;
    deleteMany: MockFn;
  };
}

interface MockCache {
  get: MockFn;
  set: MockFn;
  del: MockFn;
}

interface MockDevices {
  dangKyThietBi: MockFn;
  capNhatHoatDong: MockFn;
}

interface MockJwt {
  signAsync: MockFn;
  verifyAsync: MockFn;
}

interface MockConfig {
  get: MockFn;
}

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: MockPrisma;
  let mockCache: MockCache;
  let mockDevices: MockDevices;
  let mockJwt: MockJwt;
  let mockConfig: MockConfig;

  beforeEach(() => {
    mockPrisma = {
      nguoiDung: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      thietBi: {
        findUniqueOrThrow: vi.fn(),
      },
      phienDangNhap: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };

    mockDevices = {
      dangKyThietBi: vi.fn(),
      capNhatHoatDong: vi.fn().mockResolvedValue(undefined),
    };

    mockJwt = {
      signAsync: vi.fn().mockResolvedValue('mocked-jwt-access-token'),
      verifyAsync: vi.fn(),
    };

    mockConfig = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        const configMap: Record<string, unknown> = {
          APP_DEEP_LINK_SCHEME: 'forgestore',
          GITHUB_CLIENT_ID: 'mock-client-id',
          GITHUB_CLIENT_SECRET: 'mock-client-secret',
          GITHUB_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/callback',
          JWT_EXPIRES_IN: '15m',
          REFRESH_TOKEN_TTL_DAYS: 30,
          PORT: 3000,
        };
        return configMap[key] ?? defaultValue;
      }),
    };

    // Đúng thứ tự: prisma, cacheService, devicesService, jwtService, config
    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockCache as unknown as CacheService,
      mockDevices as unknown as DevicesService,
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('P2-10: khoiTaoGithubAuth', () => {
    it('khởi tạo luồng GitHub OAuth với deep link forgestore:// hợp lệ', async () => {
      const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const redirect = 'forgestore://auth/callback';

      const url = await service.khoiTaoGithubAuth(challenge, redirect);

      expect(url).toContain('https://github.com/login/oauth/authorize?');
      expect(url).toContain('client_id=mock-client-id');
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('fs:auth:state:'),
        expect.objectContaining({ challenge, redirect }),
        DEFAULT_TTL.OAUTH_STATE,
      );
    });

    it('từ chối redirect không thuộc whitelist scheme (ví dụ https://evil.com)', async () => {
      const challenge = 'test-challenge';
      const redirect = 'https://evil.com/steal-token';

      await expect(service.khoiTaoGithubAuth(challenge, redirect)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('P2-10: xuLyGithubCallback', () => {
    it('ném lỗi BadRequestException (MA_XAC_THUC_KHONG_HOP_LE) khi state không tồn tại trong Redis', async () => {
      mockCache.get.mockResolvedValue(null);

      await expect(service.xuLyGithubCallback('gh-code-123', 'state-expired')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('xác thực thành công với GitHub, upsert người dùng và sinh exchange code 60s (Zero-Token-on-URL)', async () => {
      mockCache.get.mockResolvedValue({
        challenge: 'test-challenge',
        redirect: 'forgestore://auth/callback',
      });

      // Mock fetch GitHub API
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('access_token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: 'gh-token-secret' }),
          });
        }
        if (url.includes('api.github.com/user/emails')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ email: 'user@example.com', primary: true, verified: true }]),
          });
        }
        if (url.includes('api.github.com/user')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 123456,
                login: 'testuser',
                name: 'Test User',
                avatar_url: 'https://avatars.githubusercontent.com/u/123456',
                bio: 'Open source dev',
              }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });
      vi.stubGlobal('fetch', mockFetch);

      mockPrisma.nguoiDung.upsert.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        tenDangNhap: 'testuser',
        email: 'user@example.com',
        tenHienThi: 'Test User',
        anhDaiDien: 'https://avatars.githubusercontent.com/u/123456',
        vaiTro: VaiTro.NGUOI_DUNG,
      });

      const redirectUrl = await service.xuLyGithubCallback('gh-auth-code-valid', 'valid-state');

      expect(mockCache.del).toHaveBeenCalledWith('fs:auth:state:valid-state');
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('fs:auth:exchange:'),
        expect.objectContaining({
          maNguoiDung: 'user-uuid-1',
          challenge: 'test-challenge',
        }),
        DEFAULT_TTL.EXCHANGE_CODE,
      );
      // Đảm bảo không chứa JWT hay Refresh token trên URL
      expect(redirectUrl).toContain('forgestore://auth/callback?code=');
      expect(redirectUrl).not.toContain('accessToken');
      expect(redirectUrl).not.toContain('refreshToken');
    });
  });

  describe('P2-13: doiMaXacThuc (PKCE Flow)', () => {
    const rawVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const computedChallenge = crypto.createHash('sha256').update(rawVerifier).digest('base64url');

    it('ném lỗi BadRequestException khi exchange code không tồn tại hoặc hết hạn', async () => {
      mockCache.get.mockResolvedValue(null);

      await expect(
        service.doiMaXacThuc({
          code: 'non-existent-code',
          verifier: rawVerifier,
          thietBi: {
            dinhDanhPhanCung: 'hw-id-1',
            tenThietBi: 'Dell XPS',
            loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi BadRequestException khi PKCE verifier không khớp challenge', async () => {
      mockCache.get.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        challenge: computedChallenge,
      });

      await expect(
        service.doiMaXacThuc({
          code: 'valid-code',
          verifier: 'wrong-verifier',
          thietBi: {
            dinhDanhPhanCung: 'hw-id-1',
            tenThietBi: 'Dell XPS',
            loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('xác thực PKCE thành công, xóa exchange code 1 lần, đăng ký thiết bị và cấp token', async () => {
      mockCache.get.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        challenge: computedChallenge,
      });

      mockDevices.dangKyThietBi.mockResolvedValue({
        maThietBi: 'device-uuid-1',
        tenThietBi: 'Dell XPS',
        loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
      });

      mockPrisma.phienDangNhap.create.mockResolvedValue({
        maPhien: 'session-uuid-1',
        maNguoiDung: 'user-uuid-1',
        maThietBi: 'device-uuid-1',
      });

      mockPrisma.nguoiDung.findUniqueOrThrow.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        tenDangNhap: 'testuser',
        email: 'user@example.com',
        tenHienThi: 'Test User',
        anhDaiDien: 'https://avatars.github.com/u/1',
        vaiTro: VaiTro.NGUOI_DUNG,
      });

      mockPrisma.thietBi.findUniqueOrThrow.mockResolvedValue({
        maThietBi: 'device-uuid-1',
        tenThietBi: 'Dell XPS',
        loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
      });

      const response = await service.doiMaXacThuc({
        code: 'valid-code',
        verifier: rawVerifier,
        thietBi: {
          dinhDanhPhanCung: 'hw-id-1',
          tenThietBi: 'Dell XPS',
          loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
        },
      });

      // Kiểm tra exchange code bị xóa ngay (chỉ dùng 1 lần)
      expect(mockCache.del).toHaveBeenCalledWith('fs:auth:exchange:valid-code');
      // Kiểm tra thiết bị được đăng ký
      expect(mockDevices.dangKyThietBi).toHaveBeenCalledWith('user-uuid-1', {
        dinhDanhPhanCung: 'hw-id-1',
        tenThietBi: 'Dell XPS',
        loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
      });
      // Kiểm tra trả về access token và refresh token
      expect(response.accessToken).toBe('mocked-jwt-access-token');
      expect(response.refreshToken).toMatch(/^session-uuid-1\.[a-f0-9]{64}$/);
      expect(response.thietBi.maThietBi).toBe('device-uuid-1');
      expect(response.nguoiDung.tenDangNhap).toBe('testuser');
    });
  });

  describe('P2-12: lamMoiToken (Token Rotation & Reuse Detection)', () => {
    it('ném lỗi UnauthorizedException khi định dạng Refresh Token không hợp lệ', async () => {
      await expect(service.lamMoiToken({ refreshToken: 'invalid-token-no-dot' })).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(service.lamMoiToken({ refreshToken: 'session-only.' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('ném lỗi UnauthorizedException khi phiên đăng nhập không tồn tại', async () => {
      mockPrisma.phienDangNhap.findUnique.mockResolvedValue(null);

      await expect(service.lamMoiToken({ refreshToken: 'session-123.secret-456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('ném lỗi và xóa phiên khi phiên đăng nhập đã hết hạn', async () => {
      mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
        maPhien: 'session-expired',
        thoiGianHetHan: new Date(Date.now() - 10000), // đã hết hạn
        chuoiMaHoaToken: 'hashed-secret',
      });

      await expect(
        service.lamMoiToken({ refreshToken: 'session-expired.some-secret' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.phienDangNhap.delete).toHaveBeenCalledWith({
        where: { maPhien: 'session-expired' },
      });
    });

    it('REUSE DETECTION: Thu hồi toàn bộ phiên đăng nhập khi bí mật không khớp (token cũ bị lộ)', async () => {
      const realSecret = 'original-secret-string';
      const hashed = await argon2.hash(realSecret);

      mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
        maPhien: 'session-valid',
        thoiGianHetHan: new Date(Date.now() + 1000000),
        chuoiMaHoaToken: hashed,
      });

      // Kẻ tấn công hoặc client gửi refresh token cũ không khớp bí mật hiện tại
      await expect(
        service.lamMoiToken({ refreshToken: 'session-valid.stolen-or-outdated-secret' }),
      ).rejects.toThrow(UnauthorizedException);

      // Verify phiên bị thu hồi lập tức khỏi CSDL
      expect(mockPrisma.phienDangNhap.delete).toHaveBeenCalledWith({
        where: { maPhien: 'session-valid' },
      });
    });

    it('xoay vòng Refresh Token thành công: cấp bí mật mới và Access Token mới', async () => {
      const currentSecret = 'valid-current-secret-12345678901234567890123456789012';
      const hashed = await argon2.hash(currentSecret);

      mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
        maPhien: 'session-valid',
        thoiGianHetHan: new Date(Date.now() + 1000000),
        chuoiMaHoaToken: hashed,
        maNguoiDung: 'user-uuid-1',
        maThietBi: 'device-uuid-1',
        nguoiDung: {
          maNguoiDung: 'user-uuid-1',
          vaiTro: VaiTro.NGUOI_DUNG,
        },
      });

      mockPrisma.phienDangNhap.update.mockResolvedValue({
        maPhien: 'session-valid',
      });

      const result = await service.lamMoiToken({
        refreshToken: `session-valid.${currentSecret}`,
      });

      expect(result.accessToken).toBe('mocked-jwt-access-token');
      expect(result.refreshToken).toMatch(/^session-valid\.[a-f0-9]{64}$/);
      expect(mockPrisma.phienDangNhap.update).toHaveBeenCalledWith({
        where: { maPhien: 'session-valid' },
        data: expect.objectContaining({
          chuoiMaHoaToken: expect.any(String),
          thoiGianHetHan: expect.any(Date),
        }),
      });
      expect(mockDevices.capNhatHoatDong).toHaveBeenCalledWith('device-uuid-1');
    });
  });

  describe('P2-14: dangXuat & dangXuatTatCa', () => {
    it('đăng xuất đơn lẻ: xóa phiên đăng nhập nhưng giữ nguyên thiết bị (D-02)', async () => {
      mockPrisma.phienDangNhap.delete.mockResolvedValue({ maPhien: 'session-123' });

      await service.dangXuat('session-123');

      expect(mockPrisma.phienDangNhap.delete).toHaveBeenCalledWith({
        where: { maPhien: 'session-123' },
      });
      // Không có thao tác xóa nào trên bảng thietBi
      expect(mockPrisma.thietBi?.delete).toBeUndefined();
    });

    it('đăng xuất tất cả: xóa mọi phiên làm việc của người dùng', async () => {
      mockPrisma.phienDangNhap.deleteMany.mockResolvedValue({ count: 3 });

      await service.dangXuatTatCa('user-uuid-1');

      expect(mockPrisma.phienDangNhap.deleteMany).toHaveBeenCalledWith({
        where: { maNguoiDung: 'user-uuid-1' },
      });
    });
  });

  describe('P2-12.5: donDepPhienHetHan', () => {
    it('xóa các phiên làm việc đã quá hạn trong CSDL', async () => {
      mockPrisma.phienDangNhap.deleteMany.mockResolvedValue({ count: 5 });

      const count = await service.donDepPhienHetHan();

      expect(count).toBe(5);
      expect(mockPrisma.phienDangNhap.deleteMany).toHaveBeenCalledWith({
        where: {
          thoiGianHetHan: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('P2-14: layHoSo', () => {
    it('lấy thông tin hồ sơ tài khoản thành công', async () => {
      const mockUser = {
        maNguoiDung: 'user-1',
        tenDangNhap: 'quyett',
        vaiTro: VaiTro.NGUOI_DUNG,
      };
      mockPrisma.nguoiDung.findUnique.mockResolvedValue(mockUser);

      const result = await service.layHoSo('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.nguoiDung.findUnique).toHaveBeenCalledWith({
        where: { maNguoiDung: 'user-1' },
      });
    });

    it('ném lỗi UnauthorizedException khi không tìm thấy người dùng', async () => {
      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);

      await expect(service.layHoSo('non-existent-user')).rejects.toThrow(UnauthorizedException);
    });
  });
});

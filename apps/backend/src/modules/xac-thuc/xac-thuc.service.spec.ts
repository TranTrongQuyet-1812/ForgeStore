import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { XacThucService } from './xac-thuc.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { ThietBiService } from '../thiet-bi/thiet-bi.service';
import { LoaiThietBi, VaiTro } from '@prisma/client';
import { DEFAULT_TTL } from '../redis/redis.constants';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  nguoiDung: {
    upsert: MockFn;
    findUnique: MockFn;
    findUniqueOrThrow: MockFn;
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  thietBi: {
    findUniqueOrThrow: MockFn;
    delete?: MockFn;
  };
  phienDangNhap: {
    create: MockFn;
    findUnique: MockFn;
    update: MockFn;
    updateMany: MockFn;
    delete: MockFn;
    deleteMany: MockFn;
  };
}

interface MockCache {
  get: MockFn;
  set: MockFn;
  del: MockFn;
  layVaXoa: MockFn;
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

describe('XacThucService', () => {
  let service: XacThucService;
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
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      thietBi: {
        findUniqueOrThrow: vi.fn(),
      },
      phienDangNhap: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      layVaXoa: vi.fn(),
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
          GOOGLE_CLIENT_ID: 'mock-google-client-id',
          GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
          GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
          JWT_EXPIRES_IN: '15m',
          REFRESH_TOKEN_TTL_DAYS: 30,
          PORT: 3000,
        };
        return configMap[key] ?? defaultValue;
      }),
    };

    service = new XacThucService(
      mockPrisma as unknown as PrismaService,
      mockCache as unknown as CacheService,
      mockDevices as unknown as ThietBiService,
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('P2-10 & Điểm 1 & Điểm D: khoiTaoGithubAuth & Vá Open Redirect', () => {
    const validChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'; // 43 chars S256 base64url

    it('khởi tạo luồng GitHub OAuth với deep link forgestore:// hợp lệ', async () => {
      const redirect = 'forgestore://auth/callback';

      const url = await service.khoiTaoGithubAuth(validChallenge, redirect);

      expect(url).toContain('https://github.com/login/oauth/authorize?');
      expect(url).toContain('client_id=mock-client-id');
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('fs:auth:state:'),
        expect.objectContaining({ challenge: validChallenge, redirect }),
        DEFAULT_TTL.OAUTH_STATE,
      );
    });

    it('chấp nhận redirect loopback localhost hoặc 127.0.0.1 hợp lệ', async () => {
      const url1 = await service.khoiTaoGithubAuth(
        validChallenge,
        'http://localhost:3000/callback',
      );
      const url2 = await service.khoiTaoGithubAuth(
        validChallenge,
        'http://127.0.0.1:1420/callback',
      );

      expect(url1).toBeDefined();
      expect(url2).toBeDefined();
    });

    it('Điểm D: từ chối challenge không đúng 43 ký tự S256 base64url', async () => {
      await expect(
        service.khoiTaoGithubAuth('too-short', 'forgestore://auth/callback'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.khoiTaoGithubAuth(
          'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM+',
          'forgestore://auth/callback',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối redirect có chứa URL hash/fragment', async () => {
      await expect(
        service.khoiTaoGithubAuth(validChallenge, 'forgestore://auth/callback#token=123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('Điểm 1: Chặn đứng tấn công Open Redirect giả mạo localhost (http://localhost:1@evil.com)', async () => {
      const evilRedirect = 'http://localhost:1@evil.com';

      await expect(service.khoiTaoGithubAuth(validChallenge, evilRedirect)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Điểm 1: Chặn đứng redirect chứa username/password (http://admin:pass@localhost:3000)', async () => {
      const evilRedirect = 'http://admin:pass@localhost:3000';

      await expect(service.khoiTaoGithubAuth(validChallenge, evilRedirect)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('từ chối redirect không thuộc whitelist scheme (ví dụ https://evil.com)', async () => {
      const redirect = 'https://evil.com/steal-token';

      await expect(service.khoiTaoGithubAuth(validChallenge, redirect)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('P2-10 & Điểm 3, 8, 9, 11: xuLyGithubCallback', () => {
    it('Điểm 3: ném lỗi BadRequestException khi state không tồn tại trong Redis (layVaXoa)', async () => {
      mockCache.layVaXoa.mockResolvedValue(null);

      await expect(service.xuLyGithubCallback('gh-code-123', 'state-expired')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ném lỗi BadRequestException khi state thuộc provider khác (provider không khớp)', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: 'test-challenge',
        redirect: 'forgestore://auth/callback',
        provider: 'google',
      });

      await expect(service.xuLyGithubCallback('gh-code-123', 'valid-state')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('xác thực thành công với GitHub, lọc email verified, tạo mới user và sinh exchange code 60s', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: 'test-challenge',
        redirect: 'forgestore://auth/callback',
        provider: 'github',
      });

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
              Promise.resolve([
                { email: 'fake@example.com', primary: false, verified: false },
                { email: 'verified@example.com', primary: true, verified: true },
              ]),
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

      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);
      mockPrisma.nguoiDung.findFirst.mockResolvedValue(null);
      mockPrisma.nguoiDung.create.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        tenDangNhap: 'testuser',
        thuDienTu: 'verified@example.com',
        tenHienThi: 'Test User',
        duongDanAvatar: 'https://avatars.githubusercontent.com/u/123456',
        vaiTro: VaiTro.NGUOI_DUNG,
      });

      const redirectUrl = await service.xuLyGithubCallback('gh-auth-code-valid', 'valid-state');

      expect(mockCache.layVaXoa).toHaveBeenCalledWith('fs:auth:state:valid-state');
      expect(mockPrisma.nguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maDinhDanhGithub: '123456',
            thuDienTu: 'verified@example.com',
            tenDangNhap: 'testuser',
          }),
        }),
      );
      expect(redirectUrl).toContain('forgestore://auth/callback?code=');
      expect(redirectUrl).not.toContain('accessToken');
      expect(redirectUrl).not.toContain('refreshToken');

      vi.unstubAllGlobals();
    });

    it('Two-Way Auto-Linking: tự động gắn maDinhDanhGithub vào tài khoản đã tạo trước qua Google có cùng email verified', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: 'test-challenge',
        redirect: 'forgestore://auth/callback',
        provider: 'github',
      });

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
              Promise.resolve([{ email: 'shared@gmail.com', primary: true, verified: true }]),
          });
        }
        if (url.includes('api.github.com/user')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 998877,
                login: 'ghuser',
                name: 'GH User',
                avatar_url: 'https://avatars.githubusercontent.com/u/998877',
              }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });
      vi.stubGlobal('fetch', mockFetch);

      // findUnique by maDinhDanhGithub returns null (chưa gắn GitHub)
      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);
      // findFirst by email tìm thấy tài khoản đã đăng ký qua Google trước đó
      const existingGoogleUser = {
        maNguoiDung: 'google-user-uuid-1',
        maDinhDanhGoogle: 'google-sub-777',
        thuDienTu: 'shared@gmail.com',
        tenDangNhap: 'google_user',
        tenHienThi: 'Google User',
      };
      mockPrisma.nguoiDung.findFirst.mockResolvedValue(existingGoogleUser);
      mockPrisma.nguoiDung.update.mockResolvedValue({
        ...existingGoogleUser,
        maDinhDanhGithub: '998877',
      });

      const redirectUrl = await service.xuLyGithubCallback('gh-auth-code-valid', 'valid-state');

      expect(redirectUrl).toContain('forgestore://auth/callback?code=');
      expect(mockPrisma.nguoiDung.update).toHaveBeenCalledWith({
        where: { maNguoiDung: 'google-user-uuid-1' },
        data: expect.objectContaining({
          maDinhDanhGithub: '998877',
        }),
      });
      expect(mockPrisma.nguoiDung.create).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('SEC-01: từ chối Auto-Linking nếu email chỉ lấy từ profile ghUser.email mà không có trong /user/emails verified', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: 'test-challenge',
        redirect: 'forgestore://auth/callback',
        provider: 'github',
      });

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('access_token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: 'gh-token-secret' }),
          });
        }
        if (url.includes('api.github.com/user/emails')) {
          // Trả về mảng rỗng hoặc lỗi (không có verified email)
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('api.github.com/user')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 112233,
                login: 'attacker',
                name: 'Attacker',
                email: 'victim@gmail.com', // Email public profile mạo danh chưa verify
              }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });
      vi.stubGlobal('fetch', mockFetch);

      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);
      mockPrisma.nguoiDung.findFirst.mockResolvedValue(null);
      mockPrisma.nguoiDung.create.mockResolvedValue({
        maNguoiDung: 'new-user-uuid',
        tenDangNhap: 'attacker',
        thuDienTu: null,
      });

      await service.xuLyGithubCallback('gh-code', 'valid-state');

      // Khẳng định: KHÔNG gọi update trên bất kỳ tài khoản có sẵn nào
      expect(mockPrisma.nguoiDung.update).not.toHaveBeenCalled();
      // Bắt buộc gọi create tài khoản mới nhưng thuDienTu PHẢI LÀ null (không lưu email profile chưa verify)
      expect(mockPrisma.nguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            thuDienTu: null,
          }),
        }),
      );

      vi.unstubAllGlobals();
    });
  });

  describe('P2-13 & Điểm 2, 3: doiMaXacThuc (PKCE RFC 7636 Flow)', () => {
    // Verifier hợp lệ: 43 ký tự RFC 7636
    const rawVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const computedChallenge = crypto.createHash('sha256').update(rawVerifier).digest('base64url');

    it('Điểm 3: ném lỗi BadRequestException khi exchange code không tồn tại hoặc đã bị dùng (layVaXoa null)', async () => {
      mockCache.layVaXoa.mockResolvedValue(null);

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

    it('Điểm 2: từ chối verifier có độ dài nhỏ hơn 43 ký tự theo RFC 7636', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        challenge: computedChallenge,
      });

      await expect(
        service.doiMaXacThuc({
          code: 'valid-code',
          verifier: 'too-short-verifier', // < 43 chars
          thietBi: {
            dinhDanhPhanCung: 'hw-id-1',
            tenThietBi: 'Dell XPS',
            loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Điểm 2: từ chối verifier có độ dài lớn hơn 128 ký tự theo RFC 7636', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        challenge: computedChallenge,
      });

      await expect(
        service.doiMaXacThuc({
          code: 'valid-code',
          verifier: 'a'.repeat(129), // > 128 chars
          thietBi: {
            dinhDanhPhanCung: 'hw-id-1',
            tenThietBi: 'Dell XPS',
            loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Điểm 2: từ chối PKCE plain mode (verifier === challenge)', async () => {
      const plainChallenge = 'a'.repeat(50);
      mockCache.layVaXoa.mockResolvedValue({
        maNguoiDung: 'user-uuid-1',
        challenge: plainChallenge,
      });

      // Gửi verifier bằng đúng challenge (plain mode)
      await expect(
        service.doiMaXacThuc({
          code: 'valid-code',
          verifier: plainChallenge,
          thietBi: {
            dinhDanhPhanCung: 'hw-id-1',
            tenThietBi: 'Dell XPS',
            loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('xác thực PKCE S256 thành công, xóa exchange code nguyên tử, đăng ký thiết bị và cấp token', async () => {
      mockCache.layVaXoa.mockResolvedValue({
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

      // Điểm 3: Kiểm tra exchange code bị lấy và xóa nguyên tử
      expect(mockCache.layVaXoa).toHaveBeenCalledWith('fs:auth:exchange:valid-code');
      // Kiểm tra đăng ký thiết bị
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

  describe('P2-12 & Điểm 5, 6: lamMoiToken (Grace Period & sid.rác Protection)', () => {
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
        thoiGianHetHan: new Date(Date.now() - 10000),
        chuoiMaHoaToken: 'hashed-secret',
      });

      await expect(
        service.lamMoiToken({ refreshToken: 'session-expired.some-secret' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.phienDangNhap.delete).toHaveBeenCalledWith({
        where: { maPhien: 'session-expired' },
      });
    });

    it('xoay vòng Refresh Token thành công: lưu chuoiMaHoaTokenCu và cập nhật updateMany có điều kiện', async () => {
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

      mockPrisma.phienDangNhap.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.lamMoiToken({
        refreshToken: `session-valid.${currentSecret}`,
      });

      expect(result.accessToken).toBe('mocked-jwt-access-token');
      expect(result.refreshToken).toMatch(/^session-valid\.[a-f0-9]{64}$/);
      expect(mockPrisma.phienDangNhap.updateMany).toHaveBeenCalledWith({
        where: {
          maPhien: 'session-valid',
          chuoiMaHoaToken: hashed,
        },
        data: expect.objectContaining({
          chuoiMaHoaToken: expect.any(String),
          chuoiMaHoaTokenCu: hashed,
          thoiGianXoayVongCuoi: expect.any(Date),
        }),
      });
    });

    it('Điểm 5 & Điểm A: GRACE PERIOD — client gửi lại token vừa xoay vòng trong 15s được cấp accessToken mới mà KHÔNG bị xóa phiên và KHÔNG cấp refreshToken cũ', async () => {
      const previousSecret = 'previous-valid-secret-12345678901234567890';
      const hashedPrev = await argon2.hash(previousSecret);
      const hashedCurrent = await argon2.hash('newer-secret-that-was-just-rotated');

      // Phiên vừa xoay vòng 2 giây trước (< 15s Grace Period)
      mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
        maPhien: 'session-grace',
        thoiGianHetHan: new Date(Date.now() + 1000000),
        chuoiMaHoaToken: hashedCurrent,
        chuoiMaHoaTokenCu: hashedPrev,
        thoiGianXoayVongCuoi: new Date(Date.now() - 2000),
        maNguoiDung: 'user-uuid-1',
        maThietBi: 'device-uuid-1',
        nguoiDung: {
          maNguoiDung: 'user-uuid-1',
          vaiTro: VaiTro.NGUOI_DUNG,
        },
      });

      // Request thứ 2 gửi lại token cũ (previousSecret) trong khoảng Grace Period
      const result = await service.lamMoiToken({
        refreshToken: `session-grace.${previousSecret}`,
      });

      expect(result.accessToken).toBe('mocked-jwt-access-token');
      // Điểm A: Không trả refreshToken cũ trong ân hạn để client không ghi đè
      expect(result.refreshToken).toBeUndefined();
      // Đảm bảo phiên KHÔNG bị xóa
      expect(mockPrisma.phienDangNhap.delete).not.toHaveBeenCalled();
    }, 15000);

    it('Điểm B: Request thua chạy đua (count === 0) đọc lại phiên tươi từ CSDL và vào nhánh ân hạn', async () => {
      const currentSecret = 'valid-secret-race-12345678901234567890';
      const hashedCurrent = await argon2.hash(currentSecret);
      const hashedNewer = await argon2.hash('winner-new-secret-999999999999999');

      // Ban đầu findUnique trả về bản ghi cũ (chưa xoay)
      mockPrisma.phienDangNhap.findUnique
        .mockResolvedValueOnce({
          maPhien: 'session-race',
          thoiGianHetHan: new Date(Date.now() + 1000000),
          chuoiMaHoaToken: hashedCurrent,
          chuoiMaHoaTokenCu: null,
          thoiGianXoayVongCuoi: null,
          maNguoiDung: 'user-uuid-1',
          maThietBi: 'device-uuid-1',
          nguoiDung: { maNguoiDung: 'user-uuid-1', vaiTro: VaiTro.NGUOI_DUNG },
        })
        // Lần findUnique thứ 2 (khi count === 0) trả về bản ghi mới nhất vừa do request thắng cuộc cập nhật
        .mockResolvedValueOnce({
          maPhien: 'session-race',
          thoiGianHetHan: new Date(Date.now() + 1000000),
          chuoiMaHoaToken: hashedNewer,
          chuoiMaHoaTokenCu: hashedCurrent,
          thoiGianXoayVongCuoi: new Date(Date.now() - 1000), // trong 15s
          maNguoiDung: 'user-uuid-1',
          maThietBi: 'device-uuid-1',
          nguoiDung: { maNguoiDung: 'user-uuid-1', vaiTro: VaiTro.NGUOI_DUNG },
        });

      // updateMany trả về count === 0 vì request chạy đua khác đã cập nhật trước
      mockPrisma.phienDangNhap.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.lamMoiToken({
        refreshToken: `session-race.${currentSecret}`,
      });

      expect(result.accessToken).toBe('mocked-jwt-access-token');
      expect(result.refreshToken).toBeUndefined();
      expect(mockPrisma.phienDangNhap.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.phienDangNhap.delete).not.toHaveBeenCalled();
    }, 15000);

    it('Điểm 5: REUSE DETECTION NGOÀI GRACE PERIOD — Token cũ gửi sau 20s (> 15s) bị thu hồi phiên lập tức', async () => {
      const previousSecret = 'stolen-previous-secret-123456789012345678';
      const hashedPrev = await argon2.hash(previousSecret);
      const hashedCurrent = await argon2.hash('current-secret-9999999999999999999');

      // Phiên đã xoay vòng 20 giây trước (> 15s Grace Period)
      mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
        maPhien: 'session-attacked',
        thoiGianHetHan: new Date(Date.now() + 1000000),
        chuoiMaHoaToken: hashedCurrent,
        chuoiMaHoaTokenCu: hashedPrev,
        thoiGianXoayVongCuoi: new Date(Date.now() - 20000),
      });

      await expect(
        service.lamMoiToken({ refreshToken: `session-attacked.${previousSecret}` }),
      ).rejects.toThrow(UnauthorizedException);

      // Verify phiên bị thu hồi lập tức khỏi CSDL
      expect(mockPrisma.phienDangNhap.delete).toHaveBeenCalledWith({
        where: { maPhien: 'session-attacked' },
      });
    }, 15000);

    it('Điểm 6: CHỐNG PHÁ HOẠI SID.RÁC — Gửi chuỗi rác không khớp cả token mới lẫn token cũ bị 401 nhưng KHÔNG xóa phiên', async () => {
      const currentHashed = await argon2.hash('legit-current-secret');
      const prevHashed = await argon2.hash('legit-previous-secret');

      mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
        maPhien: 'session-victim',
        thoiGianHetHan: new Date(Date.now() + 1000000),
        chuoiMaHoaToken: currentHashed,
        chuoiMaHoaTokenCu: prevHashed,
        thoiGianXoayVongCuoi: new Date(Date.now() - 5000),
      });

      // Kẻ xấu biết sid gửi chuỗi ngẫu nhiên (sid.rac_fake_secret)
      await expect(
        service.lamMoiToken({ refreshToken: 'session-victim.completely_random_garbage_secret' }),
      ).rejects.toThrow(UnauthorizedException);

      // ĐẢM BẢO TUYỆT ĐỐI: Phiên của nạn nhân KHÔNG BỊ XÓA!
      expect(mockPrisma.phienDangNhap.delete).not.toHaveBeenCalled();
    }, 15000);
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

  describe('P3B-15: khoiTaoGoogleAuth & xuLyGoogleCallback', () => {
    const validChallenge = 'E9Melhoa2OwvFrGMTJguCH5rtx64ZWqiJSTFuZ-PoTM';
    const validRedirect = 'forgestore://auth';

    it('khoiTaoGoogleAuth: tạo URL đăng nhập Google hợp lệ kèm PKCE challenge và state (không có access_type offline)', async () => {
      const authUrl = await service.khoiTaoGoogleAuth(validChallenge, validRedirect);

      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain('client_id=mock-google-client-id');
      expect(authUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Fgoogle%2Fcallback',
      );
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=openid+email+profile');
      expect(authUrl).not.toContain('access_type=offline');
      expect(authUrl).toContain('prompt=select_account');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:state:'),
        expect.objectContaining({
          challenge: validChallenge,
          redirect: validRedirect,
          provider: 'google',
        }),
        DEFAULT_TTL.OAUTH_STATE,
      );
    });

    it('khoiTaoGoogleAuth: ném lỗi nếu PKCE challenge không hợp lệ', async () => {
      await expect(service.khoiTaoGoogleAuth('invalid-short', validRedirect)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('khoiTaoGoogleAuth: ném lỗi nếu redirect URI không hợp lệ (chống Open Redirect)', async () => {
      await expect(
        service.khoiTaoGoogleAuth(validChallenge, 'https://malicious-site.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('xuLyGoogleCallback: ném lỗi khi state không tồn tại hoặc hết hạn', async () => {
      mockCache.layVaXoa.mockResolvedValue(null);

      await expect(service.xuLyGoogleCallback('valid-code', 'invalid-state')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('xuLyGoogleCallback: ném lỗi BadRequestException khi state thuộc provider khác (github)', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: validChallenge,
        redirect: 'forgestore://auth',
        provider: 'github',
      });

      await expect(service.xuLyGoogleCallback('valid-code', 'valid-state')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('xuLyGoogleCallback: tạo người dùng mới từ Google với username là name slug an toàn (không lộ email)', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: validChallenge,
        redirect: 'forgestore://auth',
        provider: 'google',
      });

      // Mock fetch: token exchange và userinfo
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-google-token' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub-12345',
          email: 'secret_email@gmail.com',
          email_verified: true,
          name: 'Trần Trọng Quyết',
          picture: 'https://lh3.googleusercontent.com/avatar',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);
      mockPrisma.nguoiDung.findFirst.mockResolvedValue(null);
      mockPrisma.nguoiDung.create.mockResolvedValue({
        maNguoiDung: 'user-google-uuid-1',
        tenDangNhap: 'tran_trong_quyet',
        tenHienThi: 'Trần Trọng Quyết',
        thuDienTu: 'secret_email@gmail.com',
        duongDanAvatar: 'https://lh3.googleusercontent.com/avatar',
      });

      const redirectResult = await service.xuLyGoogleCallback('valid-google-code', 'valid-state');

      expect(redirectResult).toContain('forgestore://auth?code=');
      expect(mockPrisma.nguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maDinhDanhGoogle: 'google-sub-12345',
            thuDienTu: 'secret_email@gmail.com',
            tenDangNhap: 'tran_trong_quyet',
            tenHienThi: 'Trần Trọng Quyết',
          }),
        }),
      );
      // Đảm bảo tên đăng nhập KHÔNG bao giờ dùng phần prefix của email
      expect(mockPrisma.nguoiDung.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenDangNhap: 'secret_email',
          }),
        }),
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:exchange:'),
        expect.objectContaining({
          maNguoiDung: 'user-google-uuid-1',
          challenge: validChallenge,
        }),
        DEFAULT_TTL.EXCHANGE_CODE,
      );

      vi.unstubAllGlobals();
    });

    it('xuLyGoogleCallback: tự động liên kết tài khoản nếu đã tồn tại user có email trùng khớp', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: validChallenge,
        redirect: 'forgestore://auth',
        provider: 'google',
      });

      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-google-token' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub-99999',
          email: 'existing@forgestore.dev',
          email_verified: true,
          name: 'Existing User',
          picture: 'https://google.com/pic.png',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // findUnique by maDinhDanhGoogle returns null
      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);
      // findFirst by email returns existing GitHub user
      const existingUser = {
        maNguoiDung: 'existing-user-uuid',
        maDinhDanhGithub: 'gh-123',
        thuDienTu: 'existing@forgestore.dev',
        tenDangNhap: 'github_master',
      };
      mockPrisma.nguoiDung.findFirst.mockResolvedValue(existingUser);
      mockPrisma.nguoiDung.update.mockResolvedValue({
        ...existingUser,
        maDinhDanhGoogle: 'google-sub-99999',
      });

      const redirectResult = await service.xuLyGoogleCallback('valid-google-code', 'valid-state');

      expect(redirectResult).toContain('forgestore://auth?code=');
      expect(mockPrisma.nguoiDung.update).toHaveBeenCalledWith({
        where: { maNguoiDung: 'existing-user-uuid' },
        data: expect.objectContaining({
          maDinhDanhGoogle: 'google-sub-99999',
        }),
      });
      expect(mockPrisma.nguoiDung.create).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('SEC-01 (Google): khi email_verified = false, không auto-link và lưu thuDienTu là null khi tạo tài khoản', async () => {
      mockCache.layVaXoa.mockResolvedValue({
        challenge: validChallenge,
        redirect: 'forgestore://auth',
        provider: 'google',
      });

      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-google-token' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-unverified-sub',
          email: 'unverified@example.com',
          email_verified: false,
          name: 'Unverified Google User',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mockPrisma.nguoiDung.findUnique.mockResolvedValue(null);
      mockPrisma.nguoiDung.findFirst.mockResolvedValue(null);
      mockPrisma.nguoiDung.create.mockResolvedValue({
        maNguoiDung: 'user-google-unverified-uuid',
        tenDangNhap: 'unverified_google_user',
        tenHienThi: 'Unverified Google User',
        thuDienTu: null,
      });

      const redirectResult = await service.xuLyGoogleCallback('valid-code', 'valid-state');

      expect(redirectResult).toContain('forgestore://auth?code=');
      // Không được auto-link với bất kỳ user nào có email trùng
      expect(mockPrisma.nguoiDung.update).not.toHaveBeenCalled();
      // Bắt buộc tạo mới với thuDienTu là null
      expect(mockPrisma.nguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maDinhDanhGoogle: 'google-unverified-sub',
            thuDienTu: null,
          }),
        }),
      );

      vi.unstubAllGlobals();
    });
  });
});

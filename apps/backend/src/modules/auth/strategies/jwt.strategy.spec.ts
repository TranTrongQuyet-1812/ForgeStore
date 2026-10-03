import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { VaiTro } from '@prisma/client';

describe('JwtStrategy (L-12: Redis Session Cache)', () => {
  let strategy: JwtStrategy;
  let mockPrisma: {
    phienDangNhap: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let mockCache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    get: ReturnType<typeof vi.fn>;
  };

  const payload: JwtPayload = {
    sub: 'user-uuid-1',
    sid: 'session-uuid-123',
    did: 'device-uuid-456',
    role: VaiTro.NGUOI_DUNG,
  };

  beforeEach(() => {
    mockPrisma = {
      phienDangNhap: {
        findUnique: vi.fn(),
      },
    };
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    };
    mockConfig = {
      get: vi.fn().mockReturnValue('super-secret-key-for-test-32chars'),
    };

    strategy = new JwtStrategy(
      mockConfig as unknown as ConfigService,
      mockPrisma as unknown as PrismaService,
      mockCache as unknown as CacheService,
    );
  });

  it('Cache HIT (hợp lệ): Trả về context ngay lập tức mà KHÔNG gọi CSDL', async () => {
    mockCache.get.mockResolvedValue({
      hopLe: true,
      maNguoiDung: 'user-uuid-1',
    });

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      maNguoiDung: 'user-uuid-1',
      maPhien: 'session-uuid-123',
      maThietBi: 'device-uuid-456',
      vaiTro: VaiTro.NGUOI_DUNG,
    });
    expect(mockCache.get).toHaveBeenCalledWith('auth:session:session-uuid-123');
    expect(mockPrisma.phienDangNhap.findUnique).not.toHaveBeenCalled();
  });

  it('Cache HIT (không hợp lệ): Ném UnauthorizedException mà KHÔNG gọi CSDL', async () => {
    mockCache.get.mockResolvedValue({
      hopLe: false,
    });

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.phienDangNhap.findUnique).not.toHaveBeenCalled();
  });

  it('Cache MISS (tìm thấy phiên): Truy vấn CSDL và lưu cache 60s vào Redis', async () => {
    mockCache.get.mockResolvedValue(null);
    mockPrisma.phienDangNhap.findUnique.mockResolvedValue({
      maPhien: 'session-uuid-123',
      maNguoiDung: 'user-uuid-1',
    });

    const result = await strategy.validate(payload);

    expect(result.maNguoiDung).toBe('user-uuid-1');
    expect(mockPrisma.phienDangNhap.findUnique).toHaveBeenCalledWith({
      where: { maPhien: 'session-uuid-123' },
      select: { maPhien: true, maNguoiDung: true },
    });
    expect(mockCache.set).toHaveBeenCalledWith(
      'auth:session:session-uuid-123',
      { hopLe: true, maNguoiDung: 'user-uuid-1' },
      60,
    );
  });

  it('Cache MISS (phiên đã bị thu hồi/xóa): Lưu cache âm 15s và ném UnauthorizedException', async () => {
    mockCache.get.mockResolvedValue(null);
    mockPrisma.phienDangNhap.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    expect(mockCache.set).toHaveBeenCalledWith(
      'auth:session:session-uuid-123',
      { hopLe: false },
      15,
    );
  });
});

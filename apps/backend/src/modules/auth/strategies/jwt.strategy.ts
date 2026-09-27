import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, UserSessionContext } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<UserSessionContext> {
    const cacheKey = `auth:session:${payload.sid}`;
    const cached = await this.cacheService.get<{ hopLe: boolean; maNguoiDung?: string }>(cacheKey);

    if (cached) {
      if (!cached.hopLe) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc đã kết thúc');
      }
      return {
        maNguoiDung: payload.sub,
        maPhien: payload.sid,
        maThietBi: payload.did,
        vaiTro: payload.role,
      };
    }

    // Kiểm tra trực tiếp trạng thái phiên: nếu phiên bị xóa do đăng xuất hoặc thu hồi thì ngắt ngay
    const phien = await this.prisma.phienDangNhap.findUnique({
      where: { maPhien: payload.sid },
      select: { maPhien: true, maNguoiDung: true },
    });

    if (!phien) {
      // Cache âm 15s để chặn spam request token hỏng
      await this.cacheService.set(cacheKey, { hopLe: false }, 15);
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc đã kết thúc');
    }

    // Cache phiên 60s để giảm round-trip Supabase (L-12)
    await this.cacheService.set(cacheKey, { hopLe: true, maNguoiDung: phien.maNguoiDung }, 60);

    return {
      maNguoiDung: payload.sub,
      maPhien: payload.sid,
      maThietBi: payload.did,
      vaiTro: payload.role,
    };
  }
}

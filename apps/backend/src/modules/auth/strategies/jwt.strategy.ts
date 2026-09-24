import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, UserSessionContext } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<UserSessionContext> {
    // Kiểm tra trực tiếp trạng thái phiên: nếu phiên bị xóa do đăng xuất hoặc thu hồi thì ngắt ngay
    const phien = await this.prisma.phienDangNhap.findUnique({
      where: { maPhien: payload.sid },
    });

    if (!phien) {
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc đã kết thúc');
    }

    return {
      maNguoiDung: payload.sub,
      maPhien: payload.sid,
      maThietBi: payload.did,
      vaiTro: payload.role,
    };
  }
}

import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { VaiTro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CACHE_PREFIX, DEFAULT_TTL } from '../redis/redis.constants';
import { DevicesService } from '../devices/devices.service';
import { AuthExchangeDto } from './dto/auth-exchange.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly devicesService: DevicesService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Khởi tạo luồng đăng nhập GitHub OAuth.
   * Sinh mã state ngẫu nhiên lưu vào Redis kèm PKCE challenge và redirect URL.
   */
  async khoiTaoGithubAuth(challenge: string, redirect: string): Promise<string> {
    const appDeepLinkScheme = this.config.get<string>('APP_DEEP_LINK_SCHEME', 'forgestore');

    // Kiểm tra danh sách redirect cho phép: deep link scheme hoặc loopback localhost
    const isAllowedRedirect =
      redirect.startsWith(`${appDeepLinkScheme}://`) ||
      redirect.startsWith('http://localhost:') ||
      redirect.startsWith('http://127.0.0.1:');

    if (!isAllowedRedirect) {
      throw new BadRequestException(
        `Đường dẫn chuyển hướng redirect không hợp lệ. Chỉ chấp nhận ${appDeepLinkScheme}:// hoặc localhost.`,
      );
    }

    const state = randomUUID();
    const stateKey = `${CACHE_PREFIX.AUTH_STATE}${state}`;

    // Lưu state kèm challenge và redirect vào Redis với TTL 10 phút (600 giây)
    await this.cacheService.set(
      stateKey,
      { challenge, redirect, createdAt: Date.now() },
      DEFAULT_TTL.OAUTH_STATE,
    );

    const clientId = this.config.get<string>('GITHUB_CLIENT_ID')!;
    const callbackUrl =
      this.config.get<string>('GITHUB_CALLBACK_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}/api/v1/auth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user user:email',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Xử lý callback từ GitHub OAuth.
   * Xác thực state CSRF một lần, lấy thông tin người dùng từ GitHub, upsert vào DB,
   * và sinh mã 1-time exchange code (TTL 60s) để chuyển tiếp về app native.
   */
  async xuLyGithubCallback(code: string, state: string): Promise<string> {
    const stateKey = `${CACHE_PREFIX.AUTH_STATE}${state}`;
    const stateData = await this.cacheService.get<{ challenge: string; redirect: string }>(
      stateKey,
    );

    if (!stateData) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'Mã state xác thực không hợp lệ hoặc phiên đăng nhập đã quá hạn 10 phút',
      });
    }

    // Xóa state ngay lập tức (dùng 1 lần chống replay)
    await this.cacheService.del(stateKey);

    // Đổi code lấy GitHub Access Token
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID')!;
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET')!;

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (!tokenRes.ok || !tokenData.access_token) {
      this.logger.error(`Lỗi đổi code GitHub: ${JSON.stringify(tokenData)}`);
      throw new BadRequestException('Không thể lấy mã truy cập từ GitHub');
    }

    const ghAccessToken = tokenData.access_token;

    // Lấy thông tin tài khoản GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${ghAccessToken}`,
        'User-Agent': 'ForgeStore-Central-Backend',
      },
    });

    if (!userRes.ok) {
      throw new BadRequestException('Không thể truy vấn thông tin người dùng từ GitHub');
    }

    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string | null;
    };

    // Lấy email chính xác nếu profile để ẩn email
    let primaryEmail = ghUser.email || null;
    if (!primaryEmail) {
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${ghAccessToken}`,
            'User-Agent': 'ForgeStore-Central-Backend',
          },
        });
        if (emailsRes.ok) {
          const emails = (await emailsRes.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primary = emails.find((e) => e.primary && e.verified) || emails[0];
          if (primary) {
            primaryEmail = primary.email;
          }
        }
      } catch (emailErr) {
        this.logger.warn(`Không thể lấy danh sách email GitHub: ${(emailErr as Error).message}`);
      }
    }

    // Tạo mới hoặc cập nhật người dùng trong CSDL Supabase
    const user = await this.prisma.nguoiDung.upsert({
      where: { maDinhDanhGithub: String(ghUser.id) },
      create: {
        maDinhDanhGithub: String(ghUser.id),
        tenDangNhap: ghUser.login,
        tenHienThi: ghUser.name || ghUser.login,
        thuDienTu: primaryEmail,
        duongDanAvatar: ghUser.avatar_url,
        vaiTro: VaiTro.NGUOI_DUNG,
      },
      update: {
        tenDangNhap: ghUser.login,
        tenHienThi: ghUser.name || ghUser.login,
        thuDienTu: primaryEmail,
        duongDanAvatar: ghUser.avatar_url,
      },
    });

    // P2-10.5: TUYỆT ĐỐI KHÔNG LƯU GitHub access token vào DB

    // Sinh mã xác thực dùng 1 lần (TTL 60 giây) lưu vào Redis
    const exchangeCode = randomUUID();
    const exchangeKey = `${CACHE_PREFIX.AUTH_EXCHANGE}${exchangeCode}`;

    await this.cacheService.set(
      exchangeKey,
      {
        maNguoiDung: user.maNguoiDung,
        challenge: stateData.challenge,
      },
      DEFAULT_TTL.EXCHANGE_CODE,
    );

    this.logger.log(`Đã cấp exchange code [${exchangeCode}] cho người dùng [${user.tenDangNhap}]`);

    // Chuyển hướng về native app
    const separator = stateData.redirect.includes('?') ? '&' : '?';
    return `${stateData.redirect}${separator}code=${exchangeCode}`;
  }

  /**
   * Đổi mã xác thực dùng 1 lần (Zero-Token-on-URL) lấy cặp JWT Tokens.
   * Xác thực PKCE verifier, đăng ký thiết bị vật lý, tạo phiên đăng nhập.
   */
  async doiMaXacThuc(dto: AuthExchangeDto) {
    const exchangeKey = `${CACHE_PREFIX.AUTH_EXCHANGE}${dto.code}`;
    const exchangeData = await this.cacheService.get<{
      maNguoiDung: string;
      challenge: string;
    }>(exchangeKey);

    if (!exchangeData) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'Mã xác thực không hợp lệ hoặc đã qua thời hạn 60 giây',
      });
    }

    // Xóa mã ngay lập tức (chống replay attack)
    await this.cacheService.del(exchangeKey);

    // Xác thực PKCE verifier tương ứng với challenge đã đăng ký
    const verifierBase64Url = createHash('sha256').update(dto.verifier).digest('base64url');
    const verifierHex = createHash('sha256').update(dto.verifier).digest('hex');

    const isValidVerifier =
      verifierBase64Url === exchangeData.challenge ||
      verifierHex === exchangeData.challenge ||
      dto.verifier === exchangeData.challenge;

    if (!isValidVerifier) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'PKCE code verifier không khớp với challenge đã đăng ký',
      });
    }

    // Đăng ký thiết bị vật lý (D-02)
    const thietBi = await this.devicesService.dangKyThietBi(exchangeData.maNguoiDung, dto.thietBi);

    // Tạo phiên làm việc mới và phát hành cặp Tokens (P2-12)
    return await this.taoPhienVaCapToken(exchangeData.maNguoiDung, thietBi.maThietBi);
  }

  /**
   * Làm mới Access Token và xoay vòng Refresh Token (Token Rotation).
   * Phát hiện tái sử dụng token cũ (Reuse Detection) và thu hồi phiên ngay lập tức.
   */
  async lamMoiToken(dto: RefreshTokenDto) {
    const parts = dto.refreshToken.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedException({
        maLoi: 'CHUA_XAC_THUC',
        thongBao: 'Định dạng Refresh Token không hợp lệ',
      });
    }

    const [maPhien, rawSecret] = parts as [string, string];

    const phien = await this.prisma.phienDangNhap.findUnique({
      where: { maPhien },
      include: {
        nguoiDung: true,
        thietBi: true,
      },
    });

    if (!phien) {
      throw new UnauthorizedException({
        maLoi: 'CHUA_XAC_THUC',
        thongBao: 'Phiên làm việc không tồn tại hoặc đã bị thu hồi',
      });
    }

    // Kiểm tra thời hạn phiên
    if (phien.thoiGianHetHan < new Date()) {
      await this.prisma.phienDangNhap.delete({ where: { maPhien } });
      throw new UnauthorizedException({
        maLoi: 'CHUA_XAC_THUC',
        thongBao: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      });
    }

    // Đối soát bí mật băm bằng Argon2
    const isSecretValid = await argon2.verify(phien.chuoiMaHoaToken, rawSecret);

    if (!isSecretValid) {
      // ⚠️ PHÁT HIỆN TÁI SỬ DỤNG TOKEN CŨ (REUSE DETECTION - P2-12.4)
      this.logger.warn(
        `🚨 CẢNH BÁO BẢO MẬT: Phát hiện tái sử dụng Refresh Token cũ tại phiên [${maPhien}]. Thu hồi phiên lập tức!`,
      );
      await this.prisma.phienDangNhap.delete({ where: { maPhien } });
      throw new UnauthorizedException({
        maLoi: 'CHUA_XAC_THUC',
        thongBao:
          'Phát hiện token đã bị thu hồi hoặc tái sử dụng trái phép. Phiên đăng nhập đã bị vô hiệu hóa vì lý do an toàn.',
      });
    }

    // Token Rotation: Sinh bí mật ngẫu nhiên mới và cập nhật bản băm
    const newSecret = randomBytes(32).toString('hex');
    const newHashedSecret = await argon2.hash(newSecret);

    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    const newExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.phienDangNhap.update({
      where: { maPhien },
      data: {
        chuoiMaHoaToken: newHashedSecret,
        thoiGianHetHan: newExpiresAt,
      },
    });

    // Cập nhật hoạt động cuối của thiết bị
    await this.devicesService.capNhatHoatDong(phien.maThietBi);

    // Cấp phát Access Token mới
    const payload: JwtPayload = {
      sub: phien.maNguoiDung,
      sid: phien.maPhien,
      did: phien.maThietBi,
      role: phien.nguoiDung.vaiTro,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const newRefreshToken = `${maPhien}.${newSecret}`;

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Đăng xuất phiên hiện tại (Xóa PhienDangNhap, giữ nguyên bản ghi ThietBi).
   */
  async dangXuat(maPhien: string): Promise<void> {
    try {
      await this.prisma.phienDangNhap.delete({
        where: { maPhien },
      });
      this.logger.log(`Đã hủy phiên làm việc [${maPhien}]`);
    } catch {
      // Bỏ qua nếu phiên đã bị xóa trước đó
    }
  }

  /**
   * Đăng xuất trên toàn bộ thiết bị (Xóa toàn bộ PhienDangNhap của người dùng).
   */
  async dangXuatTatCa(maNguoiDung: string): Promise<void> {
    await this.prisma.phienDangNhap.deleteMany({
      where: { maNguoiDung },
    });
    this.logger.log(`Đã thu hồi toàn bộ phiên đăng nhập của người dùng [${maNguoiDung}]`);
  }

  /**
   * Dọn dẹp các phiên làm việc đã hết hạn trong CSDL (P2-12.5).
   */
  async donDepPhienHetHan(): Promise<number> {
    const result = await this.prisma.phienDangNhap.deleteMany({
      where: {
        thoiGianHetHan: {
          lt: new Date(),
        },
      },
    });
    this.logger.log(`Đã dọn dẹp ${result.count} phiên đăng nhập hết hạn`);
    return result.count;
  }

  /**
   * Lấy thông tin hồ sơ tài khoản người dùng hiện tại.
   */
  async layHoSo(maNguoiDung: string) {
    const user = await this.prisma.nguoiDung.findUnique({
      where: { maNguoiDung },
    });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    return user;
  }

  /**
   * Helper: Tạo phiên đăng nhập và cấp phát cặp Tokens JWT.
   */
  private async taoPhienVaCapToken(maNguoiDung: string, maThietBi: string) {
    const rawSecret = randomBytes(32).toString('hex');
    const hashedSecret = await argon2.hash(rawSecret);

    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const phien = await this.prisma.phienDangNhap.create({
      data: {
        maNguoiDung,
        maThietBi,
        chuoiMaHoaToken: hashedSecret,
        thoiGianHetHan: expiresAt,
      },
    });

    const user = await this.prisma.nguoiDung.findUniqueOrThrow({
      where: { maNguoiDung },
    });

    const thietBi = await this.prisma.thietBi.findUniqueOrThrow({
      where: { maThietBi },
    });

    const payload: JwtPayload = {
      sub: user.maNguoiDung,
      sid: phien.maPhien,
      did: thietBi.maThietBi,
      role: user.vaiTro,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = `${phien.maPhien}.${rawSecret}`;

    return {
      accessToken,
      refreshToken,
      nguoiDung: user,
      thietBi,
    };
  }
}

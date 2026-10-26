import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { VaiTro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CACHE_PREFIX, DEFAULT_TTL } from '../redis/redis.constants';
import { DevicesService } from '../thiet-bi/thiet-bi.service';
import { AuthExchangeDto } from './dto/trao-doi-xac-thuc.dto';
import { RefreshTokenDto } from './dto/lam-moi-token.dto';
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
   * Kiểm tra tính hợp lệ và an toàn của URL chuyển hướng redirect (chống Open Redirect).
   */
  private kiemTraRedirectHopLe(redirect: string): boolean {
    const appDeepLinkScheme = this.config.get<string>('APP_DEEP_LINK_SCHEME', 'forgestore');
    try {
      const u = new URL(redirect);
      const isScheme = u.protocol === `${appDeepLinkScheme}:` && !u.hash;
      const isLoopback =
        u.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(u.hostname) &&
        !u.username &&
        !u.password &&
        !u.hash;
      return isScheme || isLoopback;
    } catch {
      return false;
    }
  }

  /**
   * Khởi tạo luồng đăng nhập GitHub OAuth.
   * Sinh mã state ngẫu nhiên lưu vào Redis kèm PKCE challenge và redirect URL.
   * Điểm 1: Vá lỗ hổng Open Redirect bằng URL parsing nghiêm ngặt (chặn userinfo, kiểm tra protocol & hostname).
   */
  async khoiTaoGithubAuth(challenge: string, redirect: string): Promise<string> {
    // Kiểm tra định dạng challenge PKCE: Chuẩn RFC 7636 S256 base64url luôn có độ dài đúng 43 ký tự
    if (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      throw new BadRequestException(
        'Mã PKCE challenge không hợp lệ. Bắt buộc phải là chuỗi S256 base64url có độ dài đúng 43 ký tự.',
      );
    }

    const appDeepLinkScheme = this.config.get<string>('APP_DEEP_LINK_SCHEME', 'forgestore');

    if (!this.kiemTraRedirectHopLe(redirect)) {
      throw new BadRequestException(
        `Đường dẫn chuyển hướng redirect không hợp lệ. Chỉ chấp nhận ${appDeepLinkScheme}:// hoặc loopback localhost hợp lệ.`,
      );
    }

    const state = randomUUID();
    const stateKey = `${CACHE_PREFIX.AUTH_STATE}${state}`;

    // Lưu state kèm challenge, redirect và provider vào Redis / Memory Fallback với TTL 10 phút (600 giây)
    await this.cacheService.set(
      stateKey,
      { challenge, redirect, createdAt: Date.now(), provider: 'github' },
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
   * Khởi tạo luồng đăng nhập Google OAuth.
   * Sinh mã state ngẫu nhiên lưu vào Redis kèm PKCE challenge và redirect URL.
   */
  async khoiTaoGoogleAuth(challenge: string, redirect: string): Promise<string> {
    if (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      throw new BadRequestException(
        'Mã PKCE challenge không hợp lệ. Bắt buộc phải là chuỗi S256 base64url có độ dài đúng 43 ký tự.',
      );
    }

    const appDeepLinkScheme = this.config.get<string>('APP_DEEP_LINK_SCHEME', 'forgestore');

    if (!this.kiemTraRedirectHopLe(redirect)) {
      throw new BadRequestException(
        `Đường dẫn chuyển hướng redirect không hợp lệ. Chỉ chấp nhận ${appDeepLinkScheme}:// hoặc loopback localhost hợp lệ.`,
      );
    }

    const state = randomUUID();
    const stateKey = `${CACHE_PREFIX.AUTH_STATE}${state}`;

    await this.cacheService.set(
      stateKey,
      { challenge, redirect, createdAt: Date.now(), provider: 'google' },
      DEFAULT_TTL.OAUTH_STATE,
    );

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID chưa được cấu hình trên máy chủ');
    }

    const callbackUrl =
      this.config.get<string>('GOOGLE_CALLBACK_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}/api/v1/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Đọc và xóa state nguyên tử từ Redis (layVaXoa / GETDEL).
   */
  async layVaXoaState(
    state: string,
  ): Promise<{ challenge: string; redirect: string; provider?: 'github' | 'google' } | null> {
    const stateKey = `${CACHE_PREFIX.AUTH_STATE}${state}`;
    return await this.cacheService.layVaXoa<{
      challenge: string;
      redirect: string;
      provider?: 'github' | 'google';
    }>(stateKey);
  }

  /**
   * Xử lý callback từ GitHub OAuth.
   * Điểm 3: Nguyên tử hóa việc đọc và xóa state (layVaXoa / GETDEL).
   * Điểm 8: Mask log không in mã exchange.
   * Điểm 9: Lấy email đã verified.
   * Điểm 11: Timeout AbortSignal 5s cho fetch.
   */
  async xuLyGithubCallback(code: string, state: string): Promise<string> {
    // Điểm 3: Đọc và xóa state nguyên tử (chống race-condition replay)
    const stateData = await this.layVaXoaState(state);

    if (!stateData) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'Mã state xác thực không hợp lệ hoặc phiên đăng nhập đã quá hạn 10 phút',
      });
    }

    if (stateData.provider !== 'github') {
      throw new BadRequestException({
        maLoi: 'PROVIDER_KHONG_KHOP',
        thongBao: 'Mã state xác thực không khớp với nhà cung cấp GitHub',
      });
    }

    // Đổi code lấy GitHub Access Token (Timeout 5s - Điểm 11)
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID')!;
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET')!;

    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://github.com/login/oauth/access_token', {
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
        signal: AbortSignal.timeout(5000),
      });
    } catch (fetchErr) {
      this.logger.error(`Timeout hoặc lỗi kết nối GitHub token: ${(fetchErr as Error).message}`);
      throw new BadRequestException('Quá thời gian kết nối tới máy chủ GitHub');
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (!tokenRes.ok || !tokenData.access_token) {
      this.logger.error(`Lỗi đổi code GitHub: ${JSON.stringify(tokenData)}`);
      throw new BadRequestException('Không thể lấy mã truy cập từ GitHub');
    }

    const ghAccessToken = tokenData.access_token;

    // Lấy thông tin tài khoản GitHub (Timeout 5s - Điểm 11)
    let userRes: Response;
    try {
      userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${ghAccessToken}`,
          'User-Agent': 'ForgeStore-Central-Backend',
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch (fetchErr) {
      this.logger.error(`Timeout lấy thông tin profile GitHub: ${(fetchErr as Error).message}`);
      throw new BadRequestException('Quá thời gian kết nối tới GitHub User API');
    }

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

    // Điểm 9: Lấy email chính xác đã verified từ API chuyên biệt của GitHub
    let primaryEmail: string | null = null;
    let isEmailVerified = false;
    try {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${ghAccessToken}`,
          'User-Agent': 'ForgeStore-Central-Backend',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const verifiedEmails = emails.filter((e) => e.verified);
        const primary = verifiedEmails.find((e) => e.primary) || verifiedEmails[0];
        if (primary) {
          primaryEmail = primary.email.trim().toLowerCase();
          isEmailVerified = true;
        }
      }
    } catch (emailErr) {
      this.logger.warn(`Không thể lấy danh sách email GitHub: ${(emailErr as Error).message}`);
    }

    // SEC-01: Không dùng ghUser.email làm fallback cho thuDienTu vì email profile GitHub không bắt buộc verify.
    // Cột thuDienTu trong CSDL chỉ được phép lưu email đã xác minh chính chủ (isEmailVerified === true).

    if (!ghUser.id || typeof ghUser.id !== 'number') {
      throw new BadRequestException('Thông tin người dùng GitHub không hợp lệ (thiếu user ID)');
    }

    // Tạo mới hoặc cập nhật người dùng trong CSDL - Hỗ trợ liên kết hai chiều (Two-Way Auto-Linking)
    let user = await this.prisma.nguoiDung.findUnique({
      where: { maDinhDanhGithub: String(ghUser.id) },
    });

    if (user) {
      // Đã có tài khoản liên kết với GitHub ID này -> cập nhật thông tin
      // SEC-01: Chỉ cập nhật thuDienTu nếu email mới đã được xác minh chính chủ
      user = await this.prisma.nguoiDung.update({
        where: { maNguoiDung: user.maNguoiDung },
        data: {
          tenDangNhap: ghUser.login,
          tenHienThi: ghUser.name || ghUser.login,
          thuDienTu: isEmailVerified ? primaryEmail : user.thuDienTu,
          duongDanAvatar: ghUser.avatar_url || user.duongDanAvatar,
        },
      });
    } else if (primaryEmail && isEmailVerified) {
      // SEC-01 & SEC-04: Tự động liên kết hai chiều CHỈ KHI email đã verified và tài khoản đó CHƯA TỪNG liên kết GitHub khác
      const existingUserWithEmail = await this.prisma.nguoiDung.findFirst({
        where: { thuDienTu: primaryEmail },
      });
      if (existingUserWithEmail && !existingUserWithEmail.maDinhDanhGithub) {
        user = await this.prisma.nguoiDung.update({
          where: { maNguoiDung: existingUserWithEmail.maNguoiDung },
          data: {
            maDinhDanhGithub: String(ghUser.id),
            tenHienThi: existingUserWithEmail.tenHienThi || ghUser.name || ghUser.login,
            duongDanAvatar: existingUserWithEmail.duongDanAvatar || ghUser.avatar_url,
          },
        });
      }
    }

    if (!user) {
      // Tạo mới người dùng GitHub
      let username = ghUser.login;
      const existingUsername = await this.prisma.nguoiDung.findFirst({
        where: { tenDangNhap: username },
      });
      if (existingUsername) {
        username = `${ghUser.login}_${randomUUID().slice(0, 4)}`;
      }

      // SEC-01: Cột thuDienTu CHỈ ĐƯỢC LƯU khi email ĐÃ XÁC MINH (isEmailVerified === true). Chưa xác minh bắt buộc lưu null.
      user = await this.prisma.nguoiDung.create({
        data: {
          maDinhDanhGithub: String(ghUser.id),
          tenDangNhap: username,
          tenHienThi: ghUser.name || ghUser.login,
          thuDienTu: isEmailVerified ? primaryEmail : null,
          duongDanAvatar: ghUser.avatar_url,
          vaiTro: VaiTro.NGUOI_DUNG,
        },
      });
    }

    // P2-10.5: TUYỆT ĐỐI KHÔNG LƯU GitHub access token vào DB

    // Sinh mã xác thực dùng 1 lần (TTL 60 giây) lưu vào Redis / Memory Fallback
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

    // Điểm 8: Mask log - Không ghi exchange code bí mật vào log
    this.logger.log(`Đã cấp exchange code cho người dùng [${user.tenDangNhap}]`);

    // Chuyển hướng về native app
    const separator = stateData.redirect.includes('?') ? '&' : '?';
    return `${stateData.redirect}${separator}code=${exchangeCode}`;
  }

  /**
   * Xử lý callback từ Google OAuth.
   * Đổi code lấy Access Token và User Profile, tạo mới hoặc liên kết tài khoản theo email/Google ID.
   */
  async xuLyGoogleCallback(code: string, state: string): Promise<string> {
    const stateData = await this.layVaXoaState(state);

    if (!stateData) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'Mã state xác thực không hợp lệ hoặc phiên đăng nhập đã quá hạn 10 phút',
      });
    }

    if (stateData.provider !== 'google') {
      throw new BadRequestException({
        maLoi: 'PROVIDER_KHONG_KHOP',
        thongBao: 'Mã state xác thực không khớp với nhà cung cấp Google',
      });
    }

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Chưa cấu hình GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET');
    }

    const callbackUrl =
      this.config.get<string>('GOOGLE_CALLBACK_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}/api/v1/auth/google/callback`;

    // 1. Đổi code lấy Google tokens
    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: callbackUrl,
        }).toString(),
        signal: AbortSignal.timeout(5000),
      });
    } catch (fetchErr) {
      this.logger.error(`Timeout hoặc lỗi kết nối Google token: ${(fetchErr as Error).message}`);
      throw new BadRequestException('Quá thời gian kết nối tới máy chủ Google OAuth');
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (!tokenRes.ok || !tokenData.access_token) {
      this.logger.error(`Lỗi đổi code Google: ${JSON.stringify(tokenData)}`);
      throw new BadRequestException('Không thể lấy mã truy cập từ Google');
    }

    // 2. Lấy thông tin userinfo từ Google
    let userRes: Response;
    try {
      userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch (fetchErr) {
      this.logger.error(`Timeout lấy thông tin profile Google: ${(fetchErr as Error).message}`);
      throw new BadRequestException('Quá thời gian kết nối tới Google UserInfo API');
    }

    if (!userRes.ok) {
      throw new BadRequestException('Không thể truy vấn thông tin người dùng từ Google');
    }

    const googleUser = (await userRes.json()) as {
      sub: string;
      name?: string;
      email?: string;
      email_verified?: boolean;
      picture?: string;
    };

    if (!googleUser.sub) {
      throw new BadRequestException(
        'Thông tin người dùng Google không hợp lệ (thiếu sub identifier)',
      );
    }

    // SEC-01: Chỉ xem email là hợp lệ khi googleUser.email_verified === true
    const isGoogleEmailVerified = Boolean(googleUser.email_verified && googleUser.email);
    const verifiedEmail =
      isGoogleEmailVerified && googleUser.email ? googleUser.email.trim().toLowerCase() : null;

    // 3. Tìm hoặc tự động liên kết tài khoản
    let user = await this.prisma.nguoiDung.findUnique({
      where: { maDinhDanhGoogle: googleUser.sub },
    });

    if (user) {
      // Đã có tài khoản liên kết với Google ID này -> cập nhật email nếu vừa được verified và user chưa có email
      if (isGoogleEmailVerified && verifiedEmail && !user.thuDienTu) {
        user = await this.prisma.nguoiDung.update({
          where: { maNguoiDung: user.maNguoiDung },
          data: {
            thuDienTu: verifiedEmail,
            duongDanAvatar: user.duongDanAvatar || googleUser.picture,
            tenHienThi: user.tenHienThi || googleUser.name,
          },
        });
      }
    } else if (isGoogleEmailVerified && verifiedEmail) {
      // Tự động liên kết nếu đã có tài khoản trùng email đã verified (ví dụ user đã đăng ký qua GitHub)
      // SEC-04 FIX: Chỉ liên kết nếu tài khoản đó CHƯA TỪNG liên kết với tài khoản Google khác
      const existingUserWithEmail = await this.prisma.nguoiDung.findFirst({
        where: { thuDienTu: verifiedEmail },
      });
      if (existingUserWithEmail && !existingUserWithEmail.maDinhDanhGoogle) {
        user = await this.prisma.nguoiDung.update({
          where: { maNguoiDung: existingUserWithEmail.maNguoiDung },
          data: {
            maDinhDanhGoogle: googleUser.sub,
            duongDanAvatar: existingUserWithEmail.duongDanAvatar || googleUser.picture,
            tenHienThi: existingUserWithEmail.tenHienThi || googleUser.name,
          },
        });
      }
    }

    if (!user) {
      // Tạo mới người dùng từ Google
      // Bảo vệ riêng tư: Tạo username từ name của Google (slug không dấu) hoặc UUID ngẫu nhiên, không dùng prefix email
      let baseUsername = 'user';
      if (googleUser.name && googleUser.name.trim().length > 0) {
        const slug = googleUser.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
        if (slug.length >= 3) {
          baseUsername = slug.slice(0, 20);
        } else {
          baseUsername = `user_${randomUUID().slice(0, 6)}`;
        }
      } else {
        baseUsername = `user_${randomUUID().slice(0, 6)}`;
      }

      let username = baseUsername;
      const existingUsername = await this.prisma.nguoiDung.findFirst({
        where: { tenDangNhap: username },
      });
      if (existingUsername) {
        username = `${baseUsername}_${randomUUID().slice(0, 4)}`;
      }

      // SEC-01: Cột thuDienTu CHỈ ĐƯỢC LƯU khi email ĐÃ XÁC MINH (googleUser.email_verified === true). Chưa xác minh bắt buộc lưu null.
      user = await this.prisma.nguoiDung.create({
        data: {
          maDinhDanhGoogle: googleUser.sub,
          tenDangNhap: username,
          tenHienThi: googleUser.name || username,
          thuDienTu: isGoogleEmailVerified ? verifiedEmail : null,
          duongDanAvatar: googleUser.picture,
          vaiTro: VaiTro.NGUOI_DUNG,
        },
      });
    }

    // 4. Sinh exchange code (TTL 60s) lưu vào Redis
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

    this.logger.log(`Đã cấp exchange code cho người dùng Google [${user.tenDangNhap}]`);

    // 5. Chuyển hướng về native app qua deep link
    const separator = stateData.redirect.includes('?') ? '&' : '?';
    return `${stateData.redirect}${separator}code=${exchangeCode}`;
  }

  /**
   * Đổi mã xác thực dùng 1 lần (Zero-Token-on-URL) lấy cặp JWT Tokens.
   * Điểm 2: Chuẩn hóa PKCE S256 theo RFC 7636 (base64url, length 43-128, timingSafeEqual).
   * Điểm 3: Nguyên tử hóa việc đọc và xóa exchange code (layVaXoa).
   */
  async doiMaXacThuc(dto: AuthExchangeDto) {
    const exchangeKey = `${CACHE_PREFIX.AUTH_EXCHANGE}${dto.code}`;

    // Điểm 3: Lấy và xóa exchange code nguyên tử (chống replay attack)
    const exchangeData = await this.cacheService.layVaXoa<{
      maNguoiDung: string;
      challenge: string;
    }>(exchangeKey);

    if (!exchangeData) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'Mã xác thực không hợp lệ hoặc đã qua thời hạn 60 giây',
      });
    }

    // Điểm 2: Kiểm tra độ dài code_verifier từ 43 đến 128 ký tự theo RFC 7636 Section 4.1
    if (!dto.verifier || dto.verifier.length < 43 || dto.verifier.length > 128) {
      throw new BadRequestException({
        maLoi: 'MA_XAC_THUC_KHONG_HOP_LE',
        thongBao: 'Độ dài PKCE code verifier phải từ 43 đến 128 ký tự theo chuẩn RFC 7636',
      });
    }

    // Điểm 2: Chỉ chấp nhận phương thức S256 base64url theo RFC 7636, so sánh timingSafeEqual
    const computedChallenge = createHash('sha256').update(dto.verifier).digest('base64url');
    const computedBuf = Buffer.from(computedChallenge);
    const storedBuf = Buffer.from(exchangeData.challenge);

    const isValidVerifier =
      computedBuf.length === storedBuf.length && timingSafeEqual(computedBuf, storedBuf);

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
   * Điểm 5: Concurrency updateMany & Grace Period 15s cho request song song khi mở app.
   * Điểm 6: Chống kẻ xấu gửi sid.rác làm đăng xuất người khác.
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

    let phien = await this.prisma.phienDangNhap.findUnique({
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

    // 1. Đối soát với bí mật token hiện tại
    const isCurrentSecretValid = await argon2.verify(phien.chuoiMaHoaToken, rawSecret);

    if (isCurrentSecretValid) {
      // Token hiện tại hợp lệ -> Tiến hành Token Rotation
      const newSecret = randomBytes(32).toString('hex');
      const newHashedSecret = await argon2.hash(newSecret);

      const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
      const newExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

      // Điểm 5: Cập nhật có điều kiện nguyên tử (Concurrency Guard)
      const updateResult = await this.prisma.phienDangNhap.updateMany({
        where: {
          maPhien,
          chuoiMaHoaToken: phien.chuoiMaHoaToken,
        },
        data: {
          chuoiMaHoaToken: newHashedSecret,
          chuoiMaHoaTokenCu: phien.chuoiMaHoaToken, // Lưu lại bản băm token trước đó
          thoiGianXoayVongCuoi: new Date(),
          thoiGianHetHan: newExpiresAt,
        },
      });

      // Nếu update thành công 1 bản ghi
      if (updateResult.count === 1) {
        await this.devicesService.capNhatHoatDong(phien.maThietBi);

        const payload: JwtPayload = {
          sub: phien.maNguoiDung,
          sid: phien.maPhien,
          did: phien.maThietBi,
          role: phien.nguoiDung.vaiTro,
        };

        const accessToken = await this.jwtService.signAsync(payload);
        return {
          accessToken,
          refreshToken: `${maPhien}.${newSecret}`,
        };
      }

      // Điểm B (Review): Request thua khi chạy đua (count === 0) do request đồng thời khác vừa xoay vòng token.
      // Đọc lại phiên tươi từ CSDL để nạp chuoiMaHoaTokenCu và thoiGianXoayVongCuoi mới nhất,
      // sau đó chuyển tiếp xuống nhánh kiểm tra Grace Period thay vì bị 401 oan.
      const phienMoiNhat = await this.prisma.phienDangNhap.findUnique({
        where: { maPhien },
        include: {
          nguoiDung: true,
          thietBi: true,
        },
      });
      if (phienMoiNhat) {
        phien = phienMoiNhat;
      }
    }

    // 2. Điểm 5 & 6: Không khớp token hiện tại -> Kiểm tra xem có khớp token vừa xoay vòng trước đó không?
    if (phien.chuoiMaHoaTokenCu) {
      const isPreviousSecretValid = await argon2.verify(phien.chuoiMaHoaTokenCu, rawSecret);
      if (isPreviousSecretValid) {
        const gracePeriodMs = 15000; // Ân hạn 15 giây cho race-condition client mở app gửi request song song
        const isWithinGracePeriod =
          phien.thoiGianXoayVongCuoi &&
          Date.now() - phien.thoiGianXoayVongCuoi.getTime() <= gracePeriodMs;

        if (isWithinGracePeriod) {
          // Điểm A (Review): Client gửi request đồng thời trong Grace Period:
          // Cấp lại accessToken mới, TUYỆT ĐỐI KHÔNG cấp lại refreshToken cũ để tránh client ghi đè token cũ lên token mới
          this.logger.log(
            `Ân hạn refresh token đồng thời trong Grace Period cho phiên [${maPhien}] (chỉ cấp accessToken mới)`,
          );
          const payload: JwtPayload = {
            sub: phien.maNguoiDung,
            sid: phien.maPhien,
            did: phien.maThietBi,
            role: phien.nguoiDung.vaiTro,
          };
          const accessToken = await this.jwtService.signAsync(payload);
          return {
            accessToken,
          };
        }

        // ⚠️ THỰC SỰ LÀ TÁI SỬ DỤNG TOKEN CŨ NGOÀI KHOẢNG ÂN HẠN (REUSE DETECTION - P2-12.4):
        // Token này ĐÚNG là token trước đó của phiên này, nhưng đã gửi sau 15 giây!
        this.logger.warn(
          `🚨 CẢNH BÁO BẢO MẬT: Phát hiện tái sử dụng Refresh Token cũ ngoài Grace Period tại phiên [${maPhien}]. Thu hồi phiên lập tức!`,
        );
        await this.prisma.phienDangNhap.delete({ where: { maPhien } });
        await this.cacheService.del(`auth:session:${maPhien}`);
        throw new UnauthorizedException({
          maLoi: 'CHUA_XAC_THUC',
          thongBao:
            'Phát hiện token đã bị thu hồi hoặc tái sử dụng trái phép. Phiên đăng nhập đã bị vô hiệu hóa vì lý do an toàn.',
        });
      }
    }

    // 3. Điểm 6: Nếu token gửi lên KHÔNG khớp token hiện tại và CŨNG KHÔNG khớp token cũ (ví dụ: sid.rác của kẻ phá hoại):
    // TUYỆT ĐỐI KHÔNG XÓA PHIÊN CỦA NGƯỜI DÙNG! Chỉ từ chối request đó với 401!
    throw new UnauthorizedException({
      maLoi: 'CHUA_XAC_THUC',
      thongBao: 'Refresh Token không hợp lệ',
    });
  }

  /**
   * Đăng xuất phiên hiện tại (Xóa PhienDangNhap, giữ nguyên bản ghi ThietBi).
   */
  async dangXuat(maPhien: string): Promise<void> {
    try {
      await this.prisma.phienDangNhap.delete({
        where: { maPhien },
      });
      await this.cacheService.del(`auth:session:${maPhien}`);
      this.logger.log(`Đã hủy phiên làm việc [${maPhien}]`);
    } catch {
      // Bỏ qua nếu phiên đã bị xóa trước đó
      await this.cacheService.del(`auth:session:${maPhien}`);
    }
  }

  /**
   * Đăng xuất trên toàn bộ thiết bị (Xóa toàn bộ PhienDangNhap của người dùng).
   */
  async dangXuatTatCa(maNguoiDung: string): Promise<void> {
    try {
      const phienList = await this.prisma.phienDangNhap.findMany({
        where: { maNguoiDung },
        select: { maPhien: true },
      });
      await Promise.all(phienList.map((p) => this.cacheService.del(`auth:session:${p.maPhien}`)));
    } catch {
      // Bỏ qua nếu lỗi đọc
    }
    await this.prisma.phienDangNhap.deleteMany({
      where: { maNguoiDung },
    });
    this.logger.log(`Đã thu hồi toàn bộ phiên đăng nhập của người dùng [${maNguoiDung}]`);
  }

  /**
   * Dọn dẹp các phiên làm việc đã hết hạn trong CSDL (P2-12.5).
   * Điểm 10: Tự động chạy mỗi ngày lúc nửa đêm qua Cron job.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async donDepPhienHetHan(): Promise<number> {
    const result = await this.prisma.phienDangNhap.deleteMany({
      where: {
        thoiGianHetHan: {
          lt: new Date(),
        },
      },
    });
    if (result.count > 0) {
      this.logger.log(`Đã dọn dẹp ${result.count} phiên đăng nhập hết hạn`);
    }
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

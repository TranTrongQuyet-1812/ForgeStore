import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { XacThucService } from './xac-thuc.service';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { AuthExchangeDto } from './dto/trao-doi-xac-thuc.dto';
import { RefreshTokenDto } from './dto/lam-moi-token.dto';
import { GithubAuthQueryDto } from './dto/truy-van-xac-thuc-github.dto';
import { GoogleAuthQueryDto } from './dto/truy-van-xac-thuc-google.dto';
import { UserSessionContext } from './interfaces/jwt-payload.interface';
import { dungTrangQuayLaiApp, TrangThaiQuayLai } from './trang-quay-lai-app';

/** Chống HTTP Parameter Pollution: `?code=a&code=b` thành mảng, chỉ lấy giá trị đầu. */
function layMotGiaTri(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined;
}

@ApiTags('Xác thực (Auth)')
@Controller('xac-thuc')
export class XacThucController {
  constructor(private readonly authService: XacThucService) {}

  /**
   * Trả trang HTML trung gian (thay cho 302 thẳng sang deep link) để trình duyệt hiển thị
   * trang có thương hiệu, dọn URL callback khỏi thanh địa chỉ và tự mở lại app.
   */
  private traVeApp(res: Response, trangThai: TrangThaiQuayLai, deepLink?: string) {
    const { html, nonce } = dungTrangQuayLaiApp(trangThai, deepLink);
    return res
      .status(HttpStatus.OK)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      })
      .send(html);
  }

  private traVeLoi(res: Response, redirectTarget: string, errCode: string) {
    const sep = redirectTarget.includes('?') ? '&' : '?';
    const deepLink = `${redirectTarget}${sep}error=${encodeURIComponent(errCode)}`;
    return this.traVeApp(res, errCode === 'access_denied' ? 'da-huy' : 'that-bai', deepLink);
  }

  @CongKhai()
  @Get('xong')
  @ApiOperation({
    summary: 'Trang kết thúc đăng nhập',
    description:
      'Trang tĩnh hiển thị sau khi trang callback đã mở lại app (đường dẫn sạch trên thanh địa chỉ, tránh 404 khi người dùng tải lại trang).',
  })
  @ApiResponse({ status: 200, description: 'Trang HTML hướng dẫn quay lại ứng dụng' })
  xong(@Res() res: Response) {
    return this.traVeApp(res, 'xong');
  }

  @CongKhai()
  @Get('github')
  @ApiOperation({
    summary: 'Khởi tạo đăng nhập GitHub OAuth',
    description:
      'Nhận PKCE challenge và redirect URI từ app native, sinh mã state ngẫu nhiên và chuyển hướng trình duyệt tới trang ủy quyền của GitHub.',
  })
  @ApiResponse({ status: 302, description: 'Chuyển hướng đến GitHub OAuth Authorize' })
  async khoiTaoGithub(@Query() query: GithubAuthQueryDto, @Res() res: Response) {
    const authUrl = await this.authService.khoiTaoGithubAuth(query.challenge, query.redirect);
    return res.redirect(authUrl);
  }

  @CongKhai()
  @Get('callback')
  @ApiOperation({
    summary: 'Xử lý phản hồi từ GitHub OAuth (Callback)',
    description:
      'Nhận code và state từ GitHub, xác thực state 1 lần, lấy thông tin người dùng GitHub, sinh mã exchange code (TTL 60s) và chuyển hướng về app native qua deep link.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trang HTML tự mở lại native app qua deep link kèm mã 1 lần ?code=... (hoặc ?error=...)',
  })
  async xuLyCallback(
    @Query() query: Record<string, string | string[] | undefined>,
    @Res() res: Response,
  ) {
    try {
      // Chuẩn hóa ép kiểu an toàn chống HTTP Parameter Pollution (HPP)
      const code = layMotGiaTri(query.code);
      const state = layMotGiaTri(query.state);
      const error = layMotGiaTri(query.error);

      // 1. Nếu GitHub trả về lỗi hoặc người dùng hủy ủy quyền
      if (error || !code || !state) {
        let redirectTarget = 'forgestore://auth';
        if (state) {
          try {
            const stateData = await this.authService.layVaXoaState(state);
            if (stateData?.redirect) {
              redirectTarget = stateData.redirect;
            }
          } catch {
            // Nuốt lỗi Redis để luôn redirect về client
          }
        }
        return this.traVeLoi(res, redirectTarget, error || 'DANG_NHAP_BI_HUY');
      }

      // 2. Luồng bình thường: Đổi code lấy GitHub token và sinh exchange code
      const deepLinkUrl = await this.authService.xuLyGithubCallback(code, state);
      return this.traVeApp(res, 'thanh-cong', deepLinkUrl);
    } catch (err: unknown) {
      // 3. Bắt các lỗi trong quá trình callback và trả về deep-link để UI client không bị treo
      const errObj = err as { response?: { maLoi?: string; thongBao?: string } };
      return this.traVeLoi(
        res,
        'forgestore://auth',
        errObj?.response?.maLoi || 'DANG_NHAP_THAT_BAI',
      );
    }
  }

  @CongKhai()
  @Get('google')
  @ApiOperation({
    summary: 'Khởi tạo đăng nhập Google OAuth',
    description:
      'Nhận PKCE challenge và redirect URI từ app native, sinh mã state ngẫu nhiên và chuyển hướng trình duyệt tới trang ủy quyền của Google.',
  })
  @ApiResponse({ status: 302, description: 'Chuyển hướng đến Google OAuth Authorize' })
  async khoiTaoGoogle(@Query() query: GoogleAuthQueryDto, @Res() res: Response) {
    const authUrl = await this.authService.khoiTaoGoogleAuth(query.challenge, query.redirect);
    return res.redirect(authUrl);
  }

  @CongKhai()
  @Get('google/callback')
  @ApiOperation({
    summary: 'Xử lý phản hồi từ Google OAuth (Callback)',
    description:
      'Nhận code và state từ Google, xác thực state 1 lần, lấy thông tin người dùng Google, sinh mã exchange code (TTL 60s) và chuyển hướng về app native qua deep link.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trang HTML tự mở lại native app qua deep link kèm mã 1 lần ?code=... (hoặc ?error=...)',
  })
  async xuLyGoogleCallback(
    @Query() query: Record<string, string | string[] | undefined>,
    @Res() res: Response,
  ) {
    try {
      // Chuẩn hóa ép kiểu an toàn chống HTTP Parameter Pollution (HPP)
      const code = layMotGiaTri(query.code);
      const state = layMotGiaTri(query.state);
      const error = layMotGiaTri(query.error);

      if (error || !code || !state) {
        let redirectTarget = 'forgestore://auth';
        if (state) {
          try {
            const stateData = await this.authService.layVaXoaState(state);
            if (stateData?.redirect) {
              redirectTarget = stateData.redirect;
            }
          } catch {
            // Nuốt lỗi Redis để luôn redirect về client
          }
        }
        return this.traVeLoi(res, redirectTarget, error || 'DANG_NHAP_BI_HUY');
      }

      const deepLinkUrl = await this.authService.xuLyGoogleCallback(code, state);
      return this.traVeApp(res, 'thanh-cong', deepLinkUrl);
    } catch (err: unknown) {
      const errObj = err as { response?: { maLoi?: string; thongBao?: string } };
      return this.traVeLoi(
        res,
        'forgestore://auth',
        errObj?.response?.maLoi || 'DANG_NHAP_THAT_BAI',
      );
    }
  }

  @CongKhai()
  // P6-04.4: endpoint công khai cấp token nên siết chặt hơn mức chung 100/phút
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('doi-ma')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đổi mã xác thực 1 lần lấy cặp JWT Tokens (Zero-Token-on-URL, D-09)',
    description:
      'Client native gửi mã 1 lần, PKCE code verifier và thông tin phần cứng thiết bị. Server kiểm tra verifier, đăng ký thiết bị vật lý, tạo phiên và trả về access token + refresh token.',
  })
  @ApiResponse({ status: 200, description: 'Xác thực thành công và cấp phát token' })
  @ApiResponse({ status: 400, description: 'Mã đổi hoặc PKCE verifier không hợp lệ' })
  async doiMaXacThuc(@Body() dto: AuthExchangeDto) {
    return await this.authService.doiMaXacThuc(dto);
  }

  @CongKhai()
  // P6-04.4: Desktop làm mới khoảng 15 phút một lần; 20/phút đủ cho nhiều máy chung một IP
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('lam-moi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới Access Token và xoay vòng Refresh Token (Token Rotation, P2-12)',
    description:
      'Cung cấp refresh token cũ. Server xác thực bằng Argon2, tạo bí mật mới và thay thế bản băm trong DB. Nếu phát hiện token cũ bị dùng lại ngoài ân hạn, toàn bộ phiên bị thu hồi ngay lập tức.\n\n' +
      '⚠️ Lưu ý cho Client (P3-03): Trong cửa sổ ân hạn 15 giây (Grace Period khi nhiều request refresh gửi đồng thời), server chỉ trả về accessToken mới và KHÔNG trả về refreshToken. Client phải giữ nguyên refreshToken đang lưu, không được ghi đè.',
  })
  @ApiResponse({ status: 200, description: 'Làm mới token thành công' })
  @ApiResponse({
    status: 401,
    description: 'Token không hợp lệ, hết hạn, hoặc bị phát hiện tái sử dụng',
  })
  async lamMoiToken(@Body() dto: RefreshTokenDto) {
    return await this.authService.lamMoiToken(dto);
  }

  @Post('dang-xuat')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất khỏi thiết bị hiện tại',
    description:
      'Xóa phiên đăng nhập hiện tại. Bản ghi thiết bị vật lý và danh sách app đã cài vẫn được bảo toàn nguyên vẹn (D-02).',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async dangXuat(@NguoiDungHienTai() user: UserSessionContext) {
    await this.authService.dangXuat(user.maPhien);
    return { thongBao: 'Đăng xuất phiên hiện tại thành công' };
  }

  @Post('dang-xuat-tat-ca')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất khỏi toàn bộ thiết bị',
    description:
      'Thu hồi toàn bộ phiên đăng nhập của người dùng trên tất cả thiết bị. Các thiết bị vẫn được giữ lại.',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất toàn bộ thiết bị thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async dangXuatTatCa(@NguoiDungHienTai() user: UserSessionContext) {
    await this.authService.dangXuatTatCa(user.maNguoiDung);
    return { thongBao: 'Đã đăng xuất khỏi toàn bộ thiết bị' };
  }
}

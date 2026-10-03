import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { AuthExchangeDto } from './dto/auth-exchange.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GithubAuthQueryDto } from './dto/github-auth-query.dto';
import { GoogleAuthQueryDto } from './dto/google-auth-query.dto';
import { UserSessionContext } from './interfaces/jwt-payload.interface';

@ApiTags('Xác thực (Auth)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @ApiResponse({ status: 302, description: 'Chuyển hướng về native app kèm mã 1 lần ?code=...' })
  @ApiResponse({ status: 400, description: 'State hoặc code không hợp lệ hoặc hết hạn' })
  async xuLyCallback(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    try {
      // Chuẩn hóa ép kiểu an toàn chống HTTP Parameter Pollution (HPP)
      const code =
        typeof query.code === 'string'
          ? query.code
          : Array.isArray(query.code)
            ? (query.code as string[])[0]
            : undefined;
      const state =
        typeof query.state === 'string'
          ? query.state
          : Array.isArray(query.state)
            ? (query.state as string[])[0]
            : undefined;
      const error =
        typeof query.error === 'string'
          ? query.error
          : Array.isArray(query.error)
            ? (query.error as string[])[0]
            : undefined;

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
        const errCode = error || 'DANG_NHAP_BI_HUY';
        const sep = redirectTarget.includes('?') ? '&' : '?';
        return res.redirect(`${redirectTarget}${sep}error=${encodeURIComponent(errCode)}`);
      }

      // 2. Luồng bình thường: Đổi code lấy GitHub token và sinh exchange code
      const deepLinkUrl = await this.authService.xuLyGithubCallback(code, state);
      return res.redirect(deepLinkUrl);
    } catch (err: unknown) {
      // 3. Bắt các lỗi trong quá trình callback và redirect về deep-link để UI client không bị treo
      const redirectTarget = 'forgestore://auth';
      const errObj = err as { response?: { maLoi?: string; thongBao?: string } };
      const errCode = errObj?.response?.maLoi || 'DANG_NHAP_THAT_BAI';
      const sep = redirectTarget.includes('?') ? '&' : '?';
      return res.redirect(`${redirectTarget}${sep}error=${encodeURIComponent(errCode)}`);
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
  @ApiResponse({ status: 302, description: 'Chuyển hướng về native app kèm mã 1 lần ?code=...' })
  @ApiResponse({ status: 400, description: 'State hoặc code không hợp lệ hoặc hết hạn' })
  async xuLyGoogleCallback(
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    try {
      // Chuẩn hóa ép kiểu an toàn chống HTTP Parameter Pollution (HPP)
      const code =
        typeof query.code === 'string'
          ? query.code
          : Array.isArray(query.code)
            ? (query.code as string[])[0]
            : undefined;
      const state =
        typeof query.state === 'string'
          ? query.state
          : Array.isArray(query.state)
            ? (query.state as string[])[0]
            : undefined;
      const error =
        typeof query.error === 'string'
          ? query.error
          : Array.isArray(query.error)
            ? (query.error as string[])[0]
            : undefined;

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
        const errCode = error || 'DANG_NHAP_BI_HUY';
        const sep = redirectTarget.includes('?') ? '&' : '?';
        return res.redirect(`${redirectTarget}${sep}error=${encodeURIComponent(errCode)}`);
      }

      const deepLinkUrl = await this.authService.xuLyGoogleCallback(code, state);
      return res.redirect(deepLinkUrl);
    } catch (err: unknown) {
      const redirectTarget = 'forgestore://auth';
      const errObj = err as { response?: { maLoi?: string; thongBao?: string } };
      const errCode = errObj?.response?.maLoi || 'DANG_NHAP_THAT_BAI';
      const sep = redirectTarget.includes('?') ? '&' : '?';
      return res.redirect(`${redirectTarget}${sep}error=${encodeURIComponent(errCode)}`);
    }
  }

  @CongKhai()
  @Post('exchange')
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
  @Post('refresh')
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

  @Post('logout')
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

  @Post('logout-all')
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

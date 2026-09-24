import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { AuthExchangeDto } from './dto/auth-exchange.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GithubAuthQueryDto, GithubCallbackQueryDto } from './dto/github-auth-query.dto';
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
  async xuLyCallback(@Query() query: GithubCallbackQueryDto, @Res() res: Response) {
    const deepLinkUrl = await this.authService.xuLyGithubCallback(query.code, query.state);
    return res.redirect(deepLinkUrl);
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

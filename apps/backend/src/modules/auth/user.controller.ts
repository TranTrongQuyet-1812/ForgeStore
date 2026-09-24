import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { UserSessionContext } from './interfaces/jwt-payload.interface';

@ApiTags('Người dùng (User Profile)')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản cá nhân',
    description: 'Trả về thông tin chi tiết của người dùng đang đăng nhập dựa trên JWT token.',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin hồ sơ thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực hoặc token không hợp lệ' })
  async layHoSo(@NguoiDungHienTai() user: UserSessionContext) {
    return await this.authService.layHoSo(user.maNguoiDung);
  }
}

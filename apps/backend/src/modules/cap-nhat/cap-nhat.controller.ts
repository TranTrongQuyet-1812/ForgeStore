import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { UserSessionContext } from '../xac-thuc/interfaces/jwt-payload.interface';
import { UpdaterService } from './cap-nhat.service';
import { CheckUpdatesDto } from './dto/kiem-tra-cap-nhat.dto';

@ApiTags('Updater - Cập Nhật Ứng Dụng')
@ApiBearerAuth()
@Controller('apps')
export class UpdaterController {
  constructor(private readonly updaterService: UpdaterService) {}

  @Post('check-updates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm tra bản cập nhật cho các ứng dụng đã cài trên thiết bị (P2-52)',
    description:
      'Yêu cầu xác thực JWT. Nhận mã thiết bị và danh sách ứng dụng (hoặc tự động lấy từ DB). Kiểm tra quyền sở hữu thiết bị, so sánh phiên bản bằng thuật toán SemVer/CalVer/Tag thông minh và ưu tiên release đã cài trên Android (D-13). Trả về danh sách ứng dụng có bản mới kèm thông tin tệp tải.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách các ứng dụng có bản cập nhật mới',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền kiểm tra cập nhật trên thiết bị của người khác',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy thiết bị yêu cầu',
  })
  async kiemTraCapNhat(@NguoiDungHienTai() user: UserSessionContext, @Body() dto: CheckUpdatesDto) {
    return this.updaterService.kiemTraCapNhat(dto, user.maNguoiDung, user.vaiTro);
  }
}

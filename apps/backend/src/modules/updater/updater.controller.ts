import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { UpdaterService } from './updater.service';
import { CheckUpdatesDto } from './dto/check-updates.dto';

@ApiTags('Updater - Cập Nhật Ứng Dụng')
@Controller('apps')
export class UpdaterController {
  constructor(private readonly updaterService: UpdaterService) {}

  @CongKhai()
  @Post('check-updates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm tra bản cập nhật cho các ứng dụng đã cài trên thiết bị (P2-52)',
    description:
      'Nhận mã thiết bị và danh sách ứng dụng (hoặc tự động lấy từ DB). So sánh phiên bản bằng thuật toán SemVer/CalVer/Tag thông minh và ưu tiên release đã cài trên Android (D-13). Trả về danh sách ứng dụng có bản mới kèm thông tin tệp tải.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách các ứng dụng có bản cập nhật mới',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy thiết bị yêu cầu',
  })
  async kiemTraCapNhat(@Body() dto: CheckUpdatesDto) {
    return this.updaterService.kiemTraCapNhat(dto);
  }
}

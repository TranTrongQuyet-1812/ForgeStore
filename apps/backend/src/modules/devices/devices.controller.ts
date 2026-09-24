import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { UserSessionContext } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Thiết bị (Devices)')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách thiết bị của tôi',
    description:
      'Trả về toàn bộ các thiết bị vật lý đã đăng ký gắn với tài khoản người dùng hiện tại.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách thiết bị thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực hoặc token không hợp lệ' })
  async layDanhSach(@NguoiDungHienTai() user: UserSessionContext) {
    return await this.devicesService.layDanhSachThietBi(user.maNguoiDung);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Đổi tên thiết bị',
    description:
      'Cho phép người dùng đổi tên gọi gợi nhớ cho thiết bị của mình (ví dụ: Laptop Dell XPS 15).',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị (maThietBi)' })
  @ApiResponse({ status: 200, description: 'Đổi tên thiết bị thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu yêu cầu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thiết bị' })
  async doiTen(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return await this.devicesService.doiTenThietBi(user.maNguoiDung, id, dto.tenThietBi);
  }
}

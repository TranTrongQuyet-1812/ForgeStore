import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { GhiNhanCaiDatDto } from './dto/installed-app.dto';
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

  @Get(':id/installed')
  @ApiOperation({
    summary: 'Lấy danh sách ứng dụng đã cài đặt trên thiết bị (P2-51.1)',
    description:
      'Trả về các ứng dụng đã cài đặt trên thiết bị, kèm cờ coBanMoi nếu có bản cập nhật.',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách app đã cài thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thiết bị' })
  async layDanhSachAppDaCai(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return await this.devicesService.layDanhSachAppDaCai(user.maNguoiDung, id);
  }

  @Post(':id/installed')
  @ApiOperation({
    summary: 'Ghi nhận hoặc nâng cấp ứng dụng đã cài trên thiết bị (P2-51.2)',
    description: 'Lưu hoặc cập nhật thông tin phiên bản app đang chạy trên thiết bị vật lý.',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị' })
  @ApiResponse({ status: 200, description: 'Ghi nhận cài đặt thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thiết bị hoặc ứng dụng' })
  async ghiNhanCaiDat(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: GhiNhanCaiDatDto,
  ) {
    return await this.devicesService.ghiNhanCaiDat(user.maNguoiDung, id, dto);
  }

  @Delete(':id/installed/:appId')
  @ApiOperation({
    summary: 'Gỡ ứng dụng đã cài đặt khỏi thiết bị (P2-51.3)',
    description: 'Xóa bản ghi ứng dụng đã cài đặt khi người dùng gỡ app khỏi máy.',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị' })
  @ApiParam({ name: 'appId', description: 'Mã UUID của ứng dụng cần gỡ' })
  @ApiResponse({ status: 200, description: 'Gỡ cài đặt thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thiết bị' })
  async goCaiDat(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('appId', new ParseUUIDPipe({ version: '4' })) appId: string,
  ) {
    return await this.devicesService.goCaiDat(user.maNguoiDung, id, appId);
  }
}

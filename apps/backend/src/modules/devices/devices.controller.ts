import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto } from './dto/update-device.dto';
import {
  CapNhatKhoaRegistryDto,
  GhiNhanCaiDatCliDto,
  GhiNhanCaiDatDto,
} from './dto/installed-app.dto';
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

  @Post(':id/installed/cli')
  @ApiOperation({
    summary: 'Ghi nhận người dùng cài đặt ứng dụng qua dòng lệnh CLI ("Tôi đã cài" - P3B-16.5)',
    description:
      'Lưu thông tin cài đặt CLI với trạng thái CHO_XAC_NHAN, tự hết hạn sau 24 giờ nếu không xác nhận.',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị' })
  @ApiResponse({ status: 201, description: 'Ghi nhận cài đặt CLI thành công' })
  @ApiResponse({ status: 400, description: 'Tên gói hoặc phiên bản không hợp lệ / chứa ký tự cấm' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thiết bị hoặc ứng dụng' })
  async ghiNhanCaiDatCli(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: GhiNhanCaiDatCliDto,
  ) {
    return await this.devicesService.ghiNhanCaiDatCli(user.maNguoiDung, id, dto);
  }

  @Patch(':id/installed/:appId/confirm-cli')
  @ApiOperation({
    summary: 'Xác nhận lại ứng dụng CLI đã cài đặt ("Xác nhận đã cài" - P3B-16.5)',
    description: 'Chuyển trạng thái ứng dụng CLI sang DA_XAC_NHAN và hủy đếm ngược hết hạn 24 giờ.',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị' })
  @ApiParam({ name: 'appId', description: 'Mã UUID của ứng dụng' })
  @ApiResponse({ status: 200, description: 'Xác nhận cài đặt CLI thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bản ghi cài đặt' })
  async xacNhanCaiDatCli(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('appId', new ParseUUIDPipe({ version: '4' })) appId: string,
  ) {
    return await this.devicesService.xacNhanCaiDatCli(user.maNguoiDung, id, appId);
  }

  @Delete(':id/installed/:appId')
  @ApiOperation({
    summary: 'Gỡ ứng dụng đã cài đặt khỏi thiết bị (P2-51.3 & P3B-16.6)',
    description:
      'Xóa bản ghi ứng dụng đã cài đặt khi người dùng gỡ app khỏi máy hoặc xác nhận đã gỡ.',
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

  @Patch(':id/installed/:appId/registry')
  @ApiOperation({
    summary: 'Cập nhật riêng khóa Registry Windows cho ứng dụng đã cài đặt',
    description:
      'Chỉ cập nhật khóa Registry và tên hiển thị Registry, bảo toàn mã tệp và phiên bản.',
  })
  @ApiParam({ name: 'id', description: 'Mã UUID của thiết bị' })
  @ApiParam({ name: 'appId', description: 'Mã UUID của ứng dụng' })
  @ApiResponse({ status: 200, description: 'Cập nhật khóa registry thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập thiết bị của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thiết bị hoặc bản ghi cài đặt' })
  async capNhatKhoaRegistry(
    @NguoiDungHienTai() user: UserSessionContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('appId', new ParseUUIDPipe({ version: '4' })) appId: string,
    @Body() dto: CapNhatKhoaRegistryDto,
  ) {
    return await this.devicesService.capNhatKhoaRegistry(user.maNguoiDung, id, appId, dto);
  }
}

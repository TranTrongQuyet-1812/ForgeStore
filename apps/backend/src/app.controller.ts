import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CongKhai } from './common/decorators/cong-khai.decorator';

@ApiTags('Root - Trang Chủ API')
@CongKhai()
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Thông tin hệ thống ForgeStore Central Backend' })
  layThongTinHeThong() {
    return {
      tenHeThong: 'ForgeStore Central Backend API',
      phienBan: '0.1.0',
      trangThai: 'HOAT_DONG_TOT',
    };
  }
}

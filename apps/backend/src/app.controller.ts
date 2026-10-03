import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CongKhai } from './common/decorators/cong-khai.decorator';

@ApiTags('Root - Trang Chủ API')
@CongKhai()
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Thông tin hệ thống và chào mừng ForgeStore Central Backend' })
  layThongTinHeThong() {
    return {
      tenHeThong: 'ForgeStore Central Backend API',
      khauHieu: 'Hệ thống phân phối ứng dụng mã nguồn mở tự do & minh bạch',
      phienBan: '0.1.0',
      haTang: 'Dokploy Home Server (Self-Hosted)',
      csdl: 'PostgreSQL 17 + pgvector',
      boNhoDem: 'Redis Swarm',
      trangThai: 'HOAT_DONG_TOT',
      taiLieuApi: '/api/docs',
      kiemTraSucKhoe: '/api/v1/health',
    };
  }
}

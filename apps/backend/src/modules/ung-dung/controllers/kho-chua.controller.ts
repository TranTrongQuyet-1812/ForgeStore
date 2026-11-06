import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { InspectRepoResponseDto } from '@forgestore/types';
import { UngDungService } from '../ung-dung.service';
import { InspectRepoDto } from '../dto/kiem-tra-repo.dto';

interface RequestWithUser extends Request {
  user?: { maNguoiDung?: string };
}

@ApiTags('Repos - Nạp & Kiểm Định Kho Nguồn (Module 6)')
@Controller('kho-chua')
export class KhoChuaController {
  constructor(private readonly appsService: UngDungService) {}

  // Nạp repo mới ghi vào CSDL production: bắt đăng nhập để mỗi lượt nạp gắn với một tài khoản (nhật ký nạp)
  @Throttle({ default: { limit: 30, ttl: 3600000 } })
  @Post('kiem-tra')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm định và nạp Repository tùy chọn - Paste & Play (P2-41)',
    description:
      'Nhận liên kết GitHub repo hoặc slug, tự động kiểm định: 1. Repo tồn tại; 2. Có bản phát hành; 3. Có file cài đặt tương thích nền tảng. Sau đó đồng bộ vào CSDL Store, kích hoạt Lazy AI và trả về file cài đặt sẵn sàng 1-Click.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm định và thông tin ứng dụng nạp thành công',
  })
  async kiemDinhRepo(
    @Body() dto: InspectRepoDto,
    @Req() req: RequestWithUser,
  ): Promise<InspectRepoResponseDto> {
    const userId = req.user?.maNguoiDung;
    return this.appsService.kiemDinhVaNapRepo(dto, userId);
  }
}

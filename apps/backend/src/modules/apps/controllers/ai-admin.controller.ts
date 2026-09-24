import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppsService } from '../apps.service';
import { CongKhai } from '../../../common/decorators/cong-khai.decorator';

export class PrewarmAiDto {
  danhSachAppIds?: string[];
}

@ApiTags('Admin AI')
@Controller('admin/ai')
export class AiAdminController {
  constructor(private readonly appsService: AppsService) {}

  @CongKhai()
  @Post('prewarm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chạy phân tích Dual-AI trước cho các app demo (P2-31.5, phục vụ P6-07)',
    description: 'Chạy ngầm lazy AI cho danh sách app hoặc các app chưa được phân tích.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả số app đã chạy và thành công' })
  async prewarm(@Body() body?: PrewarmAiDto) {
    return this.appsService.chayPrewarmAI(body?.danhSachAppIds);
  }
}

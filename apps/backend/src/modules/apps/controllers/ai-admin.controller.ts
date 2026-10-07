import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { VaiTro } from '@prisma/client';
import { AppsService } from '../apps.service';
import { AppDescriptionTranslationService } from '../../ai/translation/services/app-description-translation.service';
import { VaiTroYeuCau } from '../../../common/decorators/vai-tro.decorator';

export class PrewarmAiDto {
  @IsOptional()
  @IsArray({ message: 'danhSachAppIds phải là một mảng chuỗi' })
  @IsString({
    each: true,
    message: 'Mỗi phần tử trong danhSachAppIds phải là chuỗi UUID hoặc slug repo',
  })
  danhSachAppIds?: string[];
}

@ApiTags('Admin AI')
@ApiBearerAuth()
@Controller('admin/ai')
export class AiAdminController {
  constructor(
    private readonly appsService: AppsService,
    private readonly appDescriptionTranslationService: AppDescriptionTranslationService,
  ) {}

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('prewarm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chạy phân tích Dual-AI trước cho các app demo (P2-31.5, phục vụ P6-07)',
    description:
      'Chạy ngầm lazy AI cho danh sách app hoặc các app chưa được phân tích. Yêu cầu quyền QUAN_TRI_VIEN.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả số app đã chạy và thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền quản trị viên' })
  async prewarm(@Body() body?: PrewarmAiDto) {
    return this.appsService.chayPrewarmAI(body?.danhSachAppIds);
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('translate-descriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dịch gom lô mô tả toàn bộ ứng dụng sang tiếng Việt (P3B-04)',
    description: 'Quét và dịch mô tả các ứng dụng chưa có bản dịch hoặc mô tả đã thay đổi.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả số app đã quét và dịch thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền quản trị viên' })
  async translateDescriptions(@Body('forceAll') forceAll?: boolean) {
    return this.appDescriptionTranslationService.dichMoTaCacApp(Boolean(forceAll));
  }
}

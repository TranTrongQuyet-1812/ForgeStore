import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { VaiTro } from '@prisma/client';
import { UngDungService } from '../ung-dung.service';
import { AppDescriptionTranslationService } from '../../ai/translation/services/app-description-translation.service';
import { DayChuyenNapRepoService } from '../services/day-chuyen-nap-repo.service';
import { KhamPhaRepoService } from '../services/kham-pha-repo.service';
import { TheoDoiThayDoiService } from '../services/theo-doi-thay-doi.service';
import { ThongKeNapRepoService } from '../services/thong-ke-nap-repo.service';
import { LlmRateLimiterService } from '../../ai/services/llm-rate-limiter.service';
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

export class IngestionDiscoverDto {
  @IsOptional()
  @IsArray({ message: 'repos phải là một mảng chuỗi' })
  @IsString({ each: true, message: 'Mỗi phần tử phải là chuỗi owner/repo' })
  repos?: string[];
}

export class TheoDoiRunDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'soApp phải là số nguyên' })
  @Min(1, { message: 'soApp tối thiểu là 1' })
  @Max(500, { message: 'soApp tối đa là 500' })
  soApp?: number;
}

export class IngestionRunDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'batchSize phải là số nguyên' })
  @Min(1, { message: 'batchSize tối thiểu là 1' })
  @Max(100, { message: 'batchSize tối đa là 100' })
  batchSize?: number;

  @IsOptional()
  @IsBoolean({ message: 'forceRun phải là kiểu boolean' })
  forceRun?: boolean;
}

@ApiTags('Admin AI')
@ApiBearerAuth()
@Controller('quan-tri/ai')
export class AiQuanTriController {
  constructor(
    private readonly appsService: UngDungService,
    private readonly appDescriptionTranslationService: AppDescriptionTranslationService,
    private readonly repoIngestionPipelineService: DayChuyenNapRepoService,
    private readonly llmRateLimiterService: LlmRateLimiterService,
    private readonly khamPhaRepoService: KhamPhaRepoService,
    private readonly theoDoiThayDoiService: TheoDoiThayDoiService,
    private readonly thongKeNapRepoService: ThongKeNapRepoService,
  ) {}

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Get('thong-ke-ngay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy số liệu AI theo ngày: số yêu cầu từng mô hình và số mục xếp hàng (P3B-28.6)',
  })
  @ApiResponse({ status: 200, description: 'Số liệu hạn mức AI trong ngày theo giờ Pacific' })
  @ApiResponse({ status: 403, description: 'Không có quyền quản trị viên' })
  async layThongKeNgay() {
    return this.llmRateLimiterService.layThongKeGeminiTheoNgay();
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('lam-nong')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chạy phân tích Dual-AI trước cho các app demo (P2-31.5, phục vụ P6-07)',
    description:
      'Chạy ngầm lazy AI cho danh sách app hoặc các app chưa được phân tích. Yêu cầu quyền QUAN_TRI_VIEN.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả số app đã chạy và thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền quản trị viên' })
  async lamNongAi(@Body() body?: PrewarmAiDto) {
    return this.appsService.chayLamNongAI(body?.danhSachAppIds);
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('dich-mo-ta')
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

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('nap-repo/kham-pha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nạp danh sách repo ứng viên vào hàng đợi sàng lọc (P3B-06.1)',
  })
  async discoverCandidates(@Body() body?: IngestionDiscoverDto) {
    return this.repoIngestionPipelineService.khamPhaUngVien(body?.repos);
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('nap-repo/chay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Kích hoạt một chu kỳ sàng lọc, nạp lô nhỏ và dịch nền theo ngân sách (P3B-06 & P3B-05.4)',
  })
  async runIngestionBatch(@Body() body?: IngestionRunDto) {
    const ketQuaNap = await this.repoIngestionPipelineService.sangLocVaNapLauNho(
      body?.batchSize,
      Boolean(body?.forceRun),
    );
    const ketQuaDich = await this.repoIngestionPipelineService.dichNenTheoNganSachNgay(
      undefined,
      Boolean(body?.forceRun),
    );
    return { ketQuaNap, ketQuaDich };
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('nap-repo/kham-pha-tu-dong')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chạy một lượt khám phá Trending và Search ngay, bỏ qua công tắc (P3B-06.1, 06.2)',
  })
  async khamPhaTuDong() {
    return this.khamPhaRepoService.khamPhaTuDong(true);
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Post('theo-doi/chay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chạy một lượt theo dõi thay đổi bằng ETag ngay, bỏ qua công tắc (P3B-07)',
  })
  async chayTheoDoi(@Body() body?: TheoDoiRunDto) {
    return this.theoDoiThayDoiService.quetMotLuot(body?.soApp, true);
  }

  @VaiTroYeuCau(VaiTro.QUAN_TRI_VIEN)
  @Get('nap-repo/suc-khoe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bảng sức khỏe nạp và theo dõi: công tắc, hạn mức GitHub, hàng chờ, tỷ lệ 304, bản dịch (P3B-06.11, P3B-21.3)',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền quản trị viên' })
  async laySucKhoeNapRepo() {
    return this.thongKeNapRepoService.laySucKhoe();
  }
}

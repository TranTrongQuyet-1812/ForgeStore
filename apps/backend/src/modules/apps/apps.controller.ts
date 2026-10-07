import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ChiTietReadmeResponseDto,
  DanhMucDto,
  ResolveAssetResponseDto,
  TrangKetQua,
  UngDungChiTietDto,
  UngDungTomTatDto,
} from '@forgestore/types';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { AppsService } from './apps.service';
import { ReadmeTranslationService } from '../ai/translation/services/readme-translation.service';
import { PlatformFilter, QueryAppsDto, SyncRepoDto } from './dto/query-apps.dto';
import { ResolveAssetDto } from './dto/resolve-asset.dto';

import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';

@ApiTags('Apps - Kho Ứng Dụng')
@Controller('apps')
export class AppsController {
  constructor(
    private readonly appsService: AppsService,
    private readonly readmeTranslationService: ReadmeTranslationService,
  ) {}

  @CongKhai()
  @Get('categories')
  @ApiOperation({
    summary: 'Lấy danh sách danh mục có app khả dụng theo nền tảng (K3)',
    description: 'Trả về danh mục và số lượng app thật trên nền tảng (windows/android).',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh mục và số lượng app tương ứng',
  })
  async layDanhSachDanhMuc(@Query('platform') platform?: PlatformFilter): Promise<DanhMucDto[]> {
    return this.appsService.layDanhSachDanhMuc(platform);
  }

  @CongKhai()
  @Get()
  @ApiOperation({
    summary: 'Duyệt danh sách ứng dụng trong Store (P2-23)',
    description:
      'Lấy danh sách ứng dụng theo nền tảng (android/windows), danh mục, sắp xếp (stars/recent/trending) và phân trang (tối đa 50 app/trang). Có bộ đệm Redis. Tự động gắn cờ daYeuThich nếu đã đăng nhập.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách ứng dụng tóm tắt kèm phân trang',
  })
  async layDanhSachApps(
    @Query() query: QueryAppsDto,
    @NguoiDungHienTai('maNguoiDung') userId?: string,
  ): Promise<TrangKetQua<UngDungTomTatDto>> {
    return this.appsService.layDanhSachApps(query, userId);
  }

  @CongKhai()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đồng bộ hoặc nạp một repository từ GitHub vào Store (P2-21)',
    description:
      'Chấp nhận đường dẫn GitHub hoặc slug dạng "owner/repo", đồng bộ releases và phân loại tệp cài đặt nguyên tử.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết ứng dụng vừa được đồng bộ',
  })
  async dongBoRepo(@Body() body: SyncRepoDto): Promise<UngDungChiTietDto> {
    const { owner, repo } = this.appsService.phanTichUrlRepo(body.url);
    return this.appsService.dongBoRepo(owner, repo);
  }

  @CongKhai()
  @Post('resolve-asset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Phân giải tệp cài đặt phù hợp với kiến trúc thiết bị (P2-33)',
    description:
      'Nhận nền tảng và danh sách ABI ưu tiên của máy khách, tự động chọn file APK/EXE/MSI phù hợp nhất (1-Click matching). Sử dụng Jev Choice khi tên file mơ hồ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tệp cài đặt phù hợp nhất và nguồn quyết định (LUAT | JEV | DU_PHONG)',
  })
  async giaiQuyetFileCaiDat(@Body() dto: ResolveAssetDto): Promise<ResolveAssetResponseDto> {
    return this.appsService.giaiQuyetFileCaiDat(dto);
  }

  @CongKhai()
  @Get(':owner/:repo/readme')
  @ApiOperation({
    summary: 'Lấy tài liệu README song ngữ (bản gốc & bản dịch tiếng Việt) theo slug (P3B-05.7)',
    description:
      'Trả về nội dung Markdown gốc và bản dịch tiếng Việt nếu có. Nếu chưa có, tự động kích hoạt dịch chạy nền non-blocking. Hỗ trợ ?force=true để dịch lại tức thì.',
  })
  @ApiParam({ name: 'owner', description: 'GitHub username hoặc tổ chức', example: 'rustdesk' })
  @ApiParam({ name: 'repo', description: 'Tên repository', example: 'rustdesk' })
  @ApiResponse({
    status: 200,
    description: 'Nội dung README gốc và bản dịch tiếng Việt kèm trạng thái',
  })
  async layReadmeTheoSlug(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Query('force') force?: string,
  ): Promise<ChiTietReadmeResponseDto> {
    const isForce = force === 'true' || force === '1';
    return this.readmeTranslationService.layHoacKichHoatDichReadme(`${owner}/${repo}`, isForce);
  }

  @CongKhai()
  @Get(':id/readme')
  @ApiOperation({
    summary: 'Lấy tài liệu README song ngữ theo UUID (P3B-05.7)',
    description:
      'Trả về nội dung Markdown gốc và bản dịch tiếng Việt nếu có. Tự động kích hoạt dịch nền nếu chưa có. Hỗ trợ ?force=true để dịch lại tức thì.',
  })
  @ApiParam({ name: 'id', description: 'UUID hoặc slug ứng dụng', example: 'rustdesk/rustdesk' })
  @ApiResponse({
    status: 200,
    description: 'Nội dung README gốc và bản dịch tiếng Việt kèm trạng thái',
  })
  async layReadmeTheoId(
    @Param('id') id: string,
    @Query('force') force?: string,
  ): Promise<ChiTietReadmeResponseDto> {
    const isForce = force === 'true' || force === '1';
    return this.readmeTranslationService.layHoacKichHoatDichReadme(id, isForce);
  }

  @CongKhai()
  @Get(':owner/:repo')
  @ApiOperation({
    summary: 'Lấy chi tiết ứng dụng theo owner và repo slug (P2-24, K1)',
    description:
      'Ví dụ: /api/v1/apps/rustdesk/rustdesk?platform=windows. Tự động lọc phiên bản theo platform và gắn cờ laYeuThich nếu đã đăng nhập.',
  })
  @ApiParam({ name: 'owner', description: 'GitHub username hoặc tổ chức', example: 'rustdesk' })
  @ApiParam({ name: 'repo', description: 'Tên repository', example: 'rustdesk' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết toàn diện của ứng dụng',
  })
  async layChiTietAppTheoSlug(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Query('platform') platform?: PlatformFilter,
    @Query('arch') arch?: string,
    @NguoiDungHienTai('maNguoiDung') userId?: string,
  ): Promise<UngDungChiTietDto> {
    return this.appsService.layChiTietApp(`${owner}/${repo}`, userId, platform, arch);
  }

  @CongKhai()
  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết ứng dụng theo UUID hoặc URL-encoded slug (P2-24, K1)',
    description:
      'Chấp nhận UUID của ứng dụng hoặc chuỗi owner/repo đã URL-encoded (VD: rustdesk%2Frustdesk?platform=windows). Tự động lọc phiên bản theo platform và gắn cờ laYeuThich nếu đã đăng nhập.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID hoặc slug ứng dụng',
    example: 'rustdesk/rustdesk',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết toàn diện của ứng dụng',
  })
  async layChiTietApp(
    @Param('id') id: string,
    @Query('platform') platform?: PlatformFilter,
    @Query('arch') arch?: string,
    @NguoiDungHienTai('maNguoiDung') userId?: string,
  ): Promise<UngDungChiTietDto> {
    return this.appsService.layChiTietApp(id, userId, platform, arch);
  }
}

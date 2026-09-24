import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TrangKetQua, UngDungChiTietDto, UngDungTomTatDto } from '@forgestore/types';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { AppsService } from './apps.service';
import { QueryAppsDto, SyncRepoDto } from './dto/query-apps.dto';

@ApiTags('Apps - Kho Ứng Dụng')
@Controller('apps')
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @CongKhai()
  @Get()
  @ApiOperation({
    summary: 'Duyệt danh sách ứng dụng trong Store (P2-23)',
    description:
      'Lấy danh sách ứng dụng theo nền tảng (android/windows), danh mục, sắp xếp (stars/recent/trending) và phân trang (tối đa 50 app/trang). Có bộ đệm Redis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách ứng dụng tóm tắt kèm phân trang',
  })
  async layDanhSachApps(@Query() query: QueryAppsDto): Promise<TrangKetQua<UngDungTomTatDto>> {
    return this.appsService.layDanhSachApps(query);
  }

  @CongKhai()
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
  @Get(':owner/:repo')
  @ApiOperation({
    summary: 'Lấy chi tiết ứng dụng theo owner và repo slug (P2-24)',
    description: 'Ví dụ: /api/v1/apps/rustdesk/rustdesk',
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
  ): Promise<UngDungChiTietDto> {
    return this.appsService.layChiTietApp(`${owner}/${repo}`);
  }

  @CongKhai()
  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết ứng dụng theo UUID hoặc URL-encoded slug (P2-24)',
    description:
      'Chấp nhận UUID của ứng dụng hoặc chuỗi owner/repo đã URL-encoded (VD: rustdesk%2Frustdesk).',
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
  async layChiTietApp(@Param('id') id: string): Promise<UngDungChiTietDto> {
    return this.appsService.layChiTietApp(id);
  }
}

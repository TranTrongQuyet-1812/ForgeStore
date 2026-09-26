import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DanhMucDto } from '@forgestore/types';
import { CongKhai } from '../../../common/decorators/cong-khai.decorator';
import { AppsService } from '../apps.service';
import { PlatformFilter } from '../dto/query-apps.dto';

@ApiTags('Categories - Danh Mục Ứng Dụng')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly appsService: AppsService) {}

  @CongKhai()
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách danh mục có app khả dụng theo nền tảng (K3)',
    description:
      'Trả về danh sách danh mục có ít nhất một ứng dụng khả dụng trên nền tảng yêu cầu (windows/android) kèm số lượng app thật. Giúp client dựng chip danh mục động và loại bỏ các danh mục rỗng.',
  })
  @ApiQuery({
    name: 'platform',
    required: false,
    enum: PlatformFilter,
    description: 'Lọc danh mục theo nền tảng (windows hoặc android)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh mục và số lượng app tương ứng',
  })
  async layDanhSachDanhMuc(@Query('platform') platform?: PlatformFilter): Promise<DanhMucDto[]> {
    return this.appsService.layDanhSachDanhMuc(platform);
  }
}

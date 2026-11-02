import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DanhMucDto } from '@forgestore/types';
import { CongKhai } from '../../../common/decorators/cong-khai.decorator';
import { UngDungService } from '../ung-dung.service';
import { PlatformFilter } from '../dto/truy-van-ung-dung.dto';

@ApiTags('Categories - Danh Mục Ứng Dụng')
@Controller('danh-muc')
export class DanhMucController {
  constructor(private readonly appsService: UngDungService) {}

  @CongKhai()
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách danh mục và số ứng dụng theo nền tảng (K3)',
    description:
      'Trả về danh sách danh mục kèm số lượng ứng dụng khả dụng trên nền tảng yêu cầu (windows/android). Danh mục AI vẫn được trả với số lượng 0 để client hiển thị trước khi có dữ liệu; các danh mục rỗng khác được loại bỏ.',
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

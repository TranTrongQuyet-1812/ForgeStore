import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TimKiemResponseDto } from '@forgestore/types';
import { CongKhai } from '../../../common/decorators/cong-khai.decorator';
import { AppsService } from '../ung-dung.service';
import { SearchQueryDto } from '../dto/tim-kiem.dto';

@ApiTags('Search - Tìm Kiếm Thông Minh (Module 1)')
@Controller('search')
export class SearchController {
  constructor(private readonly appsService: AppsService) {}

  @CongKhai()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get()
  @ApiOperation({
    summary: 'Tìm kiếm thông minh đa năng qua Smart Input Dispatcher (P2-40)',
    description:
      'Chỉ một ô tìm kiếm duy nhất, tự động nhận diện và phân luồng: 1. URL GitHub -> Trạng thái Paste & Play; 2. Tên App ngắn -> Tìm kiếm CSDL Store (ILIKE); 3. Ý định tiếng Việt tự nhiên -> Kết hợp tìm kiếm ngữ nghĩa pgvector (P2-36) và Gemini Translator (P2-42).',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả tìm kiếm kèm nguồn dữ liệu (CSDL | GITHUB | KET_HOP | URL)',
  })
  async timKiem(@Query() query: SearchQueryDto): Promise<TimKiemResponseDto> {
    return this.appsService.timKiemThongMinh(query);
  }
}

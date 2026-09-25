import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { QueryFavoritesDto } from './dto/query-favorites.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';

@ApiTags('Favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('user/favorites')
  @ApiOperation({
    summary: 'Lấy kho ứng dụng yêu thích của người dùng hiện tại',
    description:
      'Trả về danh sách ứng dụng đã yêu thích, phân trang, bản mới thích nhất đứng trước.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách yêu thích thành công',
  })
  async layDanhSachYeuThich(
    @NguoiDungHienTai('maNguoiDung') maNguoiDung: string,
    @Query() query: QueryFavoritesDto,
  ) {
    return this.favoritesService.layDanhSachYeuThich(maNguoiDung, query.page, query.limit);
  }

  @Post('apps/:id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bật / Tắt (Toggle) trạng thái yêu thích của ứng dụng',
    description:
      'Nếu chưa thích thì thêm vào kho yêu thích (daYeuThich=true), nếu đã thích thì gỡ bỏ (daYeuThich=false).',
  })
  @ApiParam({
    name: 'id',
    description: 'Mã UUID của ứng dụng',
    type: String,
  })
  @ApiHeader({
    name: 'x-device-type',
    description: 'Loại thiết bị bấm thích (MAY_TINH | DI_DONG)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Chuyển đổi trạng thái yêu thích thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy ứng dụng',
  })
  async chuyenDoiYeuThich(
    @NguoiDungHienTai('maNguoiDung') maNguoiDung: string,
    @Param('id') id: string,
    @Headers('x-device-type') thietBiHeader?: string,
  ) {
    const thietBi = thietBiHeader?.toUpperCase() === 'DI_DONG' ? 'DI_DONG' : 'MAY_TINH';
    return this.favoritesService.chuyenDoiYeuThich(maNguoiDung, id, thietBi);
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { YeuThichService } from './yeu-thich.service';
import { QueryFavoritesDto } from './dto/truy-van-yeu-thich.dto';
import { JwtAuthGuard } from '../xac-thuc/guards/jwt-auth.guard';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';

@ApiTags('Favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class YeuThichController {
  constructor(private readonly favoritesService: YeuThichService) {}

  @Get('nguoi-dung/yeu-thich')
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

  @Post('ung-dung/:id/yeu-thich')
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
    @NguoiDungHienTai('maThietBi') maThietBi?: string,
  ) {
    const cleanId = decodeURIComponent(id.trim());
    // Loại thiết bị lấy từ phiên đăng nhập (JWT `did`), không nhận header tự khai của client:
    // header lạ còn khiến preflight CORS của WebView2 chặn luôn request.
    const thietBi = await this.favoritesService.xacDinhThietBiThem(maThietBi);
    return this.favoritesService.chuyenDoiYeuThich(maNguoiDung, cleanId, thietBi);
  }

  @Post('ung-dung/:owner/:repo/yeu-thich')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bật / Tắt trạng thái yêu thích của ứng dụng theo GitHub slug (owner/repo)',
  })
  async chuyenDoiYeuThichTheoSlug(
    @NguoiDungHienTai('maNguoiDung') maNguoiDung: string,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @NguoiDungHienTai('maThietBi') maThietBi?: string,
  ) {
    const slug = `${owner}/${repo}`;
    const thietBi = await this.favoritesService.xacDinhThietBiThem(maThietBi);
    return this.favoritesService.chuyenDoiYeuThich(maNguoiDung, slug, thietBi);
  }
}

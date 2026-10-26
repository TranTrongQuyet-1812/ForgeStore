import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ReviewsService } from './danh-gia.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { JwtAuthGuard } from '../xac-thuc/guards/jwt-auth.guard';
import { CongKhai } from '../../common/decorators/cong-khai.decorator';
import { NguoiDungHienTai } from '../../common/decorators/nguoi-dung.decorator';
import { UserSessionContext } from '../xac-thuc/interfaces/jwt-payload.interface';
import { VaiTro } from '@prisma/client';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('apps/:id/reviews')
  @CongKhai()
  @ApiOperation({
    summary: 'Lấy danh sách đánh giá & nhận xét của ứng dụng',
    description:
      'Trả về danh sách đánh giá phân trang, hỗ trợ sắp xếp theo mới nhất, hữu ích nhất, số sao cao/thấp.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mã UUID hoặc slug repo (owner/repo) của ứng dụng',
    type: String,
    example: 'rustdesk/rustdesk',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách đánh giá thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy ứng dụng',
  })
  async layDanhSachDanhGia(@Param('id') id: string, @Query() query: QueryReviewsDto) {
    return this.reviewsService.layDanhSachDanhGia(id, query);
  }

  @Post('apps/:id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Gửi đánh giá và nhận xét cho ứng dụng (1 đánh giá / user / phiên bản)',
    description:
      'Đánh giá 1-5 sao kèm nhận xét. Mỗi tài khoản chỉ được gửi 1 đánh giá cho mỗi phiên bản phần mềm.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mã UUID hoặc slug repo của ứng dụng',
    type: String,
  })
  @ApiResponse({
    status: 201,
    description: 'Gửi đánh giá thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu đánh giá không hợp lệ',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy ứng dụng',
  })
  @ApiResponse({
    status: 409,
    description: 'Người dùng đã gửi đánh giá cho phiên bản này rồi',
  })
  async taoDanhGia(
    @Param('id') id: string,
    @NguoiDungHienTai('maNguoiDung') maNguoiDung: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.taoDanhGia(maNguoiDung, id, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chỉnh sửa bài đánh giá của chính mình',
    description: 'Chỉ người tạo bài đánh giá hoặc Quản trị viên mới có quyền cập nhật.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mã UUID của bài đánh giá',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật đánh giá thành công',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền sửa nhận xét của người khác',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bài đánh giá',
  })
  async suaDanhGia(
    @Param('id', ParseUUIDPipe) id: string,
    @NguoiDungHienTai() user: UserSessionContext,
    @Body() dto: UpdateReviewDto,
  ) {
    const laQuanTri = user.vaiTro === VaiTro.QUAN_TRI_VIEN;
    return this.reviewsService.suaDanhGia(user.maNguoiDung, id, dto, laQuanTri);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Xóa bài đánh giá (Chủ sở hữu hoặc Quản trị viên)',
    description: 'Xóa bài nhận xét và tự động tính lại điểm trung bình của ứng dụng.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mã UUID của bài đánh giá',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa bài đánh giá thành công',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xóa nhận xét của người khác',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bài đánh giá',
  })
  async xoaDanhGia(
    @Param('id', ParseUUIDPipe) id: string,
    @NguoiDungHienTai() user: UserSessionContext,
  ) {
    const laQuanTri = user.vaiTro === VaiTro.QUAN_TRI_VIEN;
    return this.reviewsService.xoaDanhGia(user.maNguoiDung, id, laQuanTri);
  }

  @Post('reviews/:id/helpful')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Bình chọn nhận xét hữu ích (Helpful Vote)',
    description:
      'Mỗi người dùng chỉ được vote hữu ích 1 lần cho mỗi nhận xét (kiểm soát bởi Redis TTL 30 ngày).',
  })
  @ApiParam({
    name: 'id',
    description: 'Mã UUID của bài đánh giá',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Bình chọn hữu ích thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Người dùng đã bình chọn cho nhận xét này trước đó rồi',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bài đánh giá',
  })
  async binhChonHuuIch(
    @Param('id', ParseUUIDPipe) id: string,
    @NguoiDungHienTai('maNguoiDung') maNguoiDung: string,
  ) {
    return this.reviewsService.binhChonHuuIch(maNguoiDung, id);
  }
}

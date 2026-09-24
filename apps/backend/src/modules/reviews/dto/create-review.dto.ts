import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Số sao đánh giá (từ 1 đến 5 sao)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty({ message: 'Số sao không được để trống' })
  @IsInt({ message: 'Số sao phải là số nguyên' })
  @Min(1, { message: 'Đánh giá tối thiểu là 1 sao' })
  @Max(5, { message: 'Đánh giá tối đa là 5 sao' })
  soSao!: number;

  @ApiPropertyOptional({
    description: 'Tiêu đề ngắn cho bài nhận xét',
    example: 'Ứng dụng mượt mà, kết nối rất nhanh',
    maxLength: 150,
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @MaxLength(150, { message: 'Tiêu đề không vượt quá 150 ký tự' })
  tieuDe?: string;

  @ApiProperty({
    description: 'Nội dung nhận xét chi tiết',
    example: 'Mình đã dùng để hỗ trợ kỹ thuật cho gia đình, chất lượng stream hình ảnh rất tốt.',
    maxLength: 2000,
  })
  @IsNotEmpty({ message: 'Nội dung nhận xét không được để trống' })
  @IsString({ message: 'Nội dung nhận xét phải là chuỗi ký tự' })
  @MaxLength(2000, { message: 'Nội dung nhận xét không vượt quá 2000 ký tự' })
  noiDungNhanXet!: string;

  @ApiPropertyOptional({
    description: 'Phiên bản ứng dụng đang đánh giá (mặc định lấy bản mới nhất của app)',
    example: '1.2.3',
  })
  @IsOptional()
  @IsString({ message: 'Phiên bản phải là chuỗi ký tự' })
  phienBanDanhGia?: string;

  @ApiPropertyOptional({
    description: 'Thiết bị người dùng đang sử dụng (ví dụ: Windows 11, Pixel 7)',
    example: 'Windows 11',
  })
  @IsOptional()
  @IsString({ message: 'Tên thiết bị phải là chuỗi ký tự' })
  thietBiDanhGia?: string;
}

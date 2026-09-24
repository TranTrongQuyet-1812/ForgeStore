import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Số sao đánh giá (từ 1 đến 5 sao)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt({ message: 'Số sao phải là số nguyên' })
  @Min(1, { message: 'Đánh giá tối thiểu là 1 sao' })
  @Max(5, { message: 'Đánh giá tối đa là 5 sao' })
  soSao?: number;

  @ApiPropertyOptional({
    description: 'Tiêu đề bài nhận xét',
    example: 'Cập nhật lại nhận xét sau khi dùng thêm 2 tuần',
    maxLength: 150,
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @MaxLength(150, { message: 'Tiêu đề không vượt quá 150 ký tự' })
  tieuDe?: string;

  @ApiPropertyOptional({
    description: 'Nội dung nhận xét chi tiết',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'Nội dung nhận xét phải là chuỗi ký tự' })
  @MaxLength(2000, { message: 'Nội dung nhận xét không vượt quá 2000 ký tự' })
  noiDungNhanXet?: string;
}

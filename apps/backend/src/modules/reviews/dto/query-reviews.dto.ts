import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum ReviewSortOption {
  MOI_NHAT = 'moi_nhat',
  HUU_ICH_NHAT = 'huu_ich_nhat',
  SO_SAO_CAO = 'so_sao_cao',
  SO_SAO_THAP = 'so_sao_thap',
}

export class QueryReviewsDto {
  @ApiPropertyOptional({
    description: 'Số trang (bắt đầu từ 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng mục trên mỗi trang (tối đa 50)',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Tiêu chí sắp xếp bài nhận xét',
    enum: ReviewSortOption,
    default: ReviewSortOption.MOI_NHAT,
  })
  @IsOptional()
  @IsEnum(ReviewSortOption, { message: 'Tiêu chí sắp xếp nhận xét không hợp lệ' })
  sort?: ReviewSortOption = ReviewSortOption.MOI_NHAT;
}

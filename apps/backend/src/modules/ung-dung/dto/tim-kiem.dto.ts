import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NenTangHoTro } from '@forgestore/types';

export class SearchQueryDto {
  @ApiProperty({
    description: 'Từ khóa tìm kiếm (URL GitHub, tên app hoặc câu mô tả tự nhiên bằng tiếng Việt)',
    example: 'app xem phim không quảng cáo',
    maxLength: 200,
  })
  @IsNotEmpty({ message: 'Từ khóa tìm kiếm không được để trống' })
  @IsString()
  @MaxLength(200, { message: 'Từ khóa tìm kiếm không vượt quá 200 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q!: string;

  @ApiPropertyOptional({
    description: 'Lọc theo nền tảng hỗ trợ (case-insensitive: windows, android, da_nen_tang)',
    enum: NenTangHoTro,
    example: NenTangHoTro.WINDOWS,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const upper = value.toUpperCase().trim();
    if (upper === 'ALL' || upper === 'TAT_CA') return NenTangHoTro.DA_NEN_TANG;
    return upper;
  })
  @IsEnum(NenTangHoTro, {
    message: 'Nền tảng phải là ANDROID, WINDOWS hoặc DA_NEN_TANG',
  })
  platform?: NenTangHoTro;

  @ApiPropertyOptional({
    description: 'Số trang kết quả (bắt đầu từ 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng ứng dụng trên một trang (tối đa 50)',
    default: 20,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

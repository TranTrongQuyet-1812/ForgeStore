import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum PlatformFilter {
  ANDROID = 'android',
  WINDOWS = 'windows',
}

export enum AppSortOption {
  STARS = 'stars',
  RECENT = 'recent',
  TRENDING = 'trending',
}

export class QueryAppsDto {
  @ApiPropertyOptional({
    enum: PlatformFilter,
    description: 'Lọc theo nền tảng hệ điều hành hỗ trợ (android hoặc windows)',
    example: 'windows',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEnum(PlatformFilter, {
    message: 'Nền tảng phải là "android" hoặc "windows"',
  })
  platform?: PlatformFilter;

  @ApiPropertyOptional({
    description: 'Lọc theo danh mục ứng dụng',
    example: 'Tiện ích hệ thống',
  })
  @IsOptional()
  @IsString({ message: 'Danh mục phải là chuỗi ký tự' })
  category?: string;

  @ApiPropertyOptional({
    enum: AppSortOption,
    description: 'Tiêu chí sắp xếp: stars, recent, trending (mặc định: trending theo D-04)',
    example: 'trending',
    default: AppSortOption.TRENDING,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEnum(AppSortOption, {
    message: 'Tiêu chí sắp xếp phải là "stars", "recent" hoặc "trending"',
  })
  sort?: AppSortOption = AppSortOption.TRENDING;

  @ApiPropertyOptional({
    description: 'Số thứ tự trang cần lấy (bắt đầu từ 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên' })
  @Min(1, { message: 'Trang phải lớn hơn hoặc bằng 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng ứng dụng trên một trang (tối đa 50 theo quy định P2-23.1)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(50, { message: 'Số lượng tối đa trên một trang không được vượt quá 50' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Lọc chỉ các ứng dụng nổi bật (featured)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'featured phải là kiểu boolean (true/false)' })
  featured?: boolean;
}

export class SyncRepoDto {
  @ApiPropertyOptional({
    description:
      'URL hoặc slug repository GitHub (VD: "https://github.com/rustdesk/rustdesk" hoặc "rustdesk/rustdesk")',
    example: 'rustdesk/rustdesk',
  })
  @IsString({ message: 'Đường dẫn repo phải là chuỗi' })
  url!: string;
}

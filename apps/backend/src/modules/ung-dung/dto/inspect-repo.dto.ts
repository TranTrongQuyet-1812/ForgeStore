import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { InspectRepoRequest } from '@forgestore/types';

export class InspectRepoDto implements InspectRepoRequest {
  @ApiProperty({
    description: 'URL hoặc slug repository GitHub cần nạp (Paste & Play)',
    example: 'https://github.com/rustdesk/rustdesk',
    maxLength: 300,
  })
  @IsNotEmpty({ message: 'Đường dẫn repository không được để trống' })
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  urlRepo!: string;

  @ApiPropertyOptional({
    description: 'Nền tảng thiết bị hiện thời (ANDROID hoặc WINDOWS)',
    enum: ['ANDROID', 'WINDOWS'],
    example: 'ANDROID',
  })
  @IsOptional()
  @IsEnum(['ANDROID', 'WINDOWS'], {
    message: 'Nền tảng chỉ có thể là ANDROID hoặc WINDOWS',
  })
  nenTang?: 'ANDROID' | 'WINDOWS';

  @ApiPropertyOptional({
    description: 'Danh sách kiến trúc chip (ABI) máy khách hỗ trợ theo thứ tự ưu tiên',
    example: ['arm64-v8a', 'armeabi-v7a'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  abis?: string[];

  @ApiPropertyOptional({
    description: 'Cho phép lấy bản phát hành thử nghiệm (Pre-release) nếu không có bản chính thức',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  choPhepBanThuNghiem?: boolean;
}

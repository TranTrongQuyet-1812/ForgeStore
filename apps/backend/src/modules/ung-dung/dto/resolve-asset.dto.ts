import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ResolveAssetRequest } from '@forgestore/types';

export class ResolveAssetDto implements ResolveAssetRequest {
  @ApiProperty({
    description: 'UUID hoặc slug (owner/repo) của ứng dụng',
    example: 'rustdesk/rustdesk',
  })
  @IsNotEmpty({ message: 'maUngDung không được để trống' })
  @IsString()
  maUngDung!: string;

  @ApiProperty({
    description: 'Nền tảng của thiết bị người dùng',
    enum: ['ANDROID', 'WINDOWS'],
    example: 'ANDROID',
  })
  @IsNotEmpty({ message: 'nenTang không được để trống' })
  @IsEnum(['ANDROID', 'WINDOWS'], { message: 'nenTang phải là ANDROID hoặc WINDOWS' })
  nenTang!: 'ANDROID' | 'WINDOWS';

  @ApiProperty({
    description: 'Danh sách các ABI phần cứng hỗ trợ theo thứ tự ưu tiên của máy',
    example: ['arm64-v8a', 'armeabi-v7a'],
  })
  @IsArray({ message: 'abis phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách abis không được rỗng' })
  @IsString({ each: true, message: 'Mỗi phần tử trong abis phải là chuỗi' })
  abis!: string[];

  @ApiPropertyOptional({
    description: 'Cho phép lấy bản phát hành thử nghiệm (prerelease) hay không',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  choPhepBanThuNghiem?: boolean;

  @ApiPropertyOptional({
    description: 'Phiên bản cụ thể muốn tải (mặc định lấy bản mới nhất)',
    example: '1.2.3',
  })
  @IsOptional()
  @IsString()
  phienBan?: string;
}

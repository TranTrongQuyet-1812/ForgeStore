import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class AppVersionCheckItemDto {
  @ApiPropertyOptional({
    description: 'Mã UUID của ứng dụng trong Store (nếu biết)',
    example: 'd3b07384-d113-4c91-9e79-50c2668e1c6b',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Mã ứng dụng phải là UUID hợp lệ' })
  maUngDung?: string;

  @ApiPropertyOptional({
    description: 'Tên gói ứng dụng Android (Package Name) theo D-13',
    example: 'com.carriez.flutter_rustdesk',
  })
  @IsOptional()
  @IsString({ message: 'Tên gói Android phải là chuỗi ký tự' })
  tenGoiAndroid?: string;

  @ApiPropertyOptional({
    description: 'Phiên bản hiện tại đang cài đặt trên thiết bị (phienBan)',
    example: '1.2.0',
  })
  @ValidateIf((o: AppVersionCheckItemDto) => !o.phienBanHienTai)
  @IsNotEmpty({ message: 'Phiên bản hiện tại không được để trống' })
  @IsString({ message: 'Phiên bản hiện tại phải là chuỗi ký tự' })
  phienBan?: string;

  @ApiPropertyOptional({
    description: 'Phiên bản hiện tại theo chuẩn @forgestore/types (phienBanHienTai)',
    example: '1.2.0',
  })
  @ValidateIf((o: AppVersionCheckItemDto) => !o.phienBan)
  @IsNotEmpty({ message: 'Phiên bản hiện tại không được để trống' })
  @IsString({ message: 'Phiên bản hiện tại phải là chuỗi ký tự' })
  phienBanHienTai?: string;
}

export class CheckUpdatesDto {
  @ApiProperty({
    description: 'Mã UUID của thiết bị đang gọi kiểm tra cập nhật',
    example: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  })
  @IsNotEmpty({ message: 'Mã thiết bị không được để trống' })
  @IsUUID('4', { message: 'Mã thiết bị phải là UUID hợp lệ' })
  maThietBi!: string;

  @ApiPropertyOptional({
    description:
      'Danh sách các ứng dụng cần kiểm tra phiên bản. Nếu bỏ trống, hệ thống sẽ tự động đối soát dựa trên danh sách app đã cài của thiết bị trong CSDL (ung_dung_da_cai).',
    type: [AppVersionCheckItemDto],
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách ứng dụng phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => AppVersionCheckItemDto)
  ungDung?: AppVersionCheckItemDto[];

  @ApiPropertyOptional({
    description:
      'Danh sách các ứng dụng cần kiểm tra phiên bản theo chuẩn @forgestore/types (danhSachCaiDat).',
    type: [AppVersionCheckItemDto],
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách ứng dụng phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => AppVersionCheckItemDto)
  danhSachCaiDat?: AppVersionCheckItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MaTrinhQuanLyGoi } from '@forgestore/types';

export class GhiNhanCaiDatDto {
  @ApiProperty({
    description: 'Mã UUID của ứng dụng trong Store',
    example: 'd3b07384-d113-4c91-9e79-50c2668e1c6b',
  })
  @IsNotEmpty({ message: 'Mã ứng dụng không được để trống' })
  @IsUUID('4', { message: 'Mã ứng dụng phải là UUID hợp lệ' })
  maUngDung!: string;

  @ApiProperty({
    description: 'Phiên bản vừa cài đặt hoặc đang chạy trên máy',
    example: '1.2.3',
  })
  @IsNotEmpty({ message: 'Phiên bản không được để trống' })
  @IsString({ message: 'Phiên bản phải là chuỗi ký tự' })
  @MaxLength(100, { message: 'Phiên bản không được vượt quá 100 ký tự' })
  phienBanHienTai!: string;

  @ApiPropertyOptional({
    description: 'Mã UUID của tệp cài đặt cụ thể trong Store (nếu có)',
    example: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Mã tệp cài đặt phải là UUID hợp lệ' })
  maTepDaCai?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn thư mục cài đặt cục bộ (cho Windows Portable)',
    example: 'C:\\Program Files\\ForgeApps\\RustDesk',
  })
  @IsOptional()
  @IsString({ message: 'Đường dẫn thư mục phải là chuỗi ký tự' })
  @MaxLength(1024, { message: 'Đường dẫn thư mục không được vượt quá 1024 ký tự' })
  duongDanThuMuc?: string;

  @ApiPropertyOptional({
    description: 'Tên khóa Registry Windows lưu thông tin gỡ cài đặt (cho Windows EXE/MSI)',
    example: 'Notepad++',
  })
  @IsOptional()
  @IsString({ message: 'Khóa Registry phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Khóa Registry không được vượt quá 255 ký tự' })
  khoaRegistry?: string;

  @ApiPropertyOptional({
    description: 'Tên hiển thị trong Registry Windows (DisplayName)',
    example: 'Notepad++ (64-bit x64)',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị Registry phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tên hiển thị Registry không được vượt quá 255 ký tự' })
  tenHienThiRegistry?: string;
}

export class CapNhatKhoaRegistryDto {
  @ApiProperty({
    description: 'Tên khóa Registry Windows lưu thông tin gỡ cài đặt (cho Windows EXE/MSI)',
    example: 'Notepad++',
  })
  @IsNotEmpty({ message: 'Khóa Registry không được để trống' })
  @IsString({ message: 'Khóa Registry phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Khóa Registry không được vượt quá 255 ký tự' })
  khoaRegistry!: string;

  @ApiPropertyOptional({
    description: 'Tên hiển thị trong Registry Windows (DisplayName)',
    example: 'Notepad++ (64-bit x64)',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị Registry phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tên hiển thị Registry không được vượt quá 255 ký tự' })
  tenHienThiRegistry?: string;
}

export class GhiNhanCaiDatCliDto {
  @ApiProperty({
    description: 'Mã UUID của ứng dụng trong Store',
    example: 'd3b07384-d113-4c91-9e79-50c2668e1c6b',
  })
  @IsNotEmpty({ message: 'Mã ứng dụng không được để trống' })
  @IsUUID('4', { message: 'Mã ứng dụng phải là UUID hợp lệ' })
  maUngDung!: string;

  @ApiProperty({
    description: 'Trình quản lý gói đã sử dụng',
    example: 'winget',
    enum: Object.values(MaTrinhQuanLyGoi),
  })
  @IsNotEmpty({ message: 'Trình quản lý gói không được để trống' })
  @IsString({ message: 'Trình quản lý gói phải là chuỗi' })
  @IsIn(Object.values(MaTrinhQuanLyGoi), { message: 'Trình quản lý gói không hợp lệ' })
  trinhQuanLy!: MaTrinhQuanLyGoi;

  @ApiProperty({
    description: 'Tên gói đã dùng để cài qua dòng lệnh',
    example: 'Microsoft.PowerToys',
  })
  @IsNotEmpty({ message: 'Tên gói không được để trống' })
  @IsString({ message: 'Tên gói phải là chuỗi' })
  @MaxLength(256, { message: 'Tên gói không được vượt quá 256 ký tự' })
  tenGoi!: string;

  @ApiPropertyOptional({
    description: 'Phiên bản vừa cài đặt (nếu có)',
    example: '0.85.0',
  })
  @IsOptional()
  @IsString({ message: 'Phiên bản phải là chuỗi' })
  @MaxLength(64, { message: 'Phiên bản không được vượt quá 64 ký tự' })
  phienBan?: string;

  @ApiPropertyOptional({
    description:
      'Thư viện npm cài vào dự án (không -g): lệnh gỡ và cập nhật ghép theo phạm vi cục bộ',
  })
  @IsOptional()
  @IsBoolean({ message: 'cucBo phải là true hoặc false' })
  cucBo?: boolean;
}

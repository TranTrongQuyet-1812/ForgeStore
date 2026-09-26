import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
  duongDanThuMuc?: string;

  @ApiPropertyOptional({
    description: 'Tên khóa Registry Windows lưu thông tin gỡ cài đặt (cho Windows EXE/MSI)',
    example: 'Notepad++',
  })
  @IsOptional()
  @IsString({ message: 'Khóa Registry phải là chuỗi ký tự' })
  khoaRegistry?: string;

  @ApiPropertyOptional({
    description: 'Tên hiển thị trong Registry Windows (DisplayName)',
    example: 'Notepad++ (64-bit x64)',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị Registry phải là chuỗi ký tự' })
  tenHienThiRegistry?: string;
}

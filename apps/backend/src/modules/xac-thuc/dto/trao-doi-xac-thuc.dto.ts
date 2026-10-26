import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LoaiThietBi } from '@prisma/client';

export class ThietBiDangKyDto {
  @ApiProperty({
    description: 'Hardware fingerprint (chuỗi băm SHA-256 phần cứng thiết bị)',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  @IsString({ message: 'dinhDanhPhanCung phải là chuỗi' })
  @IsNotEmpty({ message: 'dinhDanhPhanCung không được để trống' })
  dinhDanhPhanCung!: string;

  @ApiProperty({
    description: 'Tên thiết bị (ví dụ: "Laptop Dell", "Pixel 7 Pro")',
    example: 'Laptop Dell XPS 15',
  })
  @IsString({ message: 'tenThietBi phải là chuỗi' })
  @IsNotEmpty({ message: 'tenThietBi không được để trống' })
  tenThietBi!: string;

  @ApiProperty({
    enum: LoaiThietBi,
    description: 'Loại thiết bị vật lý',
    example: LoaiThietBi.MAY_TINH_WINDOWS,
  })
  @IsEnum(LoaiThietBi, { message: 'loaiThietBi không hợp lệ' })
  loaiThietBi!: LoaiThietBi;
}

export class AuthExchangeDto {
  @ApiProperty({
    description: 'Mã xác thực 1 lần nhận qua redirect deep link forgestore://auth?code=...',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString({ message: 'code phải là chuỗi' })
  @IsNotEmpty({ message: 'code không được để trống' })
  code!: string;

  @ApiProperty({
    description: 'PKCE code verifier (tương ứng với challenge đã gửi ở GET /xac-thuc/github)',
    example: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  })
  @IsString({ message: 'verifier phải là chuỗi' })
  @IsNotEmpty({ message: 'verifier không được để trống' })
  verifier!: string;

  @ApiProperty({
    description: 'Thông tin thiết bị vật lý đăng ký phiên',
    type: ThietBiDangKyDto,
  })
  @IsObject({ message: 'thietBi phải là một đối tượng' })
  @ValidateNested()
  @Type(() => ThietBiDangKyDto)
  thietBi!: ThietBiDangKyDto;
}

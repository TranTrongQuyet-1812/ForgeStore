import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token chuỗi ngẫu nhiên định dạng <maPhien>.<biMatNgauNhien>',
    example:
      '550e8400-e29b-41d4-a716-446655440000.c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
  })
  @IsString({ message: 'refreshToken phải là chuỗi' })
  @IsNotEmpty({ message: 'refreshToken không được để trống' })
  refreshToken!: string;
}

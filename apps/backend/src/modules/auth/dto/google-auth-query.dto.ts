import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthQueryDto {
  @ApiProperty({
    description: 'PKCE Code Challenge sinh bởi client (SHA-256 base64url đúng 43 ký tự)',
    example: 'E9Melhoa2OwvFrGMTJguCH5rtx64ZWqiJSTFuZ-PoTM',
  })
  @IsString({ message: 'challenge phải là chuỗi' })
  @IsNotEmpty({ message: 'challenge không được để trống' })
  challenge!: string;

  @ApiProperty({
    description: 'Deep link scheme hoặc redirect URI đích của client (ví dụ: forgestore://auth)',
    example: 'forgestore://auth',
  })
  @IsString({ message: 'redirect phải là chuỗi' })
  @IsNotEmpty({ message: 'redirect không được để trống' })
  redirect!: string;
}

export class GoogleCallbackQueryDto {
  @ApiPropertyOptional({ description: 'Mã ủy quyền do Google trả về' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Mã state CSRF đối soát' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Scope được cấp phép từ Google' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ description: 'Chỉ số tài khoản Google đăng nhập' })
  @IsOptional()
  @IsString()
  authuser?: string;

  @ApiPropertyOptional({ description: 'Prompt từ Google' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({
    description: 'RFC 9207 Issuer Identifier từ Google',
    example: 'https://accounts.google.com',
  })
  @IsOptional()
  @IsString()
  iss?: string;

  @ApiPropertyOptional({ description: 'Mã lỗi nếu người dùng hủy ủy quyền trên Google' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết lỗi từ Google' })
  @IsOptional()
  @IsString()
  error_description?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn tài liệu lỗi từ Google' })
  @IsOptional()
  @IsString()
  error_uri?: string;
}

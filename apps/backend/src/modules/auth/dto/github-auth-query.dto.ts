import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GithubAuthQueryDto {
  @ApiProperty({
    description: 'PKCE Code Challenge sinh bởi client (SHA-256 base64url hoặc hex)',
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

export class GithubCallbackQueryDto {
  @ApiPropertyOptional({ description: 'Mã ủy quyền do GitHub trả về' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Mã state CSRF đối soát' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'RFC 9207 Authorization Server Issuer Identifier do GitHub gửi kèm',
    example: 'https://github.com/login/oauth',
  })
  @IsOptional()
  @IsString()
  @Equals('https://github.com/login/oauth', {
    message: 'Issuer OAuth không hợp lệ hoặc bị giả mạo',
  })
  iss?: string;

  @ApiPropertyOptional({ description: 'Mã lỗi nếu người dùng hủy ủy quyền trên GitHub' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết lỗi từ GitHub' })
  @IsOptional()
  @IsString()
  error_description?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn tài liệu lỗi từ GitHub' })
  @IsOptional()
  @IsString()
  error_uri?: string;
}

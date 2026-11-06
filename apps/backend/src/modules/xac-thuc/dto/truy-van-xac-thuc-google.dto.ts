import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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

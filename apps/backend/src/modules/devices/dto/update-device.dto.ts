import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateDeviceDto {
  @ApiProperty({
    description: 'Tên thiết bị mới đặt lại (ví dụ: "Laptop làm việc", "Pixel 7 Pro")',
    example: 'Laptop Dell XPS 15',
  })
  @IsString({ message: 'tenThietBi phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'tenThietBi không được để trống' })
  @MaxLength(100, { message: 'tenThietBi tối đa 100 ký tự' })
  tenThietBi!: string;
}

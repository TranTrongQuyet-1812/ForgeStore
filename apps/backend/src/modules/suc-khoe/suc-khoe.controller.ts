import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

import { CongKhai } from '../../common/decorators/cong-khai.decorator';

export interface HealthResponseDto {
  trangThai: 'HOAT_DONG' | 'GIAM_DUNG' | 'KHONG_SAN_SANG';
  db: 'SAN_SANG' | 'LOI';
  redis: 'SAN_SANG' | 'LOI';
  phienBan: string;
  thoiGian: string;
}

@ApiTags('Health - Kiểm Tra Sức Khỏe')
@SkipThrottle()
@CongKhai()
@Controller('health')
export class SucKhoeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra trạng thái sẵn sàng của Database và Redis Cache' })
  @ApiResponse({ status: 200, description: 'Hệ thống hoạt động bình thường hoặc giảm dung' })
  @ApiResponse({ status: 503, description: 'Cơ sở dữ liệu chính không khả dụng' })
  async checkHealth(@Res() res: Response) {
    // 1. Kiểm tra Database với timeout 2 giây
    const dbOk = await Promise.race([
      this.prisma.checkHealth(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);

    // 2. Kiểm tra Redis với timeout 1 giây
    const redisOk = await Promise.race([
      this.cache.ping(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
    ]);

    const isHealthy = dbOk; // DB là thành phần sống còn
    const isDegraded = dbOk && !redisOk; // Redis sập -> giảm dung nhưng app vẫn chạy (P2-05.4)

    let trangThai: HealthResponseDto['trangThai'] = 'HOAT_DONG';
    if (!dbOk) {
      trangThai = 'KHONG_SAN_SANG';
    } else if (isDegraded) {
      trangThai = 'GIAM_DUNG';
    }

    const payload: HealthResponseDto = {
      trangThai,
      db: dbOk ? 'SAN_SANG' : 'LOI',
      redis: redisOk ? 'SAN_SANG' : 'LOI',
      phienBan: '0.1.0',
      thoiGian: new Date().toISOString(),
    };

    // Nếu DB sập thì trả 503, nếu chỉ Redis lỗi thì trả 200 trạng thái GIAM_DUNG
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(payload);
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit() {
    this.logger.log('Đang kết nối tới Supabase PostgreSQL qua Transaction Pooler...');
    await this.$connect();
    this.logger.log('✅ Đã kết nối thành công tới Supabase PostgreSQL!');
  }

  async onModuleDestroy() {
    this.logger.log('Đang đóng kết nối Supabase PostgreSQL...');
    await this.$disconnect();
    this.logger.log('Đã đóng kết nối Supabase PostgreSQL an toàn.');
  }

  /**
   * Health check query đơn giản SELECT 1
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.$queryRawUnsafe('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Lỗi kiểm tra sức khỏe database:', error);
      return false;
    }
  }
}

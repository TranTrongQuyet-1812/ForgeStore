import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu một route là công khai, bỏ qua JwtAuthGuard mặc định toàn cục.
 */
export const CongKhai = () => SetMetadata(IS_PUBLIC_KEY, true);

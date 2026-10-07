import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard (Fix Claude DELIV-77.8 - CF-Connecting-IP Awareness)', () => {
  const mockOptions = [
    {
      ttl: 60000,
      limit: 100,
    },
  ];

  const mockStorageService = {
    increment: vi.fn(),
  };

  const mockReflector = new Reflector();

  const createGuard = () => {
    return new AppThrottlerGuard(mockOptions, mockStorageService as any, mockReflector);
  };

  it('ưu tiên đọc IP từ header cf-connecting-ip khi có Cloudflare Tunnel', async () => {
    const guard = createGuard();
    const req = {
      headers: {
        'cf-connecting-ip': '203.0.113.195',
        'x-forwarded-for': '127.0.0.1', // Traefik gán IP nội bộ
      },
      ip: '127.0.0.1',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('203.0.113.195');
  });

  it('xử lý chuỗi cf-connecting-ip có khoảng trắng hoặc nhiều IP phân tách bởi dấu phẩy', async () => {
    const guard = createGuard();
    const req = {
      headers: {
        'cf-connecting-ip': ' 198.51.100.42 , 10.0.0.1 ',
      },
      ip: '127.0.0.1',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('198.51.100.42');
  });

  it('xử lý header CF-Connecting-IP viết hoa chữ cái', async () => {
    const guard = createGuard();
    const req = {
      headers: {
        'CF-Connecting-IP': '203.0.113.99',
      },
      ip: '127.0.0.1',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('203.0.113.99');
  });

  it('xử lý khi cf-connecting-ip là mảng chuỗi', async () => {
    const guard = createGuard();
    const req = {
      headers: {
        'cf-connecting-ip': [' 192.0.2.1 ', '10.0.0.2'],
      },
      ip: '127.0.0.1',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('192.0.2.1');
  });

  it('fallback về req.ip khi không có header cf-connecting-ip (local dev / internal traffic)', async () => {
    const guard = createGuard();
    const req = {
      headers: {},
      ip: '192.168.1.50',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('192.168.1.50');
  });

  it('fallback về 127.0.0.1 khi không có cả headers lẫn req.ip', async () => {
    const guard = createGuard();
    const req = {};

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('127.0.0.1');
  });
});

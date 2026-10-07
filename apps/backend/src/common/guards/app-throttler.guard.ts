import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard hỗ trợ môi trường Cloudflare Tunnel kết hợp Traefik / Dokploy (P3B-05.7 / Fix Claude DELIV-77.8).
 *
 * Lý do kỹ thuật:
 * Khi request đi qua Cloudflare Tunnel (trên host) -> Traefik (của Dokploy) -> Backend,
 * Traefik có thể ghi đè X-Forwarded-For bằng IP của container bridge/cloudflared.
 * Tuy nhiên, Cloudflare luôn đính kèm header 'CF-Connecting-IP' chứa IP thực tế của client.
 * Traefik chuyển tiếp nguyên vẹn header này.
 *
 * Thứ tự ưu tiên bóc tách Client IP:
 * 1. 'cf-connecting-ip' (hoặc 'CF-Connecting-IP')
 * 2. Fallback về req.ip (khi chạy local dev, unit tests, hoặc internal traffic không qua Cloudflare)
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers || {}) as Record<string, unknown>;
    const cfIp = headers['cf-connecting-ip'] || headers['CF-Connecting-IP'];

    let clientIp: string;

    if (typeof cfIp === 'string' && cfIp.trim()) {
      // Trường hợp header là chuỗi đơn: '203.0.113.195' hoặc có thể chứa nhiều IP phân tách bởi dấu phẩy
      const firstIp = cfIp.split(',')[0]?.trim();
      clientIp = firstIp || cfIp.trim();
    } else if (Array.isArray(cfIp) && cfIp.length > 0 && typeof cfIp[0] === 'string') {
      const firstIp = cfIp[0].split(',')[0]?.trim();
      clientIp = firstIp || cfIp[0].trim();
    } else {
      clientIp = typeof req.ip === 'string' && req.ip ? req.ip : '127.0.0.1';
    }

    return super.getTracker({ ...req, ip: clientIp });
  }
}

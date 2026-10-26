import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deviceService } from './thiet-bi.service';
import { LoaiThietBi } from '@forgestore/types';

describe('DeviceService (P3-04.5 - Hardware Fingerprint)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lấy thông tin thiết bị mặc định trong môi trường Web dev fallback', async () => {
    const info = await deviceService.getDeviceInfo();
    expect(info).toBeDefined();
    // Băm SHA-256 có đúng 64 ký tự hex
    expect(info.dinhDanhPhanCung).toMatch(/^[0-9a-f]{64}$/);
    expect(info.tenThietBi).toBeDefined();
    expect(info.loaiThietBi).toBe(LoaiThietBi.MAY_TINH_WINDOWS);
  });
});

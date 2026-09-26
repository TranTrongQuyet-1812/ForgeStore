import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApkInspectorService } from './apk-inspector.service';

describe('ApkInspectorService (P2-35: HTTP Range Request APK Inspector)', () => {
  let service: ApkInspectorService;

  beforeEach(() => {
    service = new ApkInspectorService();
    vi.restoreAllMocks();
  });

  it('Trả về thanhCong: false một cách duyên dáng khi HTTP HEAD thất bại', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    });

    const res = await service.docQuyenApkTuUrl(
      'https://github.com/owner/repo/releases/download/v1.0/notfound.apk',
    );

    expect(res.thanhCong).toBe(false);
    expect(res.permissions).toEqual([]);
    expect(res.lyDoThatBai).toContain('HTTP HEAD trả mã lỗi 404');
  });

  it('SEC-V3-02: Chặn đứng URL không thuộc whitelist GitHub để chống SSRF', async () => {
    const res = await service.docQuyenApkTuUrl('https://evil.com/malware.apk');
    expect(res.thanhCong).toBe(false);
    expect(res.lyDoThatBai).toContain('SSRF Protection');

    const resLocal = await service.docQuyenApkTuUrl('http://169.254.169.254/latest/meta-data/');
    expect(resLocal.thanhCong).toBe(false);
    expect(resLocal.lyDoThatBai).toContain('SSRF Protection');
  });

  it('Trả về thanhCong: false khi server không trả Content-Length', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(), // Không có content-length
    });

    const res = await service.docQuyenApkTuUrl(
      'https://github.com/owner/repo/releases/download/v1.0/test.apk',
    );

    expect(res.thanhCong).toBe(false);
    expect(res.lyDoThatBai).toContain('Server không trả Content-Length');
  });

  it('Trả về thanhCong: false khi server không hỗ trợ Range (mã không phải 206)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1048576' }),
        url: 'https://github.com/owner/repo/releases/download/v1.0/test.apk',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200, // Cần 206 Partial Content
        headers: new Headers(),
      });

    const res = await service.docQuyenApkTuUrl(
      'https://github.com/owner/repo/releases/download/v1.0/test.apk',
    );

    expect(res.thanhCong).toBe(false);
    expect(res.lyDoThatBai).toContain('không hỗ trợ HTTP Range Request');
  });
});

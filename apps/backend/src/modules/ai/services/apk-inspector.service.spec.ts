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

  it('DELIV-44.1: Chấp nhận chuyển hướng 302 từ github.com sang release-assets.githubusercontent.com (NewPipe real flow)', async () => {
    const redirectUrl =
      'https://release-assets.githubusercontent.com/123456/NewPipe_v0.27.2.apk?token=xyz';

    global.fetch = vi
      .fn()
      // Hop 1: HEAD tới github.com trả về 302
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: redirectUrl }),
      })
      // Hop 2: HEAD tới release-assets.githubusercontent.com trả về 200 kèm content-length
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '15000000' }),
      })
      // Hop 3: Range GET tới release-assets.githubusercontent.com trả về 206
      .mockResolvedValueOnce({
        ok: true,
        status: 206,
        headers: new Headers(),
        arrayBuffer: async () => new Uint8Array(65536).buffer,
      });

    const res = await service.docQuyenApkTuUrl(
      'https://github.com/TeamNewPipe/NewPipe/releases/download/v0.27.2/NewPipe_v0.27.2.apk',
    );

    // Không bị chặn bởi SSRF protection!
    expect(res.lyDoThatBai).not.toContain('SSRF Protection');
    // Fetch được gọi 3 lần: HEAD github.com -> HEAD release-assets -> Range GET release-assets
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(global.fetch).mock.calls[1][0]).toBe(redirectUrl);
  });

  it('DELIV-44.1: Xử lý chuỗi chuyển hướng nhiều bước (2-hop redirect: latest -> download -> release-assets)', async () => {
    const hop1Url =
      'https://github.com/TeamNewPipe/NewPipe/releases/download/v0.27.2/NewPipe_v0.27.2.apk';
    const hop2Url =
      'https://release-assets.githubusercontent.com/123456/NewPipe_v0.27.2.apk?token=xyz';

    global.fetch = vi
      .fn()
      // Hop 1: HEAD tới latest URL -> 302 sang download URL
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: hop1Url }),
      })
      // Hop 2: HEAD tới download URL -> 302 sang release-assets URL
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: hop2Url }),
      })
      // Hop 3: HEAD tới release-assets URL -> 200 kèm content-length
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '15000000' }),
      })
      // Hop 4: Range GET tới release-assets -> 206
      .mockResolvedValueOnce({
        ok: true,
        status: 206,
        headers: new Headers(),
        arrayBuffer: async () => new Uint8Array(65536).buffer,
      });

    const res = await service.docQuyenApkTuUrl(
      'https://github.com/TeamNewPipe/NewPipe/releases/latest/download/NewPipe.apk',
    );

    expect(res.lyDoThatBai).not.toContain('SSRF Protection');
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(vi.mocked(global.fetch).mock.calls[1][0]).toBe(hop1Url);
    expect(vi.mocked(global.fetch).mock.calls[2][0]).toBe(hop2Url);
  });
});


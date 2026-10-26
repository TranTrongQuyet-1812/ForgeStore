import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { desktopLogger, DesktopLogger } from './desktop-logger';

describe('DesktopLogger - Ghi log an toàn ra file cho Desktop Client (P3B-19)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bộ lọc làm sạch (Sanitizer) bảo vệ thông tin nhạy cảm', () => {
    it('che giấu Bearer Token trong thông điệp trước khi ghi log', async () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      await desktopLogger.ghiLogInfo(
        'Request header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz123',
        'ApiClient',
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] [ApiClient]',
        'Request header: Bearer [REDACTED]',
      );
    });

    it('che giấu password và refresh_token trong chuỗi JSON', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await desktopLogger.ghiLogWarn(
        'Payload debug: {"password":"mySecretPassword123","username":"user1"}',
        'XacThucService',
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] [XacThucService]',
        'Payload debug: {"password":"[REDACTED]","username":"user1"}',
      );
    });

    it('che giấu Bearer Token chuẩn Base64 RFC 4648 chứa ký tự + và /', async () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      await desktopLogger.ghiLogInfo(
        'Auth: Bearer a1b2+c3d/e4f==.token_end and continue',
        'ApiClient',
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] [ApiClient]',
        'Auth: Bearer [REDACTED] and continue',
      );
    });

    it('che giấu access_token, refreshToken, apiKey trong chuỗi JSON với khoảng trắng', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await desktopLogger.ghiLogWarn(
        'Token response: {"access_token": "secret_acc", "refreshToken": "secret_ref", "apiKey": "secret_key"}',
        'XacThucService',
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] [XacThucService]',
        'Token response: {"access_token":"[REDACTED]", "refreshToken":"[REDACTED]", "apiKey":"[REDACTED]"}',
      );
    });
  });

  describe('Chế độ Web Preview (non-Tauri)', () => {
    it('ghiLogInfo xuất ra console.info', async () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      await desktopLogger.ghiLogInfo('Khởi chạy ứng dụng', 'App');
      expect(spy).toHaveBeenCalledWith('[INFO] [App]', 'Khởi chạy ứng dụng');
    });

    it('ghiLogWarn xuất ra console.warn', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await desktopLogger.ghiLogWarn('Cảnh báo bộ nhớ tạm', 'Storage');
      expect(spy).toHaveBeenCalledWith('[WARN] [Storage]', 'Cảnh báo bộ nhớ tạm');
    });

    it('ghiLogError xuất ra console.error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await desktopLogger.ghiLogError('Lỗi kết nối máy chủ', 'Network');
      expect(spy).toHaveBeenCalledWith('[ERROR] [Network]', 'Lỗi kết nối máy chủ');
    });

    it('layDuongDanLog trả về đường dẫn mặc định khi ở Web preview', async () => {
      const path = await desktopLogger.layDuongDanLog();
      expect(path).toContain('forgestore_client.log');
    });

    it('moThuMucLog không bị lỗi khi ở Web preview', async () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      await expect(desktopLogger.moThuMucLog()).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Chế độ Tauri Native', () => {
    it('gọi invoke ghi_log_desktop khi môi trường Tauri khả dụng', async () => {
      const invokeMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: invokeMock,
      }));

      const logger = new DesktopLogger();
      vi.spyOn(
        logger as unknown as { laMoiTruongTauri: () => boolean },
        'laMoiTruongTauri',
      ).mockReturnValue(true);

      await logger.ghiLogInfo('Tải file thành công', 'Downloader');

      expect(invokeMock).toHaveBeenCalledWith('ghi_log_desktop', {
        level: 'INFO',
        thongDiep: 'Tải file thành công',
        nguon: 'Downloader',
      });

      vi.doUnmock('@tauri-apps/api/core');
    });

    it('gọi invoke lay_duong_dan_tep_log và mo_thu_muc_log_cmd trong Tauri', async () => {
      const invokeMock = vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'lay_duong_dan_tep_log') {
          return Promise.resolve(
            'C:\\Users\\test\\AppData\\Local\\forgestore-desktop\\logs\\forgestore_client.log',
          );
        }
        if (cmd === 'mo_thu_muc_log_cmd') {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(null);
      });

      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: invokeMock,
      }));

      const logger = new DesktopLogger();
      vi.spyOn(
        logger as unknown as { laMoiTruongTauri: () => boolean },
        'laMoiTruongTauri',
      ).mockReturnValue(true);

      const path = await logger.layDuongDanLog();
      expect(path).toBe(
        'C:\\Users\\test\\AppData\\Local\\forgestore-desktop\\logs\\forgestore_client.log',
      );

      await logger.moThuMucLog();
      expect(invokeMock).toHaveBeenCalledWith('mo_thu_muc_log_cmd');

      vi.doUnmock('@tauri-apps/api/core');
    });
  });
});

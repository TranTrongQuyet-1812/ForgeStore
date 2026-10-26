/**
 * Service ghi log hoạt động hệ thống ra file cho ForgeStore Desktop (P3B-19 & D-27).
 *
 * Tiêu chuẩn:
 * 1. Tự động ghi nhận các sự kiện: Bắt đầu tải, băm SHA-256, cài đặt, gỡ cài đặt, lỗi API 4xx/5xx.
 * 2. Lưu vào `%LOCALAPPDATA%/forgestore-desktop/logs/forgestore_client.log`.
 * 3. Tuyệt đối KHÔNG ghi token xác thực, mật khẩu hay tham số nhạy cảm (Sanitizer 2 lớp: Frontend + Rust Native).
 * 4. Hỗ trợ mở thư mục log trong Explorer để người dùng và lập trình viên tra cứu sự cố.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export class DesktopLogger {
  private laMoiTruongTauri(): boolean {
    return (
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    );
  }

  /**
   * Bộ lọc làm sạch dữ liệu nhạy cảm phía Frontend trước khi chuyển qua Tauri IPC (Phòng thủ đa tầng)
   */
  private lamSachThongDiep(thongDiep: string): string {
    if (!thongDiep) return '';
    let result = thongDiep;

    // 1. Che giấu Bearer Token (chuẩn Base64 RFC 4648 bao gồm +, /, =)
    result = result.replace(/Bearer\s+[A-Za-z0-9+/=._-]+/gi, 'Bearer [REDACTED]');

    // 2. Che giấu các trường nhạy cảm trong chuỗi JSON/Query
    result = result.replace(
      /"(password|refresh_token|refreshToken|access_token|accessToken|token|secret|apiKey|api_key)":\s*"[^"\\]*(?:\\.[^"\\]*)*"/gi,
      '"$1":"[REDACTED]"',
    );

    return result;
  }

  /**
   * Ghi log với cấp độ chỉ định (INFO, WARN, ERROR)
   */
  async ghiLog(level: LogLevel, thongDiep: string, nguon: string = 'DesktopApp'): Promise<void> {
    const cleaned = this.lamSachThongDiep(thongDiep);

    if (this.laMoiTruongTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('ghi_log_desktop', {
          level,
          thongDiep: cleaned,
          nguon: nguon || null,
        });
      } catch (err) {
        console.warn('[DesktopLogger] Lỗi khi ghi log qua Tauri command:', err);
      }
    } else {
      // Chế độ Web Preview / Dev: In có định dạng ra Console
      const prefix = `[${level}] [${nguon}]`;
      if (level === 'ERROR') {
        console.error(prefix, cleaned);
      } else if (level === 'WARN') {
        console.warn(prefix, cleaned);
      } else {
        console.info(prefix, cleaned);
      }
    }
  }

  /**
   * Ghi thông tin hoạt động bình thường (INFO)
   */
  async ghiLogInfo(thongDiep: string, nguon?: string): Promise<void> {
    return this.ghiLog('INFO', thongDiep, nguon);
  }

  /**
   * Ghi cảnh báo hoạt động (WARN)
   */
  async ghiLogWarn(thongDiep: string, nguon?: string): Promise<void> {
    return this.ghiLog('WARN', thongDiep, nguon);
  }

  /**
   * Ghi lỗi phát sinh (ERROR)
   */
  async ghiLogError(thongDiep: string, nguon?: string): Promise<void> {
    return this.ghiLog('ERROR', thongDiep, nguon);
  }

  /**
   * Mở thư mục logs trong trình quản lý tệp Windows Explorer
   */
  async moThuMucLog(): Promise<void> {
    if (this.laMoiTruongTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('mo_thu_muc_log_cmd');
    } else {
      console.info('[DesktopLogger] Mở thư mục log (Web Preview mode)');
    }
  }

  /**
   * Lấy đường dẫn tệp log hiện tại
   */
  async layDuongDanLog(): Promise<string> {
    if (this.laMoiTruongTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('lay_duong_dan_tep_log');
      } catch (err) {
        console.warn('[DesktopLogger] Lỗi khi lấy đường dẫn file log:', err);
      }
    }
    return '%LOCALAPPDATA%\\forgestore-desktop\\logs\\forgestore_client.log';
  }
}

// Singleton instance dùng xuyên suốt ứng dụng Desktop
export const desktopLogger = new DesktopLogger();

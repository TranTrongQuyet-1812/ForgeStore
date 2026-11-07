/**
 * P3B-30: đối chiếu bản ghi "đã cài bằng dòng lệnh" trong Thư viện với thực tế trên máy.
 * Hàm thuần (không gọi mạng hay lệnh nào) để test dễ và mọi quyết định nằm một chỗ.
 */

/** Trình quản lý gói Desktop kiểm được "đã cài chưa" (lệnh Rust `kiem_tra_goi_da_cai`, P3B-16.8). */
export const TRINH_KIEM_DA_CAI = ['winget', 'npm'];

/** Trình quản lý gói Desktop đọc được phiên bản thật (lệnh Rust `doc_phien_ban_goi_da_cai`, P3B-30). */
export const TRINH_DOC_PHIEN_BAN = ['npm', 'pip'];

export interface BanGhiCliDongBo {
  trangThaiXacNhan?: string | null;
  phienBanHienTai: string;
}

export interface KetQuaHoiMay {
  /** `true`/`false` khi kiểm được, `null` khi không kiểm được (trình khác, máy chưa có, chạy ngoài Tauri). */
  daCai: boolean | null;
  /** Phiên bản thật đọc từ máy, `null` khi không đọc được. */
  phienBanThat: string | null;
}

export interface QuyetDinhDongBo {
  /** Chuyển bản ghi "chờ xác nhận" sang "đã xác nhận". */
  xacNhan: boolean;
  /** Phiên bản thật cần ghi lên máy chủ; `null` nếu không cần đổi. */
  phienBanMoi: string | null;
}

/** So hai số phiên bản, bỏ qua chữ `v` đầu và hoa thường: `v1.2.3` và `1.2.3` là một. */
export function giongPhienBan(a: string, b: string): boolean {
  const chuan = (p: string) => p.trim().replace(/^v/i, '').toLowerCase();
  return chuan(a) === chuan(b);
}

export function quyetDinhDongBoCli(ban: BanGhiCliDongBo, may: KetQuaHoiMay): QuyetDinhDongBo {
  // Coi đọc được phiên bản thật cũng là bằng chứng đã cài (đặc biệt cho pip khi daCai là null).
  // Giữ nguyên: daCai === false hoặc không có bằng chứng thì không tự xác nhận và không tự xóa gì (P3B-16.6)
  const coPhienBanThat = may.phienBanThat !== null && may.phienBanThat !== '';
  const xacNhan =
    ban.trangThaiXacNhan === 'CHO_XAC_NHAN' &&
    may.daCai !== false &&
    (may.daCai === true || coPhienBanThat);
  const coPhienBanMoi =
    may.phienBanThat !== null &&
    may.phienBanThat !== '' &&
    !giongPhienBan(ban.phienBanHienTai, may.phienBanThat);
  return { xacNhan, phienBanMoi: coPhienBanMoi ? may.phienBanThat : null };
}

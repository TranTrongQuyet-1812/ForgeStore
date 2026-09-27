import type { HeDieuHanhCli, NhomCachCai, PhanCungYeuCau } from '../enums.js';

/**
 * Bước thực hiện trong một cách cài đặt dòng lệnh (CLI).
 */
export interface BuocCaiDto {
  moTa: string; // Mô tả tiếng Việt ngắn gọn cho bước này
  lenh: string; // Câu lệnh nguyên văn trích xuất từ README
  ruiRoCao?: boolean; // Cờ cảnh báo nếu lệnh có curl|sh, irm|iex, sudo, etc.
  canhBaoRuiRo?: string; // Diễn giải cảnh báo bảo mật nếu có rủi ro
}

/**
 * Một cách cài đặt ứng dụng qua dòng lệnh (ví dụ: pip, Docker, winget...).
 */
export interface CachCaiDto {
  ten: string; // Tiêu đề cách cài (VD: "Cài đặt bằng pip", "Chạy qua Docker")
  nhom: NhomCachCai;
  heDieuHanh: HeDieuHanhCli;
  phanCung: PhanCungYeuCau;
  yeuCau?: string[]; // Điều kiện tiên quyết (VD: ["Python 3.10+", "CUDA 12"])
  buoc: BuocCaiDto[];
}

/**
 * DTO trọn vẹn hướng dẫn cài đặt qua dòng lệnh của một ứng dụng.
 */
export interface HuongDanCaiDatDto {
  cachCai: CachCaiDto[];
  coRuiRoCao?: boolean; // True nếu có ít nhất 1 lệnh trong bất kỳ cách cài nào bị gắn cờ rủi ro cao
  duongDanReadmeGoc?: string; // Link xem README gốc trên GitHub
  khongCoHuongDan?: boolean; // Cờ đánh dấu repo không có hướng dẫn cài đặt CLI để tránh gọi lại README
}

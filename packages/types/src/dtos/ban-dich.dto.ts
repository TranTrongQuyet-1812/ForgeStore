import type { LyDoLoaiUngVien, TrangThaiDichReadme, TrangThaiUngVienRepo } from '../enums.js';

/**
 * DTO bản dịch README theo ứng dụng (P3B-02.2).
 */
export interface BanDichReadmeDto {
  maBanDich: string;
  maUngDung: string;
  ngonNgu: string;
  readmeSha: string;
  noiDungDich: string;
  moHinhDich: string;
  trangThai: TrangThaiDichReadme;
  thoiGianDich: string | Date;
}

/**
 * DTO bộ nhớ dịch dùng chung giữa các repo (P3B-02.3).
 */
export interface BoNhoDichChungDto {
  maBam: string;
  ngonNgu: string;
  doanGoc: string;
  doanDich: string;
  moHinhDich: string;
  ngayTao: string | Date;
}

/**
 * DTO hàng đợi ứng viên repo trong dây chuyền nạp tự động (P3B-02.5, P3B-02.8).
 */
export interface UngVienRepoDto {
  maUngVien: string;
  tenRepoDayDu: string;
  nguonKhamPha: string;
  trangThai: TrangThaiUngVienRepo;
  lyDoLoai?: LyDoLoaiUngVien | null;
  ngayTao: string | Date;
  ngayCapNhat: string | Date;
}

/**
 * DTO phản hồi API chi tiết README (P3B-05.7).
 */
export interface ChiTietReadmeResponseDto {
  maUngDung: string;
  tenRepoDayDu: string;
  banGoc: string;
  banDich: string | null;
  trangThai: TrangThaiDichReadme | 'CHUA_DICH';
  moHinhDich?: string | null;
  readmeSha?: string | null;
}

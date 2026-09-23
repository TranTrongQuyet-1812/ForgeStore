/**
 * DTO đánh giá và nhận xét của người dùng cho một ứng dụng.
 */
export interface DanhGiaDto {
  maDanhGia: string;
  maNguoiDung: string;
  maUngDung: string;
  soSao: number; // 1 - 5 sao
  tieuDe?: string | null;
  noiDungNhanXet: string;
  phienBanDanhGia: string;
  thietBiDanhGia: string;
  soLuotHuuIch: number;
  ngayDanhGia: string | Date;
  ngayCapNhat?: string | Date;
  tenNguoiDung?: string | null;
  duongDanAvatar?: string | null;
}

/**
 * Request gửi đánh giá mới hoặc cập nhật đánh giá.
 */
export interface TaoDanhGiaRequest {
  maUngDung: string;
  soSao: number;
  tieuDe?: string;
  noiDungNhanXet: string;
  phienBanDanhGia: string;
  thietBiDanhGia: string;
}

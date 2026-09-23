import type { LoaiThietBi, VaiTro } from '../enums.js';
import type { ThietBiDto } from './thiet-bi.dto.js';

/**
 * DTO tài khoản người dùng đăng nhập hệ thống.
 */
export interface NguoiDungDto {
  maNguoiDung: string;
  maDinhDanhGithub?: string | null;
  maDinhDanhGoogle?: string | null;
  tenDangNhap: string;
  tenHienThi?: string | null;
  thuDienTu?: string | null;
  duongDanAvatar?: string | null;
  vaiTro: VaiTro;
  ngayTao: string | Date;
  ngayCapNhat?: string | Date;
}

/**
 * Request đổi mã xác thực dùng 1 lần (Zero-Token-on-URL flow - D-09) lấy cặp JWT Token.
 * Kèm PKCE code verifier (P2-13.2) và thông tin thiết bị vật lý để đăng ký phiên gắn cứng với máy.
 */
export interface AuthExchangeRequest {
  code: string; // 1-time authorization code nhận qua forgestore://auth?code=...
  verifier: string; // PKCE code verifier (Bắt buộc theo D-09, P2-13.2)
  thietBi: {
    dinhDanhPhanCung: string;
    tenThietBi: string;
    loaiThietBi: LoaiThietBi;
  };
}

/**
 * Request xoay vòng Refresh Token (Token Rotation).
 */
export interface AuthRefreshRequest {
  refreshToken: string;
}

/**
 * Response sau khi xác thực thành công chứa cặp JWT và thông tin người dùng.
 */
export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  nguoiDung: NguoiDungDto;
  thietBi?: ThietBiDto;
}

import type { LoaiThietBi } from '../enums.js';
import type { UngDungTomTatDto, BanPhatHanhDto } from './ung-dung.dto.js';

/**
 * DTO thiết bị vật lý của người dùng (tách biệt khỏi phiên đăng nhập).
 */
export interface ThietBiDto {
  maThietBi: string;
  maNguoiDung: string;
  dinhDanhPhanCung: string; // Hardware Fingerprint (Hardware UUID / Android ID)
  tenThietBi: string;
  loaiThietBi: LoaiThietBi;
  ngayDangKy: string | Date;
  hoatDongLanCuoi: string | Date;
}

/**
 * DTO ứng dụng đã cài đặt trên một thiết bị vật lý cụ thể.
 */
export interface UngDungDaCaiDto {
  maBanGhi: string;
  maNguoiDung: string;
  maUngDung: string;
  maThietBi: string;
  phienBanHienTai: string;
  maTepDaCai?: string | null;
  duongDanThuMuc?: string | null;
  khoaRegistry?: string | null;
  tenHienThiRegistry?: string | null;
  ngayCaiDat: string | Date;
  ngayCapNhatCuoi?: string | Date;
  coBanMoi?: boolean;
  phienBanMoiNhat?: string | null;
  ungDung?: UngDungTomTatDto;
}

/**
 * Request đăng ký thiết bị vật lý từ Client (Desktop / Mobile).
 */
export interface DangKyThietBiRequest {
  dinhDanhPhanCung: string;
  tenThietBi: string;
  loaiThietBi: LoaiThietBi;
}

/**
 * Request ghi nhận ứng dụng vừa cài đặt hoặc nâng cấp thành công trên máy.
 */
export interface GhiNhanCaiDatRequest {
  maUngDung: string;
  phienBanHienTai: string;
  maTepDaCai?: string;
  duongDanThuMuc?: string;
  khoaRegistry?: string;
  tenHienThiRegistry?: string;
}

/**
 * Request cập nhật riêng thông tin Registry Windows cho ứng dụng đã cài đặt.
 */
export interface CapNhatKhoaRegistryRequest {
  khoaRegistry: string;
  tenHienThiRegistry?: string;
}

/**
 * Request kiểm tra danh sách bản cập nhật từ Client.
 */
export interface CheckUpdatesRequest {
  maThietBi: string;
  danhSachCaiDat?: Array<{
    maUngDung: string;
    phienBanHienTai: string;
    tenGoiAndroid?: string;
  }>;
  /**
   * Alias ungDung tương thích với Backend DTO (BE-02)
   */
  ungDung?: Array<{
    maUngDung: string;
    phienBan: string;
    tenGoiAndroid?: string;
  }>;
}

/**
 * Chi tiết từng ứng dụng có bản cập nhật mới.
 */
export interface CheckUpdatesItemDto {
  maUngDung: string;
  phienBanHienTai: string;
  phienBanMoiNhat: string;
  coBanCapNhat: boolean;
  tomTatNangCapVi?: string | null;
  banPhatHanhMoiNhat?: BanPhatHanhDto;
}

/**
 * Response kiểm tra bản cập nhật.
 */
export interface CheckUpdatesResponseDto {
  danhSachCapNhat: CheckUpdatesItemDto[];
}

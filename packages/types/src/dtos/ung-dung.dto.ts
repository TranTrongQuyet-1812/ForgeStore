import type { DinhDangTep, KienTrucChip, MucDoUyTin, NenTangHoTro } from '../enums.js';

/**
 * Mục chi tiết cảnh báo / điểm trừ trong Trust Score.
 * Nguồn: LUAT (bộ luật TypeScript) | JEV (TypeSafe AI) | DU_PHONG (bộ luật khi Jev lỗi).
 */
export interface YeuToRuiRoItem {
  ma: string;
  moTa: string;
  diemTru: number;
  nguon: 'LUAT' | 'JEV' | 'DU_PHONG';
  xacSuat?: number; // Giá trị Noul của Jev (0.0 - 1.0)
  phanVan?: boolean; // Jev chưa chắc chắn (nằm quanh khoảng giữa)
}

/**
 * DTO phân tích trí tuệ nhân tạo (Dual-AI: Gemini Flash + TypeSafe AI Jev).
 */
export interface PhanTichAiDto {
  maPhanTich?: string;
  maUngDung?: string;
  khauHieuTiengViet: string; // Slogan Gemini tiếng Việt
  tomTatTinhNangVi: string; // 3 gạch đầu dòng tiếng Việt
  diemUyTin: number; // 0 - 100
  mucDoAnToan: MucDoUyTin;
  daThamDinhJev: boolean; // false nếu mới qua bộ luật dự phòng
  yeuToRuiRo: YeuToRuiRoItem[];
  quyenHanDaKiemTra: string[]; // Danh sách quyền Android trích xuất từ APK Range Request
  moHinhTomTat?: string | null; // Tên model (gemini-3.1-flash-lite, NVIDIA NIM, DU_PHONG)
  thoiGianPhanTich?: string | Date;
}

/**
 * DTO tệp cài đặt đính kèm trong Release (.apk, .exe, .msi, .zip).
 */
export interface TepCaiDatDto {
  maTep: string;
  maPhatHanh: string;
  tenTep: string;
  duongDanTaiVe: string;
  dungLuongBytes: number | string;
  dinhDangTep: DinhDangTep;
  kienTrucChip: KienTrucChip;
  maBamSha256?: string | null;
  soLuotTai: number;
  ngayTao?: string | Date;
}

/**
 * DTO bản phát hành (Release kéo từ GitHub).
 */
export interface BanPhatHanhDto {
  maPhatHanh: string;
  maUngDung: string;
  maReleaseGithub?: number | string | null;
  tenPhienBan: string;
  tieuDePhatHanh?: string | null;
  nhatKyThayDoiGoc?: string | null;
  tomTatNangCapVi?: string | null;
  laBanThuNghiem: boolean;
  ngayPhatHanh: string | Date;
  danhSachTepCaiDat: TepCaiDatDto[];
}

/**
 * DTO thẻ ứng dụng tóm tắt (hiển thị trong danh sách Store, tìm kiếm, BXH).
 */
export interface UngDungTomTatDto {
  maUngDung: string;
  tenRepoDayDu: string; // VD: "rustdesk/rustdesk"
  chuSoHuu: string;
  tenKhoChua: string;
  duongDanGithub: string;
  duongDanIcon?: string | null;
  soSaoGithub: number;
  danhMucChinh: string;
  nenTangHoTro: NenTangHoTro;
  duocNoiBat: boolean;
  daXacMinh: boolean;
  tenGoiAndroid?: string | null; // Package name Android (D-13)
  khauHieuTiengViet?: string | null; // Slogan Gemini
  diemUyTin?: number | null; // 0 - 100
  mucDoAnToan?: MucDoUyTin | null;
  phienBanMoiNhat?: string | null;
  ngayCapNhat?: string | Date;
}

/**
 * DTO chi tiết toàn diện của ứng dụng (trang App Detail).
 */
export interface UngDungChiTietDto extends UngDungTomTatDto {
  moTaGocTiengAnh?: string | null;
  soLuotFork: number;
  loaiGiayPhep?: string | null;
  ngonNguChinh?: string | null;
  danhSachChuDe: string[];
  trangThai: string;
  dongBoLanCuoi: string | Date;
  ngayTao: string | Date;
  phanTichAi?: PhanTichAiDto | null;
  banPhatHanhMoiNhat?: BanPhatHanhDto | null;
  danhSachBanPhatHanh?: BanPhatHanhDto[];
  laYeuThich?: boolean;
}

/**
 * Request DTO gửi lên để phân giải tệp tải phù hợp với kiến trúc máy (1-Click matching theo P2-33).
 */
export interface ResolveAssetRequest {
  maUngDung: string;
  nenTang: 'ANDROID' | 'WINDOWS'; // Thiết bị gọi chỉ có thể là ANDROID hoặc WINDOWS
  abis: string[]; // Bắt buộc, theo thứ tự ưu tiên của máy (VD: ['arm64-v8a', 'armeabi-v7a'])
  choPhepBanThuNghiem?: boolean;
  phienBan?: string;
}

/**
 * Response DTO phản hồi tệp tải đã được lọc chuẩn xác.
 */
export interface ResolveAssetResponseDto {
  tepCaiDat: TepCaiDatDto;
  nguonQuyetDinh: 'LUAT' | 'JEV' | 'DU_PHONG';
  doTinCay?: number; // Độ tin cậy nếu qua Jev AI Choice primitive
}

/**
 * Các trạng thái trong vòng đời tải và cài đặt ứng dụng (P3-08..P3-11)
 */
export type TrangThaiCaiDat =
  | 'CHUA_CAI' // Nút màu cam "Cài đặt ngay"
  | 'DANG_TAI' // Đang stream byte từ GitHub CDN
  | 'XAC_MINH' // Đang kiểm tra tính toàn vẹn SHA-256
  | 'DANG_CAI_DAT' // Đang chạy .exe / .msi hoặc giải nén .zip
  | 'DA_CAI_DAT' // Đã cài thành công, hiển thị nút xanh "Mở ứng dụng"
  | 'DA_HUY' // Người dùng chủ động hủy
  | 'LOI'; // Xảy ra lỗi (mạng, SHA-256 mismatch, zip-slip, lỗi chạy file)

/**
 * Payload tiến độ nhận từ Rust Native (P3-08.2)
 */
export interface TienDoTaiPayload {
  id_tai: string;
  da_tai_bytes: number;
  tong_bytes?: number | null;
  phan_tram: number;
  toc_do_bps: number;
  trang_thai: string;
  thong_diep?: string | null;
}

/**
 * Tiến độ tải chuẩn hóa cho Frontend UI
 */
export interface TienDoTaiFrontend {
  idTai: string;
  daTaiBytes: number;
  tongBytes: number;
  phanTram: number;
  tocDoBps: number;
  trangThai: TrangThaiCaiDat;
  thongDiep?: string;
}

/**
 * Kết quả tải và băm từ Rust
 */
export interface KetQuaTaiRust {
  id_tai: string;
  duong_dan_tep: string;
  ten_tep: string;
  sha256_tinh_duoc: string;
  da_xac_minh_sha256: boolean;
  canh_bao_khong_co_hash: boolean;
  kich_thuoc_bytes: number;
}

/**
 * Kết quả cài đặt từ Rust
 */
export interface KetQuaCaiDatRust {
  thanh_cong: boolean;
  loai_cai_dat: string;
  thong_diep: string;
  duong_dan_cai_dat?: string | null;
  duong_dan_thuc_thi?: string | null;
  thong_tin_registry?: ThongTinUngDungRegistry | null;
}

/**
 * Tham số kích hoạt tải và cài đặt
 */
export interface ThamSoCaiDat {
  maUngDung: string;
  tenApp: string;
  url: string;
  tenTep: string;
  loaiTep: 'EXE' | 'MSI' | 'ZIP' | string;
  sha256DuKien?: string;
  phienBan?: string;
  maTep?: string;
  thuMucDich?: string;
}

/**
 * Trạng thái của một ứng dụng trong Install Store
 */
export interface ThongTinCaiDatApp {
  maUngDung: string;
  tenApp: string;
  loaiTep?: string;
  trangThai: TrangThaiCaiDat;
  phanTram: number;
  tocDoBps: number;
  daTaiBytes: number;
  tongBytes: number;
  thongDiepLoi?: string;
  duongDanThucThi?: string;
  duongDanThuMuc?: string;
  thoiGianCapNhat: number;
  registryKey?: string;
  registryDisplayName?: string;
  registryPublisher?: string;
  registryDisplayVersion?: string;
  mauBienThe?: string;
  tenTepDaCai?: string;
}

/**
 * Thông tin ứng dụng quét được từ Windows Registry (A4)
 */
export interface ThongTinUngDungRegistry {
  display_name: string;
  display_version?: string | null;
  publisher?: string | null;
  uninstall_string?: string | null;
  install_location?: string | null;
  registry_key?: string | null;
  display_icon?: string | null;
}

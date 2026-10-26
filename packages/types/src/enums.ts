/**
 * Bộ Enums định danh chuẩn hóa cho toàn bộ hệ sinh thái ForgeStore.
 * Giá trị trùng khớp 100% từng chữ cái với Prisma Schema (11 bảng).
 * Định nghĩa dưới dạng hằng `as const` kèm kiểu union tương ứng.
 */

export const VaiTro = {
  NGUOI_DUNG: 'NGUOI_DUNG',
  QUAN_TRI_VIEN: 'QUAN_TRI_VIEN',
} as const;
export type VaiTro = (typeof VaiTro)[keyof typeof VaiTro];

export const LoaiThietBi = {
  MAY_TINH_WINDOWS: 'MAY_TINH_WINDOWS',
  DIEN_THOAI_ANDROID: 'DIEN_THOAI_ANDROID',
  KHAC: 'KHAC',
} as const;
export type LoaiThietBi = (typeof LoaiThietBi)[keyof typeof LoaiThietBi];

export const NenTangHoTro = {
  ANDROID: 'ANDROID',
  WINDOWS: 'WINDOWS',
  DA_NEN_TANG: 'DA_NEN_TANG',
} as const;
export type NenTangHoTro = (typeof NenTangHoTro)[keyof typeof NenTangHoTro];

export const MucDoUyTin = {
  AN_TOAN_CAO: 'AN_TOAN_CAO', // Điểm uy tín từ 80 đến 100
  CAN_LUU_Y: 'CAN_LUU_Y', // Điểm uy tín từ 60 đến 79
  CANH_BAO_RUI_RO: 'CANH_BAO_RUI_RO', // Điểm uy tín dưới 60
} as const;
export type MucDoUyTin = (typeof MucDoUyTin)[keyof typeof MucDoUyTin];

export const DinhDangTep = {
  APK: 'APK',
  EXE: 'EXE',
  MSI: 'MSI',
  ZIP_PORTABLE: 'ZIP_PORTABLE',
  KHAC: 'KHAC',
} as const;
export type DinhDangTep = (typeof DinhDangTep)[keyof typeof DinhDangTep];

export const KienTrucChip = {
  ARM64_V8A: 'ARM64_V8A', // Android 64-bit hiện đại (Pixel, Galaxy, Xiaomi...)
  ARMEABI_V7A: 'ARMEABI_V7A', // Android 32-bit đời cũ
  X86_64: 'X86_64', // Windows PC 64-bit hoặc Android Emulator
  X86: 'X86', // Máy tính Windows 32-bit
  DUNG_CHUNG: 'DUNG_CHUNG', // Universal APK chạy trên mọi kiến trúc
  KHONG_XAC_DINH: 'KHONG_XAC_DINH',
} as const;
export type KienTrucChip = (typeof KienTrucChip)[keyof typeof KienTrucChip];

export const TrangThaiNapRepo = {
  THANH_CONG: 'THANH_CONG',
  LINK_KHONG_HOP_LE: 'LINK_KHONG_HOP_LE',
  KHONG_CO_RELEASE: 'KHONG_CO_RELEASE',
  KHONG_CO_FILE_CAI_DAT: 'KHONG_CO_FILE_CAI_DAT',
  THAT_BAI: 'THAT_BAI',
} as const;
export type TrangThaiNapRepo = (typeof TrangThaiNapRepo)[keyof typeof TrangThaiNapRepo];

export const TrangThaiUngDung = {
  HOAT_DONG: 'HOAT_DONG',
  TAM_KHOA: 'TAM_KHOA',
  LUU_TRU: 'LUU_TRU',
} as const;
export type TrangThaiUngDung = (typeof TrangThaiUngDung)[keyof typeof TrangThaiUngDung];

export const TrangThaiThamDinhJev = {
  DA_THAM_DINH: 'DA_THAM_DINH',
  KHONG_CAN_THIET: 'KHONG_CAN_THIET',
  CHUA_THAM_DINH: 'CHUA_THAM_DINH',
} as const;
export type TrangThaiThamDinhJev = (typeof TrangThaiThamDinhJev)[keyof typeof TrangThaiThamDinhJev];

export const TrangThaiDichReadme = {
  DANG_DICH: 'DANG_DICH',
  HOAN_TAT: 'HOAN_TAT',
  THAT_BAI: 'THAT_BAI',
  DA_CU: 'DA_CU',
} as const;
export type TrangThaiDichReadme = (typeof TrangThaiDichReadme)[keyof typeof TrangThaiDichReadme];

export const TrangThaiUngVienRepo = {
  CHO_SANG_LOC: 'CHO_SANG_LOC',
  BI_LOAI: 'BI_LOAI',
  DA_NAP: 'DA_NAP',
} as const;
export type TrangThaiUngVienRepo = (typeof TrangThaiUngVienRepo)[keyof typeof TrangThaiUngVienRepo];

export const LyDoLoaiUngVien = {
  KHONG_CO_BAN_PHAT_HANH: 'KHONG_CO_BAN_PHAT_HANH',
  KHONG_CO_FILE_CAI: 'KHONG_CO_FILE_CAI',
  CHI_CO_CAI_CLI: 'CHI_CO_CAI_CLI',
  DA_LUU_TRU: 'DA_LUU_TRU',
  GIAY_PHEP_KHONG_MO: 'GIAY_PHEP_KHONG_MO',
  LOI_KHI_SANG_LOC: 'LOI_KHI_SANG_LOC',
} as const;
export type LyDoLoaiUngVien = (typeof LyDoLoaiUngVien)[keyof typeof LyDoLoaiUngVien];

export const NhomCachCai = {
  WINGET: 'WINGET',
  SCOOP: 'SCOOP',
  PIP: 'PIP',
  CONDA: 'CONDA',
  NPM: 'NPM',
  CARGO: 'CARGO',
  GO: 'GO',
  DOCKER: 'DOCKER',
  NGUON: 'NGUON',
} as const;
export type NhomCachCai = (typeof NhomCachCai)[keyof typeof NhomCachCai];

export const HeDieuHanhCli = {
  WINDOWS: 'WINDOWS',
  LINUX_MAC: 'LINUX_MAC',
  DUNG_CHUNG: 'DUNG_CHUNG',
} as const;
export type HeDieuHanhCli = (typeof HeDieuHanhCli)[keyof typeof HeDieuHanhCli];

export const PhanCungYeuCau = {
  CPU: 'CPU',
  GPU_NVIDIA: 'GPU_NVIDIA',
  KHONG_RO: 'KHONG_RO',
} as const;
export type PhanCungYeuCau = (typeof PhanCungYeuCau)[keyof typeof PhanCungYeuCau];

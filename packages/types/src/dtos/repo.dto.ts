import type { TrangThaiNapRepo } from '../enums.js';
import type { HuongDanCaiDatDto } from './huong-dan-cli.dto.js';
import type { BanPhatHanhDto, TepCaiDatDto, UngDungChiTietDto } from './ung-dung.dto.js';

/**
 * Request nạp và kiểm định kho GitHub Repo tùy chọn (Paste & Play — Module 6, P2-41.1).
 */
export interface InspectRepoRequest {
  urlRepo: string; // VD: "https://github.com/rustdesk/rustdesk" hoặc "rustdesk/rustdesk"
  nenTang?: 'ANDROID' | 'WINDOWS'; // Nền tảng thiết bị gọi (ANDROID / WINDOWS)
  abis?: string[]; // Danh sách ABI máy hỗ trợ (VD: ['arm64-v8a']) để chọn đúng file cài tương thích
  choPhepBanThuNghiem?: boolean;
}

/**
 * Phản hồi sau khi kiểm định repo trực tiếp từ GitHub Releases.
 */
export interface InspectRepoResponseDto {
  trangThai: TrangThaiNapRepo;
  thongBao?: string;
  ungDung?: UngDungChiTietDto;
  banPhatHanh?: BanPhatHanhDto;
  tepPhuHop?: TepCaiDatDto;
  chiCoHuongDanCli?: boolean;
  huongDanCaiDat?: HuongDanCaiDatDto;
}

/**
 * DTO lịch sử nạp repo theo yêu cầu.
 */
export interface NhatKyNapRepoDto {
  maNhatKy: string;
  maNguoiDungYeuCau?: string | null;
  duongDanRepoNhap: string;
  trangThai: TrangThaiNapRepo;
  thongBaoLoi?: string | null;
  maUngDungTaoRa?: string | null;
  ngayYeuCau: string | Date;
}

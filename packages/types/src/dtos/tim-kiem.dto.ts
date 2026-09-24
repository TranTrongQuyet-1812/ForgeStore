import type { TrangKetQua } from './common.dto.js';
import type { UngDungTomTatDto } from './ung-dung.dto.js';
import type { NenTangHoTro } from '../enums.js';

export type LoaiTruyVanTimKiem = 'URL' | 'TEN_APP' | 'Y_DINH';

export interface KetQuaPhanLuongTruyVan {
  loai: LoaiTruyVanTimKiem;
  tuKhoa: string;
  owner?: string;
  repo?: string;
}

export interface TimKiemQuery {
  q: string;
  platform?: NenTangHoTro;
  page?: number;
  limit?: number;
}

export interface ThongTinUrlGithub {
  owner: string;
  repo: string;
  urlGoc: string;
  daCoTrongStore: boolean;
}

export interface TimKiemResponseDto extends TrangKetQua<UngDungTomTatDto> {
  loaiTruyVan: LoaiTruyVanTimKiem;
  thongDiep?: string;
  duongDanUrl?: ThongTinUrlGithub;
  truyVanDich?: string; // Query đã được dịch sang GitHub format (nếu là Y_DINH)
  nguonKetQua: 'CSDL' | 'GITHUB' | 'KET_HOP' | 'URL';
}

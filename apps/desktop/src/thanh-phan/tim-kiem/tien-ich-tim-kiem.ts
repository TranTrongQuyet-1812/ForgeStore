import type { ThongTinUrlGithub, TimKiemResponseDto, UngDungTomTatDto } from '@forgestore/types';

export const SO_KET_QUA_GOI_Y_DROPDOWN = 8;
export const SO_KET_QUA_MOI_TRANG_TIM_KIEM = 48;

export interface ThongTinNutXemTatCa {
  hienThi: boolean;
  nhan: string;
}

export interface ThamSoNhanEnter {
  tuKhoa: string;
  laDuongDanGithub: boolean;
  ketQua: TimKiemResponseDto | null;
  chiSoDangChon: number;
  soDongHienThiToiDa?: number;
}

export type HanhDongNhanEnter =
  | { loai: 'KHONG_LAM_GI' }
  | { loai: 'MO_TRANG_KET_QUA'; tuKhoa: string }
  | { loai: 'MO_CHI_TIET'; maMoTrang: string }
  | { loai: 'KIEM_DINH_REPO'; duongDan: string };

/**
 * Mã để mở trang chi tiết từ kết quả dán link GitHub.
 * Backend trả `owner` và `repo` tách riêng (ví dụ "sharkdp" và "bat"), trong khi API chi tiết
 * chỉ nhận "owner/repo" hoặc mã UUID. Truyền riêng "bat" sẽ bị 404.
 */
export function layMaMoTrangTuLink(thongTin: Pick<ThongTinUrlGithub, 'owner' | 'repo'>): string {
  const owner = (thongTin.owner || '').trim();
  const repo = (thongTin.repo || '').trim();
  return owner ? `${owner}/${repo}` : repo;
}

/** Chỉ luồng tìm tên trong CSDL mới trả tổng số thật; luồng ý định/kết hợp trả giới hạn lấy về. */
export function coSoLuongKetQuaThat(
  ketQua: Pick<TimKiemResponseDto, 'loaiTruyVan' | 'nguonKetQua'> | null | undefined,
): boolean {
  return ketQua?.loaiTruyVan === 'TEN_APP' && ketQua?.nguonKetQua === 'CSDL';
}

/** Kiểm tra một mục kết quả có phải ứng dụng đã nằm trong kho ForgeStore hay chưa. */
export function laKetQuaTrongKho(
  app: Pick<UngDungTomTatDto, 'chuaThamDinh'>,
  nguonKetQua?: TimKiemResponseDto['nguonKetQua'],
): boolean {
  return !app.chuaThamDinh && nguonKetQua !== 'GITHUB';
}

/** Trang kết quả chỉ hiện app đã có trong kho (trang chi tiết mở bằng mã ứng dụng). */
export function locUngDungTrongKho(
  duLieu: UngDungTomTatDto[] | null | undefined,
  nguonKetQua?: TimKiemResponseDto['nguonKetQua'],
): UngDungTomTatDto[] {
  if (!duLieu || duLieu.length === 0 || nguonKetQua === 'GITHUB') {
    return [];
  }
  return duLieu.filter((app) => !app.chuaThamDinh);
}

/** Dòng "Xem tất cả" chỉ hiện khi có ít nhất một ứng dụng đã vào kho, và chỉ gắn số thật. */
export function thongTinNutXemTatCa(
  ketQua: TimKiemResponseDto | null | undefined,
): ThongTinNutXemTatCa {
  if (!ketQua || locUngDungTrongKho(ketQua.duLieu, ketQua.nguonKetQua).length === 0) {
    return { hienThi: false, nhan: '' };
  }
  const nhan = coSoLuongKetQuaThat(ketQua)
    ? `Xem tất cả ${ketQua.tongSo} kết quả`
    : 'Xem tất cả kết quả';
  return { hienThi: true, nhan };
}

/** Dòng phụ đếm số lượng trên TrangKetQuaTimKiem, tránh ghi số giả cho luồng ý định. */
export function taoDongPhuKetQuaTimKiem(ketQua: TimKiemResponseDto | null | undefined): string {
  if (coSoLuongKetQuaThat(ketQua)) {
    return `Tìm thấy ${ketQua!.tongSo} ứng dụng`;
  }
  return 'Các kết quả phù hợp nhất';
}

/** Xác định hành động khi người dùng nhấn Enter trong thanh tìm kiếm theo 5 nhánh đã chốt. */
export function quyetDinhKhiNhanEnter(thamSo: ThamSoNhanEnter): HanhDongNhanEnter {
  const tuKhoaSach = thamSo.tuKhoa.trim();
  if (tuKhoaSach.length < 2) {
    return { loai: 'KHONG_LAM_GI' };
  }

  if (thamSo.laDuongDanGithub || thamSo.ketQua?.loaiTruyVan === 'URL') {
    if (thamSo.ketQua?.duongDanUrl?.daCoTrongStore) {
      return { loai: 'MO_CHI_TIET', maMoTrang: layMaMoTrangTuLink(thamSo.ketQua.duongDanUrl) };
    }
    return { loai: 'KIEM_DINH_REPO', duongDan: tuKhoaSach };
  }

  const toiDa = thamSo.soDongHienThiToiDa ?? SO_KET_QUA_GOI_Y_DROPDOWN;
  const danhSachHienThi = (thamSo.ketQua?.duLieu ?? []).slice(0, toiDa);
  const coXemTatCa = thongTinNutXemTatCa(thamSo.ketQua).hienThi;

  if (thamSo.chiSoDangChon >= 0 && thamSo.chiSoDangChon < danhSachHienThi.length) {
    const app = danhSachHienThi[thamSo.chiSoDangChon];
    if (!laKetQuaTrongKho(app, thamSo.ketQua?.nguonKetQua)) {
      return { loai: 'KIEM_DINH_REPO', duongDan: app.duongDanGithub || app.tenRepoDayDu };
    }
    return { loai: 'MO_CHI_TIET', maMoTrang: app.tenRepoDayDu || app.maUngDung };
  }

  if (coXemTatCa && (thamSo.chiSoDangChon === danhSachHienThi.length || thamSo.chiSoDangChon < 0)) {
    return { loai: 'MO_TRANG_KET_QUA', tuKhoa: tuKhoaSach };
  }

  return { loai: 'KHONG_LAM_GI' };
}

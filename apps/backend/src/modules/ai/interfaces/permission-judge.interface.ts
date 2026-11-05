/**
 * Giao diện thẩm định quyền Android (P2-32.1, D-01 đổi 27/10/2026).
 * Chỉ bộ luật được quyết điểm trừ; AI không đổi điểm hay nhãn an toàn (P2-70).
 */

export interface DauVaoPhanDoan {
  quyenCanKiemTra: string[];
}

export interface PhanDoanQuyen {
  quyen: string;
  tenHienThi: string;
  diemTru: number;
  nguon: 'LUAT';
  lyDo: string;
}

export interface IBoPhanDoanQuyen {
  phanDoan(dauVao: DauVaoPhanDoan): PhanDoanQuyen[];
}

/** Khóa tiêm phụ thuộc để TrustScoreService chỉ biết giao diện, không biết lớp cụ thể. */
export const BO_PHAN_DOAN_QUYEN = Symbol('BO_PHAN_DOAN_QUYEN');

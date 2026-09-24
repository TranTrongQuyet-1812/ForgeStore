/**
 * Giao diện thẩm định tính hợp lý của quyền ứng dụng (P2-32.1 & D-01).
 * Tách bạch giữa Rule Engine, Jev Noul và Luật Dự Phòng.
 */

export interface DauVaoPhanDoan {
  tenApp: string;
  moTaApp: string;
  topics: string[];
  quyenCanKiemTra: string[];
}

export interface PhanDoanQuyen {
  quyen: string;
  tenHienThi: string;
  canThiet: boolean;
  xacSuatNoul: number; // 0.0 -> 1.0 (Xác suất cần thiết từ Jev)
  phanVan: boolean; // true nếu 0.2 < noul < 0.8 (Jev phân vân, để người dùng tự quyết)
  diemTru: number;
  nguon: 'JEV' | 'DU_PHONG';
  lyDo: string;
}

export interface IBoPhanDoanQuyen {
  phanDoan(dauVao: DauVaoPhanDoan): Promise<PhanDoanQuyen[]>;
}

/**
 * Kiểu dữ liệu của bộ khung "Data_Repo" (chuẩn bị trước bản dịch cho kho, P3B-06/07).
 * Mỗi lô (lo) là một tập repo đi qua các thư mục: cào → chờ dịch → đã dịch → đã kiểm → đẩy DB.
 */

/** 01_da_cao: dữ liệu thô lấy từ GitHub, CHƯA đụng DB. */
export interface BanGhiDaCao {
  repo: string; // Định dạng chủ_sở_hữu/tên_kho (owner/repo)
  lo: string;
  caoLuc: string; // ISO
  sao: number;
  /** Mã số repo GitHub (không đổi khi repo đổi tên hoặc chuyển chủ), dùng để bắt trùng. */
  idGithub?: number | null;
  moTaEn: string | null;
  /** README thô đúng như GithubService.layReadme trả về (mã băm tính trên bản này). */
  readmeEn: string | null;
  /** SHA-256 của readmeEn.trim() (cùng hàm tinhMaBam của BE). */
  readmeSha: string | null;
  etagRepo: string | null;
  etagReleases: string | null;
  etagReadme: string | null;
}

/** Một đoạn README do phanDoanReadme chia, đã che mã. */
export interface DoanChoDich {
  stt: number;
  /** SHA-256 của đoạn gốc (khóa bo_nho_dich_chung). */
  maBam: string;
  /** Đoạn đã che ⟦Cn⟧: phần Anti dịch. */
  vanBanDaChe: string;
  /** false khi đoạn không có chữ cần dịch (chỉ mã/ký hiệu): đã điền sẵn vi = vanBanDaChe. */
  canDich: boolean;
  /** Anti điền bản dịch của vanBanDaChe, giữ nguyên mọi ⟦Cn⟧. */
  vi: string | null;
  /** Đặt bởi bước nhập khi đoạn này lỗi (mã cố định). */
  loi?: string;
}

/** 02_cho_dich / 03_da_dich / 04_loi: cùng một hình dạng. */
export interface DongDich {
  repo: string;
  lo: string;
  moTaEn: string | null;
  /** Anti điền. Bỏ trống khi moTaEn rỗng. */
  moTaVi: string | null;
  doan: DoanChoDich[];
  loiMoTa?: string;
}

/** 04_da_kiem: đạt kiểm, sẵn sàng đẩy DB. */
export interface DongDaKiem {
  repo: string;
  lo: string;
  moTaEn: string | null;
  moTaVi: string | null;
  readmeSha: string | null;
  etagRepo: string | null;
  etagReleases: string | null;
  etagReadme: string | null;
  /** Đoạn gốc (trim) + bản dịch đã gỡ che, đúng cách BE lưu bo_nho_dich_chung. */
  doan: Array<{ maBam: string; goc: string; dich: string }>;
  /** Ghép bằng hai dấu xuống dòng đúng cách BE ghép ban_dich_readme.noi_dung_dich. */
  readmeVi: string | null;
  nguon: string;
}

export type LyDoLoiDong =
  | 'khong_co_ban_cao'
  | 'doan_bi_doi'
  | 'thieu_ban_dich'
  | 'chua_dich'
  | 'con_ky_hieu_che'
  | 'mo_ta_thieu'
  | 'mo_ta_qua_dai'
  | 'placeholders_changed'
  | 'headings_changed'
  | 'table_changed'
  | 'empty_output'
  | 'mat_noi_dung';

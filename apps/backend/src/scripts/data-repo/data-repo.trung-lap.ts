/**
 * Phát hiện repo trùng lặp trong dữ liệu đã cào (chỉ báo cáo, không tự xóa).
 * Ba kiểu trùng:
 *  - trung_id: cùng mã số repo GitHub (id không đổi khi repo đổi tên hoặc chuyển chủ).
 *  - trung_ten: cùng tên owner/repo (không phân biệt hoa thường).
 *  - trung_readme: README giống hệt nhau (bản sao, mirror, re-upload). Bỏ qua README quá ngắn
 *    vì README mẫu như "# project" trùng nhau một cách vô nghĩa.
 */
export interface BanGhiKiemTrung {
  repo: string;
  lo?: string;
  idGithub?: number | null;
  readmeSha?: string | null;
  readmeDai?: number;
}

export interface NhomTrung {
  loai: 'trung_id' | 'trung_ten' | 'trung_readme';
  khoa: string;
  repo: string[];
}

export const README_TOI_THIEU_DE_SO_TRUNG = 300;

function gom(
  rows: BanGhiKiemTrung[],
  loai: NhomTrung['loai'],
  lay: (r: BanGhiKiemTrung) => string | null,
): NhomTrung[] {
  const theoKhoa = new Map<string, string[]>();
  for (const r of rows) {
    const k = lay(r);
    if (!k) continue;
    const ds = theoKhoa.get(k) ?? [];
    // Cùng một repo xuất hiện hai lần (ví dụ đợt và lô con) không tính là trùng khác repo
    if (!ds.some((x) => x.toLowerCase() === r.repo.toLowerCase())) ds.push(r.repo);
    theoKhoa.set(k, ds);
  }
  return [...theoKhoa.entries()]
    .filter(([, ds]) => ds.length > 1)
    .map(([khoa, repo]) => ({ loai, khoa, repo }));
}

export function timTrungLap(rows: BanGhiKiemTrung[]): NhomTrung[] {
  return [
    ...gom(rows, 'trung_id', (r) => (r.idGithub ? String(r.idGithub) : null)),
    ...gom(rows, 'trung_ten', (r) => r.repo.toLowerCase()),
    ...gom(rows, 'trung_readme', (r) =>
      r.readmeSha && (r.readmeDai ?? 0) >= README_TOI_THIEU_DE_SO_TRUNG ? r.readmeSha : null,
    ),
  ];
}

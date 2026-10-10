import * as fs from 'fs';
import * as path from 'path';

/** Thư mục gốc chứa dữ liệu cào/dịch. Nằm NGOÀI git, đổi bằng biến môi trường DATA_REPO_DIR. */
export const DATA_REPO_DIR =
  process.env.DATA_REPO_DIR || 'E:\\Du_An_Ca_Nhan\\BaocaoForgeStore\\Data_Repo';

export const THU_MUC = {
  danhSach: '00_danh_sach',
  daCao: '01_da_cao',
  choDich: '02_cho_dich',
  daDich: '03_da_dich',
  daKiem: '04_da_kiem',
  loi: '04_loi',
  xem: '05_xem',
  daDay: '06_da_day',
} as const;

export function duongDan(thuMuc: keyof typeof THU_MUC, lo: string, phanMoRong = 'jsonl'): string {
  return path.join(DATA_REPO_DIR, THU_MUC[thuMuc], `${lo}.${phanMoRong}`);
}

export function docJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

export function ghiJsonl<T>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const noiDung = rows.map((r) => JSON.stringify(r)).join('\n');
  fs.writeFileSync(file, rows.length ? noiDung + '\n' : '', 'utf8');
}

export function noiThemJsonl<T>(file: string, row: T): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
}

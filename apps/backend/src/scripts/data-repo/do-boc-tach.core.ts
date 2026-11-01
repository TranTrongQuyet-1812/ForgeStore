import { coCachCaiCliHopLe } from '@forgestore/types';
import { trichXuatHuongDanCliBangQuyTac } from '../../modules/ai/tien-ich/cli-guide-extractor.util';
import type { BanGhiDaCao } from './data-repo.types';

const MAU_LENH_QUEN_THUOC: Record<string, RegExp> = {
  npm: /\b(?:npm\s+(?:install|i)|pnpm\s+(?:add|install|i)|yarn\s+(?:add|global\s+add)|bun\s+(?:add|i))\b/i,
  pip: /\b(?:pip\d*\s+install|python\d*\s+-m\s+pip\s+install|py\s+-m\s+pip\s+install|pipx\s+install)\b/i,
  uv: /\buv\s+(?:tool\s+install|pip\s+install)\b/i,
  winget: /\bwinget\s+install\b/i,
  scoop: /\bscoop\s+install\b/i,
  choco: /\bchoco\s+install\b/i,
  cargo: /\bcargo\s+install\b/i,
  go: /\bgo\s+install\b/i,
  docker: /\bdocker\s+(?:pull|run)\b/i,
};

export interface DongDoBocTach {
  repo: string;
  quanLy: string;
  dong: string;
  duocNhan: boolean;
}

export interface KetQuaDoBocTach {
  tongRepo: number;
  repoCoLenh: number;
  repoDuocNhan: number;
  repoBoSot: number;
  theoQuanLy: Record<string, number>;
  dongBoSot: DongDoBocTach[];
}

function timDongLenh(readme: string): Array<{ quanLy: string; dong: string }> {
  return readme
    .split(/\r?\n/)
    .map((dong) => dong.trim())
    .flatMap((dong) => {
      const quanLy = Object.entries(MAU_LENH_QUEN_THUOC).find(([, mau]) => mau.test(dong))?.[0];
      return quanLy ? [{ quanLy, dong }] : [];
    });
}

/** Đo khả năng bắt lệnh cài trên dữ liệu cào, không gọi mạng hay ghi dữ liệu. */
export function doBocTach(danhSach: BanGhiDaCao[]): KetQuaDoBocTach {
  const ketQua: KetQuaDoBocTach = {
    tongRepo: danhSach.length,
    repoCoLenh: 0,
    repoDuocNhan: 0,
    repoBoSot: 0,
    theoQuanLy: Object.fromEntries(Object.keys(MAU_LENH_QUEN_THUOC).map((ten) => [ten, 0])),
    dongBoSot: [],
  };

  for (const row of danhSach) {
    const dongLenh = timDongLenh(row.readmeEn || '');
    if (!dongLenh.length) continue;
    const huongDan = trichXuatHuongDanCliBangQuyTac(row.readmeEn || '');
    const duocNhan = coCachCaiCliHopLe(huongDan);
    ketQua.repoCoLenh++;
    if (duocNhan) ketQua.repoDuocNhan++;
    else ketQua.repoBoSot++;

    for (const dong of dongLenh) {
      ketQua.theoQuanLy[dong.quanLy] = (ketQua.theoQuanLy[dong.quanLy] ?? 0) + 1;
      if (!duocNhan && ketQua.dongBoSot.length < 30) {
        ketQua.dongBoSot.push({ repo: row.repo, ...dong, duocNhan });
      }
    }
  }
  return ketQua;
}

/** Dự đoán trạng thái ứng dụng chỉ từ README đã cào, phục vụ chạy thử không kết nối GitHub. */
export function duDoanTrangThaiTuReadme(readme: string | null | undefined): string {
  const huongDan = trichXuatHuongDanCliBangQuyTac(readme || '');
  return coCachCaiCliHopLe(huongDan) ? 'HOAT_DONG' : 'KHONG_CO_BAN_CAI';
}

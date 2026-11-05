import { coCachCaiCliHopLe } from '@forgestore/types';
import { trichXuatHuongDanCliBangQuyTac } from '../../modules/ai/tien-ich/cli-guide-extractor.util';
import type { BanGhiDaCao } from './data-repo.types';

const TIEN_TO_LENH = String.raw`^(?:(?:[A-Za-z_][A-Za-z0-9_]*=\S+)\s+)*(?:PS(?:\s+[^>\r\n]*)?>\s*|[$>%]\s*)?`;
const MAU_LENH_QUEN_THUOC: Record<string, RegExp> = {
  npm: new RegExp(
    `${TIEN_TO_LENH}(?:npm\\s+(?:install|i)|pnpm\\s+(?:add|install|i)|yarn\\s+(?:add|global\\s+add)|bun\\s+(?:add|i))\\b`,
    'i',
  ),
  pip: new RegExp(
    `${TIEN_TO_LENH}(?:pip\\d*\\s+install|python\\d*\\s+-m\\s+pip\\s+install|py\\s+-m\\s+pip\\s+install|pipx\\s+install)\\b`,
    'i',
  ),
  uv: new RegExp(`${TIEN_TO_LENH}uv\\s+(?:tool\\s+install|pip\\s+install)\\b`, 'i'),
  winget: new RegExp(`${TIEN_TO_LENH}winget\\s+install\\b`, 'i'),
  scoop: new RegExp(`${TIEN_TO_LENH}scoop\\s+install\\b`, 'i'),
  choco: new RegExp(`${TIEN_TO_LENH}choco\\s+install\\b`, 'i'),
  cargo: new RegExp(`${TIEN_TO_LENH}cargo\\s+install\\b`, 'i'),
  go: new RegExp(`${TIEN_TO_LENH}go\\s+install\\b`, 'i'),
  docker: new RegExp(`${TIEN_TO_LENH}docker\\s+(?:pull|run)\\b`, 'i'),
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

function layUngVienLenh(dong: string): string[] {
  const htmlCode = [...dong.matchAll(/<code\b[^>]*>(.*?)<\/code>/gi)].map(
    (match) => match[1] || '',
  );
  const markdownCode = [...dong.matchAll(/`+([^`\r\n]+?)`+/g)].map((match) => match[1] || '');
  const code = [...htmlCode, ...markdownCode].map((s) => s.trim()).filter(Boolean);
  if (code.length) return code;

  const dongSach = dong
    .replace(/<!--.*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s*(?:[-*+]\s+|>\s+)/, '')
    .trim();
  return dongSach ? [dongSach] : [];
}

function timDongLenh(readme: string): Array<{ quanLy: string; dong: string }> {
  return readme.split(/\r?\n/).flatMap((dongGoc) =>
    layUngVienLenh(dongGoc).flatMap((dong) => {
      const quanLy = Object.entries(MAU_LENH_QUEN_THUOC).find(([, mau]) => mau.test(dong))?.[0];
      return quanLy ? [{ quanLy, dong }] : [];
    }),
  );
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
    // Truyền đường dẫn repo giống backend: bước "tên gói khớp tên repo" (P3B-25.12) cần biết tên repo
    const huongDan = trichXuatHuongDanCliBangQuyTac(
      row.readmeEn || '',
      `https://github.com/${row.repo}#readme`,
    );
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

/**
 * Dự đoán trạng thái ứng dụng từ README đã cào, phục vụ chạy thử không kết nối GitHub (P3B-25.6).
 * Có lệnh cài hợp lệ thì chắc chắn hiện. Không có thì `dongBoRepo` quyết theo tệp cài của Release
 * (có thì hiện, không thì ẩn), mà bản cào không có danh sách tệp, nên chỉ báo "tùy tệp cài".
 */
export type TrangThaiDuDoan = 'HOAT_DONG' | 'TUY_TEP_CAI';

export function duDoanTrangThaiTuReadme(
  readme: string | null | undefined,
  repo?: string,
): TrangThaiDuDoan {
  const huongDan = trichXuatHuongDanCliBangQuyTac(
    readme || '',
    repo ? `https://github.com/${repo}#readme` : undefined,
  );
  return coCachCaiCliHopLe(huongDan) ? 'HOAT_DONG' : 'TUY_TEP_CAI';
}

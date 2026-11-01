/**
 * CLI Data_Repo: chuẩn bị trước bản dịch cho kho (P3B-06/07). Chạy từ apps/backend:
 *
 *   pnpm data-repo kham-pha --lo dot-01 [--so 1000] [--du-tru 1000]  # chạy tiếp được khi bị ngắt
 *   pnpm data-repo quet-lai-cli --lo dot-01 [--ra dot-01b]  # nhận repo thiếu tệp cài nhưng README có lệnh cài
 *   pnpm data-repo kiem-trung                       # báo cáo repo trùng (id GitHub, tên, README giống hệt), không tự xóa
 *   pnpm data-repo chia --lo dot-01 [--moi-lo 30]   # cắt đợt đã cào thành lô nhỏ cho Anti (dot-01-l001, ...)
 *   (cũ) pnpm data-repo kham-pha --lo pilot-01 [--so 20]  # Search + 11 bộ lọc → 00_danh_sach/pilot-01.txt (+ .boqua.jsonl)
 *   pnpm data-repo cao  --lo pilot-01        # 00_danh_sach/pilot-01.txt → 01_da_cao (cào GitHub, chưa đụng DB)
 *   pnpm data-repo xuat --lo pilot-01        # 01_da_cao → 02_cho_dich (che mã, chia đoạn như BE)
 *   pnpm data-repo nhap --lo pilot-01        # 03_da_dich (Anti trả) → 04_da_kiem + 04_loi
 *   pnpm data-repo kiem-chat-luong --lo pilot-01 # chỉ đọc 02/03 → 04_nghi_ngo
 *   pnpm data-repo kiem-chat-luong --nhom 01 # kiểm mọi lô có mã nhóm 01
 *   pnpm data-repo va-tach-doan --nguon <Dich_Hang_Loat> --ra <Dot_Va> --thu # xem trước ghép bản dịch cũ
 *   pnpm data-repo va-tach-doan --nguon <Dich_Hang_Loat> --ra <Dot_Va> [--dich-lai <danh-sach.txt>]
 *   pnpm data-repo va-tach-doan2 --nguon <Kho_Cuoi> --nguon-goc <Dich_Hang_Loat> --readme-moi <Kiem_Tuoi/readme_moi> --ra <Dot_Va2> --thu
 *   pnpm data-repo va-tach-doan2 --nguon <Kho_Cuoi> --nguon-goc <Dich_Hang_Loat> --readme-moi <Kiem_Tuoi/readme_moi> --ra <Dot_Va2> [--ghep-tu <Dot_Va2_loi>]
 *   pnpm data-repo hop-nhat --nguon <Kho_Cuoi> --va <Dot_Va2> --ra <Kho_Cuoi_v2> [--doi-ten <file>] --thu
 *   pnpm data-repo hop-nhat --nguon <Dich_Hang_Loat> --va <Dot_Va> --ra <Kho_Cuoi> --thu # cách ghép cũ
 *   pnpm data-repo kiem-tuoi --nguon <Kho_Cuoi> --ra <Kiem_Tuoi> --thu # xem số request, không gọi GitHub
 *   pnpm data-repo kiem-tuoi --nguon <Kho_Cuoi> --ra <Kiem_Tuoi> [--tiep] # kiểm độ tươi qua GitHub API
 *   Danh sách dịch lại: mỗi dòng owner/repo stt_cũ (có thể là khoảng) hoặc owner/repo maBam.
 *   pnpm data-repo xem  --lo pilot-01        # 04_da_kiem → 05_xem/pilot-01.md (bảng Anh | Việt để duyệt)
 *   pnpm data-repo doi-chieu --repo o/r      # ĐỌC DB: đối chiếu mã băm đoạn với bo_nho_dich_chung của BE
 *   pnpm data-repo phan-tich --repo o/r          # chạy phân tích AI của BE cho 1 app (uy tín, an toàn, CLI, vector)
 *   pnpm data-repo day  --lo pilot-01 [--toi-da 20] [--ghi] [--bo-qua-phan-tich] [--repo owner/repo] [--luu-tru <bao_cao.jsonl>] --nguon-che <Dich_Hang_Loat> [--sua-bo-nho] # 04_da_kiem → DB (mặc định chạy thử, không ghi)
 *   pnpm data-repo hoan-tac --lo pilot-01 [--ghi]             # gỡ bản dịch của lô khỏi DB (theo nhãn)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DATA_REPO_DIR,
  docJsonl,
  duongDan,
  ghiJsonl,
  noiThemJsonl,
  THU_MUC,
} from './data-repo.paths';
import { canhBaoDong } from './data-repo.canh-bao';
import { timTrungLap } from './data-repo.trung-lap';
import { kiemChatLuongLo } from './chat-luong.core';
import {
  doiSttSangMaBam,
  docDanhSachDichLai,
  ghepBanDichCu,
  layChon,
  phanLoaiThayDoi,
} from './va-tach-doan.core';
import {
  docDanhSachDoiTen,
  hopNhatKhoCuoi,
  kiemTraKhoDaGhi,
  type DoiTenRepo,
} from './hop-nhat.core';
import { ghepBanDichDaNhap, taoRepoVa2, type KetQuaRepoVa2 } from './va-tach-doan2.core';
import {
  chayKiemTuoi,
  layChuaXuLy,
  type BaoCaoKiemTuoi,
  type KetQuaKiemMotRepo,
  type TienDoKiemTuoi,
} from './kiem-tuoi.core';
import { kiemTraDongDaDich, phanDoan, taoDongChoDich, tinhMaBam } from './data-repo.core';
import type { BanGhiDaCao, DongDaKiem, DongDich } from './data-repo.types';
import {
  layBanDichCoKyHieu,
  layCapNhatLuuTru,
  taoMapBanDichCoKyHieu,
  taoMapTrangThaiLuuTru,
} from './day.core';

const NHAN_MO_HINH = 'antigravity/gemini-3.8-flash';

function layThamSo(ten: string): string | undefined {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const coCo = (ten: string) => process.argv.includes(`--${ten}`);

function batBuocLo(): string {
  const lo = layThamSo('lo');
  if (!lo || !/^[a-zA-Z0-9_-]+$/.test(lo)) {
    throw new Error('Thiếu hoặc sai --lo (chỉ chữ, số, gạch). Ví dụ: --lo pilot-01');
  }
  return lo;
}

function nhanLo(lo: string): string {
  return `${NHAN_MO_HINH}:${lo}`;
}

// ---------------------------------------------------------------- CÀO
async function lenhCao(): Promise<void> {
  const lo = batBuocLo();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  } catch {
    /* không có dotenv thì dùng biến môi trường sẵn */
  }
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('Thiếu GITHUB_TOKEN (apps/backend/.env).');

  const fileDs = path.join(DATA_REPO_DIR, THU_MUC.danhSach, `${lo}.txt`);
  if (!fs.existsSync(fileDs)) throw new Error(`Chưa có danh sách: ${fileDs}`);
  const dsRepo = fs
    .readFileSync(fileDs, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => /^[\w.-]+\/[\w.-]+$/.test(l));

  const fileCao = duongDan('daCao', lo);
  const daCo = new Set(docJsonl<BanGhiDaCao>(fileCao).map((r) => r.repo.toLowerCase()));
  const fileBoQua = duongDan('daCao', `${lo}.boqua`);
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ForgeStore-DataRepo',
    Authorization: `Bearer ${token}`,
  };
  const goi = async (url: string) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const conLai = Number(res.headers.get('x-ratelimit-remaining') ?? '5000');
    return { res, conLai };
  };

  let moi = 0;
  for (const repo of dsRepo) {
    if (daCo.has(repo.toLowerCase())) continue;
    const r1 = await goi(`https://api.github.com/repos/${repo}`);
    if (r1.conLai < Number(layThamSo('du-tru') ?? '1000')) {
      console.warn(
        `Dừng: hạn mức GitHub còn ${r1.conLai} (dưới dự trữ). Chạy lại sau để cào tiếp.`,
      );
      break;
    }
    if (!r1.res.ok) {
      noiThemJsonl(fileBoQua, { repo, lyDo: `repo_${r1.res.status}` });
      console.warn(`Bỏ qua ${repo}: HTTP ${r1.res.status}`);
      continue;
    }
    const info = (await r1.res.json()) as {
      id?: number;
      stargazers_count: number;
      description: string | null;
      archived: boolean;
      fork: boolean;
    };
    if (info.archived || info.fork) {
      noiThemJsonl(fileBoQua, { repo, lyDo: info.archived ? 'archived' : 'fork' });
      console.warn(`Bỏ qua ${repo}: ${info.archived ? 'đã lưu trữ' : 'là fork'}`);
      continue;
    }
    const r2 = await goi(`https://api.github.com/repos/${repo}/readme`);
    let readmeEn: string | null = null;
    if (r2.res.ok) {
      const d = (await r2.res.json()) as { content?: string; encoding?: string };
      if (d.content && d.encoding === 'base64') {
        readmeEn = Buffer.from(d.content, 'base64').toString('utf-8');
      }
    }
    const r3 = await goi(`https://api.github.com/repos/${repo}/releases?per_page=15`);
    noiThemJsonl<BanGhiDaCao>(fileCao, {
      repo,
      lo,
      caoLuc: new Date().toISOString(),
      sao: info.stargazers_count,
      idGithub: info.id ?? null,
      moTaEn: info.description,
      readmeEn,
      readmeSha: readmeEn ? tinhMaBam(readmeEn) : null,
      etagRepo: r1.res.headers.get('etag'),
      etagReleases: r3.res.ok ? r3.res.headers.get('etag') : null,
      etagReadme: r2.res.ok ? r2.res.headers.get('etag') : null,
    });
    moi++;
    console.info(`Đã cào ${repo} (${info.stargazers_count}★, hạn mức còn ${r3.conLai})`);
  }
  console.info(`Xong: cào mới ${moi}, tổng ${docJsonl(fileCao).length} repo trong ${fileCao}`);
}

// ---------------------------------------------------------------- XUẤT
function lenhXuat(): void {
  const lo = batBuocLo();
  const cao = docJsonl<BanGhiDaCao>(duongDan('daCao', lo));
  if (!cao.length) throw new Error('Chưa có 01_da_cao cho lô này. Chạy "cao" trước.');
  const daKiem = new Set(docJsonl<DongDaKiem>(duongDan('daKiem', lo)).map((r) => r.repo));
  const can = cao.filter((c) => !daKiem.has(c.repo));
  const dong = can.map(taoDongChoDich);
  ghiJsonl(duongDan('choDich', lo), dong);
  const soDoan = dong.reduce((s, d) => s + d.doan.length, 0);
  const soCanDich = dong.reduce((s, d) => s + d.doan.filter((x) => x.canDich).length, 0);
  console.info(
    `Đã xuất ${dong.length} repo (${soDoan} đoạn, ${soCanDich} đoạn cần dịch) → ${duongDan('choDich', lo)}`,
  );
  console.info(`Đưa file này cho Anti, Anti trả về: ${duongDan('daDich', lo)}`);
}

// ---------------------------------------------------------------- NHẬP
function lenhNhap(): void {
  const lo = batBuocLo();
  const cao = new Map(docJsonl<BanGhiDaCao>(duongDan('daCao', lo)).map((c) => [c.repo, c]));
  const dich = docJsonl<DongDich>(duongDan('daDich', lo));
  if (!dich.length) throw new Error(`Chưa có ${duongDan('daDich', lo)} (Anti chưa trả bản dịch).`);

  const fileKiem = duongDan('daKiem', lo);
  const daKiem = new Map(docJsonl<DongDaKiem>(fileKiem).map((r) => [r.repo, r]));
  const loi: DongDich[] = [];
  const demLoi: Record<string, number> = {};
  for (const d of dich) {
    const kq = kiemTraDongDaDich(cao.get(d.repo), d, nhanLo(lo));
    // Chạy lại nhap: dòng đã đạt trước đó nhưng nay lỗi thì phải gỡ khỏi danh sách đạt
    if (kq.dat) daKiem.set(d.repo, kq.dat);
    else daKiem.delete(d.repo);
    if (kq.loi) {
      loi.push(kq.loi);
      for (const x of kq.loi.doan) if (x.loi) demLoi[x.loi] = (demLoi[x.loi] ?? 0) + 1;
      if (kq.loi.loiMoTa) demLoi[kq.loi.loiMoTa] = (demLoi[kq.loi.loiMoTa] ?? 0) + 1;
      if (kq.loi.loiReadme) demLoi[kq.loi.loiReadme] = (demLoi[kq.loi.loiReadme] ?? 0) + 1;
    }
  }
  ghiJsonl(fileKiem, [...daKiem.values()]);
  ghiJsonl(duongDan('loi', lo), loi);
  const canhBao = [...daKiem.values()].flatMap(canhBaoDong);
  ghiJsonl(duongDan('canhBao', lo), canhBao);
  const demCb: Record<string, number> = {};
  for (const cb of canhBao) demCb[cb.loai] = (demCb[cb.loai] ?? 0) + 1;
  console.info(
    `Cảnh báo chất lượng (không chặn): ${canhBao.length} → ${duongDan('canhBao', lo)} ${JSON.stringify(demCb)}`,
  );
  console.info(`Đạt: ${daKiem.size} repo → ${fileKiem}`);
  console.info(`Lỗi: ${loi.length} repo → ${duongDan('loi', lo)} ${JSON.stringify(demLoi)}`);
  if (loi.length) {
    console.info(
      'Đưa 04_loi cho Anti dịch lại các đoạn có "loi", trả vào 03_da_dich rồi chạy "nhap" lại.',
    );
  }
}

function layMaNhom(nhom: string): number {
  const ma = nhom.match(/\d+/)?.[0];
  if (!ma) throw new Error('Sai --nhom; dùng mã như 01 hoặc g01.');
  return Number(ma);
}

function laySoNhomTuLo(lo: string): number | null {
  const ma = lo.match(/(?:^|[-_])g?(\d+)-l\d{3}$/i)?.[1];
  return ma ? Number(ma) : null;
}

function layCacLoTheoNhom(nhom: string): string[] {
  const thuMuc = path.join(DATA_REPO_DIR, THU_MUC.choDich);
  if (!fs.existsSync(thuMuc)) throw new Error(`Không có thư mục ${thuMuc}`);
  const maNhom = layMaNhom(nhom);
  return fs
    .readdirSync(thuMuc)
    .filter((ten) => ten.endsWith('.jsonl'))
    .map((ten) => ten.slice(0, -'.jsonl'.length))
    .filter((lo) => laySoNhomTuLo(lo) === maNhom)
    .sort();
}

function demDoanDaDich(choDich: DongDich[], daDich: DongDich[]): number {
  const theoRepo = new Map(daDich.map((dong) => [dong.repo, dong]));
  return choDich.reduce((tong, nguon) => {
    const dich = theoRepo.get(nguon.repo);
    const sttDaDich = new Set(dich?.doan.filter((doan) => doan.vi?.trim()).map((doan) => doan.stt));
    return tong + nguon.doan.filter((doan) => doan.canDich && sttDaDich.has(doan.stt)).length;
  }, 0);
}

function inKetQuaChatLuong(
  lo: string,
  choDich: DongDich[],
  daDich: DongDich[],
  nghiNgo: ReturnType<typeof kiemChatLuongLo>,
): void {
  const dem: Record<string, number> = {};
  for (const doan of nghiNgo) {
    for (const lyDo of doan.lyDo) dem[lyDo] = (dem[lyDo] ?? 0) + 1;
  }
  const demUuTien = { cao: 0, thap: 0 };
  for (const doan of nghiNgo) demUuTien[doan.uuTien]++;
  const file = duongDan('nghiNgo', lo);
  ghiJsonl(file, nghiNgo);
  console.info(
    `${lo}: đã xét ${demDoanDaDich(choDich, daDich)} đoạn dịch, nghi ngờ ${nghiNgo.length} đoạn (cao ${demUuTien.cao}, thấp ${demUuTien.thap}) → ${file} ${JSON.stringify(dem)}`,
  );
}

/** Chỉ đọc 02/03; báo cáo riêng để không làm thay đổi bản dịch hay kết quả kiểm trước đó. */
function lenhKiemChatLuong(): void {
  const lo = layThamSo('lo');
  const nhom = layThamSo('nhom');
  if (Boolean(lo) === Boolean(nhom))
    throw new Error('Dùng đúng một trong hai: --lo <lô> hoặc --nhom <mã>.');
  const cacLo = lo ? [batBuocLo()] : layCacLoTheoNhom(nhom!);
  if (!cacLo.length) throw new Error(`Không tìm thấy lô nào cho nhóm ${nhom}.`);
  for (const tenLo of cacLo) {
    const choDich = docJsonl<DongDich>(duongDan('choDich', tenLo));
    const daDich = docJsonl<DongDich>(duongDan('daDich', tenLo));
    if (!choDich.length) throw new Error(`Chưa có ${duongDan('choDich', tenLo)}.`);
    if (!daDich.length) throw new Error(`Chưa có ${duongDan('daDich', tenLo)}.`);
    inKetQuaChatLuong(tenLo, choDich, daDich, kiemChatLuongLo(choDich, daDich));
  }
}

interface RepoCanVa {
  nhom: string;
  loaiThayDoi: 'A' | 'B' | 'dich_lai';
  cao: BanGhiDaCao;
  choDich: DongDich;
  daDich: DongDich;
  soDoanDungLai: number;
  soDoanCanDich: number;
  soDoanDichLai: number;
  soCanDichMoi: number;
  soKhongConCanDich: number;
  soMucQuanTrongDoi: number;
  boQuaDichLai: Array<{ stt: number; dong: number; lyDo: string }>;
}

function layNhomVa(): number[] {
  const thamSo = layThamSo('nhom');
  if (!thamSo) return Array.from({ length: 9 }, (_, index) => index + 1);
  const cacNhom = thamSo.split(',').map((ma) => layMaNhom(ma));
  if (cacNhom.some((ma) => ma < 1 || ma > 9)) throw new Error('--nhom chỉ nhận mã từ 01 đến 09.');
  return [...new Set(cacNhom)].sort((a, b) => a - b);
}

function taoMapRepo<T extends { repo: string }>(rows: T[], nhan: string): Map<string, T> {
  const theoRepo = new Map<string, T>();
  for (const row of rows) {
    if (theoRepo.has(row.repo)) throw new Error(`Repo bị trùng trong ${nhan}: ${row.repo}`);
    theoRepo.set(row.repo, row);
  }
  return theoRepo;
}

function ghepDoanCu(choDichCu: DongDich, daDichCu: DongDich): DongDich['doan'] {
  const banDichTheoStt = new Map(daDichCu.doan.map((doan) => [doan.stt, doan]));
  return choDichCu.doan.map((doan) => ({
    ...doan,
    vi: banDichTheoStt.get(doan.stt)?.vi ?? null,
  }));
}

function demDoiMucQuanTrong(doanMoi: DongDich['doan'], doanCu: DongDich['doan']): number {
  const cuTheoMa = new Map<string, DongDich['doan']>();
  for (const cu of doanCu) {
    const danhSach = cuTheoMa.get(cu.maBam) ?? [];
    danhSach.push(cu);
    cuTheoMa.set(cu.maBam, danhSach);
  }
  const demLan = new Map<string, number>();
  let soDoi = 0;
  for (const moi of doanMoi) {
    const lan = demLan.get(moi.maBam) ?? 0;
    demLan.set(moi.maBam, lan + 1);
    const cu = cuTheoMa.get(moi.maBam)?.[lan];
    if (cu && cu.mucQuanTrong !== moi.mucQuanTrong) soDoi++;
  }
  return soDoi;
}

function demDoiCanDich(
  doanMoi: DongDich['doan'],
  doanCu: DongDich['doan'],
): { canDichMoi: number; khongConCanDich: number } {
  const cuTheoMa = new Map<string, DongDich['doan']>();
  for (const cu of doanCu) {
    const danhSach = cuTheoMa.get(cu.maBam) ?? [];
    danhSach.push(cu);
    cuTheoMa.set(cu.maBam, danhSach);
  }
  const demLan = new Map<string, number>();
  let canDichMoi = 0;
  let khongConCanDich = 0;
  for (const moi of doanMoi) {
    const lan = demLan.get(moi.maBam) ?? 0;
    demLan.set(moi.maBam, lan + 1);
    const cu = cuTheoMa.get(moi.maBam)?.[lan];
    if (!cu) continue;
    if (!cu.canDich && moi.canDich) canDichMoi++;
    if (cu.canDich && !moi.canDich) khongConCanDich++;
  }
  return { canDichMoi, khongConCanDich };
}

function docMotLoCanVa(
  thuMucNguon: string,
  nhom: string,
  tenLo: string,
  danhSachDichLai: ReturnType<typeof docDanhSachDichLai>,
  reposDaGap: Set<string>,
): RepoCanVa[] {
  const docTheoThuMuc = (thuMuc: string) => {
    const file = path.join(thuMucNguon, nhom, thuMuc, `${tenLo}.jsonl`);
    if (!fs.existsSync(file)) throw new Error(`Thiếu tệp đầu vào ${file}`);
    return docJsonl(file);
  };
  const cao = taoMapRepo(docTheoThuMuc(THU_MUC.daCao) as BanGhiDaCao[], tenLo);
  const choDich = taoMapRepo(docTheoThuMuc(THU_MUC.choDich) as DongDich[], tenLo);
  const daDich = taoMapRepo(docTheoThuMuc(THU_MUC.daDich) as DongDich[], tenLo);
  if (cao.size !== choDich.size || cao.size !== daDich.size)
    throw new Error(`Số repo 01/02/03 không khớp trong ${tenLo}.`);
  const canVa: RepoCanVa[] = [];
  for (const [repo, banCao] of cao) {
    reposDaGap.add(repo.toLowerCase());
    const banChoDichCu = choDich.get(repo);
    const banDichCu = daDich.get(repo);
    if (!banChoDichCu || !banDichCu)
      throw new Error(`Thiếu dữ liệu 02/03 cho ${repo} trong ${tenLo}.`);
    const loMoi = tenLo.replace(/^dich-/, 'va-');
    const banChoDichMoi = taoDongChoDich({ ...banCao, lo: loMoi });
    const loaiThayDoi = phanLoaiThayDoi(banChoDichMoi.doan, banChoDichCu.doan);
    const chonCu = layChon(repo, danhSachDichLai);
    const daDoiStt = doiSttSangMaBam(banChoDichCu.doan, banChoDichMoi.doan, chonCu);
    const coYeuCauDichLai = daDoiStt.chon.maBam.size > 0 || daDoiStt.chon.lanTheoMaBam.size > 0;
    if (!loaiThayDoi && !coYeuCauDichLai) continue;
    const ketQua = ghepBanDichCu(
      banChoDichMoi.doan,
      ghepDoanCu(banChoDichCu, banDichCu),
      daDoiStt.chon,
    );
    const doiCanDich = demDoiCanDich(banChoDichMoi.doan, banChoDichCu.doan);
    canVa.push({
      nhom,
      loaiThayDoi: loaiThayDoi ?? 'dich_lai',
      cao: { ...banCao, lo: loMoi },
      choDich: banChoDichMoi,
      daDich: { ...banChoDichMoi, moTaVi: banDichCu.moTaVi, doan: ketQua.doan },
      soDoanDungLai: ketQua.soDoanDungLai,
      soDoanCanDich: ketQua.soDoanCanDich,
      soDoanDichLai: ketQua.soDoanDichLai,
      soCanDichMoi: doiCanDich.canDichMoi,
      soKhongConCanDich: doiCanDich.khongConCanDich,
      soMucQuanTrongDoi: demDoiMucQuanTrong(banChoDichMoi.doan, banChoDichCu.doan),
      boQuaDichLai: daDoiStt.boQua,
    });
  }
  return canVa;
}

function docCacRepoCanVa(
  thuMucNguon: string,
  cacNhom: number[],
  danhSachDichLai: ReturnType<typeof docDanhSachDichLai>,
  reposDaGap: Set<string>,
): RepoCanVa[] {
  const canVa: RepoCanVa[] = [];
  for (const soNhom of cacNhom) {
    const nhom = `Nhom_${String(soNhom).padStart(2, '0')}`;
    const thuMucChoDich = path.join(thuMucNguon, nhom, THU_MUC.choDich);
    if (!fs.existsSync(thuMucChoDich)) throw new Error(`Không có thư mục ${thuMucChoDich}`);
    const mauLo = new RegExp(`^dich-g${String(soNhom).padStart(2, '0')}-l\\d{3}\\.jsonl$`);
    const cacLo = fs
      .readdirSync(thuMucChoDich)
      .filter((ten) => mauLo.test(ten))
      .sort();
    if (!cacLo.length) throw new Error(`Không tìm thấy lô dịch trong ${thuMucChoDich}`);
    for (const file of cacLo) {
      const tenLo = file.slice(0, -'.jsonl'.length);
      canVa.push(...docMotLoCanVa(thuMucNguon, nhom, tenLo, danhSachDichLai, reposDaGap));
    }
  }
  return canVa;
}

function inTongKetVaTachDoan(
  cacNhom: number[],
  canVa: RepoCanVa[],
  danhSachDichLai: ReturnType<typeof docDanhSachDichLai>,
  reposDaGap: Set<string>,
): void {
  let soMucQuanTrongDoi = 0;
  let soDichLai = 0;
  let soBoQua = 0;
  for (const soNhom of cacNhom) {
    const nhom = String(soNhom).padStart(2, '0');
    const repos = canVa.filter((repo) => repo.nhom === `Nhom_${nhom}`);
    const tong = (chon: (repo: RepoCanVa) => boolean, laySo: (repo: RepoCanVa) => number) =>
      repos.filter(chon).reduce((dem, repo) => dem + laySo(repo), 0);
    const dongNhom = [
      `N${nhom}: A ${tong(
        (r) => r.loaiThayDoi === 'A',
        () => 1,
      )} repo / ${tong(
        (r) => r.loaiThayDoi === 'A',
        (r) => r.soDoanCanDich,
      )} đoạn cần dịch`,
      `B ${tong(
        (r) => r.loaiThayDoi === 'B',
        () => 1,
      )} repo / ${tong(
        (r) => r.loaiThayDoi === 'B',
        (r) => r.soDoanCanDich,
      )} đoạn cần dịch`,
      `dịch lại riêng ${tong(
        (r) => r.loaiThayDoi === 'dich_lai',
        () => 1,
      )} repo / ${tong(
        (r) => r.loaiThayDoi === 'dich_lai',
        (r) => r.soDoanDichLai,
      )} đoạn`,
      `false→true ${repos.reduce((s, r) => s + r.soCanDichMoi, 0)}, true→false ${repos.reduce((s, r) => s + r.soKhongConCanDich, 0)}`,
    ];
    console.info(dongNhom.join('; '));
    soMucQuanTrongDoi += repos.reduce((s, r) => s + r.soMucQuanTrongDoi, 0);
    soDichLai += repos.reduce((s, r) => s + r.soDoanDichLai, 0);
    soBoQua += repos.reduce((s, r) => s + r.boQuaDichLai.length, 0);
  }
  console.info(
    `Tổng: ${canVa.filter((r) => r.loaiThayDoi === 'A').length} repo A, ${canVa.filter((r) => r.loaiThayDoi === 'B').length} repo B; yêu cầu dịch lại ${soDichLai} đoạn.`,
  );
  console.info(
    `Đoạn đổi mức mucQuanTrong: ${soMucQuanTrongDoi}; dòng dịch lại bị bỏ qua: ${soBoQua}.`,
  );
  for (const repo of canVa)
    for (const dong of repo.boQuaDichLai)
      console.info(`Bỏ qua ${repo.cao.repo} stt ${dong.stt} (dòng ${dong.dong}): ${dong.lyDo}.`);
  for (const [repo, chon] of danhSachDichLai) {
    if (reposDaGap.has(repo)) continue;
    for (const stt of chon.sttCu)
      console.info(
        `Bỏ qua ${repo} stt ${stt} (dòng ${chon.dongTheoStt.get(stt)?.[0] ?? 0}): không tìm thấy repo trong các nhóm đã đọc.`,
      );
  }
}

function ghiCacLoVaTachDoan(thuMucRa: string, canVa: RepoCanVa[], moiLo: number): void {
  const nhom = [...new Set(canVa.map((repo) => repo.nhom))].sort();
  for (const maNhom of nhom) {
    const repos = canVa.filter((repo) => repo.nhom === maNhom);
    for (let batDau = 0; batDau < repos.length; batDau += moiLo) {
      const soLo = Math.floor(batDau / moiLo) + 1;
      const lo = `va-g${maNhom.slice(-2)}-l${String(soLo).padStart(3, '0')}`;
      const nhomLo = repos.slice(batDau, batDau + moiLo);
      ghiJsonl(
        path.join(thuMucRa, THU_MUC.daCao, `${lo}.jsonl`),
        nhomLo.map((repo) => ({ ...repo.cao, lo })),
      );
      ghiJsonl(
        path.join(thuMucRa, THU_MUC.choDich, `${lo}.jsonl`),
        nhomLo.map((repo) => ({ ...repo.choDich, lo })),
      );
      ghiJsonl(
        path.join(thuMucRa, THU_MUC.daDich, `${lo}.jsonl`),
        nhomLo.map((repo) => ({ ...repo.daDich, lo })),
      );
    }
  }
}

function lenhVaTachDoan(): void {
  const nguon = layThamSo('nguon');
  const dauRa = layThamSo('ra');
  if (!nguon || !dauRa) throw new Error('Cần --nguon <Dich_Hang_Loat> và --ra <Dot_Va>.');
  const thuMucNguon = path.resolve(nguon);
  const thuMucRa = path.resolve(dauRa);
  const namTrongNhomCu = Array.from({ length: 9 }, (_, index) => index + 1).some((soNhom) => {
    const nhomCu = path.join(thuMucNguon, `Nhom_${String(soNhom).padStart(2, '0')}`);
    const tuongDoi = path.relative(nhomCu, thuMucRa);
    return tuongDoi === '' || (!tuongDoi.startsWith('..') && !path.isAbsolute(tuongDoi));
  });
  if (namTrongNhomCu) throw new Error('Thư mục đầu ra không được nằm trong các nhóm nguồn.');
  if (!coCo('thu') && fs.existsSync(thuMucRa))
    throw new Error(`Thư mục đầu ra đã tồn tại, không ghi đè: ${thuMucRa}`);
  const fileDichLai = layThamSo('dich-lai');
  const danhSachDichLai = fileDichLai
    ? docDanhSachDichLai(fs.readFileSync(path.resolve(fileDichLai), 'utf8'))
    : new Map();
  const cacNhom = layNhomVa();
  const reposDaGap = new Set<string>();
  const canVa = docCacRepoCanVa(thuMucNguon, cacNhom, danhSachDichLai, reposDaGap);
  inTongKetVaTachDoan(cacNhom, canVa, danhSachDichLai, reposDaGap);
  if (coCo('thu')) return;
  const moiLo = Number(layThamSo('moi-lo') ?? '30');
  if (!Number.isInteger(moiLo) || moiLo < 1) throw new Error('--moi-lo phải là số nguyên dương.');
  ghiCacLoVaTachDoan(thuMucRa, canVa, moiLo);
  console.info(`Đã tạo dữ liệu vá tại ${thuMucRa}`);
}

function layTepLo(thuMuc: string, mau: RegExp): string[] {
  if (!fs.existsSync(thuMuc)) throw new Error(`Thiếu thư mục đầu vào ${thuMuc}.`);
  return fs
    .readdirSync(thuMuc)
    .filter((ten) => mau.test(ten))
    .sort();
}

function docCacLoGocHopNhat(thuMucNguon: string) {
  const thuMucCaoDon = path.join(thuMucNguon, THU_MUC.daCao);
  if (fs.existsSync(thuMucCaoDon)) return docCacLoKhoHopNhat(thuMucNguon);
  const cacLo = [];
  for (let n = 1; n <= 9; n++) {
    const nhom = `Nhom_${String(n).padStart(2, '0')}`;
    const mau = new RegExp(`^dich-g${String(n).padStart(2, '0')}-l\\d{3}\\.jsonl$`);
    const thuMucCao = path.join(thuMucNguon, nhom, THU_MUC.daCao);
    const thuMucKiem = path.join(thuMucNguon, nhom, THU_MUC.daKiem);
    const tepCao = layTepLo(thuMucCao, mau);
    const tepKiem = layTepLo(thuMucKiem, mau);
    if (!tepCao.length || JSON.stringify(tepCao) !== JSON.stringify(tepKiem))
      throw new Error(`Tên lô 01_da_cao/04_da_kiem không khớp trong ${nhom}.`);
    for (const tep of tepCao) {
      const lo = tep.slice(0, -'.jsonl'.length);
      cacLo.push({
        lo,
        cao: docJsonl<BanGhiDaCao>(path.join(thuMucCao, tep)),
        daKiem: docJsonl<DongDaKiem>(path.join(thuMucKiem, tep)),
      });
    }
  }
  return cacLo;
}

function docCacLoKhoHopNhat(thuMucNguon: string) {
  const thuMucCao = path.join(thuMucNguon, THU_MUC.daCao);
  const thuMucKiem = path.join(thuMucNguon, THU_MUC.daKiem);
  const mau = /^dich-g\d{2}-l\d{3}\.jsonl$/;
  const tepCao = layTepLo(thuMucCao, mau);
  const tepKiem = layTepLo(thuMucKiem, mau);
  if (!tepCao.length || JSON.stringify(tepCao) !== JSON.stringify(tepKiem))
    throw new Error('Tên lô 01_da_cao/04_da_kiem không khớp trong Kho_Cuoi.');
  return tepCao.map((tep) => {
    const lo = tep.slice(0, -'.jsonl'.length);
    return {
      lo,
      cao: docJsonl<BanGhiDaCao>(path.join(thuMucCao, tep)),
      daKiem: docJsonl<DongDaKiem>(path.join(thuMucKiem, tep)),
    };
  });
}

function docCacLoVaHopNhat(thuMucVa: string) {
  const mau = /^va2?-g\d{2}-l\d{3}\.jsonl$/;
  const thuMucCao = path.join(thuMucVa, THU_MUC.daCao);
  const thuMucKiem = path.join(thuMucVa, THU_MUC.daKiem);
  const thuMucLoi = path.join(thuMucVa, THU_MUC.loi);
  const tepCao = layTepLo(thuMucCao, mau);
  const tepKiem = layTepLo(thuMucKiem, mau);
  const tepLoi = layTepLo(thuMucLoi, mau);
  if (!tepCao.length || JSON.stringify(tepCao) !== JSON.stringify(tepKiem))
    throw new Error('Tên lô 01_da_cao/04_da_kiem của Dot_Va không khớp.');
  if (JSON.stringify(tepCao) !== JSON.stringify(tepLoi))
    throw new Error('Tên lô 01_da_cao/04_loi của Dot_Va không khớp.');
  return tepCao.map((tep) => {
    const lo = tep.slice(0, -'.jsonl'.length);
    return {
      lo,
      cao: docJsonl<BanGhiDaCao>(path.join(thuMucCao, tep)),
      daKiem: docJsonl<DongDaKiem>(path.join(thuMucKiem, tep)),
      loi: docJsonl<DongDich>(path.join(thuMucLoi, tep)),
    };
  });
}

function taoBaoCaoHopNhat(
  ketQua: ReturnType<typeof hopNhatKhoCuoi>,
  soDoan: { canDich: number; daDich: number },
): string {
  const dong = [
    '# Nguồn dữ liệu Kho_Cuoi',
    '',
    'Kho cuối giữ nguyên tên và thứ tự lô gốc. Repo đạt kiểm trong đợt vá thay bản cũ cùng repo.',
    '',
    '| Lô | Tổng repo | Lấy từ đợt vá | Giữ bản cũ |',
    '|---|---:|---:|---:|',
  ];
  for (const lo of ketQua.cacLo)
    dong.push(
      `| ${lo.lo} | ${lo.cao.length} | ${lo.soRepoThayThe} | ${lo.cao.length - lo.soRepoThayThe} |`,
    );
  dong.push(
    '',
    `Tổng: ${ketQua.tongRepo} repo, ${ketQua.tongThayThe} repo lấy từ đợt vá.`,
    `Đoạn cần dịch: ${soDoan.daDich}/${soDoan.canDich} đã có bản dịch.`,
    '',
    '## Repo lấy từ Dot_Va2',
    '',
    ...(ketQua.danhSachThayThe.length
      ? ketQua.danhSachThayThe.map((item) => `- ${item.repo}`)
      : ['- Không có']),
    '',
    '## Repo đã đổi tên',
    '',
    ...(ketQua.danhSachDoiTen.length
      ? ketQua.danhSachDoiTen.map((item) => `- ${item.tenCu} → ${item.tenMoi}`)
      : ['- Không có']),
    '',
    '## Repo đã lưu trữ (theo Kiem_Tuoi)',
    '',
    ...(ketQua.danhSachLuuTru.length
      ? ketQua.danhSachLuuTru.map((repo) => `- ${repo}`)
      : ['- Không có']),
    '',
  );
  return dong.join('\n');
}

function inBaoCaoHopNhat(
  ketQua: ReturnType<typeof hopNhatKhoCuoi>,
  soDoan: { canDich: number; daDich: number },
): void {
  console.info(`Tổng repo đầu ra: ${ketQua.tongRepo}; số lô: ${ketQua.cacLo.length}.`);
  console.info(
    `Lấy từ Dot_Va2: ${ketQua.tongThayThe}; giữ từ Kho_Cuoi: ${ketQua.tongRepo - ketQua.tongThayThe}.`,
  );
  console.info(`Repo đổi tên: ${ketQua.danhSachDoiTen.length}.`);
  console.info(`Repo archived trong Kiem_Tuoi: ${ketQua.danhSachLuuTru.length}.`);
  console.info(
    `Đoạn có bản dịch: ${soDoan.daDich}/${soDoan.canDich}; thiếu: ${soDoan.canDich - soDoan.daDich}.`,
  );
  for (const lo of ketQua.cacLo)
    console.info(`${lo.lo} | ${lo.cao.length} repo | ${lo.soRepoThayThe} từ Dot_Va2.`);
  for (const thay of ketQua.danhSachThayThe)
    console.info(`${thay.repo}: ${thay.loGoc} ← ${thay.loVa}`);
  for (const doiTen of ketQua.danhSachDoiTen)
    console.info(`Đổi tên: ${doiTen.tenCu} → ${doiTen.tenMoi}.`);
  if (ketQua.danhSachLuuTru.length)
    console.info(`Đã lưu trữ: ${ketQua.danhSachLuuTru.join(', ')}.`);
}

function ghiKhoHopNhat(
  thuMucRa: string,
  ketQua: ReturnType<typeof hopNhatKhoCuoi>,
  soDoan: { canDich: number; daDich: number },
): void {
  for (const lo of ketQua.cacLo) {
    ghiJsonl(path.join(thuMucRa, THU_MUC.daCao, `${lo.lo}.jsonl`), lo.cao);
    ghiJsonl(path.join(thuMucRa, THU_MUC.daKiem, `${lo.lo}.jsonl`), lo.daKiem);
  }
  fs.writeFileSync(path.join(thuMucRa, 'NGUON.md'), taoBaoCaoHopNhat(ketQua, soDoan), 'utf8');
}

function docRepoLuuTru(thuMucNguon: string): string[] {
  const thuMucBaoCao = fs.existsSync(path.join(thuMucNguon, '01_da_cao'))
    ? path.join(path.dirname(thuMucNguon), 'Kiem_Tuoi')
    : path.join(thuMucNguon, 'Kiem_Tuoi');
  const file = path.join(thuMucBaoCao, 'bao_cao.jsonl');
  if (!fs.existsSync(file)) return [];
  return docJsonl<BaoCaoKiemTuoi>(file)
    .filter((row) => row.loai === 'luu_tru' || row.archived === true)
    .map((row) => row.repo);
}

function demDoanCoBanDichKho(ketQua: ReturnType<typeof hopNhatKhoCuoi>) {
  let canDich = 0;
  let daDich = 0;
  for (const lo of ketQua.cacLo) {
    const daKiemTheoRepo = new Map(lo.daKiem.map((row) => [row.repo.toLowerCase(), row]));
    for (const cao of lo.cao) {
      const doanNguon = taoDongChoDich(cao).doan;
      const daKiem = daKiemTheoRepo.get(cao.repo.toLowerCase());
      if (!daKiem || doanNguon.length !== daKiem.doan.length)
        throw new Error(`Số đoạn 01/04 không khớp khi thống kê ${cao.repo}.`);
      for (const [stt, doan] of doanNguon.entries()) {
        if (!doan.canDich) continue;
        canDich++;
        if (daKiem.doan[stt]?.dich.trim()) daDich++;
      }
    }
  }
  return { canDich, daDich };
}

function docDanhSachDoiTenTep(file?: string): DoiTenRepo[] {
  if (!file) return [];
  const duongDanTep = path.resolve(file);
  if (!fs.existsSync(duongDanTep))
    throw new Error(`Không tìm thấy danh sách đổi tên ${duongDanTep}.`);
  return docDanhSachDoiTen(fs.readFileSync(duongDanTep, 'utf8'));
}

function kiemThuMucDauRaHopNhat(thuMucRa: string): void {
  if (!fs.existsSync(thuMucRa)) return;
  if (fs.readdirSync(thuMucRa).length > 0)
    throw new Error(`Thư mục đầu ra đã có nội dung, không ghi đè: ${thuMucRa}`);
}

interface MucTaoVa2 {
  nhom: string;
  repo: string;
  ketQua: KetQuaRepoVa2;
}

function layTenTepReadmeMoi(thuMuc: string, repo: string): string {
  const phanTen = repo.replace(/[^a-zA-Z0-9._-]+/g, '__');
  return path.join(thuMuc, `${phanTen}-${tinhMaBam(repo).slice(0, 12)}.md`);
}

function docMapNguonKho<T extends { repo: string }>(thuMuc: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const tep of fs
    .readdirSync(thuMuc)
    .filter((ten) => ten.endsWith('.jsonl'))
    .sort()) {
    for (const dong of docJsonl<T>(path.join(thuMuc, tep))) {
      const khoa = dong.repo.toLowerCase();
      if (map.has(khoa)) throw new Error(`Repo trùng trong ${thuMuc}: ${dong.repo}.`);
      map.set(khoa, dong);
    }
  }
  return map;
}

function docNguonDichCuVa2(thuMucNguonGoc: string): Map<string, DongDich> {
  const thuMucVa = path.join(thuMucNguonGoc, 'Dot_Va', THU_MUC.daDich);
  const tuDotVa = docMapNguonKho<DongDich>(thuMucVa);
  const nguon = new Map(tuDotVa);
  for (let soNhom = 1; soNhom <= 9; soNhom++) {
    const nhom = `Nhom_${String(soNhom).padStart(2, '0')}`;
    const thuMuc = path.join(thuMucNguonGoc, nhom, THU_MUC.daDich);
    for (const [khoa, dong] of docMapNguonKho<DongDich>(thuMuc)) {
      if (!nguon.has(khoa)) nguon.set(khoa, dong);
    }
  }
  return nguon;
}

function docMucTaoVa2(
  thuMucNguon: string,
  thuMucReadme: string,
  thuMucNguonGoc: string,
): MucTaoVa2[] {
  const fileBaoCao = path.join(path.dirname(thuMucReadme), 'bao_cao.jsonl');
  const baoCao = docJsonl<BaoCaoKiemTuoi>(fileBaoCao);
  const canVa = new Map(
    baoCao
      .filter((row) => ['readme_doi_nhe', 'readme_doi_nhieu'].includes(row.loai))
      .map((row) => [row.repo.toLowerCase(), row]),
  );
  const caoTheoRepo = docMapNguonKho<BanGhiDaCao>(path.join(thuMucNguon, THU_MUC.daCao));
  const kiemTheoRepo = docMapNguonKho<DongDaKiem>(path.join(thuMucNguon, THU_MUC.daKiem));
  const dichCuTheoRepo = docNguonDichCuVa2(thuMucNguonGoc);
  const muc: MucTaoVa2[] = [];
  for (const [khoa, row] of canVa) {
    const caoCu = caoTheoRepo.get(khoa);
    const daKiemCu = kiemTheoRepo.get(khoa);
    const dichCu = dichCuTheoRepo.get(khoa);
    if (!caoCu || !daKiemCu || !dichCu)
      throw new Error(`Thiếu dữ liệu Kho_Cuoi hoặc 03_da_dich cho ${row.repo}.`);
    const fileReadme = layTenTepReadmeMoi(thuMucReadme, row.repo);
    if (!fs.existsSync(fileReadme))
      throw new Error(`Thiếu README mới của ${row.repo}: ${fileReadme}`);
    const readmeMoi = fs.readFileSync(fileReadme, 'utf8');
    if (!row.readmeShaMoi || tinhMaBam(readmeMoi) !== row.readmeShaMoi)
      throw new Error(`SHA README mới không khớp báo cáo cho ${row.repo}.`);
    const nhom = caoCu.lo.match(/^dich-g(\d{2})-/)?.[1];
    if (!nhom) throw new Error(`Không suy ra nhóm từ lô ${caoCu.lo} của ${row.repo}.`);
    muc.push({
      nhom,
      repo: row.repo,
      ketQua: taoRepoVa2({
        caoCu,
        daKiemCu,
        doanCuDaChe: dichCu.doan,
        readmeMoi,
        shaMoi: tinhMaBam(readmeMoi),
        loMoi: '',
        saoMoi: row.saoHienTai,
        idMoi: row.idGithub,
        taoDoan: (cao) => taoDongChoDich(cao).doan,
      }),
    });
  }
  return muc.sort((a, b) => a.nhom.localeCompare(b.nhom));
}

function chiaLoVa2(muc: MucTaoVa2[], kichThuoc = 30): Array<{ lo: string; muc: MucTaoVa2[] }> {
  const theoNhom = new Map<string, MucTaoVa2[]>();
  for (const dong of muc) {
    const ds = theoNhom.get(dong.nhom) ?? [];
    ds.push(dong);
    theoNhom.set(dong.nhom, ds);
  }
  return [...theoNhom.entries()].flatMap(([nhom, danhSach]) =>
    Array.from({ length: Math.ceil(danhSach.length / kichThuoc) }, (_, index) => {
      const lo = `va2-g${nhom}-l${String(index + 1).padStart(3, '0')}`;
      const phan = danhSach.slice(index * kichThuoc, (index + 1) * kichThuoc);
      return {
        lo,
        muc: phan.map((item) => {
          item.ketQua.cao.lo = lo;
          item.ketQua.choDich.lo = lo;
          item.ketQua.daDich.lo = lo;
          return item;
        }),
      };
    }),
  );
}

function inThongKeVa2(cacLo: Array<{ lo: string; muc: MucTaoVa2[] }>): void {
  const tongRepo = cacLo.reduce((tong, lo) => tong + lo.muc.length, 0);
  const dungLai = cacLo
    .flatMap((lo) => lo.muc)
    .reduce((tong, item) => tong + item.ketQua.soDoanDungLai, 0);
  const canDich = cacLo
    .flatMap((lo) => lo.muc)
    .reduce((tong, item) => tong + item.ketQua.soDoanCanDich, 0);
  console.info(
    `Repo cần vá: ${tongRepo}; đoạn dùng lại: ${dungLai}; đoạn mới Anti phải dịch: ${canDich}.`,
  );
  for (const lo of cacLo) {
    const dung = lo.muc.reduce((tong, item) => tong + item.ketQua.soDoanDungLai, 0);
    const moi = lo.muc.reduce((tong, item) => tong + item.ketQua.soDoanCanDich, 0);
    console.info(`${lo.lo}: ${lo.muc.length} repo, ${dung} đoạn dùng lại, ${moi} đoạn mới.`);
  }
}

function ghepTienDoVa2(muc: MucTaoVa2[], thuMucCu: string): number {
  const cuTheoRepo = docMapNguonKho<DongDich>(path.join(thuMucCu, THU_MUC.daDich));
  let soGhep = 0;
  for (const item of muc) {
    const dongCu = cuTheoRepo.get(item.repo.toLowerCase());
    if (!dongCu) continue;
    const ketQuaCho = ghepBanDichDaNhap(item.ketQua.choDich, dongCu);
    const ketQuaDa = ghepBanDichDaNhap(item.ketQua.daDich, dongCu);
    if (!ketQuaDa.soGhep) continue;
    const dongThu = {
      ...ketQuaDa.dong,
      doan: ketQuaDa.dong.doan.map((doan) =>
        doan.canDich && !doan.vi?.trim() ? { ...doan, vi: doan.vanBanDaChe } : doan,
      ),
    };
    const kiemThu = kiemTraDongDaDich(item.ketQua.cao, dongThu, 'va2:kiem_thu');
    if (kiemThu.loi?.loiReadme) {
      const canHoanTac = new Set(ketQuaDa.sttGhep);
      item.ketQua.choDich = {
        ...ketQuaCho.dong,
        doan: ketQuaCho.dong.doan.map((doan) =>
          canHoanTac.has(doan.stt) ? { ...doan, vi: null } : doan,
        ),
      };
      item.ketQua.daDich = {
        ...ketQuaDa.dong,
        doan: ketQuaDa.dong.doan.map((doan) =>
          canHoanTac.has(doan.stt) ? { ...doan, vi: null } : doan,
        ),
      };
      console.warn(
        `Không khôi phục ${ketQuaDa.soGhep} đoạn ${item.repo}: bản dịch làm đổi cấu trúc README.`,
      );
      continue;
    }
    item.ketQua.choDich = ketQuaCho.dong;
    item.ketQua.daDich = ketQuaDa.dong;
    item.ketQua.soDoanDungLai += ketQuaDa.soGhep;
    item.ketQua.soDoanCanDich -= ketQuaDa.soGhep;
    soGhep += ketQuaDa.soGhep;
  }
  return soGhep;
}

function ghiCacLoVa2(thuMucRa: string, cacLo: Array<{ lo: string; muc: MucTaoVa2[] }>): void {
  for (const lo of cacLo) {
    ghiJsonl(
      path.join(thuMucRa, THU_MUC.daCao, `${lo.lo}.jsonl`),
      lo.muc.map((item) => item.ketQua.cao),
    );
    ghiJsonl(
      path.join(thuMucRa, THU_MUC.choDich, `${lo.lo}.jsonl`),
      lo.muc.map((item) => item.ketQua.choDich),
    );
    ghiJsonl(
      path.join(thuMucRa, THU_MUC.daDich, `${lo.lo}.jsonl`),
      lo.muc.map((item) => item.ketQua.daDich),
    );
  }
}

function lenhVaTachDoan2(): void {
  const nguon = layThamSo('nguon');
  const nguonGoc = layThamSo('nguon-goc');
  const readme = layThamSo('readme-moi');
  const ghepTu = layThamSo('ghep-tu');
  const dauRa = layThamSo('ra');
  if (!nguon || !nguonGoc || !readme || !dauRa)
    throw new Error(
      'Dùng va-tach-doan2 --nguon <Kho_Cuoi> --nguon-goc <Dich_Hang_Loat> --readme-moi <readme_moi> --ra <Dot_Va2> [--thu].',
    );
  const thuMucNguon = path.resolve(nguon);
  const thuMucNguonGoc = path.resolve(nguonGoc);
  const thuMucReadme = path.resolve(readme);
  const thuMucRa = path.resolve(dauRa);
  const muc = docMucTaoVa2(thuMucNguon, thuMucReadme, thuMucNguonGoc);
  const cacLo = chiaLoVa2(muc);
  const soGhepTam = ghepTu ? ghepTienDoVa2(muc, path.resolve(ghepTu)) : 0;
  inThongKeVa2(cacLo);
  if (ghepTu) console.info(`Khôi phục ${soGhepTam} đoạn Anti đã dịch từ ${path.resolve(ghepTu)}.`);
  if (coCo('thu')) return console.info('Chạy thử: không ghi tệp nào.');
  if (thuMucRa === thuMucNguon || thuMucRa.startsWith(`${thuMucNguon}${path.sep}`))
    throw new Error('Dot_Va2 phải nằm ngoài Kho_Cuoi.');
  if (fs.existsSync(thuMucRa)) throw new Error(`Thư mục đầu ra đã tồn tại: ${thuMucRa}`);
  ghiCacLoVa2(thuMucRa, cacLo);
  console.info(`Đã tạo ${cacLo.length} lô trong ${thuMucRa}.`);
}

function docKhoHopNhatDaGhi(thuMucRa: string, cacLoGoc: ReturnType<typeof docCacLoGocHopNhat>) {
  return cacLoGoc.map(({ lo }) => ({
    lo,
    cao: docJsonl<BanGhiDaCao>(path.join(thuMucRa, THU_MUC.daCao, `${lo}.jsonl`)),
    daKiem: docJsonl<DongDaKiem>(path.join(thuMucRa, THU_MUC.daKiem, `${lo}.jsonl`)),
  }));
}

function lenhHopNhat(): void {
  const nguon = layThamSo('nguon');
  const duLieuVa = layThamSo('va');
  const dauRa = layThamSo('ra');
  const tepDoiTen = layThamSo('doi-ten');
  if (!nguon || !duLieuVa || !dauRa)
    throw new Error(
      'Dùng --nguon <Kho_Cuoi|Dich_Hang_Loat> --va <Dot_Va|Dot_Va2> --ra <Kho_Cuoi_moi> [--doi-ten <file>] [--thu].',
    );
  const thuMucNguon = path.resolve(nguon);
  const thuMucVa = path.resolve(duLieuVa);
  const thuMucRa = path.resolve(dauRa);
  const cacThuMucNguon = [
    ...Array.from({ length: 9 }, (_, index) =>
      path.join(thuMucNguon, `Nhom_${String(index + 1).padStart(2, '0')}`),
    ),
    thuMucVa,
  ];
  const namTrongNguon =
    [thuMucNguon, thuMucVa].includes(thuMucRa) ||
    cacThuMucNguon.some((goc) => {
      const tuongDoi = path.relative(goc, thuMucRa);
      return tuongDoi === '' || (!tuongDoi.startsWith('..') && !path.isAbsolute(tuongDoi));
    });
  if (namTrongNguon) throw new Error('Kho_Cuoi phải nằm ngoài thư mục dữ liệu đầu vào.');
  if (!coCo('thu')) kiemThuMucDauRaHopNhat(thuMucRa);
  const cacLoGoc = docCacLoGocHopNhat(thuMucNguon);
  const cacLoVa = docCacLoVaHopNhat(thuMucVa);
  const ketQua = hopNhatKhoCuoi(
    cacLoGoc,
    cacLoVa,
    817,
    docDanhSachDoiTenTep(tepDoiTen),
    docRepoLuuTru(thuMucNguon),
  );
  if (ketQua.cacLo.some((lo) => /^va2?-g\d{2}-l\d{3}$/.test(lo.lo)))
    throw new Error('Không được để tên lô đợt vá trong kho đầu ra.');
  const soDoan = demDoanCoBanDichKho(ketQua);
  inBaoCaoHopNhat(ketQua, soDoan);
  if (coCo('thu')) {
    console.info('Chạy thử: không ghi tệp nào.');
    return;
  }
  ghiKhoHopNhat(thuMucRa, ketQua, soDoan);
  kiemTraKhoDaGhi(ketQua, docKhoHopNhatDaGhi(thuMucRa, cacLoGoc));
  console.info(
    `Đã ghi và đối chiếu ${ketQua.tongRepo} repo trong ${ketQua.cacLo.length} lô tại ${thuMucRa}.`,
  );
}

function docDuLieuKiemTuoi(thuMucNguon: string): TienDoKiemTuoi[] {
  const thuMucCao = path.join(thuMucNguon, THU_MUC.daCao);
  const thuMucKiem = path.join(thuMucNguon, THU_MUC.daKiem);
  if (!fs.existsSync(thuMucCao) || !fs.existsSync(thuMucKiem))
    throw new Error('Nguồn cần có cả 01_da_cao và 04_da_kiem.');
  const cao = fs
    .readdirSync(thuMucCao)
    .filter((tep) => tep.endsWith('.jsonl'))
    .flatMap((tep) => docJsonl<BanGhiDaCao>(path.join(thuMucCao, tep)));
  const daKiem = fs
    .readdirSync(thuMucKiem)
    .filter((tep) => tep.endsWith('.jsonl'))
    .flatMap((tep) => docJsonl<DongDaKiem>(path.join(thuMucKiem, tep)));
  const daKiemTheoRepo = new Map<string, DongDaKiem>();
  for (const dong of daKiem) {
    const khoa = dong.repo.toLowerCase();
    if (daKiemTheoRepo.has(khoa)) throw new Error(`04_da_kiem có repo trùng: ${dong.repo}.`);
    daKiemTheoRepo.set(khoa, dong);
  }
  if (!cao.length) throw new Error('Không tìm thấy bản cào README trong 01_da_cao.');
  const repoDaGap = new Set<string>();
  for (const banCao of cao) {
    const khoa = banCao.repo.toLowerCase();
    if (repoDaGap.has(khoa)) throw new Error(`01_da_cao có repo trùng: ${banCao.repo}.`);
    if (!daKiemTheoRepo.has(khoa)) throw new Error(`Thiếu ${banCao.repo} trong 04_da_kiem.`);
    repoDaGap.add(khoa);
  }
  if (daKiemTheoRepo.size !== cao.length)
    throw new Error('Số repo 01_da_cao và 04_da_kiem không khớp.');
  return cao.map((banCao) => ({
    cao: banCao,
    daKiem: daKiemTheoRepo.get(banCao.repo.toLowerCase()),
  }));
}

function taoXemTruocKiemTuoi(danhSach: TienDoKiemTuoi[]): void {
  const coId = danhSach.filter(({ cao }) => Boolean(cao.idGithub));
  console.info(`Repo: ${danhSach.length}; request tối đa dự kiến: ${coId.length * 2}.`);
  console.info('5 repo đầu:');
  for (const { cao } of danhSach.slice(0, 5)) console.info(`- ${cao.repo}`);
}

function taoYeuCauKiemTuoi(token: string) {
  return async (url: string, etag: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ForgeStore-DataRepo',
      Authorization: `Bearer ${token}`,
    };
    if (etag) headers['If-None-Match'] = etag;
    for (let lan = 0; lan < 4; lan++) {
      try {
        const response = await fetch(url, {
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        });
        const remainingHeader = response.headers.get('x-ratelimit-remaining');
        const resetHeader = response.headers.get('x-ratelimit-reset');
        const dungLuongConLai = remainingHeader === null ? null : Number(remainingHeader);
        const reset = resetHeader === null ? null : Number(resetHeader);
        const ketQua = {
          response,
          dungLuongConLai:
            dungLuongConLai !== null && Number.isFinite(dungLuongConLai) ? dungLuongConLai : null,
          thoiDiemReset: reset !== null && Number.isFinite(reset) && reset > 0 ? reset : null,
        };
        const canThuLai = [403, 429].includes(response.status) || response.status >= 500;
        if (
          !canThuLai ||
          lan === 3 ||
          (ketQua.dungLuongConLai !== null && ketQua.dungLuongConLai < 200)
        )
          return ketQua;
        await new Promise((resolve) => setTimeout(resolve, layThoiGianLui(response, lan)));
      } catch (error) {
        if (lan === 3)
          throw new Error(error instanceof Error ? error.message : 'Lỗi kết nối GitHub.');
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** lan));
      }
    }
    throw new Error('Không thể gọi GitHub sau các lần thử lại.');
  };
}

function layThoiGianLui(response: Response, lan: number): number {
  const sau = Number(response.headers.get('retry-after'));
  return Number.isFinite(sau) && sau > 0 ? sau * 1000 : 1000 * 2 ** lan;
}

function docBaoCaoKiemTuoi(file: string): Map<string, BaoCaoKiemTuoi> {
  return new Map(docJsonl<BaoCaoKiemTuoi>(file).map((dong) => [dong.repo.toLowerCase(), dong]));
}

function ghiTienDoKiemTuoi(thuMucRa: string, baoCao: Map<string, BaoCaoKiemTuoi>): void {
  const file = path.join(thuMucRa, 'bao_cao.jsonl');
  ghiTepThayThe(file, [...baoCao.values()].map((row) => JSON.stringify(row)).join('\n') + '\n');
  ghiTepThayThe(
    path.join(thuMucRa, 'tien-do.json'),
    JSON.stringify({ daHoanTat: baoCao.size, capNhatLuc: new Date().toISOString() }, null, 2),
  );
}

function ghiTepThayThe(file: string, noiDung: string): void {
  const tepTam = `${file}.tam`;
  fs.writeFileSync(tepTam, noiDung, 'utf8');
  fs.renameSync(tepTam, file);
}

function ghiReadmeKiemTuoi(thuMucRa: string, repo: string, noiDung: string): void {
  const tenTep = `${repo.replace(/[^a-zA-Z0-9._-]+/g, '__')}-${tinhMaBam(repo).slice(0, 12)}.md`;
  const thuMucReadme = path.join(thuMucRa, 'readme_moi');
  fs.mkdirSync(thuMucReadme, { recursive: true });
  fs.writeFileSync(path.join(thuMucReadme, tenTep), noiDung, 'utf8');
}

function taoTomTatKiemTuoi(baoCao: BaoCaoKiemTuoi[]): string {
  const loai = [
    'khong_doi',
    'da_xoa',
    'doi_ten',
    'luu_tru',
    'rieng_tu_hoac_bi_chan',
    'readme_doi_nhe',
    'readme_doi_nhieu',
    'loi_goi_api',
  ] as const;
  const dong = ['# Kết quả kiểm tra độ tươi', '', '| Phân loại | Số repo |', '|---|---:|'];
  for (const muc of loai)
    dong.push(`| ${muc} | ${baoCao.filter((row) => row.loai === muc).length} |`);
  dong.push('', '## Repo cần quyết định', '');
  const canXem = baoCao.filter((row) =>
    ['da_xoa', 'doi_ten', 'luu_tru', 'readme_doi_nhieu'].includes(row.loai),
  );
  for (const row of canXem)
    dong.push(`- ${row.repo}: ${row.loai}${row.tenMoi ? ` → ${row.tenMoi}` : ''}`);
  dong.push('', `Đã kiểm ${baoCao.length} repo.`, '');
  return dong.join('\n');
}

async function lenhKiemTuoi(): Promise<void> {
  const nguon = layThamSo('nguon');
  const dauRa = layThamSo('ra');
  if (!nguon || !dauRa)
    throw new Error('Dùng kiem-tuoi --nguon <Kho_Cuoi> --ra <Kiem_Tuoi_dir> [--thu] [--tiep].');
  const thuMucNguon = path.resolve(nguon);
  const thuMucRa = path.resolve(dauRa);
  const namTrongNguon = path.relative(thuMucNguon, thuMucRa);
  if (!namTrongNguon.startsWith('..') && !path.isAbsolute(namTrongNguon))
    throw new Error('Thư mục kết quả phải nằm ngoài Kho_Cuoi.');
  const danhSach = docDuLieuKiemTuoi(thuMucNguon);
  if (coCo('thu')) return taoXemTruocKiemTuoi(danhSach);
  const tiep = coCo('tiep');
  if (tiep && !fs.existsSync(thuMucRa)) throw new Error('Không có thư mục tiến độ để tiếp tục.');
  if (!tiep && fs.existsSync(thuMucRa))
    throw new Error('Thư mục kết quả đã tồn tại; dùng --tiep để tiếp tục.');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  } catch {
    /* Có thể cấu hình token qua môi trường của shell. */
  }
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('Thiếu GITHUB_TOKEN (apps/backend/.env).');
  fs.mkdirSync(thuMucRa, { recursive: true });
  const baoCao = docBaoCaoKiemTuoi(path.join(thuMucRa, 'bao_cao.jsonl'));
  const canXuLy = layChuaXuLy(
    danhSach,
    new Set(
      [...baoCao.values()]
        .filter((row) => row.loai !== 'loi_goi_api')
        .map((row) => row.repo.toLowerCase()),
    ),
  );
  console.info(`Bắt đầu kiểm ${canXuLy.length} repo còn lại, tối đa 5 request đồng thời.`);
  const ketThuc = await chayKiemTuoi(
    danhSach,
    new Set(
      [...danhSach]
        .filter(({ cao }) => !canXuLy.some((muc) => muc.cao.repo === cao.repo))
        .map(({ cao }) => cao.repo.toLowerCase()),
    ),
    {
      yeuCau: taoYeuCauKiemTuoi(token),
      taoDongMoi: (cao) => taoDongChoDich(cao).doan,
      ngu: async () => undefined,
    },
    (ketQua: KetQuaKiemMotRepo, cao) => {
      if (ketQua.baoCao) baoCao.set(cao.repo.toLowerCase(), ketQua.baoCao);
      if (ketQua.readmeMoi && ketQua.baoCao?.readmeShaMoi)
        ghiReadmeKiemTuoi(thuMucRa, cao.repo, ketQua.readmeMoi);
      ghiTienDoKiemTuoi(thuMucRa, baoCao);
    },
  );
  fs.writeFileSync(
    path.join(thuMucRa, 'TOM_TAT.md'),
    taoTomTatKiemTuoi([...baoCao.values()]),
    'utf8',
  );
  if (ketThuc.dungViHanMuc) {
    const reset = ketThuc.thoiDiemReset
      ? new Date(ketThuc.thoiDiemReset * 1000).toLocaleString('vi-VN')
      : 'chưa có thông tin';
    console.info(
      `Đã dừng vì hạn mức còn dưới 200. GitHub đặt lại lúc ${reset}; tiếp tục bằng --tiep.`,
    );
  }
  console.info(`Đã ghi ${baoCao.size}/${danhSach.length} repo vào ${thuMucRa}.`);
}

// ---------------------------------------------------------------- XEM
function lenhXem(): void {
  const lo = batBuocLo();
  const so = Number(layThamSo('so') ?? '10');
  const rows = docJsonl<DongDaKiem>(duongDan('daKiem', lo));
  const md: string[] = [`# Duyệt bản dịch lô ${lo} (${rows.length} repo)`, ''];
  for (const r of rows.slice(0, so)) {
    md.push(`## ${r.repo}`, '', `**Mô tả (Anh):** ${r.moTaEn ?? '(trống)'}`, '');
    md.push(`**Mô tả (Việt):** ${r.moTaVi ?? '(trống)'}`, '');
    const mau = r.doan.find((d) => d.goc.length > 80) ?? r.doan[0];
    if (mau) {
      md.push(
        '**Mẫu đoạn README đầu tiên (Anh | Việt):**',
        '',
        '```text',
        mau.goc.slice(0, 600),
        '```',
        '',
      );
      md.push('```text', mau.dich.slice(0, 600), '```', '');
    }
  }
  const file = duongDan('xem', lo, 'md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, md.join('\n'), 'utf8');
  console.info(`Đã ghi ${file} (${Math.min(so, rows.length)}/${rows.length} repo)`);
}

// ---------------------------------------------------------------- CÁC LỆNH CẦN NEST/DB
async function voiNest<T>(
  fn: (app: import('@nestjs/common').INestApplicationContext) => Promise<T>,
  logChiTiet = false,
) {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: logChiTiet ? ['log', 'warn', 'error'] : ['warn', 'error'],
  });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

async function lenhDoiChieu(): Promise<void> {
  const repo = layThamSo('repo');
  if (!repo) throw new Error('Thiếu --repo owner/repo');
  await voiNest(async (app) => {
    const { PrismaService } = await import('../../modules/prisma/prisma.service');
    const { GithubService } = await import('../../modules/github/github.service');
    const prisma = app.get(PrismaService);
    const github = app.get(GithubService);
    const [owner = '', ten = ''] = repo.split('/');
    const readme = (await github.layReadme(owner, ten)) ?? '';
    const doan = phanDoan(readme);
    const maBam = doan.map(tinhMaBam);
    const co = await prisma.boNhoDichChung.findMany({
      where: { maBam: { in: maBam }, ngonNgu: 'vi' },
      select: { maBam: true, doanGoc: true },
    });
    const theoMa = new Map(co.map((c) => [c.maBam, c.doanGoc]));
    const khop = doan.filter((d, i) => theoMa.get(maBam[i] ?? '') === d.trim()).length;
    const app0 = await prisma.ungDung.findFirst({
      where: { tenRepoDayDu: { equals: repo, mode: 'insensitive' } },
      select: { readmeSha: true, maBamMoTa: true, moTaGocTiengAnh: true },
    });
    const ban = await prisma.banDichReadme.findFirst({
      where: { ungDung: { tenRepoDayDu: { equals: repo, mode: 'insensitive' } }, ngonNgu: 'vi' },
      select: { readmeSha: true, trangThai: true, moHinhDich: true },
    });
    console.info(
      JSON.stringify(
        {
          repo,
          soDoan: doan.length,
          doanKhopBoNho: khop,
          readmeShaHienTai: tinhMaBam(readme),
          readmeShaTrongDb: ban?.readmeSha ?? null,
          trangThaiBanDich: ban?.trangThai ?? null,
          moHinhDich: ban?.moHinhDich ?? null,
          maBamMoTaKhop: app0?.moTaGocTiengAnh
            ? (await import('./data-repo.core')).tinhMaBamMoTa(app0.moTaGocTiengAnh) ===
              app0.maBamMoTa
            : null,
        },
        null,
        2,
      ),
    );
  });
}

/** Đọc bản dịch dạng có ký hiệu ⟦Cn⟧ của cả kho: Nhom_01..09, rồi Dot_Va, rồi Dot_Va2 ghi đè. */
function docBanDichCoKyHieu(thuMucGoc: string): Map<string, Array<string | null>> {
  const cacThuMuc = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => path.join(thuMucGoc, `Nhom_0${n}`, THU_MUC.daDich)),
    path.join(thuMucGoc, 'Dot_Va', THU_MUC.daDich),
    path.join(thuMucGoc, 'Dot_Va2', THU_MUC.daDich),
  ];
  return taoMapBanDichCoKyHieu(
    cacThuMuc.map((thuMuc) =>
      layTepLo(thuMuc, /\.jsonl$/).flatMap((tep) => docJsonl<DongDich>(path.join(thuMuc, tep))),
    ),
  );
}

type PrismaDay = import('../../modules/prisma/prisma.service').PrismaService;

/** Ghi bộ nhớ dịch chung đúng dạng backend đọc được (có ký hiệu giữ chỗ), không ghi đè mục đã có. */
async function ghiBoNhoDichChung(
  prisma: PrismaDay,
  r: DongDaKiem,
  che: Map<string, string>,
  nhan: string,
): Promise<void> {
  for (const d of r.doan) {
    const doanDich = che.get(d.maBam);
    if (!doanDich) continue;
    await prisma.boNhoDichChung.upsert({
      where: { maBam_ngonNgu: { maBam: d.maBam, ngonNgu: 'vi' } },
      create: { maBam: d.maBam, ngonNgu: 'vi', doanGoc: d.goc, doanDich, moHinhDich: nhan },
      update: {},
    });
  }
}

/** Sửa các mục đã ghi sai dạng (không có ký hiệu) do lệnh day cũ; chỉ động vào mục có nhãn antigravity. */
async function suaBoNhoDichChung(prisma: PrismaDay, che: Map<string, string>): Promise<number> {
  let soDong = 0;
  for (const [maBam, doanDich] of che) {
    const kq = await prisma.boNhoDichChung.updateMany({
      where: {
        maBam,
        ngonNgu: 'vi',
        moHinhDich: { startsWith: 'antigravity/' },
        NOT: { doanDich: { contains: '⟦C' } },
      },
      data: { doanDich },
    });
    soDong += kq.count;
  }
  return soDong;
}

async function lenhDay(): Promise<void> {
  const lo = batBuocLo();
  const ghi = coCo('ghi');
  const toiDa = Number(layThamSo('toi-da') ?? '20');
  const thuMucNguonChe = layThamSo('nguon-che');
  const suaBoNho = coCo('sua-bo-nho');
  if (ghi && !thuMucNguonChe)
    throw new Error(
      'Cần --nguon-che <Dich_Hang_Loat> để ghi bộ nhớ dịch đúng dạng có ký hiệu ⟦Cn⟧.',
    );
  const viTheoRepo = thuMucNguonChe ? docBanDichCoKyHieu(path.resolve(thuMucNguonChe)) : undefined;
  const dsCao = docJsonl<BanGhiDaCao>(duongDan('daCao', lo));
  const fileLuuTru = layThamSo('luu-tru');
  const trangThaiLuuTru = fileLuuTru
    ? taoMapTrangThaiLuuTru(
        docJsonl<{ repo: string; loai: string; archived?: boolean }>(path.resolve(fileLuuTru)),
      )
    : undefined;
  const dsKiem = docJsonl<DongDaKiem>(duongDan('daKiem', lo));
  const fileLog = duongDan('daDay', lo);
  const daDay = new Set(
    docJsonl<{ repo: string; ketQua: string }>(fileLog)
      .filter((l) => l.ketQua === 'ok')
      .map((l) => l.repo),
  );
  const chiRepo = layThamSo('repo')?.toLowerCase();
  const cho = dsKiem
    .filter(
      (r) =>
        (suaBoNho ? daDay.has(r.repo) : !daDay.has(r.repo)) &&
        (!chiRepo || r.repo.toLowerCase() === chiRepo),
    )
    .slice(0, toiDa);
  console.info(
    `${ghi ? 'GHI THẬT' : 'CHẠY THỬ (không ghi)'}: ${cho.length}/${dsKiem.length} repo, tối đa ${toiDa}`,
  );
  if (!trangThaiLuuTru) {
    console.warn('Không truyền --luu-tru <bao_cao.jsonl>; lệnh day sẽ không thay đổi cờ daLuuTru.');
  } else {
    const trongLo = cho.filter((row) => layCapNhatLuuTru(row.repo, trangThaiLuuTru).daLuuTru);
    const tongLuuTru = [...trangThaiLuuTru.values()].filter(Boolean).length;
    console.info(
      `Repo archived trong lô này sẽ gắn daLuuTru=true: ${trongLo.length}; tổng trong báo cáo: ${tongLuuTru}.`,
    );
    for (const row of trongLo) console.info(`[lưu trữ] ${row.repo}`);
  }

  await voiNest(async (app) => {
    const { PrismaService } = await import('../../modules/prisma/prisma.service');
    const { UngDungService } = await import('../../modules/ung-dung/ung-dung.service');
    const { CacheService } = await import('../../modules/redis/cache.service');
    const { tinhMaBamMoTa } = await import('./data-repo.core');
    const prisma = app.get(PrismaService);
    const apps = app.get(UngDungService);
    const cache = app.get(CacheService);
    const nhan = nhanLo(lo);

    for (const r of cho) {
      const [owner = '', ten = ''] = r.repo.split('/');
      const ghiLog = (ketQua: string, chiTiet: Record<string, unknown> = {}) =>
        ghi &&
        noiThemJsonl(fileLog, {
          repo: r.repo,
          luc: new Date().toISOString(),
          nhan,
          ketQua,
          ...chiTiet,
        });
      try {
        const caoRow = dsCao.find((c) => c.repo.toLowerCase() === r.repo.toLowerCase());
        const che =
          viTheoRepo && caoRow
            ? layBanDichCoKyHieu(caoRow, r, viTheoRepo.get(r.repo.toLowerCase()))
            : undefined;
        if ((ghi || suaBoNho) && !che)
          throw new Error('Thiếu --nguon-che hoặc 01_da_cao cho repo này, không ghi bộ nhớ dịch.');
        if (suaBoNho) {
          const soMuc = ghi ? await suaBoNhoDichChung(prisma, che!) : 0;
          console.info(
            `${ghi ? '✓' : '[thử]'} ${r.repo}: ${che!.size} đoạn có ký hiệu${ghi ? `, sửa ${soMuc} mục bộ nhớ dịch` : ''}`,
          );
          continue;
        }
        if (!ghi) {
          console.info(
            `[thử] ${r.repo}: sẽ dongBoRepo, ghi mô tả ${r.moTaVi ? 'có' : 'không'}, ${r.doan.length} đoạn vào bộ nhớ, ban_dich_readme ${r.readmeVi ? 'có' : 'không'}`,
          );
          continue;
        }
        await apps.dongBoRepo(owner, ten);
        const ud = await prisma.ungDung.findFirst({
          where: { tenRepoDayDu: { equals: r.repo, mode: 'insensitive' } },
          select: { maUngDung: true, tenRepoDayDu: true, moTaGocTiengAnh: true, moTaVi: true },
        });
        if (!ud) throw new Error('Không thấy app sau khi đồng bộ');

        const data: Record<string, unknown> = {
          etagRepo: r.etagRepo,
          etagReleases: r.etagReleases,
          etagReadme: r.etagReadme,
          ...layCapNhatLuuTru(r.repo, trangThaiLuuTru),
        };
        let moTa = 'bo_qua';
        if (
          r.moTaVi &&
          ud.moTaGocTiengAnh &&
          tinhMaBamMoTa(ud.moTaGocTiengAnh) === tinhMaBamMoTa(r.moTaEn ?? '')
        ) {
          data.moTaVi = r.moTaVi;
          data.maBamMoTa = tinhMaBamMoTa(ud.moTaGocTiengAnh);
          moTa = 'da_ghi';
        } else if (r.moTaVi) {
          moTa = 'lech_de_BE_tu_dich';
        }
        let readme = 'khong_co';
        if (r.readmeVi && r.readmeSha) {
          await ghiBoNhoDichChung(prisma, r, che!, nhan);
          await prisma.banDichReadme.upsert({
            where: { maUngDung_ngonNgu: { maUngDung: ud.maUngDung, ngonNgu: 'vi' } },
            create: {
              maUngDung: ud.maUngDung,
              ngonNgu: 'vi',
              readmeSha: r.readmeSha,
              noiDungDich: r.readmeVi,
              moHinhDich: nhan,
              trangThai: 'HOAN_TAT',
            },
            update: {
              readmeSha: r.readmeSha,
              noiDungDich: r.readmeVi,
              moHinhDich: nhan,
              trangThai: 'HOAN_TAT',
              thoiGianDich: new Date(),
            },
          });
          data.readmeSha = r.readmeSha;
          readme = 'da_ghi';
        }
        await prisma.ungDung.update({ where: { maUngDung: ud.maUngDung }, data });
        // Xóa cache đúng khóa BE đọc (chi tiết theo mã và theo tên repo, danh sách, danh mục)
        await cache.xoaTheoPrefix(`fs:apps:detail:${ud.maUngDung}`);
        await cache.xoaTheoPrefix(`fs:apps:detail:${ud.tenRepoDayDu.toLowerCase()}`);
        await cache.xoaTheoPrefix('fs:apps:list:');
        await cache.xoaTheoPrefix('fs:categories:');
        // Phân tích AI (điểm uy tín, mức an toàn, hướng dẫn CLI, vector tìm kiếm). Không dựa vào "phân tích lười" của BE.
        let phanTich = 'bo_qua';
        if (!coCo('bo-qua-phan-tich')) {
          try {
            await apps.phanTichUngDung(ud.maUngDung);
            const pt = await prisma.phanTichAI.findUnique({
              where: { maUngDung: ud.maUngDung },
              select: { maPhanTich: true },
            });
            phanTich = pt ? 'da_ghi' : 'khong_co_ket_qua';
          } catch (err) {
            phanTich = 'loi: ' + String(err).slice(0, 120);
          }
        }
        ghiLog('ok', { moTa, readme, phanTich });
        console.info(`✓ ${r.repo}: mô tả ${moTa}, README ${readme}, phân tích ${phanTich}`);
      } catch (err) {
        ghiLog('loi', { thongBao: String(err).slice(0, 300) });
        console.error(`✗ ${r.repo}: ${String(err).slice(0, 200)}`);
      }
    }
  });
}

async function lenhHoanTac(): Promise<void> {
  const lo = batBuocLo();
  const ghi = coCo('ghi');
  const nhan = nhanLo(lo);
  await voiNest(async (app) => {
    const { PrismaService } = await import('../../modules/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    const soBan = await prisma.banDichReadme.count({ where: { moHinhDich: nhan } });
    const soBoNho = await prisma.boNhoDichChung.count({ where: { moHinhDich: nhan } });
    console.info(
      `Nhãn ${nhan}: ${soBan} bản dịch README, ${soBoNho} đoạn bộ nhớ${ghi ? '' : ' (chạy thử, thêm --ghi để xóa)'}`,
    );
    if (!ghi) return;
    await prisma.banDichReadme.deleteMany({ where: { moHinhDich: nhan } });
    await prisma.boNhoDichChung.deleteMany({ where: { moHinhDich: nhan } });
    console.info(
      'Đã xóa. Mô tả tiếng Việt và app không bị xóa: dùng lô khác hoặc BE sẽ dịch lại khi cần.',
    );
  });
}

// ---------------------------------------------------------------- KHÁM PHÁ
/** Dải sao, quét từ cao xuống thấp (ưu tiên repo nhiều sao, P3B-06.1). Mỗi truy vấn Search tối đa 1.000 kết quả nên chia dải. */
const DAI_SAO = ['>=20000', '5000..19999', '2000..4999', '1000..1999'];

/** Chủ đề (topic) dùng để tìm repo ứng dụng; '' là không lọc chủ đề. */
const CHU_DE_KHAM_PHA = [
  '',
  'topic:windows',
  'topic:desktop-app',
  'topic:electron',
  'topic:tauri',
  'topic:productivity',
  'topic:cross-platform',
  'topic:gui',
  'topic:utility',
  'topic:qt',
  'topic:wpf',
  'topic:dotnet',
  'topic:flutter',
  'topic:gtk',
  'topic:cli',
  'topic:terminal',
  'topic:editor',
  'topic:media-player',
  'topic:video',
  'topic:audio',
  'topic:music',
  'topic:file-manager',
  'topic:downloader',
  'topic:backup',
  'topic:password-manager',
  'topic:security',
  'topic:vpn',
  'topic:proxy',
  'topic:network',
  'topic:screen-recorder',
  'topic:screenshot',
  'topic:ocr',
  'topic:note-taking',
  'topic:markdown',
  'topic:launcher',
  'topic:clipboard',
  'topic:emulator',
  'topic:game',
  'topic:torrent',
  'topic:ide',
  'topic:database',
  'topic:git',
  'topic:developer-tools',
  'topic:system-tools',
];

/** Lấy README thô của repo qua GitHub API (giải mã base64, giống GithubService.layReadme). */
async function layReadmeGithub(
  repo: string,
  headers: Record<string, string>,
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/readme`, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { content?: string; encoding?: string };
  return d.content && d.encoding === 'base64'
    ? Buffer.from(d.content, 'base64').toString('utf-8')
    : null;
}

/** Đọc các repo đã có trong một file danh sách (bỏ ghi chú sau dấu #). */
function docDanhSachRepo(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => /^[\w.-]+\/[\w.-]+$/.test(l));
}

async function lenhKhamPha(): Promise<void> {
  const lo = batBuocLo();
  const soCan = Number(layThamSo('so') ?? '20');
  const toiDaXet = Number(layThamSo('toi-da-xet') ?? String(soCan * 8));
  const duTruCore = Number(layThamSo('du-tru') ?? '1000');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  } catch {
    /* dùng biến môi trường sẵn có */
  }
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('Thiếu GITHUB_TOKEN (apps/backend/.env).');
  const { locCucBo, danhGiaRelease, NGUONG_LOC_MAC_DINH, coLenhCaiTuReadme } =
    await import('../../modules/ung-dung/tien-ich/bo-loc-nap-repo.util');
  type RepoUV = import('../../modules/ung-dung/tien-ich/bo-loc-nap-repo.util').RepoUngVien;

  const thuMucDs = path.join(DATA_REPO_DIR, THU_MUC.danhSach);
  const fileDs = path.join(thuMucDs, `${lo}.txt`);
  const fileBoQua = path.join(thuMucDs, `${lo}.boqua.jsonl`);
  fs.mkdirSync(thuMucDs, { recursive: true });

  // Bộ lọc 6: không trùng kho (chỉ ĐỌC DB), hàng chờ và các đợt Data_Repo khác
  const daCo = new Set<string>();
  {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      for (const r of await prisma.ungDung.findMany({ select: { tenRepoDayDu: true } }))
        daCo.add(r.tenRepoDayDu.toLowerCase());
      for (const r of await prisma.ungVienRepo.findMany({ select: { tenRepoDayDu: true } }))
        daCo.add(r.tenRepoDayDu.toLowerCase());
    } finally {
      await prisma.$disconnect();
    }
    for (const t of fs
      .readdirSync(thuMucDs)
      .filter((x) => x.endsWith('.txt') && x !== `${lo}.txt`)) {
      for (const r of docDanhSachRepo(path.join(thuMucDs, t))) daCo.add(r.toLowerCase());
    }
  }

  // Chạy tiếp được: đọc kết quả của lần chạy trước trong cùng đợt
  const daXet = new Set<string>();
  const daXetId = new Set<number>();
  const datTruoc = docDanhSachRepo(fileDs);
  // Mã số repo đã gặp trong mọi danh sách và bản cào (bắt repo đổi tên hoặc chuyển chủ)
  for (const t of fs.readdirSync(thuMucDs).filter((x) => x.endsWith('.txt'))) {
    for (const m of fs.readFileSync(path.join(thuMucDs, t), 'utf8').matchAll(/\bid=(\d+)/g)) {
      daXetId.add(Number(m[1]));
    }
  }
  for (const b of docJsonl<{ idGithub?: number }>(fileBoQua)) {
    if (b.idGithub) daXetId.add(b.idGithub);
  }
  for (const r of datTruoc) daXet.add(r.toLowerCase());
  for (const b of docJsonl<{ repo: string }>(fileBoQua)) daXet.add(b.repo.toLowerCase());
  if (!fs.existsSync(fileDs)) fs.writeFileSync(fileDs, `# Đợt ${lo}\n`, 'utf8');

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ForgeStore-DataRepo',
    Authorization: `Bearer ${token}`,
  };
  const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const now = new Date();
  const ngayPush = new Date(now.getTime() - NGUONG_LOC_MAC_DINH.maxPushThang * 30.4375 * 86400000)
    .toISOString()
    .slice(0, 10);

  let soDat = datTruoc.length;
  let soXet = 0;
  let soSearch = 0;
  const dem: Record<string, number> = {};
  const loai = (repo: string, lyDo: string, extra: Record<string, unknown> = {}) => {
    dem[lyDo] = (dem[lyDo] ?? 0) + 1;
    noiThemJsonl(fileBoQua, { repo, lyDo, ...extra });
  };
  console.info(
    `Đợt ${lo}: mục tiêu ${soCan} repo, đã có ${soDat} từ lần trước, dự trữ GitHub ${duTruCore} lượt, tối đa xét ${toiDaXet} release.`,
  );

  vongNgoai: for (const dai of DAI_SAO) {
    for (const chuDe of CHU_DE_KHAM_PHA) {
      for (let trang = 1; trang <= 10; trang++) {
        if (soDat >= soCan || soXet >= toiDaXet) break vongNgoai;
        const q = `stars:${dai} archived:false fork:false pushed:>=${ngayPush} ${chuDe}`.trim();
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${trang}`;
        await ngu(2500); // Search tối đa khoảng 24 lần mỗi phút
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
        soSearch++;
        if (!res.ok) {
          console.warn(`Search lỗi ${res.status} (${dai} ${chuDe || 'tất cả'} trang ${trang}).`);
          if (res.status === 403 || res.status === 429) await ngu(60000);
          break; // sang chủ đề tiếp theo
        }
        if (Number(res.headers.get('x-ratelimit-remaining') ?? '30') <= 1) await ngu(30000);
        const kq = (await res.json()) as { items: RepoUV[] };
        for (const it of kq.items as Array<RepoUV & { id?: number }>) {
          if (soDat >= soCan || soXet >= toiDaXet) break;
          const khoa = it.full_name.toLowerCase();
          if (daXet.has(khoa)) continue;
          daXet.add(khoa);
          if (it.id && daXetId.has(it.id)) {
            loai(it.full_name, 'TRUNG_ID_GITHUB', { idGithub: it.id });
            continue;
          }
          if (it.id) daXetId.add(it.id);
          if (daCo.has(khoa)) {
            loai(it.full_name, 'DA_CO_TRONG_KHO_HOAC_DOT_KHAC');
            continue;
          }
          const cb = locCucBo(it, now);
          if (!cb.dat) {
            loai(it.full_name, cb.lyDo ?? 'KHONG_RO', {
              sao: it.stargazers_count,
              chiTiet: cb.chiTiet,
            });
            continue;
          }
          soXet++;
          const rr = await fetch(
            `https://api.github.com/repos/${it.full_name}/releases?per_page=15`,
            { headers, signal: AbortSignal.timeout(30000) },
          );
          if (Number(rr.headers.get('x-ratelimit-remaining') ?? '5000') < duTruCore) {
            console.warn(
              `Dừng: hạn mức GitHub (core) xuống dưới ${duTruCore}. Chạy lại sau để tiếp tục.`,
            );
            break vongNgoai;
          }
          if (!rr.ok) {
            loai(it.full_name, 'LOI_KHI_SANG_LOC', { chiTiet: `HTTP ${rr.status}` });
            continue;
          }
          const dg = danhGiaRelease((await rr.json()) as never[], now);
          let chiCoLenhCai = false;
          if (
            !dg.dat &&
            (dg.lyDo === 'KHONG_CO_BAN_PHAT_HANH' || dg.lyDo === 'KHONG_CO_FILE_CAI') &&
            coLenhCaiTuReadme(await layReadmeGithub(it.full_name, headers), it.full_name)
          ) {
            chiCoLenhCai = true; // bộ lọc 10: không có tệp cài nhưng có lệnh cài trong README
          } else if (!dg.dat) {
            loai(it.full_name, dg.lyDo ?? 'KHONG_RO', {
              sao: it.stargazers_count,
              chiTiet: dg.chiTiet,
            });
            continue;
          }
          fs.appendFileSync(
            fileDs,
            `${it.full_name}  # P2 ${it.stargazers_count}★ ${it.license?.spdx_id ?? ''} ${dg.tenBanPhatHanh ?? ''}${dg.lauChuaCapNhat ? ' lau-chua-cap-nhat' : ''}${dg.chiCoApk ? ' chi-co-apk' : ''}${chiCoLenhCai ? ' chi-co-lenh-cai' : ''} chu-de=${chuDe || 'tat-ca'} dai=${dai} id=${it.id ?? ''}\n`,
            'utf8',
          );
          soDat++;
          if (soDat % 25 === 0)
            console.info(
              `... đạt ${soDat}/${soCan} (đã xét release ${soXet}, ${soSearch} lượt Search)`,
            );
        }
        if (kq.items.length < 100) break; // hết kết quả của truy vấn này
      }
    }
  }

  console.info(
    `Đạt ${soDat}/${soCan} (xét release ${soXet} trong lần chạy này, ${soSearch} lượt Search) → ${fileDs}`,
  );
  console.info(`Loại trong lần chạy này: ${JSON.stringify(dem)}`);
  if (soDat < soCan) console.info('Chưa đủ mục tiêu: chạy lại đúng lệnh này để tiếp tục.');
}

// ---------------------------------------------------------------- XÉT LẠI REPO THIẾU TỆP CÀI (bộ lọc 10)
/** Xét lại các repo đã bị loại vì thiếu tệp cài của một đợt: README có lệnh cài hợp lệ thì nhận vào đợt mới (--ra). */
async function lenhQuetLaiCli(): Promise<void> {
  const nguon = batBuocLo();
  const ra = layThamSo('ra') ?? `${nguon}b`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  } catch {
    /* dùng biến môi trường sẵn có */
  }
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('Thiếu GITHUB_TOKEN (apps/backend/.env).');
  const duTruCore = Number(layThamSo('du-tru') ?? '1000');
  const { coLenhCaiTuReadme } =
    await import('../../modules/ung-dung/tien-ich/bo-loc-nap-repo.util');
  const thuMucDs = path.join(DATA_REPO_DIR, THU_MUC.danhSach);
  const ungVien = docJsonl<{ repo: string; sao?: number; lyDo: string }>(
    path.join(thuMucDs, `${nguon}.boqua.jsonl`),
  ).filter((b) => b.lyDo === 'KHONG_CO_BAN_PHAT_HANH' || b.lyDo === 'KHONG_CO_FILE_CAI');
  const fileRa = path.join(thuMucDs, `${ra}.txt`);
  const daXet = new Set(docDanhSachRepo(fileRa).map((r) => r.toLowerCase()));
  const fileLoai = path.join(thuMucDs, `${ra}.boqua.jsonl`);
  for (const b of docJsonl<{ repo: string }>(fileLoai)) daXet.add(b.repo.toLowerCase());
  if (!fs.existsSync(fileRa))
    fs.writeFileSync(
      fileRa,
      `# Đợt ${ra}: repo thiếu tệp cài nhưng có lệnh cài trong README (từ ${nguon})\n`,
      'utf8',
    );
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ForgeStore-DataRepo',
    Authorization: `Bearer ${token}`,
  };
  let nhan = 0;
  let loai = 0;
  for (const b of ungVien.sort((x, y) => (y.sao ?? 0) - (x.sao ?? 0))) {
    if (daXet.has(b.repo.toLowerCase())) continue;
    daXet.add(b.repo.toLowerCase());
    const res = await fetch(`https://api.github.com/repos/${b.repo}/readme`, {
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (Number(res.headers.get('x-ratelimit-remaining') ?? '5000') < duTruCore) {
      console.warn(`Dừng: hạn mức GitHub xuống dưới ${duTruCore}. Chạy lại để tiếp tục.`);
      break;
    }
    let readme: string | null = null;
    if (res.ok) {
      const d = (await res.json()) as { content?: string; encoding?: string };
      readme =
        d.content && d.encoding === 'base64'
          ? Buffer.from(d.content, 'base64').toString('utf-8')
          : null;
    }
    if (coLenhCaiTuReadme(readme, b.repo)) {
      fs.appendFileSync(
        fileRa,
        `${b.repo}  # chi-co-lenh-cai ${b.sao ?? ''}★ tu=${nguon}\n`,
        'utf8',
      );
      nhan++;
    } else {
      noiThemJsonl(fileLoai, { repo: b.repo, sao: b.sao, lyDo: 'KHONG_CO_TEP_CAI_VA_LENH_CAI' });
      loai++;
    }
  }
  console.info(
    `Xét ${nhan + loai} repo thiếu tệp cài của ${nguon}: nhận ${nhan} (có lệnh cài), loại ${loai} → ${fileRa}`,
  );
}

// ---------------------------------------------------------------- CHIA ĐỢT THÀNH LÔ NHỎ
/** Cắt đợt đã cào (01_da_cao/<đợt>.jsonl) thành lô nhỏ cho Anti dịch, đồng thời xuất sẵn 02_cho_dich của từng lô. */
function lenhChia(): void {
  const dot = batBuocLo();
  const moiLo = Number(layThamSo('moi-lo') ?? '30');
  const cao = docJsonl<BanGhiDaCao>(duongDan('daCao', dot));
  if (!cao.length) throw new Error('Chưa có 01_da_cao cho đợt này. Chạy "cao" trước.');
  const soLo = Math.ceil(cao.length / moiLo);
  let tongDoan = 0;
  for (let i = 0; i < soLo; i++) {
    const tenLo = `${dot}-l${String(i + 1).padStart(3, '0')}`;
    const phan = cao.slice(i * moiLo, (i + 1) * moiLo).map((r) => ({ ...r, lo: tenLo }));
    ghiJsonl(duongDan('daCao', tenLo), phan);
    const dong = phan.map(taoDongChoDich);
    ghiJsonl(duongDan('choDich', tenLo), dong);
    tongDoan += dong.reduce((s, d) => s + d.doan.filter((x) => x.canDich).length, 0);
  }
  console.info(
    `Đã chia ${cao.length} repo thành ${soLo} lô (mỗi lô tối đa ${moiLo}): ${dot}-l001 … ${dot}-l${String(soLo).padStart(3, '0')}. Tổng ${tongDoan} đoạn cần dịch.`,
  );
  console.info(`Đưa từng file ${THU_MUC.choDich}/<lô>.jsonl cho Anti.`);
}

// ---------------------------------------------------------------- KIỂM TRÙNG
/** Báo cáo repo trùng trong mọi bản cào (không tự xóa): cùng id GitHub, cùng tên, README giống hệt. */
function lenhKiemTrung(): void {
  const thuMuc = path.join(DATA_REPO_DIR, THU_MUC.daCao);
  if (!fs.existsSync(thuMuc)) throw new Error('Chưa có 01_da_cao.');
  const files = fs
    .readdirSync(thuMuc)
    // Bỏ lô con do "chia" sinh ra (dot-01-l001) vì chúng là bản cắt của đợt
    .filter((f) => f.endsWith('.jsonl') && !/-l\d{3}\.jsonl$/.test(f));
  const rows = files.flatMap((f) =>
    docJsonl<BanGhiDaCao>(path.join(thuMuc, f)).map((r) => ({
      repo: r.repo,
      lo: f.replace('.jsonl', ''),
      idGithub: r.idGithub ?? null,
      readmeSha: r.readmeSha,
      readmeDai: r.readmeEn?.length ?? 0,
    })),
  );
  const nhom = timTrungLap(rows);
  const file = path.join(DATA_REPO_DIR, THU_MUC.danhSach, '_trung_lap.jsonl');
  ghiJsonl(file, nhom);
  const dem: Record<string, number> = {};
  for (const n of nhom) dem[n.loai] = (dem[n.loai] ?? 0) + 1;
  console.info(
    `Đã xét ${rows.length} repo trong ${files.length} bản cào. Nhóm trùng: ${nhom.length} ${JSON.stringify(dem)} → ${file}`,
  );
  for (const n of nhom.slice(0, 10)) console.info(` - ${n.loai}: ${n.repo.join('  |  ')}`);
  const thieuId = rows.filter((r) => !r.idGithub).length;
  if (thieuId)
    console.info(
      `Lưu ý: ${thieuId} repo chưa có id GitHub (bản cào cũ), chỉ kiểm được theo tên và README.`,
    );
}

async function lenhPhanTich(): Promise<void> {
  const repo = layThamSo('repo');
  if (!repo) throw new Error('Thiếu --repo owner/repo');
  await voiNest(async (app) => {
    const { PrismaService } = await import('../../modules/prisma/prisma.service');
    const { UngDungService } = await import('../../modules/ung-dung/ung-dung.service');
    const prisma = app.get(PrismaService);
    const apps = app.get(UngDungService);
    const ud = await prisma.ungDung.findFirst({
      where: { tenRepoDayDu: { equals: repo, mode: 'insensitive' } },
      select: { maUngDung: true, tenRepoDayDu: true },
    });
    if (!ud) throw new Error('Repo chưa có trong DB (chạy day trước).');
    const truoc = await prisma.phanTichAI.findUnique({
      where: { maUngDung: ud.maUngDung },
      select: { diemUyTin: true },
    });
    console.info('Trước khi chạy: phan_tich_ai', truoc ? 'đã có' : 'CHƯA có');
    try {
      await apps.phanTichUngDung(ud.maUngDung);
      console.info('phanTichUngDung kết thúc, không ném lỗi.');
    } catch (err) {
      console.error('phanTichUngDung NÉM LỖI:', err);
    }
    const sau = await prisma.phanTichAI.findUnique({
      where: { maUngDung: ud.maUngDung },
      select: { diemUyTin: true, mucDoAnToan: true, huongDanCaiDat: true },
    });
    const vec = (await prisma.$queryRawUnsafe(
      `SELECT (vector_ngu_nghia IS NOT NULL) AS co FROM phan_tich_ai WHERE ma_ung_dung = '${ud.maUngDung}'::uuid`,
    )) as Array<{ co: boolean }>;
    console.info(
      JSON.stringify({
        sau_khi_chay: sau ? 'đã có phan_tich_ai' : 'VẪN CHƯA có',
        diemUyTin: sau?.diemUyTin ?? null,
        mucDoAnToan: sau?.mucDoAnToan ?? null,
        coHuongDanCli: Boolean(sau?.huongDanCaiDat),
        coVector: vec[0]?.co ?? false,
      }),
    );
  }, true);
}

async function main(): Promise<void> {
  const lenh = process.argv[2];
  switch (lenh) {
    case 'quet-lai-cli':
      return lenhQuetLaiCli();
    case 'kiem-trung':
      return lenhKiemTrung();
    case 'chia':
      return lenhChia();
    case 'kham-pha':
      return lenhKhamPha();
    case 'cao':
      return lenhCao();
    case 'xuat':
      return lenhXuat();
    case 'nhap':
      return lenhNhap();
    case 'kiem-chat-luong':
      return lenhKiemChatLuong();
    case 'va-tach-doan':
      return lenhVaTachDoan();
    case 'va-tach-doan2':
      return lenhVaTachDoan2();
    case 'hop-nhat':
      return lenhHopNhat();
    case 'kiem-tuoi':
      return lenhKiemTuoi();
    case 'xem':
      return lenhXem();
    case 'phan-tich':
      return lenhPhanTich();
    case 'doi-chieu':
      return lenhDoiChieu();
    case 'day':
      return lenhDay();
    case 'hoan-tac':
      return lenhHoanTac();
    default:
      console.info(
        'Lệnh: cao | xuat | nhap | kiem-chat-luong | va-tach-doan | hop-nhat | kiem-tuoi | xem | doi-chieu | day | hoan-tac (xem phần đầu file này)',
      );
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 200))
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  });

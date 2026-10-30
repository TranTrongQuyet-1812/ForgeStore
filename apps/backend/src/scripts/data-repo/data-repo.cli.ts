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
 *   Danh sách dịch lại: mỗi dòng owner/repo stt_cũ (có thể là khoảng) hoặc owner/repo maBam.
 *   pnpm data-repo xem  --lo pilot-01        # 04_da_kiem → 05_xem/pilot-01.md (bảng Anh | Việt để duyệt)
 *   pnpm data-repo doi-chieu --repo o/r      # ĐỌC DB: đối chiếu mã băm đoạn với bo_nho_dich_chung của BE
 *   pnpm data-repo phan-tich --repo o/r          # chạy phân tích AI của BE cho 1 app (uy tín, an toàn, CLI, vector)
 *   pnpm data-repo day  --lo pilot-01 [--toi-da 20] [--ghi] [--bo-qua-phan-tich]  [--repo owner/repo]   # 04_da_kiem → DB (mặc định chạy thử, không ghi)
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
  coDanhSachMaBamKhac,
  docDanhSachDichLai,
  ghepBanDichCu,
  layChon,
} from './va-tach-doan.core';
import { kiemTraDongDaDich, phanDoan, taoDongChoDich, tinhMaBam } from './data-repo.core';
import type { BanGhiDaCao, DongDaKiem, DongDich } from './data-repo.types';

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
  cao: BanGhiDaCao;
  choDich: DongDich;
  daDich: DongDich;
  soDoanDungLai: number;
  soDoanCanDich: number;
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

function docMotLoCanVa(
  thuMucNguon: string,
  nhom: string,
  tenLo: string,
  danhSachDichLai: ReturnType<typeof docDanhSachDichLai>,
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
    const banChoDichCu = choDich.get(repo);
    const banDichCu = daDich.get(repo);
    if (!banChoDichCu || !banDichCu)
      throw new Error(`Thiếu dữ liệu 02/03 cho ${repo} trong ${tenLo}.`);
    const loMoi = tenLo.replace(/^dich-/, 'va-');
    const banChoDichMoi = taoDongChoDich({ ...banCao, lo: loMoi });
    if (!coDanhSachMaBamKhac(banChoDichMoi.doan, banChoDichCu.doan)) continue;
    const ketQua = ghepBanDichCu(
      banChoDichMoi.doan,
      ghepDoanCu(banChoDichCu, banDichCu),
      layChon(repo, danhSachDichLai),
    );
    canVa.push({
      nhom,
      cao: { ...banCao, lo: loMoi },
      choDich: banChoDichMoi,
      daDich: { ...banChoDichMoi, moTaVi: banDichCu.moTaVi, doan: ketQua.doan },
      soDoanDungLai: ketQua.soDoanDungLai,
      soDoanCanDich: ketQua.soDoanCanDich,
    });
  }
  return canVa;
}

function docCacRepoCanVa(
  thuMucNguon: string,
  cacNhom: number[],
  danhSachDichLai: ReturnType<typeof docDanhSachDichLai>,
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
      canVa.push(...docMotLoCanVa(thuMucNguon, nhom, tenLo, danhSachDichLai));
    }
  }
  return canVa;
}

function inTongKetVaTachDoan(cacNhom: number[], canVa: RepoCanVa[]): void {
  for (const soNhom of cacNhom) {
    const nhom = String(soNhom).padStart(2, '0');
    const repos = canVa.filter((repo) => repo.nhom === `Nhom_${nhom}`);
    const dungLai = repos.reduce((tong, repo) => tong + repo.soDoanDungLai, 0);
    const canDich = repos.reduce((tong, repo) => tong + repo.soDoanCanDich, 0);
    console.info(
      `N${nhom}: ${repos.length} repo cần vá, dùng lại ${dungLai} đoạn, cần dịch ${canDich} đoạn.`,
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
  const canVa = docCacRepoCanVa(thuMucNguon, cacNhom, danhSachDichLai);
  inTongKetVaTachDoan(cacNhom, canVa);
  if (coCo('thu')) return;
  const moiLo = Number(layThamSo('moi-lo') ?? '30');
  if (!Number.isInteger(moiLo) || moiLo < 1) throw new Error('--moi-lo phải là số nguyên dương.');
  ghiCacLoVaTachDoan(thuMucRa, canVa, moiLo);
  console.info(`Đã tạo dữ liệu vá tại ${thuMucRa}`);
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

async function lenhDay(): Promise<void> {
  const lo = batBuocLo();
  const ghi = coCo('ghi');
  const toiDa = Number(layThamSo('toi-da') ?? '20');
  const dsKiem = docJsonl<DongDaKiem>(duongDan('daKiem', lo));
  const fileLog = duongDan('daDay', lo);
  const daDay = new Set(
    docJsonl<{ repo: string; ketQua: string }>(fileLog)
      .filter((l) => l.ketQua === 'ok')
      .map((l) => l.repo),
  );
  const chiRepo = layThamSo('repo')?.toLowerCase();
  const cho = dsKiem
    .filter((r) => !daDay.has(r.repo) && (!chiRepo || r.repo.toLowerCase() === chiRepo))
    .slice(0, toiDa);
  console.info(
    `${ghi ? 'GHI THẬT' : 'CHẠY THỬ (không ghi)'}: ${cho.length}/${dsKiem.length} repo, tối đa ${toiDa}`,
  );

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
          for (const d of r.doan) {
            await prisma.boNhoDichChung.upsert({
              where: { maBam_ngonNgu: { maBam: d.maBam, ngonNgu: 'vi' } },
              create: {
                maBam: d.maBam,
                ngonNgu: 'vi',
                doanGoc: d.goc,
                doanDich: d.dich,
                moHinhDich: nhan,
              },
              update: {},
            });
          }
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
        'Lệnh: cao | xuat | nhap | kiem-chat-luong | va-tach-doan | xem | doi-chieu | day | hoan-tac (xem phần đầu file này)',
      );
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 200))
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  });

/**
 * CLI Data_Repo: chuẩn bị trước bản dịch cho kho (P3B-06/07). Chạy từ apps/backend:
 *
 *   pnpm data-repo kham-pha --lo pilot-01 [--so 20]  # Search + 11 bộ lọc → 00_danh_sach/pilot-01.txt (+ .boqua.jsonl)
 *   pnpm data-repo cao  --lo pilot-01        # 00_danh_sach/pilot-01.txt → 01_da_cao (cào GitHub, chưa đụng DB)
 *   pnpm data-repo xuat --lo pilot-01        # 01_da_cao → 02_cho_dich (che mã, chia đoạn như BE)
 *   pnpm data-repo nhap --lo pilot-01        # 03_da_dich (Anti trả) → 04_da_kiem + 04_loi
 *   pnpm data-repo xem  --lo pilot-01        # 04_da_kiem → 05_xem/pilot-01.md (bảng Anh | Việt để duyệt)
 *   pnpm data-repo doi-chieu --repo o/r      # ĐỌC DB: đối chiếu mã băm đoạn với bo_nho_dich_chung của BE
 *   pnpm data-repo day  --lo pilot-01 [--toi-da 20] [--ghi]   # 04_da_kiem → DB (mặc định chạy thử, không ghi)
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
    if (r1.conLai < 300) {
      console.warn(`Dừng: hạn mức GitHub còn ${r1.conLai} (<300). Chạy lại sau để cào tiếp.`);
      break;
    }
    if (!r1.res.ok) {
      noiThemJsonl(fileBoQua, { repo, lyDo: `repo_${r1.res.status}` });
      console.warn(`Bỏ qua ${repo}: HTTP ${r1.res.status}`);
      continue;
    }
    const info = (await r1.res.json()) as {
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
    if (kq.dat) daKiem.set(d.repo, kq.dat);
    else if (kq.loi) {
      loi.push(kq.loi);
      for (const x of kq.loi.doan) if (x.loi) demLoi[x.loi] = (demLoi[x.loi] ?? 0) + 1;
      if (kq.loi.loiMoTa) demLoi[kq.loi.loiMoTa] = (demLoi[kq.loi.loiMoTa] ?? 0) + 1;
    }
  }
  ghiJsonl(fileKiem, [...daKiem.values()]);
  ghiJsonl(duongDan('loi', lo), loi);
  console.info(`Đạt: ${daKiem.size} repo → ${fileKiem}`);
  console.info(`Lỗi: ${loi.length} repo → ${duongDan('loi', lo)} ${JSON.stringify(demLoi)}`);
  if (loi.length) {
    console.info(
      'Đưa 04_loi cho Anti dịch lại các đoạn có "loi", trả vào 03_da_dich rồi chạy "nhap" lại.',
    );
  }
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
) {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
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
  const cho = dsKiem.filter((r) => !daDay.has(r.repo)).slice(0, toiDa);
  console.info(
    `${ghi ? 'GHI THẬT' : 'CHẠY THỬ (không ghi)'}: ${cho.length}/${dsKiem.length} repo, tối đa ${toiDa}`,
  );

  await voiNest(async (app) => {
    const { PrismaService } = await import('../../modules/prisma/prisma.service');
    const { AppsService } = await import('../../modules/apps/apps.service');
    const { CacheService } = await import('../../modules/redis/cache.service');
    const { tinhMaBamMoTa } = await import('./data-repo.core');
    const prisma = app.get(PrismaService);
    const apps = app.get(AppsService);
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
        ghiLog('ok', { moTa, readme });
        console.info(`✓ ${r.repo}: mô tả ${moTa}, README ${readme}`);
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
/** Truy vấn Search theo thứ tự ưu tiên 2 (nhiều sao nhất), chia theo chủ đề để không chỉ ra repo phi ứng dụng. */
const CHU_DE_KHAM_PHA = [
  '',
  'topic:windows',
  'topic:desktop-app',
  'topic:electron',
  'topic:tauri',
  'topic:productivity',
];

async function lenhKhamPha(): Promise<void> {
  const lo = batBuocLo();
  const soCan = Number(layThamSo('so') ?? '20');
  const toiDaXet = Number(layThamSo('toi-da-xet') ?? '150');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  } catch {
    /* dùng biến môi trường sẵn có */
  }
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('Thiếu GITHUB_TOKEN (apps/backend/.env).');
  const { locCucBo, danhGiaRelease, NGUONG_LOC_MAC_DINH } =
    await import('../../modules/apps/utils/ingestion-filters.util');
  type RepoUV = import('../../modules/apps/utils/ingestion-filters.util').RepoUngVien;

  // Bộ lọc 6: không trùng kho, hàng chờ và các lô Data_Repo khác (chỉ ĐỌC DB)
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
    const thuMucDs = path.join(DATA_REPO_DIR, THU_MUC.danhSach);
    if (fs.existsSync(thuMucDs)) {
      for (const t of fs
        .readdirSync(thuMucDs)
        .filter((x) => x.endsWith('.txt') && x !== `${lo}.txt`)) {
        for (const l of fs.readFileSync(path.join(thuMucDs, t), 'utf8').split(/\r?\n/)) {
          const m = l.replace(/#.*/, '').trim();
          if (m) daCo.add(m.toLowerCase());
        }
      }
    }
  }

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

  const dat: string[] = [];
  const boQua: Array<Record<string, unknown>> = [];
  const daXet = new Set<string>();
  let soXet = 0;
  let soSearch = 0;

  vongNgoai: for (let trang = 1; trang <= 3; trang++) {
    for (const chuDe of CHU_DE_KHAM_PHA) {
      if (dat.length >= soCan || soXet >= toiDaXet) break vongNgoai;
      const q =
        `stars:>=${NGUONG_LOC_MAC_DINH.minStars} archived:false fork:false pushed:>=${ngayPush} ${chuDe}`.trim();
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=50&page=${trang}`;
      await ngu(2500); // Search tối đa khoảng 24 lần mỗi phút
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      soSearch++;
      if (!res.ok) {
        console.warn(
          `Search lỗi ${res.status} (${chuDe || 'tất cả'}, trang ${trang}), bỏ qua truy vấn này.`,
        );
        continue;
      }
      const conLaiSearch = Number(res.headers.get('x-ratelimit-remaining') ?? '30');
      if (conLaiSearch <= 1) await ngu(30000); // hết lượt Search trong phút này, đợi sang phút mới
      const kq = (await res.json()) as { items: RepoUV[] };
      for (const it of kq.items) {
        const khoa = it.full_name.toLowerCase();
        if (daXet.has(khoa)) continue;
        daXet.add(khoa);
        if (daCo.has(khoa)) {
          boQua.push({ repo: it.full_name, lyDo: 'DA_CO_TRONG_KHO_HOAC_LO_KHAC' });
          continue;
        }
        const cb = locCucBo(it, now);
        if (!cb.dat) {
          boQua.push({
            repo: it.full_name,
            sao: it.stargazers_count,
            lyDo: cb.lyDo,
            chiTiet: cb.chiTiet,
          });
          continue;
        }
        if (dat.length >= soCan || soXet >= toiDaXet) break;
        soXet++;
        const rr = await fetch(
          `https://api.github.com/repos/${it.full_name}/releases?per_page=15`,
          { headers, signal: AbortSignal.timeout(20000) },
        );
        if (!rr.ok) {
          boQua.push({
            repo: it.full_name,
            lyDo: 'LOI_KHI_SANG_LOC',
            chiTiet: `HTTP ${rr.status}`,
          });
          continue;
        }
        const conLaiCore = Number(rr.headers.get('x-ratelimit-remaining') ?? '5000');
        if (conLaiCore < 300) {
          console.warn('Dừng: hạn mức GitHub (core) còn ' + conLaiCore);
          break vongNgoai;
        }
        const dg = danhGiaRelease((await rr.json()) as never[], now);
        if (!dg.dat) {
          boQua.push({
            repo: it.full_name,
            sao: it.stargazers_count,
            lyDo: dg.lyDo,
            chiTiet: dg.chiTiet,
          });
          continue;
        }
        dat.push(
          `${it.full_name}  # P2 ${it.stargazers_count}★ ${it.license?.spdx_id ?? ''} ${dg.tenBanPhatHanh ?? ''}${dg.lauChuaCapNhat ? ' lau-chua-cap-nhat' : ''}${dg.chiCoApk ? ' chi-co-apk' : ''} chu-de=${chuDe || 'tat-ca'}`,
        );
        console.info(`✓ ${it.full_name} (${it.stargazers_count}★)`);
      }
    }
  }

  const fileDs = path.join(DATA_REPO_DIR, THU_MUC.danhSach, `${lo}.txt`);
  fs.mkdirSync(path.dirname(fileDs), { recursive: true });
  fs.writeFileSync(
    fileDs,
    `# Lô ${lo}: khám phá ${now.toISOString()}\n` + dat.join('\n') + '\n',
    'utf8',
  );
  ghiJsonl(path.join(DATA_REPO_DIR, THU_MUC.danhSach, `${lo}.boqua.jsonl`), boQua);
  const dem: Record<string, number> = {};
  for (const b of boQua) dem[String(b.lyDo)] = (dem[String(b.lyDo)] ?? 0) + 1;
  console.info(
    `Đạt ${dat.length}/${soCan} (đã xét release ${soXet}, ${soSearch} lượt Search) → ${fileDs}`,
  );
  console.info(`Loại ${boQua.length}: ${JSON.stringify(dem)}`);
}

async function main(): Promise<void> {
  const lenh = process.argv[2];
  switch (lenh) {
    case 'kham-pha':
      return lenhKhamPha();
    case 'cao':
      return lenhCao();
    case 'xuat':
      return lenhXuat();
    case 'nhap':
      return lenhNhap();
    case 'xem':
      return lenhXem();
    case 'doi-chieu':
      return lenhDoiChieu();
    case 'day':
      return lenhDay();
    case 'hoan-tac':
      return lenhHoanTac();
    default:
      console.info(
        'Lệnh: cao | xuat | nhap | xem | doi-chieu | day | hoan-tac (xem phần đầu file này)',
      );
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 200))
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  });

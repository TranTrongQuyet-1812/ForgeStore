import type { BanGhiDaCao, DongDaKiem, DongDich } from './data-repo.types';

export interface LoGocHopNhat {
  lo: string;
  cao: BanGhiDaCao[];
  daKiem: DongDaKiem[];
}

export interface LoVaHopNhat {
  lo: string;
  cao: BanGhiDaCao[];
  daKiem: DongDaKiem[];
  loi: DongDich[];
}

export interface LoCuoiHopNhat extends LoGocHopNhat {
  soRepoThayThe: number;
  danhSachThayThe: string[];
}

export interface DoiTenRepo {
  tenCu: string;
  tenMoi: string;
}

export interface KetQuaHopNhat {
  cacLo: LoCuoiHopNhat[];
  tongRepo: number;
  tongThayThe: number;
  danhSachThayThe: Array<{ repo: string; loGoc: string; loVa: string }>;
  danhSachDoiTen: DoiTenRepo[];
  danhSachLuuTru: string[];
}

/** Đọc danh sách đổi tên theo từng dòng để chủ dự án dễ rà soát. */
export function docDanhSachDoiTen(noiDung: string): DoiTenRepo[] {
  const danhSach: DoiTenRepo[] = [];
  const tenCuDaGap = new Set<string>();
  const tenMoiDaGap = new Set<string>();
  for (const [index, dong] of noiDung.split(/\r?\n/).entries()) {
    const sach = dong.trim();
    if (!sach || sach.startsWith('#')) continue;
    const [tenCu, tenMoi, ...phanDu] = sach.split(/\s+/);
    if (!tenCu || !tenMoi || phanDu.length || !laTenRepo(tenCu) || !laTenRepo(tenMoi))
      throw new Error(
        `Dòng ${index + 1} trong danh sách đổi tên phải có dạng owner/repo owner/repo.`,
      );
    const khoaCu = tenCu.toLowerCase();
    const khoaMoi = tenMoi.toLowerCase();
    if (khoaCu === khoaMoi) throw new Error(`Dòng ${index + 1} tự đổi tên cùng một repo.`);
    if (tenCuDaGap.has(khoaCu)) throw new Error(`Repo đổi tên bị lặp: ${tenCu}.`);
    if (tenMoiDaGap.has(khoaMoi)) throw new Error(`Tên repo mới bị lặp: ${tenMoi}.`);
    tenCuDaGap.add(khoaCu);
    tenMoiDaGap.add(khoaMoi);
    danhSach.push({ tenCu, tenMoi });
  }
  return danhSach;
}

function laTenRepo(repo: string): boolean {
  return /^[^/\s]+\/[^/\s]+$/.test(repo);
}

function kiemDanhSachDoiTen(cacLoGoc: LoGocHopNhat[], danhSach: DoiTenRepo[]): void {
  const repoGoc = taoMapRepoGoc(cacLoGoc);
  for (const { tenCu, tenMoi } of danhSach) {
    const khoaCu = tenCu.toLowerCase();
    const khoaMoi = tenMoi.toLowerCase();
    if (!repoGoc.has(khoaCu)) throw new Error(`Không tìm thấy repo cần đổi tên ${tenCu}.`);
    if (repoGoc.has(khoaMoi)) throw new Error(`Tên mới ${tenMoi} đã thuộc repo khác.`);
  }
}

function doiTruongDinhDanh(
  giaTri: unknown,
  khoa: string,
  doiTen: DoiTenRepo,
  trongChuSoHuu = false,
): unknown {
  const [chuCu, tenKhoCu] = doiTen.tenCu.split('/');
  const [chuMoi, tenKhoMoi] = doiTen.tenMoi.split('/');
  if (typeof giaTri === 'string') {
    const khoaDinhDanh = ['repo', 'full_name'].includes(khoa);
    if (khoaDinhDanh && giaTri.toLowerCase() === doiTen.tenCu.toLowerCase()) return doiTen.tenMoi;
    if (
      (khoa === 'owner' || (trongChuSoHuu && khoa === 'login')) &&
      giaTri.toLowerCase() === chuCu!.toLowerCase()
    )
      return chuMoi;
    if (!trongChuSoHuu && khoa === 'name' && giaTri.toLowerCase() === tenKhoCu!.toLowerCase())
      return tenKhoMoi;
    if (khoa.endsWith('url')) {
      const mauRepo = new RegExp(
        `/${thoatRegex(chuCu!)}/${thoatRegex(tenKhoCu!)}(?=[/?#]|$)`,
        'gi',
      );
      const urlDaDoiRepo = giaTri.replace(mauRepo, `/${chuMoi}/${tenKhoMoi}`);
      if (!trongChuSoHuu) return urlDaDoiRepo;
      const mauChuSoHuu = new RegExp(`/${thoatRegex(chuCu!)}(?=[/?#]|$)`, 'gi');
      return urlDaDoiRepo.replace(mauChuSoHuu, `/${chuMoi}`);
    }
    return giaTri;
  }
  if (Array.isArray(giaTri))
    return giaTri.map((item) => doiTruongDinhDanh(item, khoa, doiTen, trongChuSoHuu));
  if (!giaTri || typeof giaTri !== 'object') return giaTri;
  const laChuSoHuu = trongChuSoHuu || khoa === 'owner';
  return Object.fromEntries(
    Object.entries(giaTri).map(([khoaCon, giaTriCon]) => [
      khoaCon,
      doiTruongDinhDanh(giaTriCon, khoaCon, doiTen, laChuSoHuu),
    ]),
  );
}

function thoatRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function doiTenBanGhi<T extends { repo: string }>(dong: T, doiTen?: DoiTenRepo): T {
  if (!doiTen) return dong;
  return doiTruongDinhDanh(dong, '', doiTen) as T;
}

function taoMapRepo<T extends { repo: string }>(
  rows: T[],
  lo: string,
  nhan: string,
): Map<string, T> {
  const theoRepo = new Map<string, T>();
  for (const row of rows) {
    const khoa = row.repo.toLowerCase();
    if (theoRepo.has(khoa)) throw new Error(`${nhan} có repo trùng ${row.repo} trong ${lo}.`);
    theoRepo.set(khoa, row);
  }
  return theoRepo;
}

function kiemThuTuRepo(cao: BanGhiDaCao[], daKiem: DongDaKiem[], lo: string): void {
  const repoCao = new Set(cao.map((row) => row.repo.toLowerCase()));
  if (cao.length !== daKiem.length || daKiem.some((row) => !repoCao.has(row.repo.toLowerCase())))
    throw new Error(`Danh sách repo 01/04 không khớp trong ${lo}.`);
}

function taoMapRepoGoc(cacLo: LoGocHopNhat[]): Map<string, string> {
  const loTheoRepo = new Map<string, string>();
  for (const lo of cacLo) {
    for (const row of lo.cao) {
      const khoa = row.repo.toLowerCase();
      const loCu = loTheoRepo.get(khoa);
      if (loCu) throw new Error(`Repo ${row.repo} xuất hiện ở hai lô: ${loCu} và ${lo.lo}.`);
      loTheoRepo.set(khoa, lo.lo);
    }
  }
  return loTheoRepo;
}

function taoMapBanVa(cacLoVa: LoVaHopNhat[], loGocTheoRepo: Map<string, string>) {
  const banVaTheoRepo = new Map<string, { cao: BanGhiDaCao; daKiem: DongDaKiem; loVa: string }>();
  for (const loVa of cacLoVa) {
    if (loVa.loi.length) throw new Error(`${loVa.lo} còn ${loVa.loi.length} repo trong 04_loi.`);
    const caoTheoRepo = taoMapRepo(loVa.cao, loVa.lo, '01_da_cao');
    const daKiemTheoRepo = taoMapRepo(loVa.daKiem, loVa.lo, '04_da_kiem');
    for (const daKiem of loVa.daKiem) {
      const khoa = daKiem.repo.toLowerCase();
      const cao = caoTheoRepo.get(khoa);
      if (!cao) throw new Error(`Repo vá ${daKiem.repo} thiếu dữ liệu 01_da_cao trong ${loVa.lo}.`);
      if (!loGocTheoRepo.has(khoa))
        throw new Error(`Repo vá ${daKiem.repo} không có trong lô gốc nào.`);
      if (banVaTheoRepo.has(khoa))
        throw new Error(`Repo vá ${daKiem.repo} xuất hiện ở nhiều lô Dot_Va.`);
      banVaTheoRepo.set(khoa, { cao, daKiem, loVa: loVa.lo });
    }
    if (daKiemTheoRepo.size !== loVa.daKiem.length) throw new Error(`Repo trùng trong ${loVa.lo}.`);
  }
  return banVaTheoRepo;
}

/** Ghép theo danh sách cũ để không làm đổi thứ tự lô mà lệnh day đang dùng. */
export function hopNhatKhoCuoi(
  cacLoGoc: LoGocHopNhat[],
  cacLoVa: LoVaHopNhat[],
  soRepoMongDoi = 817,
  danhSachDoiTen: DoiTenRepo[] = [],
  danhSachLuuTru: string[] = [],
): KetQuaHopNhat {
  const loGocTheoRepo = taoMapRepoGoc(cacLoGoc);
  kiemDanhSachDoiTen(cacLoGoc, danhSachDoiTen);
  const doiTenTheoRepo = new Map(danhSachDoiTen.map((item) => [item.tenCu.toLowerCase(), item]));
  const banVaTheoRepo = taoMapBanVa(cacLoVa, loGocTheoRepo);
  const cacLo = cacLoGoc.map((loGoc) => {
    kiemThuTuRepo(loGoc.cao, loGoc.daKiem, loGoc.lo);
    const caoCu = taoMapRepo(loGoc.cao, loGoc.lo, '01_da_cao');
    const daKiemCu = taoMapRepo(loGoc.daKiem, loGoc.lo, '04_da_kiem');
    const danhSachThayThe: string[] = [];
    const cao = loGoc.cao.map((row) => {
      const thay = banVaTheoRepo.get(row.repo.toLowerCase());
      if (!thay) return doiTenBanGhi(row, doiTenTheoRepo.get(row.repo.toLowerCase()));
      danhSachThayThe.push(row.repo);
      return doiTenBanGhi(
        { ...thay.cao, lo: loGoc.lo },
        doiTenTheoRepo.get(row.repo.toLowerCase()),
      );
    });
    const daKiem = loGoc.daKiem.map((row) => {
      const thay = banVaTheoRepo.get(row.repo.toLowerCase());
      const daKiemMoi = thay ? { ...thay.daKiem, lo: loGoc.lo } : row;
      return doiTenBanGhi(daKiemMoi, doiTenTheoRepo.get(row.repo.toLowerCase()));
    });
    if (cao.length !== caoCu.size || daKiem.length !== daKiemCu.size)
      throw new Error(`Số repo đầu ra khác lô gốc ${loGoc.lo}.`);
    return { lo: loGoc.lo, cao, daKiem, soRepoThayThe: danhSachThayThe.length, danhSachThayThe };
  });
  const tongRepo = cacLo.reduce((tong, lo) => tong + lo.cao.length, 0);
  if (tongRepo !== soRepoMongDoi || loGocTheoRepo.size !== soRepoMongDoi)
    throw new Error(`Tổng repo phải là ${soRepoMongDoi}, hiện có ${tongRepo}.`);
  const repoDaRa = new Set<string>();
  for (const lo of cacLo) {
    for (const row of lo.cao) {
      const khoa = row.repo.toLowerCase();
      if (repoDaRa.has(khoa)) throw new Error(`Repo đầu ra bị trùng sau đổi tên: ${row.repo}.`);
      repoDaRa.add(khoa);
    }
  }
  const danhSachThayThe = cacLo.flatMap((lo) =>
    lo.danhSachThayThe.map((repo) => ({
      repo,
      loGoc: lo.lo,
      loVa: banVaTheoRepo.get(repo.toLowerCase())!.loVa,
    })),
  );
  return {
    cacLo,
    tongRepo,
    tongThayThe: danhSachThayThe.length,
    danhSachThayThe,
    danhSachDoiTen,
    danhSachLuuTru,
  };
}

/** Đối chiếu dữ liệu đọc lại với bản ghép để không giao kho bị ghi thiếu hoặc lệch thứ tự. */
export function kiemTraKhoDaGhi(duKien: KetQuaHopNhat, daGhi: LoGocHopNhat[]): void {
  if (duKien.cacLo.length !== daGhi.length) throw new Error('Số lô trong Kho_Cuoi không khớp.');
  for (const [index, loDuKien] of duKien.cacLo.entries()) {
    const loDaGhi = daGhi[index];
    if (
      !loDaGhi ||
      loDaGhi.lo !== loDuKien.lo ||
      JSON.stringify(loDaGhi.cao) !== JSON.stringify(loDuKien.cao) ||
      JSON.stringify(loDaGhi.daKiem) !== JSON.stringify(loDuKien.daKiem)
    )
      throw new Error(`Đối chiếu Kho_Cuoi thất bại tại ${loDuKien.lo}.`);
  }
}

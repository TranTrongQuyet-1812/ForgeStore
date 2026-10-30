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

export interface KetQuaHopNhat {
  cacLo: LoCuoiHopNhat[];
  tongRepo: number;
  tongThayThe: number;
  danhSachThayThe: Array<{ repo: string; loGoc: string; loVa: string }>;
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
): KetQuaHopNhat {
  const loGocTheoRepo = taoMapRepoGoc(cacLoGoc);
  const banVaTheoRepo = taoMapBanVa(cacLoVa, loGocTheoRepo);
  const cacLo = cacLoGoc.map((loGoc) => {
    kiemThuTuRepo(loGoc.cao, loGoc.daKiem, loGoc.lo);
    const caoCu = taoMapRepo(loGoc.cao, loGoc.lo, '01_da_cao');
    const daKiemCu = taoMapRepo(loGoc.daKiem, loGoc.lo, '04_da_kiem');
    const danhSachThayThe: string[] = [];
    const cao = loGoc.cao.map((row) => {
      const thay = banVaTheoRepo.get(row.repo.toLowerCase());
      if (!thay) return row;
      danhSachThayThe.push(row.repo);
      return { ...thay.cao, lo: loGoc.lo };
    });
    const daKiem = loGoc.daKiem.map((row) => {
      const thay = banVaTheoRepo.get(row.repo.toLowerCase());
      return thay ? { ...thay.daKiem, lo: loGoc.lo } : row;
    });
    if (cao.length !== caoCu.size || daKiem.length !== daKiemCu.size)
      throw new Error(`Số repo đầu ra khác lô gốc ${loGoc.lo}.`);
    return { lo: loGoc.lo, cao, daKiem, soRepoThayThe: danhSachThayThe.length, danhSachThayThe };
  });
  const tongRepo = cacLo.reduce((tong, lo) => tong + lo.cao.length, 0);
  if (tongRepo !== soRepoMongDoi || loGocTheoRepo.size !== soRepoMongDoi)
    throw new Error(`Tổng repo phải là ${soRepoMongDoi}, hiện có ${tongRepo}.`);
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

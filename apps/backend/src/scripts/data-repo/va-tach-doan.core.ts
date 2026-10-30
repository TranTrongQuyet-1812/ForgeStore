import type { DoanChoDich } from './data-repo.types';

export interface ChonDoanDichLai {
  sttCu: Set<number>;
  dongTheoStt: Map<number, number[]>;
  maBam: Set<string>;
}

export interface ChonDaDoiMaBam {
  maBam: Set<string>;
  lanTheoMaBam: Map<string, Set<number>>;
}

export interface DongBoQuaDichLai {
  stt: number;
  dong: number;
  lyDo: string;
}

export interface KetQuaDoiStt {
  chon: ChonDaDoiMaBam;
  boQua: DongBoQuaDichLai[];
}

export interface KetQuaGhepDoan {
  doan: DoanChoDich[];
  soDoanDungLai: number;
  soDoanCanDich: number;
  soDoanDichLai: number;
}

export type LoaiThayDoi = 'A' | 'B' | null;

export function taoChonRong(): ChonDoanDichLai {
  return { sttCu: new Set(), dongTheoStt: new Map(), maBam: new Set() };
}

export function layChon(repo: string, danhSach: Map<string, ChonDoanDichLai>): ChonDoanDichLai {
  return danhSach.get(repo.toLowerCase()) ?? taoChonRong();
}

export function phanLoaiThayDoi(doanMoi: DoanChoDich[], doanCu: DoanChoDich[]): LoaiThayDoi {
  if (coDanhSachMaBamKhac(doanMoi, doanCu)) return 'A';
  return doanMoi.some((doan, index) => doan.canDich !== doanCu[index]?.canDich) ? 'B' : null;
}

export function coDanhSachMaBamKhac(doanMoi: DoanChoDich[], doanCu: DoanChoDich[]): boolean {
  return (
    doanMoi.length !== doanCu.length ||
    doanMoi.some((doan, index) => doan.maBam !== doanCu[index]?.maBam)
  );
}

function layLanXuatHien(doanList: DoanChoDich[]): number[] {
  const dem = new Map<string, number>();
  return doanList.map((doan) => {
    const lan = dem.get(doan.maBam) ?? 0;
    dem.set(doan.maBam, lan + 1);
    return lan;
  });
}

/** Đổi STT cũ sang mã băm và lần xuất hiện để không nhầm các đoạn trùng chữ. */
export function doiSttSangMaBam(
  doanCu: DoanChoDich[],
  doanMoi: DoanChoDich[],
  chonCu: ChonDoanDichLai,
): KetQuaDoiStt {
  const lanCu = layLanXuatHien(doanCu);
  const soLanMoi = new Map<string, number>();
  for (const doan of doanMoi) soLanMoi.set(doan.maBam, (soLanMoi.get(doan.maBam) ?? 0) + 1);
  const chon: ChonDaDoiMaBam = { maBam: new Set(chonCu.maBam), lanTheoMaBam: new Map() };
  const boQua: DongBoQuaDichLai[] = [];
  for (const stt of chonCu.sttCu) {
    const index = doanCu.findIndex((doan) => doan.stt === stt);
    const dong = chonCu.dongTheoStt.get(stt)?.[0] ?? 0;
    const cu = doanCu[index];
    if (!cu) {
      boQua.push({ stt, dong, lyDo: 'không tìm thấy stt cũ' });
      continue;
    }
    if (!cu.canDich) {
      boQua.push({ stt, dong, lyDo: 'stt cũ không cần dịch' });
      continue;
    }
    const lan = lanCu[index]!;
    if (lan >= (soLanMoi.get(cu.maBam) ?? 0)) {
      boQua.push({ stt, dong, lyDo: 'đoạn không còn trong bản mới' });
      continue;
    }
    const cacLan = chon.lanTheoMaBam.get(cu.maBam) ?? new Set<number>();
    cacLan.add(lan);
    chon.lanTheoMaBam.set(cu.maBam, cacLan);
  }
  return { chon, boQua };
}

/** Ghép bản cũ theo mã băm và lần xuất hiện, đồng thời để trống phần cần dịch mới. */
export function ghepBanDichCu(
  doanMoi: DoanChoDich[],
  doanCu: DoanChoDich[],
  chon: ChonDaDoiMaBam = { maBam: new Set(), lanTheoMaBam: new Map() },
): KetQuaGhepDoan {
  const cuTheoMa = new Map<string, DoanChoDich[]>();
  for (const doan of doanCu) {
    const danhSach = cuTheoMa.get(doan.maBam) ?? [];
    danhSach.push(doan);
    cuTheoMa.set(doan.maBam, danhSach);
  }
  const demLanXuatHien = new Map<string, number>();
  let soDoanDungLai = 0;
  let soDoanCanDich = 0;
  let soDoanDichLai = 0;
  const doan = doanMoi.map((moi) => {
    const lan = demLanXuatHien.get(moi.maBam) ?? 0;
    demLanXuatHien.set(moi.maBam, lan + 1);
    const cu = cuTheoMa.get(moi.maBam)?.[lan];
    if (!moi.canDich) return moi;
    const cacLan = chon.lanTheoMaBam.get(moi.maBam);
    const canDichLai = chon.maBam.has(moi.maBam) || Boolean(cacLan?.has(lan));
    if (cu?.canDich && cu.vi?.trim() && !canDichLai) {
      soDoanDungLai++;
      return { ...moi, vi: cu.vi };
    }
    if (canDichLai) soDoanDichLai++;
    soDoanCanDich++;
    return { ...moi, vi: null };
  });
  return { doan, soDoanDungLai, soDoanCanDich, soDoanDichLai };
}

function themStt(chon: ChonDoanDichLai, bieuThuc: string, dong: number): void {
  for (const muc of bieuThuc.split(/[,/;]/)) {
    const khoang = muc.match(/^(\d+)-(\d+)$/);
    if (khoang) {
      const dau = Number(khoang[1]);
      const cuoi = Number(khoang[2]);
      if (dau < 1 || cuoi < dau) throw new Error(`Khoảng stt không hợp lệ: ${muc}`);
      for (let stt = dau; stt <= cuoi; stt++) themDongStt(chon, stt, dong);
      continue;
    }
    if (!/^\d+$/.test(muc) || Number(muc) < 1) throw new Error(`stt không hợp lệ: ${muc}`);
    themDongStt(chon, Number(muc), dong);
  }
}

function themDongStt(chon: ChonDoanDichLai, stt: number, dong: number): void {
  chon.sttCu.add(stt);
  const cacDong = chon.dongTheoStt.get(stt) ?? [];
  cacDong.push(dong);
  chon.dongTheoStt.set(stt, cacDong);
}

/** Đọc danh sách dịch lại, giữ số dòng để báo các mục không thể áp dụng. */
export function docDanhSachDichLai(noiDung: string): Map<string, ChonDoanDichLai> {
  const danhSach = new Map<string, ChonDoanDichLai>();
  for (const [index, dong] of noiDung.split(/\r?\n/).entries()) {
    const sach = dong.replace(/\s+#.*$/, '').trim();
    if (!sach || sach.startsWith('#')) continue;
    const [repo, ...phanConLai] = sach.split(/\s+/);
    const chon = phanConLai.join(' ').trim();
    if (!repo?.includes('/') || !chon)
      throw new Error(`Dòng ${index + 1} trong danh sách dịch lại sai.`);
    const khoaRepo = repo.toLowerCase();
    const muc = danhSach.get(khoaRepo) ?? taoChonRong();
    if (/^[a-f\d]{64}$/i.test(chon)) muc.maBam.add(chon.toLowerCase());
    else themStt(muc, chon, index + 1);
    danhSach.set(khoaRepo, muc);
  }
  return danhSach;
}

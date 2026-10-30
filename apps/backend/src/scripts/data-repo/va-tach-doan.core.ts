import type { DoanChoDich } from './data-repo.types';

export interface ChonDoanDichLai {
  sttCu: Set<number>;
  maBam: Set<string>;
}

export interface KetQuaGhepDoan {
  doan: DoanChoDich[];
  soDoanDungLai: number;
  soDoanCanDich: number;
}

export function layChon(repo: string, danhSach: Map<string, ChonDoanDichLai>): ChonDoanDichLai {
  return danhSach.get(repo.toLowerCase()) ?? { sttCu: new Set(), maBam: new Set() };
}

function ghepTheoMaBam(doanCu: DoanChoDich[]): Map<string, DoanChoDich[]> {
  const theoMa = new Map<string, DoanChoDich[]>();
  for (const doan of doanCu) {
    const danhSach = theoMa.get(doan.maBam) ?? [];
    danhSach.push(doan);
    theoMa.set(doan.maBam, danhSach);
  }
  return theoMa;
}

export function coDanhSachMaBamKhac(doanMoi: DoanChoDich[], doanCu: DoanChoDich[]): boolean {
  return (
    doanMoi.length !== doanCu.length ||
    doanMoi.some((doan, index) => doan.maBam !== doanCu[index]?.maBam)
  );
}

/** Ghép theo lần xuất hiện của mã băm để không nhập nhằng các đoạn trùng chữ. */
export function ghepBanDichCu(
  doanMoi: DoanChoDich[],
  doanCu: DoanChoDich[],
  chon: ChonDoanDichLai = { sttCu: new Set(), maBam: new Set() },
): KetQuaGhepDoan {
  const cuTheoMa = ghepTheoMaBam(doanCu);
  const demLanXuatHien = new Map<string, number>();
  let soDoanDungLai = 0;
  let soDoanCanDich = 0;
  const doan = doanMoi.map((moi) => {
    const lan = demLanXuatHien.get(moi.maBam) ?? 0;
    demLanXuatHien.set(moi.maBam, lan + 1);
    const cu = cuTheoMa.get(moi.maBam)?.[lan];
    if (!moi.canDich) return moi;
    const canDichLai = chon.maBam.has(moi.maBam) || Boolean(cu && chon.sttCu.has(cu.stt));
    if (cu?.canDich && cu.vi?.trim() && !canDichLai) {
      soDoanDungLai++;
      return { ...moi, vi: cu.vi };
    }
    soDoanCanDich++;
    return { ...moi, vi: null };
  });
  return { doan, soDoanDungLai, soDoanCanDich };
}

function themStt(chon: ChonDoanDichLai, bieuThuc: string): void {
  for (const muc of bieuThuc.split(/[,/;]/)) {
    const khoang = muc.match(/^(\d+)-(\d+)$/);
    if (khoang) {
      const dau = Number(khoang[1]);
      const cuoi = Number(khoang[2]);
      if (dau < 1 || cuoi < dau) throw new Error(`Khoảng stt không hợp lệ: ${muc}`);
      for (let stt = dau; stt <= cuoi; stt++) chon.sttCu.add(stt);
      continue;
    }
    if (!/^\d+$/.test(muc) || Number(muc) < 1) throw new Error(`stt không hợp lệ: ${muc}`);
    chon.sttCu.add(Number(muc));
  }
}

/** Đọc stt của bản cũ để có thể yêu cầu dịch lại dù thứ tự mới đã thay đổi. */
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
    const muc = danhSach.get(khoaRepo) ?? { sttCu: new Set<number>(), maBam: new Set<string>() };
    if (/^[a-f\d]{64}$/i.test(chon)) muc.maBam.add(chon.toLowerCase());
    else themStt(muc, chon);
    danhSach.set(khoaRepo, muc);
  }
  return danhSach;
}

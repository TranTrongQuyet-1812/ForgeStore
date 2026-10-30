import type { BanGhiDaCao, DoanChoDich, DongDaKiem, DongDich } from './data-repo.types';
import { ghepBanDichCu } from './va-tach-doan.core';

export interface DauVaoRepoVa2 {
  caoCu: BanGhiDaCao;
  daKiemCu: DongDaKiem;
  doanCuDaChe: DoanChoDich[];
  readmeMoi: string;
  shaMoi: string;
  loMoi: string;
  saoMoi?: number | null;
  idMoi?: number | null;
  taoDoan: (cao: BanGhiDaCao) => DoanChoDich[];
}

export interface KetQuaRepoVa2 {
  cao: BanGhiDaCao;
  choDich: DongDich;
  daDich: DongDich;
  soDoanDungLai: number;
  soDoanCanDich: number;
}

function taoDoanCu(
  caoCu: BanGhiDaCao,
  doanCuDaChe: DoanChoDich[],
  taoDoan: DauVaoRepoVa2['taoDoan'],
): DoanChoDich[] {
  const doanCu = taoDoan(caoCu);
  if (doanCu.length !== doanCuDaChe.length)
    throw new Error(`Số đoạn cũ không khớp trong ${caoCu.repo}.`);
  const banCuTheoMa = new Map<string, DoanChoDich[]>();
  for (const doan of doanCuDaChe) {
    const danhSach = banCuTheoMa.get(doan.maBam) ?? [];
    danhSach.push(doan);
    banCuTheoMa.set(doan.maBam, danhSach);
  }
  const demLan = new Map<string, number>();
  return doanCu.map((doan) => {
    const lan = demLan.get(doan.maBam) ?? 0;
    demLan.set(doan.maBam, lan + 1);
    const banCu = banCuTheoMa.get(doan.maBam)?.[lan];
    if (!banCu) throw new Error(`Thiếu bản dịch cũ của ${caoCu.repo}, mã ${doan.maBam}.`);
    if (doan.canDich && !banCu.vi?.trim())
      throw new Error(`Bản dịch cũ rỗng trong ${caoCu.repo}, mã ${doan.maBam}.`);
    if (doan.canDich && demToken(banCu.vi ?? '') !== demToken(doan.vanBanDaChe))
      throw new Error(
        `Số token giữ chỗ trong bản dịch cũ không khớp ${caoCu.repo}, mã ${doan.maBam}.`,
      );
    return { ...doan, vi: banCu.vi };
  });
}

function demToken(text: string): string {
  return [...(text.match(/⟦C\d+⟧/g) ?? [])].sort().join('|');
}

/** Giữ phần Anti đã dịch khi dựng lại lô; chỉ chép vào đoạn mới còn trống. */
export function ghepBanDichDaNhap(
  dongMoi: DongDich,
  dongCu: DongDich,
): { dong: DongDich; soGhep: number; sttGhep: number[] } {
  if (dongMoi.repo.toLowerCase() !== dongCu.repo.toLowerCase())
    throw new Error(`Không thể giữ bản dịch khác repo: ${dongMoi.repo} / ${dongCu.repo}.`);
  const cuTheoMa = new Map<string, DoanChoDich[]>();
  for (const doan of dongCu.doan) {
    const danhSach = cuTheoMa.get(doan.maBam) ?? [];
    danhSach.push(doan);
    cuTheoMa.set(doan.maBam, danhSach);
  }
  const lanTheoMa = new Map<string, number>();
  let soGhep = 0;
  const sttGhep: number[] = [];
  const doan = dongMoi.doan.map((moi) => {
    const lan = lanTheoMa.get(moi.maBam) ?? 0;
    lanTheoMa.set(moi.maBam, lan + 1);
    const cu = cuTheoMa.get(moi.maBam)?.[lan];
    if (!moi.canDich || moi.vi?.trim() || !cu?.canDich || !cu.vi?.trim()) return moi;
    if (demToken(moi.vanBanDaChe) !== demToken(cu.vi))
      throw new Error(`Token giữ chỗ không khớp khi khôi phục ${dongMoi.repo}, mã ${moi.maBam}.`);
    soGhep++;
    sttGhep.push(moi.stt);
    return { ...moi, vi: cu.vi };
  });
  return { dong: { ...dongMoi, doan }, soGhep, sttGhep };
}

function taoThongTinMoi(dauVao: DauVaoRepoVa2): BanGhiDaCao {
  return {
    ...dauVao.caoCu,
    caoLuc: new Date().toISOString(),
    sao: dauVao.saoMoi ?? dauVao.caoCu.sao,
    idGithub: dauVao.idMoi ?? dauVao.caoCu.idGithub ?? null,
    readmeEn: dauVao.readmeMoi,
    readmeSha: dauVao.shaMoi,
    // Kết quả kiểm tươi không lưu ETag phản hồi, nên xóa ETag cũ để tránh gắn cache sai nội dung mới.
    etagRepo: null,
    etagReadme: null,
    etagReleases: null,
    lo: dauVao.loMoi,
  };
}

export function taoRepoVa2(dauVao: DauVaoRepoVa2): KetQuaRepoVa2 {
  const cao = taoThongTinMoi(dauVao);
  const doanCu = taoDoanCu(dauVao.caoCu, dauVao.doanCuDaChe, dauVao.taoDoan);
  const doanMoi = dauVao.taoDoan(cao);
  const ghep = ghepBanDichCu(doanMoi, doanCu);
  const choDich: DongDich = {
    repo: cao.repo,
    lo: cao.lo,
    moTaEn: cao.moTaEn?.trim() ? cao.moTaEn.trim() : null,
    moTaVi: dauVao.daKiemCu.moTaVi,
    doan: ghep.doan,
  };
  return {
    cao,
    choDich,
    daDich: { ...choDich, doan: ghep.doan.map((doan) => ({ ...doan })) },
    soDoanDungLai: ghep.soDoanDungLai,
    soDoanCanDich: ghep.soDoanCanDich,
  };
}

import type { BanGhiDaCao, DoanChoDich, DongDaKiem, DongDich } from './data-repo.types';
import { ghepBanDichCu } from './va-tach-doan.core';

export interface DauVaoRepoVa2 {
  caoCu: BanGhiDaCao;
  daKiemCu: DongDaKiem;
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
  daKiemCu: DongDaKiem,
  taoDoan: DauVaoRepoVa2['taoDoan'],
): DoanChoDich[] {
  const doanCu = taoDoan(caoCu);
  const banDichTheoMa = new Map<string, string[]>();
  for (const doan of daKiemCu.doan) {
    const danhSach = banDichTheoMa.get(doan.maBam) ?? [];
    danhSach.push(doan.dich);
    banDichTheoMa.set(doan.maBam, danhSach);
  }
  const demLan = new Map<string, number>();
  return doanCu.map((doan) => {
    const lan = demLan.get(doan.maBam) ?? 0;
    demLan.set(doan.maBam, lan + 1);
    const dich = banDichTheoMa.get(doan.maBam)?.[lan];
    if (dich === undefined)
      throw new Error(`Thiếu bản dịch cũ của ${caoCu.repo}, mã ${doan.maBam}.`);
    return { ...doan, vi: dich };
  });
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
  const doanCu = taoDoanCu(dauVao.caoCu, dauVao.daKiemCu, dauVao.taoDoan);
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

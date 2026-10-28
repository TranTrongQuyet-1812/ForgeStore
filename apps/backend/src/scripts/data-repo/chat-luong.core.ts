import type { DoanChoDich, DongDich } from './data-repo.types';

export type LyDoChatLuong =
  | 'ngan_bat_thuong'
  | 'ngan_bat_thuong_nang'
  | 'ngan_bat_thuong_muc_2'
  | 'mat_cau'
  | 'nghi_dich_lech_doan'
  | 'bo_nguyen_tieng_anh'
  | 'dich_qua_dai'
  | 'dong_lap_bat_thuong';

export interface DoanNghiNgo {
  repo: string;
  lo: string;
  stt: number;
  mucQuanTrong: DoanChoDich['mucQuanTrong'];
  lyDo: LyDoChatLuong[];
  tiLe: number;
  goc: string;
  vi: string;
}

const TU_DUNG_DAU_CAU = new Set([
  'A',
  'After',
  'All',
  'Also',
  'An',
  'As',
  'Before',
  'By',
  'Click',
  'Each',
  'For',
  'From',
  'If',
  'In',
  'Install',
  'It',
  'Open',
  'Select',
  'Some',
  'The',
  'There',
  'This',
  'To',
  'Use',
  'When',
  'What',
  'Your',
]);

function lamSach(text: string): string {
  return text
    .replace(/⟦C\d+⟧/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lamSachDong(text: string): string[] {
  return text
    .replace(/⟦C\d+⟧/g, ' ')
    .split(/\r?\n/)
    .map((dong) => dong.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function chuanHoaSoSanh(text: string): string {
  return text
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function boChuoiKyThuat(text: string): string {
  return text
    .replace(/(?:https?:\/\/|www\.)\S+/giu, ' ')
    .replace(/\b0x[a-f\d]{40}\b/giu, ' ')
    .replace(/\b(?:bc1|[13])[a-z\d]{25,}\b/giu, ' ')
    .replace(/\b[a-f\d]{32,}\b/giu, ' ');
}

function demCau(text: string): number {
  const khongUrl = text.replace(/(?:https?:\/\/|www\.)\S+/giu, ' ');
  const soCau = khongUrl.match(/[.!?。！？]+(?=\s|$)/gu)?.length ?? 0;
  return text.trim() ? Math.max(1, soCau) : 0;
}

function demDongLap(text: string): number {
  const dem = new Map<string, number>();
  for (const dong of lamSachDong(text)) dem.set(dong, (dem.get(dong) ?? 0) + 1);
  return [...dem.values()].reduce((tong, so) => tong + Math.max(0, so - 1), 0);
}

function catNgan(text: string): string {
  return Array.from(text).slice(0, 200).join('');
}

function tiLeDoDai(goc: string, vi: string): number {
  return Number((vi.length / Math.max(1, goc.length)).toFixed(3));
}

function layTuKhoa(text: string): string[] {
  const mau = /\b(?:\d+(?:[.,/-]\d+)*(?:%|[A-Za-z]+)?|[A-Z][A-Za-z0-9+#._-]{2,})\b/g;
  return [...text.matchAll(mau)]
    .filter((match) => match.index !== 0 && !TU_DUNG_DAU_CAU.has(match[0]))
    .map((match) => match[0])
    .filter((tu, i, tatCa) => tatCa.findIndex((x) => x.toLowerCase() === tu.toLowerCase()) === i);
}

function coTu(text: string, tu: string): boolean {
  const tuThoat = tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${tuThoat}\\b`, 'i').test(text);
}

function doLechTiLe(so: number, mau: number): number {
  return Math.abs(Math.log(Math.max(1, so) / Math.max(1, mau)));
}

function laDoanLech(goc: string, vi: string, doan: DoanChoDich, cacDoan: DoanChoDich[]): boolean {
  if (goc.length < 40) return false;
  const tuMat = layTuKhoa(goc).filter((tu) => !coTu(vi, tu));
  const hangXom = cacDoan.filter(
    (mau) => Math.abs(mau.stt - doan.stt) <= 2 && mau.stt !== doan.stt,
  );
  const tuOHangXom = tuMat.filter((tu) =>
    hangXom.some((mau) => coTu(lamSach(mau.vanBanDaChe), tu)),
  );
  const khopDoDai = hangXom.some(
    (mau) =>
      doLechTiLe(vi.length, lamSach(mau.vanBanDaChe).length) + 0.2 <
      doLechTiLe(vi.length, goc.length),
  );
  return tuOHangXom.length >= 2 || (tuOHangXom.length > 0 && khopDoDai);
}

function themLyDo(
  lyDo: LyDoChatLuong[],
  doan: DoanChoDich,
  goc: string,
  vi: string,
  viTho: string,
  cacDoan: DoanChoDich[],
): void {
  themLyDoDoDai(lyDo, doan.mucQuanTrong, goc.length, tiLeDoDai(goc, vi));
  if (demCau(goc) > 1 && demCau(vi) * 2 < demCau(goc)) lyDo.push('mat_cau');
  if (laDoanLech(goc, vi, doan, cacDoan)) lyDo.push('nghi_dich_lech_doan');
  if (goc.length >= 40 && laBanDichGiongGoc(goc, vi)) lyDo.push('bo_nguyen_tieng_anh');
  // Tiêu đề ngắn thường dài hơn khi dịch tự nhiên, nên chỉ xét đoạn đủ dài.
  if (goc.length >= 40 && vi.length > goc.length * 2) lyDo.push('dich_qua_dai');
  if (demDongLap(viTho) > demDongLap(doan.vanBanDaChe)) lyDo.push('dong_lap_bat_thuong');
}

function themLyDoDoDai(
  lyDo: LyDoChatLuong[],
  muc: DoanChoDich['mucQuanTrong'],
  doDaiGoc: number,
  tiLe: number,
): void {
  if (doDaiGoc < 40) return;
  if (muc === 1 && tiLe < 0.5) lyDo.push('ngan_bat_thuong_nang');
  else if (muc === 1 && tiLe < 0.6) lyDo.push('ngan_bat_thuong');
  else if (muc === 2 && tiLe < 0.4) lyDo.push('ngan_bat_thuong_muc_2');
}

function laBanDichGiongGoc(goc: string, vi: string): boolean {
  const gocSoSanh = chuanHoaSoSanh(boChuoiKyThuat(goc));
  return gocSoSanh.length >= 40 && gocSoSanh === chuanHoaSoSanh(boChuoiKyThuat(vi));
}

function taoDoanNghiNgo(
  nguon: DongDich,
  doan: DoanChoDich,
  goc: string,
  vi: string,
  lyDo: LyDoChatLuong[],
): DoanNghiNgo {
  return {
    repo: nguon.repo,
    lo: nguon.lo,
    stt: doan.stt,
    mucQuanTrong: doan.mucQuanTrong,
    lyDo,
    tiLe: tiLeDoDai(goc, vi),
    goc: catNgan(goc),
    vi: catNgan(vi),
  };
}

function kiemChatLuongRepo(nguon: DongDich, dich: DongDich): DoanNghiNgo[] {
  const theoStt = new Map(dich.doan.map((doan) => [doan.stt, doan]));
  const nghiNgo: DoanNghiNgo[] = [];
  for (const doan of nguon.doan) {
    const banDich = theoStt.get(doan.stt);
    if (!doan.canDich || !banDich?.vi?.trim()) continue;
    const goc = lamSach(doan.vanBanDaChe);
    const vi = lamSach(banDich.vi);
    if (!goc || /\p{Script=Han}/u.test(goc)) continue;
    const lyDo: LyDoChatLuong[] = [];
    themLyDo(lyDo, doan, goc, vi, banDich.vi, nguon.doan);
    if (lyDo.length) nghiNgo.push(taoDoanNghiNgo(nguon, doan, goc, vi, lyDo));
  }
  return nghiNgo;
}

export function kiemChatLuongLo(choDich: DongDich[], daDich: DongDich[]): DoanNghiNgo[] {
  const theoRepo = new Map(daDich.map((dong) => [dong.repo, dong]));
  return choDich.flatMap((nguon) => {
    const dich = theoRepo.get(nguon.repo);
    return dich ? kiemChatLuongRepo(nguon, dich) : [];
  });
}

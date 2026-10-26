import { DinhDangTep } from '@prisma/client';
import { coCachCaiCliHopLe } from '@forgestore/types';
import { trichXuatHuongDanCliBangQuyTac } from '../../ai/tien-ich/cli-guide-extractor.util';
import { phanLoaiTep } from './phan-loai-tep.util';

/**
 * Bộ lọc ứng viên repo (P3B-06.3), hàm thuần dùng chung cho Data_Repo (lệnh `kham-pha`)
 * và dây chuyền nạp thật (P3B-06), để repo qua lọc ở khâu chuẩn bị cũng qua lọc khi nạp.
 * Thứ tự rẻ → đắt: bộ lọc cục bộ (không gọi API) rồi mới đến đánh giá Release.
 */

export interface NguongLoc {
  minStars: number;
  maxPushThang: number;
  maxReleaseThang: number;
  nhanLauChuaCapNhatThang: number;
}

export const NGUONG_LOC_MAC_DINH: NguongLoc = {
  minStars: 1000,
  maxPushThang: 24,
  maxReleaseThang: 36,
  nhanLauChuaCapNhatThang: 12,
};

export type LyDoLoc =
  | 'IT_SAO'
  | 'LA_FORK'
  | 'DA_LUU_TRU'
  | 'KHONG_CON_CAP_NHAT'
  | 'GIAY_PHEP_CAN_DUYET'
  | 'TRONG_DANH_SACH_CHAN'
  | 'KHONG_CO_BAN_PHAT_HANH'
  | 'KHONG_CO_FILE_CAI';

export interface RepoUngVien {
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  license: { spdx_id: string | null } | null;
  topics?: string[];
}

export interface KetQuaLoc {
  dat: boolean;
  lyDo?: LyDoLoc;
  chiTiet?: string;
}

/** Từ khóa chặn trong tên, mô tả, topic (khớp theo từ nguyên vẹn, không phân biệt hoa thường). */
export const TU_KHOA_CHAN = [
  'crack',
  'cracked',
  'keygen',
  'activator',
  'cheat',
  'cheats',
  'nulled',
  'hack tool',
];

const CHAN_REGEX = new RegExp(
  `(^|[^a-z0-9])(${TU_KHOA_CHAN.map((t) => t.replace(/ /g, '[ _-]')).join('|')})([^a-z0-9]|$)`,
  'i',
);

export function trongDanhSachChan(repo: RepoUngVien): string | null {
  if (/^awesome/i.test(repo.name)) return 'awesome-*';
  const topics = repo.topics ?? [];
  if (topics.some((t) => t === 'awesome' || t === 'awesome-list')) return 'topic awesome';
  const van = [repo.name, repo.description ?? '', ...topics].join(' ');
  const m = van.match(CHAN_REGEX);
  return m ? (m[2] ?? null) : null;
}

export function soThangTu(iso: string | null | undefined, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = now.getTime() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

/** Bộ lọc 1 đến 5 và 7 (không gọi API). Bộ lọc 6 (trùng kho) làm ở nơi có DB. */
export function locCucBo(
  repo: RepoUngVien,
  now: Date = new Date(),
  nguong: NguongLoc = NGUONG_LOC_MAC_DINH,
): KetQuaLoc {
  if (repo.stargazers_count < nguong.minStars) return { dat: false, lyDo: 'IT_SAO' };
  if (repo.fork) return { dat: false, lyDo: 'LA_FORK' };
  if (repo.archived) return { dat: false, lyDo: 'DA_LUU_TRU' };
  if (soThangTu(repo.pushed_at, now) > nguong.maxPushThang) {
    return { dat: false, lyDo: 'KHONG_CON_CAP_NHAT', chiTiet: 'push cũ' };
  }
  const spdx = repo.license?.spdx_id;
  if (!spdx || spdx === 'NOASSERTION' || spdx.toLowerCase() === 'other') {
    return { dat: false, lyDo: 'GIAY_PHEP_CAN_DUYET', chiTiet: spdx ?? 'không có' };
  }
  const chan = trongDanhSachChan(repo);
  if (chan) return { dat: false, lyDo: 'TRONG_DANH_SACH_CHAN', chiTiet: chan };
  return { dat: true };
}

export interface ReleaseUngVien {
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string | null;
  assets?: Array<{ name: string }>;
}

export interface KetQuaDanhGiaRelease extends KetQuaLoc {
  tuoiThang?: number;
  lauChuaCapNhat?: boolean;
  chiCoApk?: boolean;
  tenBanPhatHanh?: string;
}

const DINH_DANG_HOP_LE: DinhDangTep[] = [
  DinhDangTep.EXE,
  DinhDangTep.MSI,
  DinhDangTep.ZIP_PORTABLE,
  DinhDangTep.APK,
];

/** Bộ lọc 8 và 9: Release CHÍNH THỨC mới nhất (bỏ nháp và pre-release) có tệp cài hợp lệ, không quá cũ. */
export function danhGiaRelease(
  releases: Array<ReleaseUngVien & { tag_name?: string }>,
  now: Date = new Date(),
  nguong: NguongLoc = NGUONG_LOC_MAC_DINH,
): KetQuaDanhGiaRelease {
  const chinhThuc = releases
    .filter((r) => !r.draft && !r.prerelease)
    .sort(
      (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
    )[0];
  if (!chinhThuc) return { dat: false, lyDo: 'KHONG_CO_BAN_PHAT_HANH' };

  const tep = (chinhThuc.assets ?? [])
    .map((a) => phanLoaiTep(a.name))
    .filter((k) => !k.boQua && k.dinhDang !== null && DINH_DANG_HOP_LE.includes(k.dinhDang));
  if (tep.length === 0) return { dat: false, lyDo: 'KHONG_CO_FILE_CAI' };

  const tuoiThang = soThangTu(chinhThuc.published_at, now);
  if (tuoiThang > nguong.maxReleaseThang) {
    return { dat: false, lyDo: 'KHONG_CON_CAP_NHAT', chiTiet: 'release cũ', tuoiThang };
  }
  return {
    dat: true,
    tuoiThang,
    lauChuaCapNhat: tuoiThang > nguong.nhanLauChuaCapNhatThang,
    chiCoApk: tep.every((k) => k.dinhDang === DinhDangTep.APK),
    tenBanPhatHanh: chinhThuc.tag_name,
  };
}

/**
 * Bộ lọc 10 (P3B-06.3): repo không có tệp cài nhưng README có lệnh cài hợp lệ (winget, scoop, npm, pip, docker…)
 * vẫn được nhận. Dùng đúng bộ trích bằng quy tắc của BE (không AI).
 */
export function coLenhCaiTuReadme(readme: string | null | undefined, fullName: string): boolean {
  if (!readme) return false;
  return coCachCaiCliHopLe(
    trichXuatHuongDanCliBangQuyTac(readme, `https://github.com/${fullName}#readme`),
  );
}

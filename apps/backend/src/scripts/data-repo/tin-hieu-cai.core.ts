/**
 * Phân nhóm tín hiệu cài đặt của repo đã qua README/release (D-42, thử nhỏ lô mới 12/11/2026). Đo trên 191 repo đã kiểm tay:
 * nhóm MẠNH (có tệp cài .exe/.msi, hoặc cài winget/scoop/choco đúng gói repo) lọt khoảng 5%; nhóm YẾU (pip trần, npm cục bộ,
 * ZIP lẻ, Docker, skill...) lọt khoảng 20%. Nhóm yếu cần mắt người trước khi đi tiếp. Hàm thuần: không gọi mạng.
 */
import { cachCaiThuocRepo } from '../../modules/ung-dung/tien-ich/bo-loc-nap-repo.util';
import { phanLoaiTep } from '../../modules/ung-dung/tien-ich/phan-loai-tep.util';

export type NhomTinHieu = 'MANH' | 'YEU';

interface TepRelease {
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string | null;
  assets?: Array<{ name: string }>;
}

interface CachCaiTomTat {
  nhom?: string;
  tenGoi?: string;
}

/** Release chính thức mới nhất có tệp cài .exe hoặc .msi hợp lệ (không phải mã nguồn, không dành cho hệ điều hành khác). */
function coTepCaiExeMsi(releases: TepRelease[] | null | undefined): boolean {
  const chinhThuc = (releases ?? [])
    .filter((r) => !r.draft && !r.prerelease)
    .sort(
      (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
    )[0];
  return (chinhThuc?.assets ?? []).some((a) => {
    const k = phanLoaiTep(a.name);
    return !k.boQua && (k.dinhDang === 'EXE' || k.dinhDang === 'MSI');
  });
}

/** Cài bằng winget/scoop/choco và gói đó đúng là gói của chính repo (Luật 4). */
function coGoiUngDungDungRepo(
  fullName: string,
  cachCai: CachCaiTomTat[] | null | undefined,
): boolean {
  const ds = cachCai ?? [];
  const goiUngDung = ds.filter((c) => ['WINGET', 'SCOOP', 'CHOCO'].includes(c.nhom ?? ''));
  return goiUngDung.length > 0 && cachCaiThuocRepo(fullName, goiUngDung);
}

export function nhomTinHieuCai(
  fullName: string,
  releases: TepRelease[] | null | undefined,
  cachCai: CachCaiTomTat[] | null | undefined,
): NhomTinHieu {
  return coTepCaiExeMsi(releases) || coGoiUngDungDungRepo(fullName, cachCai) ? 'MANH' : 'YEU';
}

export interface UngVienKiemTay {
  repo: string;
  sao: number;
  hang: number;
  nhom: string[];
}

/** Bản tóm tắt ngắn của một repo để người kiểm tay đọc: tệp release, lệnh cài hệ thống bắt được, mấy dòng đầu README. */
export function taoTomTatKiemTay(
  uv: UngVienKiemTay,
  readme: string | null | undefined,
  releases: TepRelease[] | null | undefined,
  cachCai: Array<{ nhom?: string; buoc?: Array<{ lenh: string }> }> | null | undefined,
  moTa?: string | null,
): string {
  const chinhThuc = (releases ?? [])
    .filter((r) => !r.draft && !r.prerelease)
    .sort(
      (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
    )[0];
  const tep =
    (chinhThuc?.assets ?? [])
      .map((a) => a.name)
      .slice(0, 4)
      .join(', ') || '-';
  const lenh =
    (cachCai ?? [])
      .slice(0, 2)
      .map((c) => `${c.nhom}:${(c.buoc?.[0]?.lenh ?? '').replace(/\s+/g, ' ').slice(0, 40)}`)
      .join(' | ') || '-';
  const dau = (readme ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)|<[^>]*>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 130);
  const nhom = uv.nhom.length ? uv.nhom.join('+') : 'THUONG';
  return `H${uv.hang} ${uv.repo} (${uv.sao}) [${nhom}]\n   TEP: ${tep.slice(0, 80)} | LENH: ${lenh}\n   ${moTa ? `(GH) ${moTa.slice(0, 70)} // ` : ''}${dau}`;
}

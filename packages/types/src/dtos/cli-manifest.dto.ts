/**
 * Khuôn Khai Báo Trình Quản Lý Gói (Package Manager Manifest Framework)
 * Đặc tả P3B-16 & Quyết định D-23 (05/10/2026).
 *
 * Hỗ trợ các ứng dụng cài bằng dòng lệnh (winget, scoop, npm, pip, docker)
 * đi qua cùng luồng với bộ cài: vào Storefront, lưu Thư viện, theo dõi cập nhật, gỡ.
 * Đảm bảo 100% an toàn: Tuyệt đối không tự chạy lệnh, chống command injection tên gói.
 */

export const MaTrinhQuanLyGoi = {
  WINGET: 'winget',
  SCOOP: 'scoop',
  NPM: 'npm',
  PIP: 'pip',
  DOCKER: 'docker',
} as const;

export type MaTrinhQuanLyGoi = (typeof MaTrinhQuanLyGoi)[keyof typeof MaTrinhQuanLyGoi];

export const KieuSoPhienBan = {
  SEMVER: 'semver',
  CALVER: 'calver',
  CUSTOM: 'custom',
} as const;

export type KieuSoPhienBan = (typeof KieuSoPhienBan)[keyof typeof KieuSoPhienBan];

export const TrangThaiXacNhanCli = {
  CHO_XAC_NHAN: 'CHO_XAC_NHAN',
  DA_XAC_NHAN: 'DA_XAC_NHAN',
} as const;

export type TrangThaiXacNhanCli = (typeof TrangThaiXacNhanCli)[keyof typeof TrangThaiXacNhanCli];

/**
 * Bản khai báo cấu hình của một trình quản lý gói.
 * Thêm một trình mới = thêm một bản khai báo + test, không đụng phần còn lại (P3B-16.1).
 */
export interface KhaiBaoTrinhQuanLyGoi {
  ma: MaTrinhQuanLyGoi;
  tenHienThi: string;
  bieuTuong: string;
  mauLenhCai: string; // VD: "winget install --id {tenGoi} -e"
  mauLenhCapNhat: string; // VD: "winget upgrade --id {tenGoi}"
  mauLenhGo: string; // VD: "winget uninstall --id {tenGoi}"
  regexTenGoi: string; // Regex chuỗi kiểm tra tên gói hợp lệ
  regexPhienBan?: string; // Regex chuỗi kiểm tra phiên bản (nếu có)
  kieuSoPhienBan: KieuSoPhienBan;
}

/**
 * Danh sách ban đầu 5 trình quản lý gói được hỗ trợ chính thức (P3B-16.1).
 */
export const DANH_SACH_TRINH_QUAN_LY_GOI: Record<MaTrinhQuanLyGoi, KhaiBaoTrinhQuanLyGoi> = {
  [MaTrinhQuanLyGoi.WINGET]: {
    ma: MaTrinhQuanLyGoi.WINGET,
    tenHienThi: 'Windows Package Manager (winget)',
    bieuTuong: 'Terminal',
    mauLenhCai: 'winget install --id {tenGoi} -e',
    mauLenhCapNhat: 'winget upgrade --id {tenGoi}',
    mauLenhGo: 'winget uninstall --id {tenGoi}',
    // Winget Package ID: chữ cái, số, dấu chấm, gạch dưới, gạch ngang (VD: Microsoft.PowerToys, Fastfetch-cli.Fastfetch)
    regexTenGoi: '^[A-Za-z0-9][A-Za-z0-9._-]{1,128}$',
    regexPhienBan: '^[0-9]+(?:\\.[0-9a-zA-Z._-]+)*$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
  [MaTrinhQuanLyGoi.SCOOP]: {
    ma: MaTrinhQuanLyGoi.SCOOP,
    tenHienThi: 'Scoop',
    bieuTuong: 'Terminal',
    mauLenhCai: 'scoop install {tenGoi}',
    mauLenhCapNhat: 'scoop update {tenGoi}',
    mauLenhGo: 'scoop uninstall {tenGoi}',
    // Scoop: cho phép tên gói đơn lẻ hoặc kèm bucket prefix (VD: extras/googlechrome, git, neovim)
    regexTenGoi: '^(?:[a-zA-Z0-9][a-zA-Z0-9_-]*\\/)?[a-zA-Z0-9][a-zA-Z0-9._-]{0,64}$',
    regexPhienBan: '^[0-9]+(?:\\.[0-9a-zA-Z._-]+)*$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
  [MaTrinhQuanLyGoi.NPM]: {
    ma: MaTrinhQuanLyGoi.NPM,
    tenHienThi: 'Node Package Manager (npm)',
    bieuTuong: 'Terminal',
    mauLenhCai: 'npm install -g {tenGoi}',
    mauLenhCapNhat: 'npm update -g {tenGoi}',
    mauLenhGo: 'npm uninstall -g {tenGoi}',
    // npm package: tên thường hoặc scoped package, bắt buộc bắt đầu bằng chữ/số (VD: @angular/cli, pnpm, serve)
    regexTenGoi: '^(?:@[a-z0-9][a-z0-9_.-]*\\/)?[a-z0-9][a-z0-9_.-]{0,213}$',
    regexPhienBan: '^[0-9]+(?:\\.[0-9a-zA-Z._-]+)*$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
  [MaTrinhQuanLyGoi.PIP]: {
    ma: MaTrinhQuanLyGoi.PIP,
    tenHienThi: 'Python Package Index (pip)',
    bieuTuong: 'Terminal',
    mauLenhCai: 'pip install {tenGoi}',
    mauLenhCapNhat: 'pip install --upgrade {tenGoi}',
    mauLenhGo: 'pip uninstall -y {tenGoi}',
    // Python PEP 508 package name (VD: open-webui, yt-dlp, black, torch)
    regexTenGoi: '^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$',
    regexPhienBan: '^[0-9]+(?:\\.[0-9a-zA-Z._-]+)*$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
  [MaTrinhQuanLyGoi.DOCKER]: {
    ma: MaTrinhQuanLyGoi.DOCKER,
    tenHienThi: 'Docker Container Image',
    bieuTuong: 'Container',
    mauLenhCai: 'docker run -d --name {tenGoi} {tenGoi}',
    mauLenhCapNhat: 'docker pull {tenGoi}',
    mauLenhGo: 'docker rm -f {tenGoi}',
    // Docker Image Tag (VD: ghcr.io/open-webui/open-webui:main, nginx:latest, postgres:16-alpine)
    regexTenGoi:
      '^(?:(?:[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\\:[0-9]+)?\\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*\\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_.-]+)?$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
};

/**
 * Danh sách ký tự nguy hiểm tuyệt đối không được phép xuất hiện trong tên gói hoặc phiên bản
 * Chống Command Injection triệt để (P3B-16.2).
 */
export const KY_TU_DOC_HAI_REGEX = /[;&|`$<>\\!'"\n\r\t\0]/;

/**
 * Kiểm tra xem một chuỗi có chứa ký tự nguy hiểm tiềm ẩn command injection hay không.
 */
export function laKyTuDocHai(val: string): boolean {
  if (!val || typeof val !== 'string') return true;
  // Cấm bắt đầu bằng dấu gạch ngang '-' để chống Flag / Option Injection (CWE-88)
  if (val.startsWith('-')) return true;
  if (KY_TU_DOC_HAI_REGEX.test(val)) return true;
  // Cấm các cú pháp shell expansion: $(...), ${...}, `...`, &&, ||, v.v.
  if (/\$\(/.test(val) || /\$\{/.test(val)) return true;
  // Cấm khoảng trắng bất thường (tên gói chuẩn không bao giờ có space)
  if (/\s/.test(val)) return true;
  return false;
}

/**
 * Kiểm tra tính hợp lệ của tên gói theo manifest tương ứng.
 */
export function kiemTraTenGoiHopLe(trinhQuanLy: MaTrinhQuanLyGoi, tenGoi: string): boolean {
  if (!tenGoi || typeof tenGoi !== 'string') return false;
  const trimmed = tenGoi.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return false;

  // 1. Chống ký tự độc hại
  if (laKyTuDocHai(trimmed)) return false;

  // 2. Đối chiếu Whitelist Regex của trình quản lý gói
  const manifest = DANH_SACH_TRINH_QUAN_LY_GOI[trinhQuanLy];
  if (!manifest) return false;

  try {
    const reg = new RegExp(manifest.regexTenGoi);
    return reg.test(trimmed);
  } catch {
    return false;
  }
}

/**
 * Kiểm tra tính hợp lệ của phiên bản (nếu có).
 */
export function kiemTraPhienBanHopLe(
  trinhQuanLy: MaTrinhQuanLyGoi,
  phienBan?: string | null,
): boolean {
  if (!phienBan) return true; // Cho phép rỗng
  const trimmed = phienBan.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > 64) return false;

  if (laKyTuDocHai(trimmed)) return false;

  const manifest = DANH_SACH_TRINH_QUAN_LY_GOI[trinhQuanLy];
  if (!manifest || !manifest.regexPhienBan) {
    // Nếu không có regex riêng, kiểm tra theo định dạng an toàn chung (chữ số, dấu chấm, gạch ngang)
    return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed);
  }

  try {
    const reg = new RegExp(manifest.regexPhienBan);
    return reg.test(trimmed);
  } catch {
    return false;
  }
}

export interface KetQuaGhepLenhCli {
  hopLe: boolean;
  lyDoKhongHopLe?: string;
  lenhCai?: string;
  lenhCapNhat?: string;
  lenhGo?: string;
  trinhQuanLy?: MaTrinhQuanLyGoi;
  tenGoi?: string;
  phienBan?: string;
}

/**
 * Ghép câu lệnh cài đặt / cập nhật / gỡ an toàn từ manifest (P3B-16.2).
 * Nếu tên gói hoặc phiên bản không hợp lệ => TỪ CHỐI 100%, KHÔNG SINH LỆNH.
 */
export function ghepLenhCliAnToan(
  trinhQuanLy: MaTrinhQuanLyGoi,
  tenGoi: string,
  phienBan?: string,
): KetQuaGhepLenhCli {
  const manifest = DANH_SACH_TRINH_QUAN_LY_GOI[trinhQuanLy];
  if (!manifest) {
    return {
      hopLe: false,
      lyDoKhongHopLe: `Trình quản lý gói [${trinhQuanLy}] không nằm trong danh sách hỗ trợ.`,
    };
  }

  const cleanTenGoi = tenGoi?.trim();
  if (!cleanTenGoi || !kiemTraTenGoiHopLe(trinhQuanLy, cleanTenGoi)) {
    return {
      hopLe: false,
      lyDoKhongHopLe: `Tên gói [${tenGoi}] không hợp lệ hoặc chứa ký tự bị cấm. Từ chối ghép lệnh.`,
    };
  }

  const cleanPhienBan = phienBan?.trim();
  if (cleanPhienBan && !kiemTraPhienBanHopLe(trinhQuanLy, cleanPhienBan)) {
    return {
      hopLe: false,
      lyDoKhongHopLe: `Phiên bản [${phienBan}] không hợp lệ hoặc chứa ký tự bị cấm. Từ chối ghép lệnh.`,
    };
  }

  // Ghép lệnh an toàn (dùng replaceAll để thay thế toàn bộ placeholder {tenGoi} và {phienBan})
  const lenhCai = manifest.mauLenhCai
    .replaceAll('{tenGoi}', cleanTenGoi)
    .replaceAll('{phienBan}', cleanPhienBan || '');
  const lenhCapNhat = manifest.mauLenhCapNhat
    .replaceAll('{tenGoi}', cleanTenGoi)
    .replaceAll('{phienBan}', cleanPhienBan || '');
  const lenhGo = manifest.mauLenhGo
    .replaceAll('{tenGoi}', cleanTenGoi)
    .replaceAll('{phienBan}', cleanPhienBan || '');

  return {
    hopLe: true,
    lenhCai,
    lenhCapNhat,
    lenhGo,
    trinhQuanLy,
    tenGoi: cleanTenGoi,
    phienBan: cleanPhienBan,
  };
}

/**
 * Bóc tách tên gói từ một dòng lệnh thô trích xuất từ README.
 * Ví dụ:
 *  - "winget install --id Microsoft.PowerToys -e" -> { trinhQuanLy: 'winget', tenGoi: 'Microsoft.PowerToys' }
 *  - "scoop install extras/googlechrome" -> { trinhQuanLy: 'scoop', tenGoi: 'extras/googlechrome' }
 *  - "npm install -g @angular/cli" -> { trinhQuanLy: 'npm', tenGoi: '@angular/cli' }
 *  - "pip install open-webui" -> { trinhQuanLy: 'pip', tenGoi: 'open-webui' }
 */
export function trichTenGoiTuLenhTho(
  lenhTho: string,
): { trinhQuanLy: MaTrinhQuanLyGoi; tenGoi: string; phienBan?: string } | null {
  if (!lenhTho || typeof lenhTho !== 'string') return null;

  // Chốt chặn 1: Nếu toàn bộ dòng lệnh thô chứa bất kỳ ký tự shell injection nào => TỪ CHỐI 100%
  if (KY_TU_DOC_HAI_REGEX.test(lenhTho)) return null;
  if (/\$\(/.test(lenhTho) || /\$\{/.test(lenhTho)) return null;

  const l = lenhTho.trim().replace(/^[$#>]\s*/, '');

  // 1. WINGET
  // Mẫu: winget install (--id | -e)? <id>
  if (/^winget\s+install\b/i.test(l)) {
    const tokens = l.split(/\s+/);
    const installIdx = tokens.findIndex((t) => /^install$/i.test(t));
    if (installIdx !== -1) {
      const sauInstall = tokens.slice(installIdx + 1);
      // Ưu tiên cờ --id <tên_gói>
      const idFlagIdx = sauInstall.findIndex((t) => /^--id$/i.test(t));
      const idCandidate = idFlagIdx !== -1 ? sauInstall[idFlagIdx + 1] : undefined;
      if (idCandidate && !idCandidate.startsWith('-')) {
        if (kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.WINGET, idCandidate)) {
          return { trinhQuanLy: MaTrinhQuanLyGoi.WINGET, tenGoi: idCandidate };
        }
      }
      // Nếu không dùng --id, tìm tham số đầu tiên không phải cờ
      const pkgToken = sauInstall.find((t) => !t.startsWith('-'));
      if (pkgToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.WINGET, pkgToken)) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.WINGET, tenGoi: pkgToken };
      }
    }
  }

  // 2. SCOOP
  // Mẫu: scoop install <pkg>
  if (/^scoop\s+install\b/i.test(l)) {
    const tokens = l.split(/\s+/);
    const installIdx = tokens.findIndex((t) => /^install$/i.test(t));
    if (installIdx !== -1) {
      const sauInstall = tokens.slice(installIdx + 1);
      const pkgToken = sauInstall.find((t) => !t.startsWith('-'));
      if (pkgToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.SCOOP, pkgToken)) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.SCOOP, tenGoi: pkgToken };
      }
    }
  }

  // 3. NPM
  // Mẫu: npm (install|i) -g <pkg> hoặc pnpm add -g <pkg> hoặc yarn global add <pkg>
  if (/^(?:npm\s+(?:install|i)|pnpm\s+add|yarn\s+(?:global\s+add|add))\b/i.test(l)) {
    const tokens = l.split(/\s+/);
    const actionIdx = tokens.findIndex((t) => /^(?:install|i|add)$/i.test(t));
    if (actionIdx !== -1) {
      const sauAction = tokens.slice(actionIdx + 1);
      const pkgToken = sauAction.find((t) => !t.startsWith('-'));
      if (pkgToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.NPM, pkgToken)) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.NPM, tenGoi: pkgToken };
      }
    }
  }

  // 4. PIP
  // Mẫu: (pip|pip3|python -m pip) install <pkg>
  if (/^(?:pip|pip3|python\d*\s+-m\s+pip)\s+install\b/i.test(l)) {
    const tokens = l.split(/\s+/);
    const installIdx = tokens.findIndex((t) => /^install$/i.test(t));
    if (installIdx !== -1) {
      const sauInstall = tokens.slice(installIdx + 1);
      const pkgToken = sauInstall.find((t) => !t.startsWith('-'));
      if (pkgToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, pkgToken)) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.PIP, tenGoi: pkgToken };
      }
    }
  }

  // 5. DOCKER
  // Mẫu: docker pull <image> hoặc docker run ... <image>
  if (/^docker\s+(?:pull|run)\b/i.test(l)) {
    const tokens = l.split(/\s+/);
    const nonFlags = tokens.slice(2).filter((t) => !t.startsWith('-'));
    const imageToken = nonFlags[nonFlags.length - 1];
    if (imageToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.DOCKER, imageToken)) {
      return { trinhQuanLy: MaTrinhQuanLyGoi.DOCKER, tenGoi: imageToken };
    }
  }

  return null;
}

/**
 * DTO dữ liệu theo dõi cài đặt qua CLI trong Thư viện máy (P3B-16.5, P3B-16.6).
 */
export interface ThongTinCaiDatCliDto {
  maBanGhi?: string;
  maUngDung: string;
  trinhQuanLy: MaTrinhQuanLyGoi;
  tenGoi: string;
  phienBan?: string;
  lenhGo: string;
  lenhCapNhat?: string;
  trangThaiXacNhan: TrangThaiXacNhanCli;
  thoiGianHetHan?: string; // ISO 8601 string (+24h nếu là CHO_XAC_NHAN)
  ngayCaiDat: string;
}

/**
 * Yêu cầu gửi từ Desktop khi người dùng bấm "Tôi đã cài" (P3B-16.5).
 */
export interface GhiNhanCaiDatCliDto {
  maUngDung: string;
  trinhQuanLy: MaTrinhQuanLyGoi;
  tenGoi: string;
  phienBan?: string;
}

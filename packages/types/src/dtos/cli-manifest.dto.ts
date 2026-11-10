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
  NPX: 'npx',
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
    // Tên gói Python theo chuẩn PEP 508 (VD: open-webui, yt-dlp, black, torch)
    regexTenGoi: '^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$',
    regexPhienBan: '^[0-9]+(?:\\.[0-9a-zA-Z._-]+)*$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
  [MaTrinhQuanLyGoi.DOCKER]: {
    ma: MaTrinhQuanLyGoi.DOCKER,
    tenHienThi: 'Docker Container Image',
    bieuTuong: 'Container',
    mauLenhCai: 'docker run -d --name {tenContainer} {tenGoi}',
    mauLenhCapNhat: 'docker pull {tenGoi}',
    mauLenhGo: 'docker rm -f {tenContainer}',
    // Thẻ định danh ảnh Docker (Docker Image Tag - VD: ghcr.io/open-webui/open-webui:main, nginx:latest, postgres:16-alpine)
    regexTenGoi:
      '^(?:(?:[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\\:[0-9]+)?\\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*\\/)?[a-zA-Z0-9][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_.-]+)?$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
  [MaTrinhQuanLyGoi.NPX]: {
    ma: MaTrinhQuanLyGoi.NPX,
    tenHienThi: 'Node Package Execute (npx)',
    bieuTuong: 'Terminal',
    // npx chỉ chạy gói rồi thôi, không có khái niệm cập nhật hay gỡ chung. Để rỗng để không bao giờ hiện
    // `npx <tên-gói>` như một lệnh cập nhật (đó là lệnh CHẠY gói, không phải cập nhật). Người dùng chép lệnh gốc từ README.
    mauLenhCai: '',
    mauLenhCapNhat: '',
    mauLenhGo: '',
    // Hỗ trợ cả tên gói npm đơn lẻ, scoped package hoặc repo slug của nhóm skill (D-38)
    regexTenGoi: '^(?:@[a-z0-9][a-z0-9_.-]*\\/)?[A-Za-z0-9][A-Za-z0-9_.-]*(?:\\/[A-Za-z0-9_.-]+)?$',
    kieuSoPhienBan: KieuSoPhienBan.SEMVER,
  },
};

/**
 * Tạo tên container Docker an toàn và hợp lệ từ tên Image (P3B-16.2).
 * Docker cấm ký tự '/' và ':' trong tên container (--name).
 * Ví dụ:
 *  - "ghcr.io/open-webui/open-webui:main" -> "open-webui"
 *  - "ghcr.io/foo/bar:latest" -> "bar"
 *  - "nginx:alpine" -> "nginx"
 */
export function taoTenContainerTuImage(image: string): string {
  if (!image || typeof image !== 'string') return 'app';
  // 1. Lấy phần cuối cùng sau dấu '/' (bỏ registry domain & repo namespace)
  const phanCuoi = image.split('/').pop() || image;
  // 2. Loại bỏ tag (:tag) hoặc digest (@sha256:...)
  const tenGoc = phanCuoi.split(':')[0]?.split('@')[0] || phanCuoi;
  // 3. Làm sạch ký tự không hợp lệ cho Docker container name [a-zA-Z0-9_.-]
  const lamSach = tenGoc.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^[^a-zA-Z0-9]+/, '');
  return lamSach.length > 0 ? lamSach : 'app';
}

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

  // 2. Quy tắc riêng từng trình quản lý gói
  if (trinhQuanLy === MaTrinhQuanLyGoi.PIP) {
    // Tên gói Python trên PyPI không bao giờ là tệp mở rộng (.txt, .py, .whl, .tar.gz, etc.)
    if (/\.(?:txt|py|whl|tar\.gz|zip|toml|cfg|md|json)$/i.test(trimmed)) return false;
    // Không phải đường dẫn tương đối/tuyệt đối
    if (
      trimmed === '.' ||
      trimmed.startsWith('./') ||
      trimmed.includes('/') ||
      trimmed.includes('\\')
    ) {
      return false;
    }
  }

  // 3. Đối chiếu Whitelist Regex của trình quản lý gói
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
  tenContainer?: string;
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
  cucBo = false,
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

  const cleanTenContainer =
    trinhQuanLy === MaTrinhQuanLyGoi.DOCKER ? taoTenContainerTuImage(cleanTenGoi) : cleanTenGoi;

  // Ghép lệnh an toàn (dùng replaceAll để thay thế toàn bộ placeholder {tenGoi}, {tenContainer} và {phienBan})
  const lenhCai = manifest.mauLenhCai
    .replaceAll('{tenGoi}', cleanTenGoi)
    .replaceAll('{tenContainer}', cleanTenContainer)
    .replaceAll('{phienBan}', cleanPhienBan || '');
  // Thư viện npm cài vào dự án (`npm install x`, không -g): lệnh cập nhật và gỡ phải cùng phạm vi cục bộ, nếu không
  // sẽ gỡ nhầm bản toàn máy (D-36 vẫn nhận các thư viện này vào kho)
  const duocCucBo = cucBo && trinhQuanLy === MaTrinhQuanLyGoi.NPM;
  const lenhCapNhat = (duocCucBo ? 'npm update {tenGoi}' : manifest.mauLenhCapNhat)
    .replaceAll('{tenGoi}', cleanTenGoi)
    .replaceAll('{tenContainer}', cleanTenContainer)
    .replaceAll('{phienBan}', cleanPhienBan || '');
  const lenhGo = (duocCucBo ? 'npm uninstall {tenGoi}' : manifest.mauLenhGo)
    .replaceAll('{tenGoi}', cleanTenGoi)
    .replaceAll('{tenContainer}', cleanTenContainer)
    .replaceAll('{phienBan}', cleanPhienBan || '');

  return {
    hopLe: true,
    lenhCai,
    lenhCapNhat,
    lenhGo,
    trinhQuanLy,
    tenGoi: cleanTenGoi,
    tenContainer: trinhQuanLy === MaTrinhQuanLyGoi.DOCKER ? cleanTenContainer : undefined,
    phienBan: cleanPhienBan,
  };
}

/**
 * `npm install x`, `pnpm add x`, `yarn add x`, `bun add x` không có -g/--global: cài thư viện vào dự án đang mở.
 * Dùng chung cho bộ bóc lệnh (backend) và nút "Tôi đã cài" (desktop) để lệnh gỡ và cập nhật cùng phạm vi.
 */
export function laLenhNpmCucBo(lenh?: string): boolean {
  const l = (lenh ?? '').trim();
  return (
    /^(npm\s+(i|install)|pnpm\s+(add|i|install)|yarn\s+add|bun\s+(add|i))\s/i.test(l) &&
    !/\s(?:-g|--global)(?=\s|$)/i.test(l)
  );
}

/**
 * Bỏ dấu nhắc shell đứng đầu dòng lệnh trong README: `$ cmd`, `> cmd`, `% cmd`, `PS> cmd`, `PS C:\> cmd`.
 * Phải chạy TRƯỚC khi kiểm tra ký tự nguy hiểm (vì `$` nằm trong danh sách chặn).
 */
export function boDauNhacShell(lenh: string): string {
  if (!lenh || typeof lenh !== 'string') return '';
  return lenh
    .trim()
    .replace(/^(?:PS(?:\s+[^>\r\n]*)?>\s*|[$>%]\s+)/, '')
    .trim();
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
  lenhThoGoc: string,
): { trinhQuanLy: MaTrinhQuanLyGoi; tenGoi: string; phienBan?: string } | null {
  if (!lenhThoGoc || typeof lenhThoGoc !== 'string') return null;
  const lenhTho = boDauNhacShell(lenhThoGoc);

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
      // Danh sách cờ có tham số đi kèm cần bỏ qua cả cờ lẫn giá trị tiếp theo
      const flagsWithArgs = new Set([
        '-r',
        '--requirement',
        '-c',
        '--constraint',
        '-f',
        '--find-links',
        '-i',
        '--index-url',
        '--extra-index-url',
        '-t',
        '--target',
        '-e',
        '--editable',
        '--prefix',
        '--root',
        '--src',
        '--proxy',
      ]);

      let pkgToken: string | undefined;
      for (let i = 0; i < sauInstall.length; i++) {
        const token = sauInstall[i];
        if (!token) continue;

        // Cờ dạng --flag=value
        if (token.startsWith('--') && token.includes('=')) {
          continue;
        }

        // Cờ có tham số đi kèm (ví dụ: -r requirements.txt) -> bỏ qua cả cờ và giá trị sau
        if (flagsWithArgs.has(token.toLowerCase())) {
          i++; // Nhảy qua giá trị kèm theo
          continue;
        }

        // Cờ thông thường (ví dụ: -U, --upgrade, --no-cache-dir)
        if (token.startsWith('-')) {
          continue;
        }

        // Token đầu tiên không phải cờ
        pkgToken = token;
        break;
      }

      if (pkgToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.PIP, pkgToken)) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.PIP, tenGoi: pkgToken };
      }
    }
  }

  // 5. DOCKER
  // Khuyến nghị Quyết định D-23 & Claude Review:
  // Ưu tiên cao nhất là 'docker pull <image>'.
  // Với 'docker run': Chỉ chấp nhận khi xác định chắc chắn được image (không có lệnh chương trình trailing phức tạp).
  if (/^docker\s+pull\b/i.test(l)) {
    const tokens = l.split(/\s+/).slice(2);
    const nonFlags = tokens.filter((t) => !t.startsWith('-'));
    const imageToken = nonFlags[0];
    if (imageToken && kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.DOCKER, imageToken)) {
      return { trinhQuanLy: MaTrinhQuanLyGoi.DOCKER, tenGoi: imageToken };
    }
  }

  if (/^docker\s+run\b/i.test(l)) {
    const tokens = l.split(/\s+/).slice(2);
    const dockerRunFlagsWithArgs = new Set([
      '--name',
      '-p',
      '--publish',
      '-v',
      '--volume',
      '--mount',
      '-e',
      '--env',
      '--env-file',
      '--network',
      '--net',
      '--restart',
      '-w',
      '--workdir',
      '-u',
      '--user',
      '--group-add',
      '--entrypoint',
      '--shm-size',
      '--ulimit',
      '--log-driver',
      '--log-opt',
      '-m',
      '--memory',
      '--memory-swap',
      '--memory-reservation',
      '--cpus',
      '--cpu-shares',
      '--cpuset-cpus',
      '--gpus',
      '--cap-add',
      '--cap-drop',
      '--add-host',
      '-l',
      '--label',
      '--label-file',
      '-h',
      '--hostname',
      '--platform',
      '--pull',
      '--runtime',
      '--device',
      '--dns',
      '--dns-search',
      '--dns-option',
      '--tmpfs',
      '--security-opt',
      '--ip',
      '--ip6',
      '--link',
      '--expose',
      '--stop-signal',
      '--stop-timeout',
    ]);

    let candidateIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      if (token.startsWith('-') && token.includes('=')) continue;
      if (dockerRunFlagsWithArgs.has(token.toLowerCase())) {
        i++; // Nhảy qua giá trị của cờ
        continue;
      }
      if (token.startsWith('-')) continue;

      // Token đầu tiên không phải cờ
      candidateIdx = i;
      break;
    }

    if (candidateIdx !== -1) {
      const candidateImage = tokens[candidateIdx];
      // Nếu sau candidateImage CÒN token nào khác (ví dụ: "serve --port 80", "sh", "app.py")
      // -> Đây là lệnh có tham số chương trình phức tạp, không xác định chắc chắn được image -> TỪ CHỐI!
      const remainingTokens = tokens.slice(candidateIdx + 1);
      if (
        remainingTokens.length === 0 &&
        candidateImage &&
        kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.DOCKER, candidateImage)
      ) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.DOCKER, tenGoi: candidateImage };
      }
    }
  }

  // 6. NPX / Skill (D-38 & P3B-33)
  // Dạng 1: npx skills add <target> hoặc npx skills install <target>
  if (/^npx\s+skills\s+(?:add|install)\b/i.test(l)) {
    const tokens = l.split(/\s+/);
    const target = tokens[3]?.trim();
    if (target && !target.startsWith('-') && !laKyTuDocHai(target)) {
      if (kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.NPX, target)) {
        return { trinhQuanLy: MaTrinhQuanLyGoi.NPX, tenGoi: target };
      }
    }
  }

  // Dạng 2: npx <tên-gói> install hoặc npx <tên-gói> add
  const matchNpx = l.match(/^npx\s+([@a-zA-Z0-9_.-]+)\s+(?:install|add)\b/i);
  if (matchNpx && matchNpx[1]) {
    const pkg = matchNpx[1];
    if (kiemTraTenGoiHopLe(MaTrinhQuanLyGoi.NPX, pkg)) {
      return { trinhQuanLy: MaTrinhQuanLyGoi.NPX, tenGoi: pkg };
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

/**
 * Kiểm tra xem một Hướng dẫn cài đặt có chứa ít nhất một cách cài đặt CLI hợp lệ
 * (có trinhQuanLy và tenGoi được hỗ trợ) hay không (P3B-16 & Quyết định D-23).
 * Dùng để phân biệt ứng dụng CLI thực thụ với các repo chỉ có câu lệnh chạy phát triển dev (pip install -r requirements.txt, python main.py).
 */
export function coCachCaiCliHopLe<
  T extends { cachCai?: Array<{ trinhQuanLy?: string | null; tenGoi?: string | null }> },
>(huongDan: T | null | undefined): huongDan is T {
  if (!huongDan || !Array.isArray(huongDan.cachCai) || huongDan.cachCai.length === 0) {
    return false;
  }
  return huongDan.cachCai.some((c) => Boolean(c.trinhQuanLy && c.tenGoi));
}

export interface KetQuaKiemTraGoiThuocRepo {
  khop: boolean;
  mucDoTinCay: 'CAO' | 'TRUNG_BINH' | 'CANH_BAO';
  canhBao?: string;
  tenGoiChuanHoa: string;
  repoChuanHoa: string;
}

/**
 * Tách và chuẩn hóa tên owner và repo từ đường dẫn hoặc slug (VD: "owner/repo", "https://github.com/owner/repo.git").
 */
export function trichXuatOwnerVaRepo(
  repoDuongDan?: string | null,
): { owner: string; repo: string } | null {
  if (!repoDuongDan || typeof repoDuongDan !== 'string') return null;
  const clean = repoDuongDan
    .trim()
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const match = clean.match(
    /(?:github\.com\/|gitlab\.com\/|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/,
  );
  if (match && match[1] && match[2]) {
    return { owner: match[1].toLowerCase(), repo: match[2].toLowerCase() };
  }
  return null;
}

/**
 * Đối chiếu tên gói CLI với repository GitHub theo quy tắc định danh (Heuristic Name Check, P3B-18 & Quyết định D-27).
 * Lưu ý: Đây là kiểm tra tương đồng cú pháp/tên gọi (Name Heuristic), chưa gọi live network API lên Registry (PyPI, npm, winget).
 * Cảnh báo nếu tên gói khác biệt hoặc nghi vấn mạo danh để người dùng thẩm tra trước khi cài đặt.
 */
export function kiemTraGoiThuocRepo(
  trinhQuanLy: MaTrinhQuanLyGoi,
  tenGoi: string,
  repoDuongDan?: string | null,
): KetQuaKiemTraGoiThuocRepo {
  const cleanGoi = (tenGoi || '').trim();
  const info = trichXuatOwnerVaRepo(repoDuongDan);

  const tenGoiNorm = cleanGoi.toLowerCase().replace(/[^a-z0-9]/g, '');
  const repoSlug = info ? `${info.owner}/${info.repo}` : (repoDuongDan || '').toLowerCase();
  const repoNameNorm = info ? info.repo.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const ownerNorm = info ? info.owner.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  if (!info || !cleanGoi) {
    return {
      khop: true,
      mucDoTinCay: 'TRUNG_BINH',
      tenGoiChuanHoa: tenGoiNorm,
      repoChuanHoa: repoSlug,
    };
  }

  // 1. Docker: Image có dạng registry/owner/repo:tag hoặc owner/repo:tag
  if (trinhQuanLy === MaTrinhQuanLyGoi.DOCKER) {
    const cleanImage = cleanGoi.split(':')[0]?.split('@')[0] || cleanGoi;
    const parts = cleanImage.split('/').filter(Boolean);
    const imgRepo =
      parts
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') || '';
    const imgOwner =
      parts
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') || '';

    if (imgRepo === repoNameNorm) {
      if (!imgOwner || imgOwner === ownerNorm) {
        return {
          khop: true,
          mucDoTinCay: 'CAO',
          tenGoiChuanHoa: tenGoiNorm,
          repoChuanHoa: repoSlug,
        };
      }
      if (ownerNorm.includes(imgOwner) || imgOwner.includes(ownerNorm)) {
        return {
          khop: true,
          mucDoTinCay: 'TRUNG_BINH',
          tenGoiChuanHoa: tenGoiNorm,
          repoChuanHoa: repoSlug,
        };
      }
      // Khác hoàn toàn owner -> Cảnh báo
      return {
        khop: false,
        mucDoTinCay: 'CANH_BAO',
        canhBao: `Tổ chức Docker Image [${imgOwner}] không khớp với tác giả repository [${info.owner}]. Hãy kiểm tra kỹ trước khi tải.`,
        tenGoiChuanHoa: tenGoiNorm,
        repoChuanHoa: repoSlug,
      };
    }
  }

  // 2. Winget: Package ID thường là Publisher.AppName (VD: Microsoft.PowerToys)
  if (trinhQuanLy === MaTrinhQuanLyGoi.WINGET) {
    const parts = cleanGoi.split('.').map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const pub = parts[0] || '';
    const app = parts[parts.length - 1] || '';

    if (pub === ownerNorm && (app === repoNameNorm || parts.includes(repoNameNorm))) {
      return {
        khop: true,
        mucDoTinCay: 'CAO',
        tenGoiChuanHoa: tenGoiNorm,
        repoChuanHoa: repoSlug,
      };
    }
    if (pub === ownerNorm && (app.includes(repoNameNorm) || repoNameNorm.includes(app))) {
      return {
        khop: true,
        mucDoTinCay: 'CAO',
        tenGoiChuanHoa: tenGoiNorm,
        repoChuanHoa: repoSlug,
      };
    }
    // Trường hợp Publisher khác Owner nhưng App trùng Repo (VD gói do cộng đồng đóng gói)
    if (app === repoNameNorm || parts.includes(repoNameNorm)) {
      return {
        khop: true,
        mucDoTinCay: 'TRUNG_BINH',
        tenGoiChuanHoa: tenGoiNorm,
        repoChuanHoa: repoSlug,
      };
    }
  }

  // 3. NPM Scoped: @scope/pkg
  if (trinhQuanLy === MaTrinhQuanLyGoi.NPM && cleanGoi.startsWith('@')) {
    const match = cleanGoi.match(/^@([^/]+)\/(.+)$/);
    if (match) {
      const scope = match[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      const pkg = match[2]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      // BẮT BUỘC scope phải khớp chính xác owner để chống mạo danh (vd @evil-hacker/react, @facebook-fake/react)
      if (scope === ownerNorm) {
        if (pkg === repoNameNorm || pkg.includes(repoNameNorm) || repoNameNorm.includes(pkg)) {
          return {
            khop: true,
            mucDoTinCay: 'CAO',
            tenGoiChuanHoa: tenGoiNorm,
            repoChuanHoa: repoSlug,
          };
        }
      } else {
        // Scope không khớp với owner kho lưu trữ -> Cảnh báo mạo danh
        return {
          khop: false,
          mucDoTinCay: 'CANH_BAO',
          canhBao: `Phạm vi gói NPM [@${match[1]}] không khớp với tác giả repository [${info.owner}]. Nguy cơ mạo danh thư viện.`,
          tenGoiChuanHoa: tenGoiNorm,
          repoChuanHoa: repoSlug,
        };
      }
    }
  }

  // 4. Scoop: bucket/pkg hoặc pkg
  if (trinhQuanLy === MaTrinhQuanLyGoi.SCOOP && cleanGoi.includes('/')) {
    const pkg =
      cleanGoi
        .split('/')
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') || '';
    if (pkg === repoNameNorm) {
      return {
        khop: true,
        mucDoTinCay: 'CAO',
        tenGoiChuanHoa: tenGoiNorm,
        repoChuanHoa: repoSlug,
      };
    }
    if (repoNameNorm.includes(pkg) || pkg.includes(repoNameNorm)) {
      return {
        khop: false,
        mucDoTinCay: 'CANH_BAO',
        canhBao: `Gói Scoop [${cleanGoi}] tương đồng một phần nhưng không khớp chính xác với repository [${repoSlug}] (đối chiếu theo tên, chưa kiểm tra Registry). Cảnh giác nguy cơ mạo danh.`,
        tenGoiChuanHoa: tenGoiNorm,
        repoChuanHoa: repoSlug,
      };
    }
  }

  // 5. So sánh tên chuẩn hóa thông thường (pip, npm không scope, scoop không bucket)
  if (tenGoiNorm === repoNameNorm) {
    return {
      khop: true,
      mucDoTinCay: 'CAO',
      tenGoiChuanHoa: tenGoiNorm,
      repoChuanHoa: repoSlug,
    };
  }

  // Chống combosquatting: Tên bao hàm nhau (vd ytdlp-malware trên yt-dlp) phải kích hoạt cảnh báo khop: false
  if (
    (tenGoiNorm.length >= 3 && repoNameNorm.includes(tenGoiNorm)) ||
    (repoNameNorm.length >= 3 && tenGoiNorm.includes(repoNameNorm))
  ) {
    return {
      khop: false,
      mucDoTinCay: 'CANH_BAO',
      canhBao: `Tên gói [${cleanGoi}] tương đồng một phần nhưng không khớp chính xác với repository [${repoSlug}] (đối chiếu theo tên, chưa kiểm tra Registry). Cảnh giác nguy cơ Combosquatting.`,
      tenGoiChuanHoa: tenGoiNorm,
      repoChuanHoa: repoSlug,
    };
  }

  // Nếu không khớp
  return {
    khop: false,
    mucDoTinCay: 'CANH_BAO',
    canhBao: `Tên gói [${cleanGoi}] khác biệt so với tên kho lưu trữ [${repoSlug}] (đối chiếu theo tên, chưa kiểm tra Registry). Hãy kiểm tra kỹ độ tin cậy trước khi cài đặt.`,
    tenGoiChuanHoa: tenGoiNorm,
    repoChuanHoa: repoSlug,
  };
}

/**
 * Đối chiếu URL dự án được công bố trên Registry (PyPI, npm, winget) với repository gốc (D-27).
 * Hàm này dùng để so khớp URL metadata khi backend tích hợp API truy vấn Registry trực tiếp.
 */
export function xacThucGoiThuocRepoUrl(urlDuAn?: string | null, repoGoc?: string | null): boolean {
  if (!urlDuAn || !repoGoc) return false;
  const infoDuAn = trichXuatOwnerVaRepo(urlDuAn);
  const infoGoc = trichXuatOwnerVaRepo(repoGoc);

  if (infoDuAn && infoGoc) {
    return infoDuAn.owner === infoGoc.owner && infoDuAn.repo === infoGoc.repo;
  }

  const cleanDuAn = urlDuAn
    .trim()
    .toLowerCase()
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const cleanGoc = repoGoc
    .trim()
    .toLowerCase()
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  return cleanDuAn.includes(cleanGoc) || cleanGoc.includes(cleanDuAn);
}

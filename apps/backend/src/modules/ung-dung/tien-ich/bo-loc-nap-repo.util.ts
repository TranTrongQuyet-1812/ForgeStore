import { DinhDangTep } from '@prisma/client';
import { coCachCaiCliHopLe } from '@forgestore/types';
import { trichXuatHuongDanCliBangQuyTac } from '../../ai/tien-ich/cli-guide-extractor.util';
import { phanLoaiCacTepBanPhatHanh } from './phan-loai-tep.util';

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
  | 'KHONG_CO_GIAY_PHEP'
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

/**
 * Repo GitHub không nhận diện được giấy phép nhưng vẫn được giữ trong kho. Chỉ có đúng một ngoại lệ, do Chủ chốt
 * 06/11/2026: 7-Zip dùng giấy phép riêng (LGPL kèm điều khoản unRAR) nên GitHub trả `license: null`.
 * Dùng chung cho dây chuyền nạp, "Dán link GitHub" và bộ theo dõi thay đổi để ba nơi không lệch nhau.
 */
export const NGOAI_LE_GIAY_PHEP = new Set(['ip7z/7zip']);

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
  // D-36: nhận mọi giấy phép kể cả NOASSERTION và other (tác giả có ghi, GitHub chỉ không đọc ra mã);
  // chỉ loại repo hoàn toàn không có giấy phép vì theo luật là mọi quyền được bảo lưu.
  if (!repo.license && !NGOAI_LE_GIAY_PHEP.has(repo.full_name.toLowerCase())) {
    return { dat: false, lyDo: 'KHONG_CO_GIAY_PHEP', chiTiet: 'không có' };
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

  // P3B-36: phân loại cả danh sách để nhận ZIP duy nhất không ghi hệ điều hành (Ghidra)
  const tep = phanLoaiCacTepBanPhatHanh((chinhThuc.assets ?? []).map((a) => a.name)).filter(
    (k) => !k.boQua && k.dinhDang !== null && DINH_DANG_HOP_LE.includes(k.dinhDang),
  );
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

function thoatKyTuRegex(chuoi: string): string {
  return chuoi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kiểm tra xem một repo/README có phải là thư viện lập trình thuần không (Luật 2, Quyết định 11/11/2026).
 * Tiêu chí:
 * - Thứ để chạy như một chương trình (dòng lệnh, giao diện, máy chủ) thì nhận (trả về false).
 * - Thứ chỉ để import vào mã của người khác thì loại (trả về true).
 */
export function laThuVienLapTrinh(
  readme: string | null | undefined,
  fullName: string,
  cachCai?: Array<{
    nhom?: string;
    trinhQuanLy?: string;
    tenGoi?: string;
    buoc?: Array<{ lenh: string }>;
  }> | null,
): boolean {
  if (!readme || !cachCai || cachCai.length === 0) return false;

  // 1. Nếu có cách cài nào thuộc WINGET, SCOOP, CHOCO, DOCKER -> Là ứng dụng
  const nhomHopLe = new Set(cachCai.map((c) => c.nhom));
  if (
    nhomHopLe.has('WINGET') ||
    nhomHopLe.has('SCOOP') ||
    nhomHopLe.has('CHOCO') ||
    nhomHopLe.has('DOCKER')
  ) {
    return false;
  }

  // 2. Nếu có cờ mcp / skill / agent -> Là ứng dụng / skill AI
  if (/<!--\s*mcp-name:/i.test(readme) || nhomHopLe.has('NPX')) {
    return false;
  }

  // 3. Nếu có Docker trong README -> Ứng dụng
  if (/\bdocker\s+(run|compose)\b/i.test(readme)) {
    return false;
  }

  // 4. Nếu có lệnh cài toàn cục (pipx install, uv tool install, npm -g, cargo install, go install) -> Là ứng dụng CLI
  let coCaiDatToanCuc = false;
  for (const c of cachCai) {
    for (const b of c.buoc ?? []) {
      const l = b.lenh.trim();
      if (
        /\b(?:pipx\s+install|uv\s+tool\s+install)\b/i.test(l) ||
        /\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\s+.*-(?:g|-global)\b/i.test(l) ||
        /\b(?:cargo|go)\s+install\b/i.test(l)
      ) {
        coCaiDatToanCuc = true;
        break;
      }
    }
    if (coCaiDatToanCuc) break;
  }
  if (coCaiDatToanCuc) {
    return false;
  }

  // 5. Framework/thư viện phát triển nổi tiếng luôn bị loại dù có CLI dev. Kiểm TRƯỚC khối code import vì README
  // viết bằng RST (scikit-learn, scrapy) không có khối ``` nên sẽ lọt nếu chỉ dựa vào dấu hiệu import.
  const tenRepo = (fullName.split('/')[1] || fullName).toLowerCase();
  const cacGoi = cachCai
    .map((c) => c.tenGoi)
    .filter(Boolean)
    .map((g) => (g as string).toLowerCase());
  const danhSachTen = Array.from(new Set([tenRepo, ...cacGoi]));

  const FRAMEWORK_DEV_LOAI = new Set([
    'fastapi',
    'scrapy',
    'transformers',
    'langchain',
    'autogen',
    'scikit-learn',
    'torch',
    'tensorflow',
  ]);
  if (danhSachTen.some((t) => FRAMEWORK_DEV_LOAI.has(t))) {
    return true;
  }

  // 6. Dấu hiệu import code thật ở BẤT KỲ đâu trong README (kể cả README RST, dòng nhắc ">>>" hay thụt đầu dòng,
  // không chỉ trong khối ```). Trước đây chỉ xét khối ``` nên README viết kiểu khác lọt luật thư viện.
  const coCodeImport = MAU_IMPORT_CODE.some((re) => re.test(readme));
  // Nếu không có dấu hiệu import nào, thì không phải là thư viện thuần
  if (!coCodeImport) return false;

  // Dòng lệnh chạy chính gói đó như một chương trình (`<gói> --help`, `<gói> <lệnh con>`): chỉ tính dòng nằm trong
  // khối mã hoặc sau dấu `$`. Câu văn mở đầu bằng tên repo ("Faker is a Python package...") không phải lệnh.
  const dongLenh = layCacDongLenhTrongReadme(readme);
  // Tên lệnh thường là tên gói, hoặc thêm đuôi -cli (gtts-cli, vd. gTTS)
  const reLenhChinhGoi = new RegExp(
    `^(?:${danhSachTen
      .filter((t) => t.length >= 2)
      .map((t) => `${thoatKyTuRegex(t)}(?:[-_]?cli)?`)
      .join('|')})(?:\\.exe)?\\s+(?![=(:,.])\\S`, // loại phép gán/gọi hàm trong mã (faker = Faker())
    'i',
  );
  const lenhBoQua = /^(?:pip3?|uv|npm|pnpm|yarn|bun|cargo|go|git)\b/i;
  if (dongLenh.some((l) => !lenhBoQua.test(l) && reLenhChinhGoi.test(l))) return false;

  // 7. Lệnh chạy runner độc lập của CHÍNH gói này. `python -m pip`, `npx create-react-app`... là việc khác, không tính.
  const tenGoiRegex = danhSachTen
    .filter((t) => t.length >= 2)
    .map((t) => thoatKyTuRegex(t).replace(/[-_]/g, '[-_]'))
    .join('|');
  if (
    tenGoiRegex &&
    new RegExp(
      `\\b(?:python\\d*\\s+-m|pipx\\s+run|uvx|npx(?:\\s+-y)?)\\s+(?:@[\\w.-]+/)?(?:${tenGoiRegex})\\b`,
      'i',
    ).test(readme)
  ) {
    return false;
  }
  if (/\bstreamlit\s+run\b/i.test(readme)) return false;

  return true;
}

/** Mẫu "import" của các ngôn ngữ phổ biến, bám đầu dòng (cho phép thụt lề và dấu nhắc `>>>`). */
const MAU_IMPORT_CODE: RegExp[] = [
  /(?:^|\n)[ \t]*(?:>>>\s*)?(?:from\s+[\w.]+\s+import\s+|import\s+[\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+)*\s*(?:\r?\n|$))/,
  /(?:^|\n)[ \t]*(?:import\s+(?:\{[^}]*\}|[\w*\s,]+)\s+from\s+['"][^'"]+['"]|const\s+.*?=\s*require\(['"][^'"]+['"]\))/,
  /(?:^|\n)[ \t]*(?:use\s+[\w:]+;|extern\s+crate\s+\w+;)/,
  /(?:^|\n)[ \t]*(?:import\s+(?:\([^)]*\)|"[^"]+"))/,
  /(?:^|\n)[ \t]*#include\s+[<"][^>"]+[>"]/,
  /(?:^|\n)[ \t]*using\s+[A-Z][\w.]+;/,
];

/** Các dòng có thể là lệnh gõ vào terminal: dòng trong khối ``` và dòng bắt đầu bằng `$`, đã bỏ dấu nhắc. */
function layCacDongLenhTrongReadme(readme: string): string[] {
  const dong: string[] = [];
  for (const m of readme.matchAll(/```[^\n]*\n([\s\S]*?)```/g))
    dong.push(...(m[1] ?? '').split('\n'));
  // Dòng sau `$` và dòng thụt 4 khoảng trắng/tab (khối mã kiểu RST, Markdown cũ)
  dong.push(...readme.split('\n').filter((l) => /^\s*\$\s+\S/.test(l) || /^(?: {4}|\t)\S/.test(l)));
  return dong
    .map((l) =>
      l
        .trim()
        .replace(/^[$#>]\s*/, '')
        .replace(/^usage:\s*/i, ''),
    )
    .filter(Boolean);
}

const MAU_TEP_KHONG_PHAI_APP_DESKTOP =
  /\.(?:app\.zip|ipa|nupkg|snupkg|aar|vsix|epub|fpk)$|\.xcframework(?:\.zip)?$|\.fb2\.zip$/i;
const MAU_README_THU_VIEN_PHU_THUOC =
  /dotnet\s+add\s+package|Install-Package|PackageReference|composer\s+require|vcpkg\s+install|conan\s+install|cargo\s+add|<artifactId>|\bimplementation\s*[("']|\bpod\s+['"]|\.package\(url:|FetchContent_Declare|find_package\(/i;
const MAU_README_PLUGIN_CUA_APP_KHAC =
  /\b(?:obsidian|typora|wordpress|home assistant|hacs|decky|godot|unity|unreal|blender)\b[^\n]{0,30}\b(?:plugin|add-?on|extension|integration)s?\b|\b(?:plugin|add-?on|extension|integration)s? for (?:obsidian|typora|wordpress|home assistant|godot|unity|unreal|blender)\b|SKILL\.md|\.claude\/skills/i;

const MAU_README_TIEN_ICH_TRINH_DUYET =
  /chrome web store|addons\.mozilla\.org|chrome\.google\.com\/webstore|(?:browser|chrome|firefox|chromium) (?:extension|add-?on)/i;

/**
 * Luật 1 bổ sung (12/11/2026): tên ZIP lẻ không đủ để biết nó là ứng dụng chạy trên Windows/Linux, nên xét thêm
 * README và tên các tệp cùng bản phát hành. Loại khi: (1) có tệp gói thư viện/ứng dụng nền tảng khác (.nupkg, .ipa,
 * .aar, .xcframework, .app.zip...) hoặc cặp main.js + manifest.json của plugin; (2) README nói về macOS nhiều hơn hẳn
 * Windows/Linux; (3) README dạy thêm thư viện vào dự án (dotnet add package, composer require, vcpkg...); (4) README
 * nói đây là plugin/tích hợp/skill của ứng dụng khác (Obsidian, Home Assistant, Claude skill...).
 * Đo trên bản lưu 335 repo: README không nhắc hệ điều hành nào vẫn được nhận (FModel, GeekDesk là app Windows thật).
 */
export function zipLaUngDungDesktop(
  readme: string | null | undefined,
  tenCacTep: string[],
): boolean {
  const ten = tenCacTep.map((t) => t.trim().toLowerCase());
  if (ten.some((t) => MAU_TEP_KHONG_PHAI_APP_DESKTOP.test(t))) return false;
  if (ten.includes('main.js') && ten.includes('manifest.json')) return false;
  const vb = readme ?? '';
  if (MAU_README_THU_VIEN_PHU_THUOC.test(vb) || MAU_README_PLUGIN_CUA_APP_KHAC.test(vb))
    return false;
  if (MAU_README_TIEN_ICH_TRINH_DUYET.test(vb)) return false;
  const dem = (re: RegExp) => (vb.match(re) ?? []).length;
  if (dem(/\b(?:font|typeface)s?\b/gi) >= 3) return false; // bộ chữ, không phải ứng dụng
  const win = dem(/\bwindows\b|\.exe\b|\bwin(?:32|64)\b/gi);
  const linux = dem(/\blinux\b|\bubuntu\b|\bdebian\b/gi);
  const mac = dem(
    /\bmac(?:os)?\b|\bos\s?x\b|\bdarwin\b|\bhomebrew\b|\bxcode\b|\bapple silicon\b/gi,
  );
  return !(mac >= 2 && mac > 2 * (win + linux));
}

/**
 * Luật 4 (Chủ chốt 12/11/2026): gói cài phải là gói CỦA CHÍNH REPO. README hay dạy cài thêm gói phụ
 * (`pip install pypdf`, `pip install torch`, `npm install react`), nếu lấy đó làm cách cài thì Desktop
 * theo dõi và cập nhật nhầm gói. Nhận khi có cách cài không phụ thuộc tên gói (winget, scoop, choco, docker,
 * npx, conda) hoặc có gói pip/npm/cargo/go mà tên khớp tên repo, chủ repo, hoặc chung một từ chính với tên repo.
 * Lệnh cài từ URL bản phát hành của chính repo (Luật 3) có tên gói dạng `owner/repo` nên cũng khớp.
 */
export function cachCaiThuocRepo(
  fullName: string,
  cachCai: Array<{ nhom?: string; tenGoi?: string }> | null | undefined,
): boolean {
  const ds = cachCai ?? [];
  if (
    ds.some((c) => ['WINGET', 'SCOOP', 'CHOCO', 'DOCKER', 'NPX', 'CONDA'].includes(c.nhom ?? ''))
  ) {
    return true;
  }
  const goi = ds.filter((c) => ['PIP', 'NPM', 'CARGO', 'GO'].includes(c.nhom ?? '') && c.tenGoi);
  if (goi.length === 0) return true; // không có gói nào để so (ví dụ chỉ có cài từ mã nguồn): không phán ở luật này
  const [chu = '', ten = ''] = fullName.toLowerCase().split('/');
  const chuan = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tu = (x: string) =>
    x
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);
  const tenRepo = chuan(ten);
  const tenChu = chuan(chu);
  const tuRepo = tu(ten);
  return goi.some((c) => {
    const g = chuan(c.tenGoi as string);
    if (!g || !tenRepo) return false;
    if (g.includes(tenRepo) || tenRepo.includes(g) || (tenChu && g.includes(tenChu))) return true;
    const tuGoi = new Set(tu(c.tenGoi as string));
    return tuRepo.some((t) => tuGoi.has(t));
  });
}

/**
 * Bộ lọc 10 (P3B-06.3 & Luật 2 ngày 11/11/2026): repo không có tệp cài nhưng README có lệnh cài hợp lệ
 * (winget, scoop, npm, pip, docker…) vẫn được nhận, TRỪ KHI là thư viện lập trình thuần (chỉ để import).
 */
export function coLenhCaiTuReadme(readme: string | null | undefined, fullName: string): boolean {
  if (!readme) return false;
  const huongDan = trichXuatHuongDanCliBangQuyTac(readme, `https://github.com/${fullName}#readme`);
  if (!coCachCaiCliHopLe(huongDan)) return false;
  if (laThuVienLapTrinh(readme, fullName, huongDan.cachCai)) return false;
  if (!cachCaiThuocRepo(fullName, huongDan.cachCai)) return false;
  return true;
}

/** Dùng chung cho lệnh `kham-pha` của Data_Repo và tầng khám phá của backend (P3B-06.1).
 * Dải sao, quét từ cao xuống thấp (ưu tiên repo nhiều sao, P3B-06.1). Mỗi truy vấn Search tối đa 1.000 kết quả nên chia dải. */
export const DAI_SAO = ['>=20000', '5000..19999', '2000..4999', '1000..1999'];

/** Chủ đề (topic) dùng để tìm repo ứng dụng; '' là không lọc chủ đề. */
export const CHU_DE_KHAM_PHA = [
  '',
  'topic:windows',
  'topic:desktop-app',
  'topic:electron',
  'topic:tauri',
  'topic:productivity',
  'topic:cross-platform',
  'topic:gui',
  'topic:utility',
  'topic:qt',
  'topic:wpf',
  'topic:dotnet',
  'topic:flutter',
  'topic:gtk',
  'topic:cli',
  'topic:terminal',
  'topic:editor',
  'topic:media-player',
  'topic:video',
  'topic:audio',
  'topic:music',
  'topic:file-manager',
  'topic:downloader',
  'topic:backup',
  'topic:password-manager',
  'topic:security',
  'topic:vpn',
  'topic:proxy',
  'topic:network',
  'topic:screen-recorder',
  'topic:screenshot',
  'topic:ocr',
  'topic:note-taking',
  'topic:markdown',
  'topic:launcher',
  'topic:clipboard',
  'topic:emulator',
  'topic:game',
  'topic:torrent',
  'topic:ide',
  'topic:database',
  'topic:git',
  'topic:developer-tools',
  'topic:system-tools',
];

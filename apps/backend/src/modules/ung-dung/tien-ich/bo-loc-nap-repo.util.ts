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

  // 0. README tự mô tả là thư viện ở phần mở đầu ("X is a Python package", "Graphiti A Framework for...", "Python GraphQL
  // library") thì là thư viện, kể cả khi có Docker (hasktorch, graphiti) hoặc vài lệnh CLI phụ (faker, typer, sympy). Cách cài
  // winget/scoop/choco của đúng gói repo vẫn được tin hơn (bước 1). Ngoại lệ: mở đầu nói rõ là công cụ dòng lệnh (gTTS, isort).
  const moDauThuVien = phanDauReadme(readme, 900);
  const coCaiKieuUngDung = cachCai.some((c) => ['WINGET', 'SCOOP', 'CHOCO'].includes(c.nhom ?? ''));
  if (
    !coCaiKieuUngDung &&
    (MAU_TU_MO_TA_LA_THU_VIEN.test(moDauThuVien) ||
      MAU_MO_DAU_TIEU_DE_THU_VIEN.test(moDauThuVien.slice(0, 140)) ||
      MAU_MO_DAU_CUM_THU_VIEN.test(moDauThuVien.slice(0, 260))) &&
    !MAU_MO_DAU_LA_CONG_CU.test(moDauThuVien.slice(0, 500))
  ) {
    return true;
  }

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
    // Cài toàn cục chỉ chứng tỏ là ứng dụng khi gói đó là gói CỦA CHÍNH REPO (expo-cli của react-three-fiber, vercel của
    // NoUnityCN, corepack của evolu là gói khác, không tính)
    if (!cachCaiThuocRepo(fullName, [c])) continue;
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

  // Các tên có thể là tên lệnh của chương trình: tên repo và tên các gói cài
  const tenRepo = (fullName.split('/')[1] || fullName).toLowerCase();
  const cacGoi = cachCai
    .map((c) => c.tenGoi)
    .filter(Boolean)
    .map((g) => (g as string).toLowerCase());
  const danhSachTen = Array.from(new Set([tenRepo, ...cacGoi]));

  // 4c. Chỉ có cách cài "thêm gói vào dự án" và mở đầu không nói đây là công cụ dòng lệnh/ứng dụng
  if (
    chiCaiNhuPhuThuocDuAn(fullName, cachCai) &&
    !MAU_MO_DAU_LA_CLI_RIENG.test(phanDauReadme(readme, 500)) &&
    !coLenhChayChinhGoi(readme, danhSachTen) // browserify main.js, staticrypt file.html, playroom start...
  ) {
    return true;
  }

  // 5. Framework/thư viện phát triển nổi tiếng luôn bị loại dù có CLI dev. Kiểm TRƯỚC khối code import vì README
  // viết bằng RST (scikit-learn, scrapy) không có khối ``` nên sẽ lọt nếu chỉ dựa vào dấu hiệu import.
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

  if (coLenhChayChinhGoi(readme, danhSachTen)) return false;

  // 7. Lệnh chạy runner độc lập của CHÍNH gói này (python -m <gói>, uvx <gói>, npx <gói>...), hoặc streamlit run
  if (coLenhRunnerChinhGoi(readme, danhSachTen)) return false;

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

// ---------------------------------------------------------------- LUẬT 1 BỔ SUNG: ZIP LẺ PHẢI LÀ ỨNG DỤNG
// Mỗi mẫu dưới đây rút từ ca thật khi kiểm tay 339 repo vớt (12/11/2026), xem _chuan/nhan_tay_12-11.json.

/** Tệp cùng bản phát hành cho biết đây không phải ứng dụng Windows/Linux: gói thư viện, ứng dụng Mac/iOS, sách, ảnh đĩa, firmware. */
const MAU_TEP_KHONG_PHAI_APP_DESKTOP =
  /\.(?:app\.zip|ipa|aar|vsix|epub|pdf|iso|fpk)$|\.xcframework(?:\.zip)?$|\.fb2\.zip$|\.img(?:\.xz)?(?:\.\d+)?$|\.iso\.\d+$/i;
/** Tên ZIP chung chung kiểu gói web, dữ liệu, bản chụp mã (web.zip, specs.zip, frontend.zip, repo-git.zip). */
/** Gói NuGet đi kèm ZIP: thường là thư viện .NET, nhưng tiện ích như lessmsi cũng phát hành kèm nupkg. */
const MAU_TEP_NUGET = /\.s?nupkg$/i;
/** README tự nhận là công cụ/tiện ích/dòng lệnh (lessmsi: "a utility with a graphical user interface"). */
const MAU_ZIP_TU_NHAN_LA_CONG_CU =
  /\b(?:tool|utility|command[- ]line|graphical user interface|desktop application)\b/i;
const MAU_TEN_ZIP_GOI_PHU =
  /^(?:web|frontend|html5?|public|build|specs?|deps|resources|skills?|dist|assets|data)(?:[-_.\d].*)?\.(?:zip|7z)$|[-_.](?:data|dataset)[-_.]|(?:^|[-_.])(?:web|ui|frontend|html5?)(?:[-_.]|$)|[-_.]git\.(?:zip|7z)$/i;
const MAU_README_THU_VIEN_PHU_THUOC =
  /dotnet\s+add\s+package|Install-Package|PackageReference|composer\s+require|vcpkg\s+install|conan\s+install|cargo\s+add|<artifactId>|\bimplementation\s*[("']|\bpod\s+['"]|\.package\(url:|FetchContent_Declare|find_package\(/i;
const MAU_README_PLUGIN_CUA_APP_KHAC =
  /\b(?:obsidian|typora|wordpress|home assistant|hacs|decky|godot|unity|unreal|blender|jetbrains|intellij)\b[^\n]{0,30}\b(?:plug-?in|add-?on|extension|integration)s?\b|\b(?:plug-?in|add-?on|extension|integration)s? for (?:obsidian|typora|wordpress|home assistant|godot|unity|unreal|blender|jetbrains|intellij)\b|SKILL\.md|\.claude\/skills|beacon object file|cobalt strike/i;
const MAU_README_TIEN_ICH_TRINH_DUYET =
  /chrome web store|addons\.mozilla\.org|chrome\.google\.com\/webstore|(?:browser|chrome|firefox|chromium) (?:extension|add-?on)/i;
/**
 * Câu tự mô tả "X là một <vài từ> <loại>" ở phần mở đầu README. Chỉ bắt dạng copula, không bắt từ "library" rải rác, vì README
 * ứng dụng hay nhắc thư viện mà nó DÙNG (FModel: "CUE4Parse, the library that parses UE archives"). Không bắt "X is a package of
 * python tools" (oletools là bộ công cụ, không phải thư viện).
 */
const MAU_TU_MO_TA_LA_GOI_PHU_TRO =
  /\b(?:is|are)\s+(?:an?|the)\s+(?:[^\s.]+\s+){0,4}(?:library|sdk|plug-?in|add-?on|extension|theme|template|boilerplate|dataset|firmware|wrapper|bindings|cms|operating system|language server)\b/i;
/** Như trên, thêm các loại gói mã chỉ để import (dùng cho đường vớt README, nơi đã có cách cài pip/npm). */
const MAU_TU_MO_TA_LA_THU_VIEN =
  /\b(?:is|are)\s+(?:an?|the)\s+(?:[^\s.]+\s+){0,4}(?:library|sdk|toolkit|package(?!\s+of\b)|module|adapter|orm|wrapper|bindings|framework for)\b/i;
/** Tiêu đề kiểu "Graphiti A Framework for...", "pyts: a Python package...": vài từ đầu rồi mạo từ rồi loại gói. */
const MAU_MO_DAU_TIEU_DE_THU_VIEN =
  /^(?:[\w.:-]+\s+){1,3}(?:an?|the)\s+(?:[^\s.]+\s+){0,4}(?:framework|library|package|toolkit|sdk)\b/i;
/** Tiêu đề kiểu cụm danh từ ("Python GraphQL library", "database adapter for Python", "collection of widgets") ở ~260 ký tự đầu. */
const MAU_MO_DAU_CUM_THU_VIEN =
  /\b(?:python|node(?:\.js)?|javascript|typescript|java|rust|ruby|php|\.?net|c\+\+|react|vue|django)\s+(?:[\w-]+\s+){0,3}(?:library|package|module|adapter|orm|sdk|wrapper|bindings)\b|\b(?:library|sdk|adapter|orm|bindings|wrapper|framework|plug-?in)\s+(?:for|to)\b|\bcollection of\b|\b(?:multi-?agent|agent|web|ai|python|javascript|typescript|automation|testing|browser|application)\s+framework\b|\bpython apis?\b|\bimplementation of\b|\b(?:development|developer) kit\b|\b(?:react|vue|angular|svelte|solid|jquery)\s+(?:component|plugin|hook)s?\b|\bthis (?:library|package|module)\b|\bport of\b|\bresume template\b/i;
/**
 * Bản hẹp của mẫu trên cho đường ZIP: bỏ "collection of" (retoolkit: "collection of tools") và "framework for" (monkey365:
 * "assessment framework for Microsoft 365"), vì ZIP lẻ của công cụ Windows hay mô tả như vậy. Kiểm tay 12/11/2026.
 */
const MAU_MO_DAU_CUM_THU_VIEN_ZIP =
  /\b(?:python|node(?:\.js)?|javascript|typescript|java|rust|ruby|php|\.?net|c\+\+|react|vue|django)\s+(?:[\w-]+\s+){0,3}(?:library|package|module|adapter|orm|sdk|wrapper|bindings)\b|\b(?:library|sdk|adapter|orm|bindings|wrapper)\s+(?:for|to)\b|\bpython apis?\b|\bimplementation of\b|\b(?:development|developer) kit\b/i;
/** npm/pnpm/yarn/bun cài MỘT gói có tên (cho phép cờ trước tên). "pnpm install" trần (chạy từ mã nguồn) không khớp. */
const MAU_NPM_CAI_GOI_CO_TEN =
  /\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\s+(?:-{1,2}[\w-]+(?:=\S+)?\s+)*(?!-)[@\w.][^\s]*/;

/**
 * Mọi cách cài đều chỉ là thêm một gói vào dự án khác (npm install <gói> không -g, không npx; pip và cài từ mã nguồn không
 * làm đổi kết luận) và không có đường cài kiểu ứng dụng (winget, scoop, choco, docker, cargo/go install, conda...). Ứng dụng
 * viết bằng JS thường cài bằng npm -g hoặc npx. Kiểm tay mẫu độc lập 12/11/2026: lightGallery, effector, Squire, deck.gl...
 */
function chiCaiNhuPhuThuocDuAn(
  fullName: string,
  cachCai: Array<{ nhom?: string; tenGoi?: string; buoc?: Array<{ lenh: string }> }>,
): boolean {
  let coNpmCoTen = false;
  for (const c of cachCai) {
    const nhom = c.nhom ?? '';
    if (nhom === 'PIP' || nhom === 'NGUON') continue;
    if (nhom !== 'NPM') return false;
    for (const b of c.buoc ?? []) {
      const l = b.lenh.trim();
      if (/(?:^|\s)npx\s/.test(l)) return false;
      // Cài toàn cục chỉ chứng tỏ là ứng dụng khi là gói của chính repo (expo-cli của react-three-fiber thì không)
      if (/(?:^|\s)(?:-g|--global)\b/.test(l) && cachCaiThuocRepo(fullName, [c])) return false;
      if (MAU_NPM_CAI_GOI_CO_TEN.test(l)) coNpmCoTen = true;
    }
  }
  return coNpmCoTen;
}

/** Lệnh chạy runner của CHÍNH gói (python -m pip, npx create-react-app... là việc khác, không tính). */
function coLenhRunnerChinhGoi(readme: string, danhSachTen: string[]): boolean {
  const tenGoiRegex = danhSachTen
    .filter((t) => t.length >= 2)
    .map((t) => thoatKyTuRegex(t).replace(/[-_]/g, '[-_]'))
    .join('|');
  if (
    tenGoiRegex &&
    new RegExp(
      String.raw`\b(?:python\d*\s+-m|pipx\s+run|uvx|npx(?:\s+-y)?)\s+(?:@[\w.-]+/)?(?:${tenGoiRegex})\b`,
      'i',
    ).test(readme)
  ) {
    return true;
  }
  return /\bstreamlit\s+run\b/i.test(readme);
}

/**
 * README có dòng lệnh chạy CHÍNH gói đó như một chương trình (`<gói> --help`, `<gói> <lệnh con>`): chỉ tính dòng nằm trong
 * khối mã hoặc sau dấu `$`. Câu văn mở đầu bằng tên repo ("Faker is a Python package...") không phải lệnh.
 */
function coLenhChayChinhGoi(readme: string, danhSachTen: string[]): boolean {
  // Tên lệnh thường là tên gói, hoặc thêm đuôi -cli (gtts-cli, vd. gTTS)
  const ten = danhSachTen.filter((t) => t.length >= 2);
  if (ten.length === 0) return false;
  const reLenhChinhGoi = new RegExp(
    `^(?:${ten.map((t) => `${thoatKyTuRegex(t)}(?:[-_]?cli)?`).join('|')})(?:\\.exe)?(?:\\s+(?![=(:,.])\\S|$)`, // loại phép gán/gọi hàm trong mã (faker = Faker())
    'i',
  );
  const lenhBoQua = /^(?:pip3?|uv|npm|pnpm|yarn|bun|cargo|go|git)\b/i;
  return layCacDongLenhTrongReadme(readme).some(
    (l) => !lenhBoQua.test(l) && reLenhChinhGoi.test(l),
  );
}

/** Chỉ riêng CLI/dòng lệnh (không tính app, terminal, gui, vốn hay xuất hiện trong mô tả thư viện); không tính "để xây CLI". */
const MAU_MO_DAU_LA_CLI_RIENG =
  /(?<!(?:build|building|create|creating|write|writing|develop|developing|for)\s)(?<![\w-])\b(?:cli|command[- ]line)\b/i;

/** Phần mở đầu nói đây là công cụ dòng lệnh/tiện ích/ứng dụng; không tính "để xây/viết/tạo CLI". */
const MAU_MO_DAU_LA_CONG_CU =
  /(?<!(?:build|building|create|creating|write|writing|develop|developing|for)\s)(?<![\w-])\b(?:cli|command[- ]line|utility(?!\s+(?:tools?|functions?|methods?|classes|modules?))|terminal|gui|desktop|app)\b/i;
/** Dấu hiệu không nhập nhằng ở phần mở đầu: web tự host, tài liệu học, bộ cấu hình, framework đặc thù. */
const MAU_MO_DAU_KHONG_PHAI_APP =
  /\b(?:php|laravel|wordpress|self[- ]hosted|web[- ]based|web interface|in the browser|for the web|e-?commerce|tutorials?|courses?|exercises|katas|prompts?|skills?|graphic packs?|configs?|configuration files?|systemless module|home assistant|components for|operating system|framework for (?:wpf|\.net|react|vue|angular|android|ios|unity|godot|unreal)|language server|add-?on|gdextension|our research)\b|\b(?:development|testing|debugging|database|web|application|mobile|ui|test) framework\b|插件|主题|模板|配置|教程|课程|扩展/i;

/** README đã bỏ ảnh, liên kết, thẻ HTML, ký hiệu; cắt `n` ký tự đầu. */
function phanDauReadme(readme: string, n: number): string {
  return readme
    .replace(/!\[[^\]]*\]\([^)]*\)|<[^>]*>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|=]/g, ' ')
    .replace(/(^|\s)-+(?=\s)/g, ' ') // gạch đứng riêng (gạch đầu dòng); giữ gạch trong từ (expo-cli, multi-agent)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
}

/**
 * Luật 1 bổ sung (12/11/2026): tên ZIP lẻ không đủ để biết nó là ứng dụng chạy trên Windows/Linux, nên xét thêm
 * README và tên các tệp cùng bản phát hành. Loại khi: (1) tệp cùng bản là gói thư viện, ảnh đĩa, sách, firmware,
 * ứng dụng Mac/iOS, cặp main.js + manifest.json của plugin, hoặc có bản `-src` đi kèm; (2) tên ZIP chung chung kiểu gói
 * web/dữ liệu; (3) README dạy thêm thư viện vào dự án; (4) README nói đây là plugin/skill của ứng dụng khác;
 * (5) phần mở đầu README tự nhận là thư viện/plugin/web tự host/bộ cấu hình...; (6) README nói về macOS nhiều hơn hẳn
 * Windows/Linux, hoặc chỉ nhắc macOS. README không nhắc hệ điều hành nào vẫn được nhận (FModel, GeekDesk là app Windows thật).
 */
export function zipLaUngDungDesktop(
  readme: string | null | undefined,
  tenCacTep: string[],
): boolean {
  const ten = tenCacTep.map((t) => t.trim().toLowerCase());
  if (ten.some((t) => MAU_TEP_KHONG_PHAI_APP_DESKTOP.test(t))) return false;
  if (ten.includes('main.js') && ten.includes('manifest.json')) return false;
  if (ten.filter((t) => t.endsWith('.bin')).length >= 3) return false; // firmware
  if (ten.filter((t) => /\.(?:txt|dat|csv|list)$/.test(t)).length >= 3) return false; // bộ dữ liệu
  if (ten.some((t) => /(?:^|[-_.])(?:src|source)(?:[-_.]|$)/.test(t) && /\.(?:zip|7z)$/.test(t)))
    return false;
  const zip = ten.find((t) => /\.(?:zip|7z)$/.test(t));
  if (zip && MAU_TEN_ZIP_GOI_PHU.test(zip)) return false;

  const vb = readme ?? '';
  const moDau = phanDauReadme(vb, 600);
  const tuNhanLaCongCu = MAU_ZIP_TU_NHAN_LA_CONG_CU.test(moDau.slice(0, 450));
  if (ten.some((t) => MAU_TEP_NUGET.test(t)) && !tuNhanLaCongCu) return false;
  if (MAU_README_THU_VIEN_PHU_THUOC.test(vb) || MAU_README_PLUGIN_CUA_APP_KHAC.test(vb))
    return false;
  if (MAU_README_TIEN_ICH_TRINH_DUYET.test(vb)) return false;
  // Mở đầu tự nhận là thư viện/plugin/web tự host... thì loại, trừ khi mở đầu nói rõ đây là công cụ/tiện ích/dòng lệnh (SchemaCrawler)
  if (
    !tuNhanLaCongCu &&
    (MAU_TU_MO_TA_LA_GOI_PHU_TRO.test(moDau) ||
      MAU_MO_DAU_KHONG_PHAI_APP.test(moDau.slice(0, 350)) ||
      MAU_MO_DAU_CUM_THU_VIEN_ZIP.test(moDau.slice(0, 260)))
  )
    return false;

  const dem = (re: RegExp) => (vb.match(re) ?? []).length;
  if (readmeChiChoMac(vb) || laCongCuKhongNenNhan(vb)) return false;
  if (dem(/\b(?:font|typeface)s?\b/gi) >= 3) return false; // bộ chữ, không phải ứng dụng
  if (dem(/\bphp\b/gi) >= 2) return false; // web PHP tự host
  return true;
}

/**
 * README chỉ nói về macOS (Apple Silicon, MLX, Homebrew...) mà gần như không nhắc Windows/Linux. "windows" đứng một mình hay
 * trùng với "quản lý cửa sổ", nên Windows chỉ tính khi đi với phiên bản/ngữ cảnh cài đặt. Kiểm tay 12/11/2026: Loop, mlx-audio.
 */
export function readmeChiChoMac(vb: string): boolean {
  const dem = (re: RegExp) => (vb.match(re) ?? []).length;
  const win = dem(
    /\bwindows\s*(?:\d+|xp|vista|server)\b|\.exe\b|\bwin(?:32|64)\b|\bfor windows\b|\bwindows[,/ ]+(?:and |or )?(?:linux|macos|mac)\b|\b(?:linux|macos|mac)[,/ ]+(?:and |or )?windows\b|\bmicrosoft windows\b/gi,
  );
  const linux = dem(/\blinux\b|\bubuntu\b|\bdebian\b/gi);
  const mac = dem(
    /\bmac(?:os)?\b|\bos\s?x\b|\bdarwin\b|\bhomebrew\b|\bxcode\b|\bapple silicon\b|\bmlx\b/gi,
  );
  return mac >= 2 && mac > 2 * (win + linux);
}

/**
 * Dùng cho đường README (pip/npm/docker): phần mở đầu nói về Mac/Apple Silicon/MLX VÀ cả README không nhắc Windows hay Linux
 * (mlx-audio, mlx-serve, terminal-mac). Chặt hơn đếm số lần vì README ứng dụng đa nền tảng hay có đoạn cài cho Mac
 * (browser-use, aws-shell nhắc macOS ở phần hướng dẫn cài).
 */
export function readmeChiChoMacTheoMoDau(vb: string): boolean {
  return (
    /\b(?:apple silicon|macos|mac|macbook|mlx)\b/i.test(phanDauReadme(vb, 500)) &&
    !/\b(?:windows|linux|ubuntu|debian)\b/i.test(vb)
  );
}

/** Không nên nhận: công cụ gian lận game (aimbot...), tạo tài khoản hàng loạt, module Xposed/Magisk (chỉ chạy bên trong Android đã root). */
export function laCongCuKhongNenNhan(readme: string | null | undefined): boolean {
  return /\b(?:aimbot|aim[- ]?(?:assist|alignment|bot)|wallhack|triggerbot|game cheats?|cheat engine|account (?:generator|creator)|(?:xposed|lsposed|magisk) module|systemless module)\b/i.test(
    phanDauReadme(readme ?? '', 900),
  );
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
  if (ds.some((c) => ['DOCKER', 'NPX', 'CONDA'].includes(c.nhom ?? ''))) return true;
  // winget/scoop/choco cũng phải đúng gói của repo (robotgo dạy cài "GoLang.Go" là gói khác)
  const goi = ds.filter(
    (c) =>
      ['PIP', 'NPM', 'CARGO', 'GO', 'WINGET', 'SCOOP', 'CHOCO'].includes(c.nhom ?? '') && c.tenGoi,
  );
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
  const tuChu = new Set(tu(chu));
  return goi.some((c) => {
    const g = chuan(c.tenGoi as string);
    if (!g || !tenRepo) return false;
    // Gói trùng tên chủ repo chỉ nhận khi TRÙNG HẲN (browser-use/...→browser-use). "twilio-cli" của repo twilio-video-app-react
    // chỉ chung chữ twilio với chủ repo, là gói khác (kiểm tay 339 repo vớt, 12/11/2026).
    if (g.includes(tenRepo) || tenRepo.includes(g) || (tenChu && g === tenChu)) return true;
    const tuGoi = new Set(tu(c.tenGoi as string));
    return tuRepo.some((t) => tuGoi.has(t) && !tuChu.has(t));
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
  if (readmeChiChoMacTheoMoDau(readme) || laCongCuKhongNenNhan(readme)) return false;
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

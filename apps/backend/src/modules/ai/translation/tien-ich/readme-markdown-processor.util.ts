import { createHash } from 'node:crypto';

/**
 * Tách README thành các nút có vị trí nguồn để dịch riêng chữ và giữ nguyên khung Markdown.
 * Bộ đọc này cố ý không chuẩn hóa/tuần tự hóa lại Markdown: mọi phần không dịch được chép nguyên từ nguồn.
 */

export type LoaiNutReadme =
  | 'heading'
  | 'paragraph'
  | 'list_item'
  | 'table_cell'
  | 'blockquote'
  | 'code'
  | 'html'
  | 'thematic_break'
  | 'definition'
  | 'unknown';

export interface NutReadme {
  loai: LoaiNutReadme;
  batDau: number;
  ketThuc: number;
  dongBatDau: number;
  dongKetThuc: number;
  capTieuDe?: number;
  noiDung?: string;
  duongDanTieuDe: string[];
}

export interface DoanDichReadme {
  stt: number;
  maBam: string;
  loai: LoaiNutReadme;
  viTriBatDau: number;
  viTriKetThuc: number;
  dong: number;
  tieuDeMuc: string[];
  vanBanGoc: string;
  vanBanDaChe: string;
  khungGiuNguyen: Record<string, string>;
  canDich: boolean;
}

export interface CauTrucReadme {
  nut: NutReadme[];
  doan: DoanDichReadme[];
  canhBao: Array<{ dong: number; lyDo: string }>;
}

const TU_KHOA_TIEU_DE_CO_DINH: Record<string, string> = {
  license: 'Giấy phép',
  许可证: 'Giấy phép',
  installation: 'Cài đặt',
  install: 'Cài đặt',
  installing: 'Cài đặt',
  features: 'Tính năng',
  'key features': 'Tính năng chính',
  highlights: 'Điểm nổi bật',
  contributing: 'Đóng góp',
  contribute: 'Đóng góp',
  contribution: 'Đóng góp',
  'how to contribute': 'Cách đóng góp',
  documentation: 'Tài liệu',
  docs: 'Tài liệu',
  usage: 'Cách dùng',
  'basic usage': 'Cách dùng cơ bản',
  'how to use': 'Cách dùng',
  'quick start': 'Bắt đầu nhanh',
  quickstart: 'Bắt đầu nhanh',
  快速开始: 'Bắt đầu nhanh',
  'getting started': 'Bắt đầu',
  'get started': 'Bắt đầu',
  contributors: 'Người đóng góp',
  sponsors: 'Nhà tài trợ',
  sponsor: 'Nhà tài trợ',
  backers: 'Người ủng hộ',
  donate: 'Ủng hộ',
  'star history': 'Lịch sử sao',
  'table of contents': 'Mục lục',
  contents: 'Mục lục',
  community: 'Cộng đồng',
  faq: 'Câu hỏi thường gặp',
  'frequently asked questions': 'Câu hỏi thường gặp',
  常见问题: 'Câu hỏi thường gặp',
  development: 'Phát triển',
  support: 'Hỗ trợ',
  help: 'Trợ giúp',
  'getting help': 'Nhận trợ giúp',
  configuration: 'Cấu hình',
  settings: 'Cài đặt',
  downloads: 'Tải về',
  download: 'Tải về',
  screenshots: 'Ảnh chụp màn hình',
  截图: 'Ảnh chụp màn hình',
  troubleshooting: 'Xử lý sự cố',
  prerequisites: 'Điều kiện cần có',
  requirements: 'Yêu cầu',
  'system requirements': 'Yêu cầu hệ thống',
  examples: 'Ví dụ',
  example: 'Ví dụ',
  'how it works': 'Cách hoạt động',
  security: 'Bảo mật',
  overview: 'Tổng quan',
  introduction: 'Giới thiệu',
  about: 'Giới thiệu',
  roadmap: 'Lộ trình',
  credits: 'Ghi công',
  acknowledgements: 'Lời cảm ơn',
  acknowledgments: 'Lời cảm ơn',
  thanks: 'Lời cảm ơn',
  'special thanks': 'Lời cảm ơn đặc biệt',
  build: 'Build',
  building: 'Build',
  'build from source': 'Build từ mã nguồn',
  'from source': 'Từ mã nguồn',
  architecture: 'Kiến trúc',
  plugins: 'Plugin',
  resources: 'Tài nguyên',
  demo: 'Demo',
  disclaimer: 'Tuyên bố miễn trừ trách nhiệm',
  citation: 'Trích dẫn',
  maintainers: 'Người duy trì',
  authors: 'Tác giả',
  options: 'Tùy chọn',
  changelog: 'Nhật ký thay đổi',
  "what's new": 'Có gì mới',
  'related projects': 'Dự án liên quan',
  related: 'Liên quan',
  'code of conduct': 'Quy tắc ứng xử',
  performance: 'Hiệu năng',
  benchmarks: 'Benchmark',
  benchmark: 'Benchmark',
  setup: 'Thiết lập',
  links: 'Liên kết',
  'quick links': 'Liên kết nhanh',
  translations: 'Bản dịch',
  'tech stack': 'Công nghệ sử dụng',
  'environment variables': 'Biến môi trường',
  'supported platforms': 'Nền tảng được hỗ trợ',
  'browser support': 'Trình duyệt được hỗ trợ',
  dependencies: 'Thành phần phụ thuộc',
  contact: 'Liên hệ',
  integrations: 'Tích hợp',
  news: 'Tin tức',
  limitations: 'Hạn chế',
  'known issues': 'Vấn đề đã biết',
  testing: 'Kiểm thử',
  uninstall: 'Gỡ cài đặt',
  'for developers': 'Dành cho nhà phát triển',
  'use cases': 'Trường hợp sử dụng',
  references: 'Tài liệu tham khảo',
  customization: 'Tùy biến',
};
const KY_TU_CAU_TRUC_INLINE = new Set([
  '\\',
  '`',
  '!',
  '*',
  '_',
  '[',
  ']',
  '{',
  '}',
  '<',
  '>',
  '|',
  '#',
  '~',
]);
const BANG_THUAT_NGU_KIEM = [
  { goc: /\bfeatures?\b/i, dich: /tính năng/i, ma: 'feature' },
  { goc: /\bpackages?\b/i, dich: /\bgói\b/i, ma: 'package' },
  { goc: /\bcommands?\b/i, dich: /\blệnh\b/i, ma: 'command' },
  { goc: /\bdependencies?\b/i, dich: /thành phần phụ thuộc/i, ma: 'dependency' },
  { goc: /\bservers?\b/i, dich: /máy chủ/i, ma: 'server' },
  { goc: /\bbrowsers?\b/i, dich: /trình duyệt/i, ma: 'browser' },
  { goc: /\blibraries\b|\blibrary\b/i, dich: /thư viện/i, ma: 'library' },
  { goc: /\benvironments?\b/i, dich: /môi trường/i, ma: 'environment' },
  { goc: /\bsupport(?:ed|s)?\b/i, dich: /hỗ trợ/i, ma: 'support' },
  { goc: /\bcommunities\b|\bcommunity\b/i, dich: /cộng đồng/i, ma: 'community' },
  { goc: /\bapplications?\b|\bapps?\b/i, dich: /ứng dụng/i, ma: 'application' },
  { goc: /\bupdates?\b/i, dich: /cập nhật/i, ma: 'update' },
  { goc: /\bversions?\b/i, dich: /phiên bản/i, ma: 'version' },
  { goc: /\bfiles?\b/i, dich: /tệp/i, ma: 'file' },
  { goc: /\bdirectories\b|\bdirectory\b|\bfolders?\b/i, dich: /thư mục/i, ma: 'directory' },
  { goc: /\bsecurity\b/i, dich: /bảo mật/i, ma: 'security' },
  { goc: /\bbugs?\b/i, dich: /lỗi/i, ma: 'bug' },
  { goc: /\bclients?\b/i, dich: /máy khách/i, ma: 'client' },
  { goc: /\bbinaries\b|\bbinary\b/i, dich: /tệp thực thi/i, ma: 'binary' },
  { goc: /\bopen-source\b/i, dich: /mã nguồn mở/i, ma: 'open_source' },
  { goc: /\bcloud\b/i, dich: /đám mây/i, ma: 'cloud' },
  { goc: /\bmodels?\b/i, dich: /mô hình/i, ma: 'model' },
  { goc: /\breleases?\b/i, dich: /bản phát hành/i, ma: 'release' },
  { goc: /\bcontributors?\b/i, dich: /người đóng góp/i, ma: 'contributor' },
  { goc: /\bdownloads?\b/i, dich: /tải về/i, ma: 'download' },
  { goc: /\binstalls?\b|\binstalling\b/i, dich: /cài đặt/i, ma: 'install' },
  { goc: /\buninstalls?\b|\buninstalling\b/i, dich: /gỡ cài đặt/i, ma: 'uninstall' },
  { goc: /\bconfiguration\b/i, dich: /cấu hình/i, ma: 'configuration' },
  { goc: /\bchangelog\b/i, dich: /nhật ký thay đổi/i, ma: 'changelog' },
  { goc: /\bscreenshots?\b/i, dich: /ảnh chụp màn hình/i, ma: 'screenshot' },
];

interface DongNguon {
  text: string;
  batDau: number;
  so: number;
}

interface VungChu {
  batDau: number;
  ketThuc: number;
  loai: LoaiNutReadme;
  dong: number;
  tieuDeMuc: string[];
  vanBanGoc: string;
  vanBanDaChe: string;
  khungGiuNguyen: Record<string, string>;
  coDichCoDinh?: string;
}

/** Tính hash giống Data_Repo và cache BE: SHA-256 trên trim của đoạn nguồn. */
export function tinhMaBamDoanReadme(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}

function tachDong(markdown: string): DongNguon[] {
  const lines: DongNguon[] = [];
  let batDau = 0;
  for (const [so, text] of markdown.split(/(?<=\n)/).entries()) {
    lines.push({ text, batDau, so: so + 1 });
    batDau += text.length;
  }
  return lines;
}

function boDauDong(text: string): string {
  return text.replace(/\r?\n$/, '');
}

function layTieuDeTieuChuan(text: string): string {
  return text
    .replace(/\s+#+\s*$/, '')
    .replace(/^\s*\d+(?:\.\d+)*[.)]?\s*/, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '')
    .trim()
    .toLocaleLowerCase('en-US');
}

function layMocTieuDe(text: string): { cap: number; start: number; end: number } | null {
  const atx = text.match(/^\s{0,3}(#{1,6})\s+/);
  if (atx) {
    const start = atx[0].length;
    const end = text.replace(/\r?\n$/, '').replace(/\s+#+\s*$/, '').length;
    return { cap: atx[1]?.length ?? 1, start, end };
  }
  return null;
}

function boQuaDong(text: string): boolean {
  if (!text.trim() || /^\s*(?:<!--|<\/)/.test(text)) return true;
  const tagDungRieng = /^\s*<[^>]+>\s*$/.test(text);
  return tagDungRieng && !/^\s*<img\b/i.test(text);
}

function phanLoaiDong(text: string): LoaiNutReadme {
  if (/^\s{0,3}(?:`{3,}|~{3,})/.test(text)) return 'code';
  if (/^ {4}\S|^\t/.test(text)) return 'code';
  // Chỉ coi cú pháp import/export có dạng mã là MDX; câu văn "Import the library..." vẫn dịch được.
  if (
    /^\s*import\s+(?:(?:type\s+)?(?:[\w$]+|\*\s+as\s+[\w$]+|\{[^}]+\})\s+from\s*['"]|['"][^'"]+['"])/.test(
      text,
    ) ||
    /^\s*export\s+(?:\{[^}]+\}(?:\s+from\s*['"])?|\*\s+from\s*['"]|(?:default|const|let|var|function|class)\b)/.test(
      text,
    ) ||
    /^\s*:::\w/.test(text)
  )
    return 'unknown';
  if (/^\s{0,3}#{1,6}\s/.test(text)) return 'heading';
  if (/^\s{0,3}>/.test(text)) return 'blockquote';
  if (/^\s{0,3}(?:[-*_]\s*){3,}$/.test(text)) return 'thematic_break';
  if (/^\s{0,3}(?:[*+-]|\d+[.)])\s+/.test(text)) return 'list_item';
  if (/^\s{0,3}\|?.+\|.+\|?\s*$/.test(text)) return 'table_cell';
  if (/^\s{0,3}\[[^\]]+\]:/.test(text)) return 'definition';
  if (/^\s{0,3}</.test(text)) return 'html';
  return 'paragraph';
}

/** Tách vị trí chữ có thể dịch; mã, URL, thuộc tính HTML và cú pháp Markdown được giữ ở nguồn. */
function layVungChu(
  text: string,
  absoluteStart: number,
  vungGiuNguyen: Array<{ batDau: number; ketThuc: number }>,
): Array<{ batDau: number; ketThuc: number }> {
  const spans: Array<{ batDau: number; ketThuc: number }> = [];
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart >= 0 && end > runStart) {
      const raw = text.slice(runStart, end);
      const leading = raw.length - raw.trimStart().length;
      const trailing = raw.trimEnd().length;
      if (trailing > leading && /[\p{L}\p{N}]/u.test(raw.slice(leading, trailing))) {
        spans.push({
          batDau: absoluteStart + runStart + leading,
          ketThuc: absoluteStart + runStart + trailing,
        });
      }
    }
    runStart = -1;
  };
  let protectedIndex = 0;
  let low = 0;
  let high = vungGiuNguyen.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (vungGiuNguyen[middle]!.ketThuc <= absoluteStart) low = middle + 1;
    else high = middle;
  }
  protectedIndex = low;
  let i = 0;
  while (i < text.length) {
    const absoluteIndex = absoluteStart + i;
    while (
      protectedIndex < vungGiuNguyen.length &&
      vungGiuNguyen[protectedIndex]!.ketThuc <= absoluteIndex
    )
      protectedIndex++;
    const protectedRegion = vungGiuNguyen[protectedIndex];
    if (protectedRegion && absoluteIndex >= protectedRegion.batDau) {
      flush(i);
      i = Math.min(text.length, protectedRegion.ketThuc - absoluteStart);
      continue;
    }
    const rest = text.slice(i);
    const code = rest.match(/^(`+)[\s\S]*?\1/);
    const comment = rest.match(/^<!--[\s\S]*?-->/);
    const image = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    const htmlImage = rest.match(/^<img\b[^>]*>/i);
    const url = rest.match(/^(?:https?:\/\/|mailto:)[^\s<>)\]]+/i);
    const html = rest.match(/^<[^>]*>/);
    const destination = rest.match(/^\]\(\s*<?[^\s)>]+>?[^)]*\)/);
    const reference = rest.match(/^\]\[[^\]]*\]/);
    const currentChar = text[i];
    const syntax = currentChar !== undefined && KY_TU_CAU_TRUC_INLINE.has(currentChar);
    const isBadge = image && /(?:shields\.io|badge|badgen|img\.shields)/i.test(image[2] ?? '');
    const protect =
      code?.[0] ??
      comment?.[0] ??
      (isBadge ? image?.[0] : undefined) ??
      url?.[0] ??
      (htmlImage ? undefined : html?.[0]) ??
      destination?.[0] ??
      reference?.[0];
    if (protect) {
      flush(i);
      i += protect.length;
      continue;
    }
    if (htmlImage) {
      const attributes = htmlImage[0];
      const badge =
        /\b(?:src|data-src)\s*=\s*["'][^"']*(?:shields\.io|badge|badgen)[^"']*["']/i.test(
          attributes,
        );
      const alt = attributes.match(/\balt\s*=\s*(["'])(.*?)\1/i);
      if (!badge && alt?.[2]) {
        flush(i);
        const altStart = alt.index! + alt[0].indexOf(alt[2]);
        spans.push({
          batDau: absoluteStart + i + altStart,
          ketThuc: absoluteStart + i + altStart + alt[2].length,
        });
        i += attributes.length;
        continue;
      }
      flush(i);
      i += attributes.length;
      continue;
    }
    if (syntax) {
      flush(i);
      // Dấu mở link/image là khung; phần nhãn bên trong vẫn được tách thành chữ dịch.
      i++;
      continue;
    }
    if (runStart < 0) runStart = i;
    i++;
  }
  flush(text.length);
  return spans;
}

/** Tìm các vùng phải giữ nguyên trên toàn văn bản để nhận ra mã inline qua xuống dòng. */
function layVungGiuNguyen(markdown: string): Array<{ batDau: number; ketThuc: number }> {
  const regions: Array<{ batDau: number; ketThuc: number }> = [];
  const addMatches = (regex: RegExp) => {
    for (const match of markdown.matchAll(regex)) {
      if (match.index !== undefined)
        regions.push({ batDau: match.index, ketThuc: match.index + match[0].length });
    }
  };

  addMatches(/<!--(?:[\s\S]*?-->|[\s\S]*$)/g);
  addMatches(/<code\b[^>]*>[\s\S]*?<\/code\s*>/gi);
  addMatches(/<pre\b[^>]*>[\s\S]*?<\/pre\s*>/gi);
  addMatches(/\{[^{}\n]*(?:=>|===|==|=|[()[\].<>;])[^{}\n]*\}/g);
  addMatches(/(?<![\\`])(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g);
  const sorted = regions.sort((a, b) => a.batDau - b.batDau);
  const merged: Array<{ batDau: number; ketThuc: number }> = [];
  for (const region of sorted) {
    const last = merged.at(-1);
    if (last && region.batDau <= last.ketThuc)
      last.ketThuc = Math.max(last.ketThuc, region.ketThuc);
    else merged.push({ ...region });
  }
  return merged;
}

function tachNoiDungDong(
  markdown: string,
  dong: DongNguon,
  vungGiuNguyen: Array<{ batDau: number; ketThuc: number }>,
): Array<{ batDau: number; ketThuc: number }> {
  const raw = boDauDong(dong.text);
  const heading = layMocTieuDe(raw);
  const list = raw.match(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/);
  const quote = raw.match(/^\s{0,3}>\s?/);
  const table = raw.match(/^\s*\|?/);
  const prefix = heading?.start ?? list?.[0].length ?? quote?.[0].length ?? 0;
  const content = raw.slice(prefix);
  const trimStart = content.length - content.trimStart().length;
  const start = dong.batDau + prefix + trimStart;
  const headingEnd = heading?.end;
  // Dòng phân cách của bảng là cấu trúc, không phải văn bản cần dịch.
  if (table && /^\s*\|?\s*:?-{3,}/.test(content)) return [];
  // Văn bản trên huy hiệu là nhãn máy sinh, cần giữ nguyên; alt ảnh nội dung vẫn được dịch.
  const phanDong = markdown.slice(dong.batDau, dong.batDau + raw.length);
  const anh = phanDong.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  if (
    anh?.[1] &&
    anh[2] &&
    phanDong.trim() === anh[0] &&
    /(?:shields\.io|badge|badgen|img\.shields)/i.test(anh[2])
  ) {
    return [];
  }
  const text = raw.slice(prefix + trimStart, headingEnd === undefined ? raw.length : headingEnd);
  const spans = layVungChu(text, start, vungGiuNguyen);
  return spans;
}

/**
 * Đọc README thành cây khối có vị trí và các đoạn chữ thuần. Dòng cấu trúc lạ được giữ nguyên và báo vị trí.
 */
export function phanTichReadme(markdown: string): CauTrucReadme {
  if (!markdown) return { nut: [], doan: [], canhBao: [] };
  const lines = tachDong(markdown);
  const vungGiuNguyen = layVungGiuNguyen(markdown);
  const nut: NutReadme[] = [];
  const canhBao: CauTrucReadme['canhBao'] = [];
  const tieuDe = new Map<number, string>();
  let i = 0;
  let trongCode = false;
  let codeDelimiter = '';
  let codeDelimiterLength = 0;
  let trongBinhLuanHtml = false;

  while (i < lines.length) {
    const line = lines[i]!;
    const raw = boDauDong(line.text);
    if (i === 0 && /^---\s*$/.test(raw)) {
      let end = i + 1;
      while (end < lines.length && !/^\s*(?:---|\.\.\.)\s*$/.test(boDauDong(lines[end]!.text)))
        end++;
      if (end < lines.length) {
        const last = lines[end]!;
        nut.push({
          loai: 'unknown',
          batDau: line.batDau,
          ketThuc: last.batDau + last.text.length,
          dongBatDau: line.so,
          dongKetThuc: last.so,
          duongDanTieuDe: [...tieuDe.values()],
        });
        canhBao.push({ dong: line.so, lyDo: 'front_matter_duoc_giu_nguyen' });
        i = end + 1;
        continue;
      }
    }
    if (trongBinhLuanHtml || raw.includes('<!--')) {
      const start = i;
      while (i < lines.length && !boDauDong(lines[i]!.text).includes('-->')) i++;
      if (i < lines.length) i++;
      else trongBinhLuanHtml = true;
      const last = lines[Math.max(start, i - 1)]!;
      nut.push({
        loai: 'html',
        batDau: line.batDau,
        ketThuc: last.batDau + last.text.length,
        dongBatDau: line.so,
        dongKetThuc: last.so,
        duongDanTieuDe: [...tieuDe.values()],
      });
      continue;
    }
    const fence = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const delimiter = fence[1]![0]!;
      if (!trongCode) {
        trongCode = true;
        codeDelimiter = delimiter;
        codeDelimiterLength = fence[1]!.length;
      } else if (
        delimiter === codeDelimiter &&
        fence[1]!.length >= codeDelimiterLength &&
        /^\s*$/.test(raw.slice(fence[1]!.length))
      ) {
        trongCode = false;
      }
      nut.push({
        loai: 'code',
        batDau: line.batDau,
        ketThuc: line.batDau + line.text.length,
        dongBatDau: line.so,
        dongKetThuc: line.so,
        duongDanTieuDe: [...tieuDe.values()],
      });
      i++;
      continue;
    }
    if (trongCode) {
      nut.push({
        loai: 'code',
        batDau: line.batDau,
        ketThuc: line.batDau + line.text.length,
        dongBatDau: line.so,
        dongKetThuc: line.so,
        duongDanTieuDe: [...tieuDe.values()],
      });
      i++;
      continue;
    }
    if (boQuaDong(raw)) {
      i++;
      continue;
    }

    const kind = phanLoaiDong(raw);
    const header = layMocTieuDe(raw);
    let endIndex = i;
    if (kind === 'paragraph' || kind === 'blockquote' || kind === 'html') {
      while (endIndex + 1 < lines.length && !boQuaDong(boDauDong(lines[endIndex + 1]!.text))) {
        const next = boDauDong(lines[endIndex + 1]!.text);
        if (/^\s{0,3}(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|\|)/.test(next)) break;
        if (phanLoaiDong(next) !== kind) break;
        endIndex++;
      }
    }
    if (kind === 'table_cell') {
      while (
        endIndex + 1 < lines.length &&
        /\|/.test(lines[endIndex + 1]!.text) &&
        !boQuaDong(lines[endIndex + 1]!.text)
      )
        endIndex++;
    }

    const last = lines[endIndex]!;
    const startPos = line.batDau;
    const endPos = last.batDau + last.text.length;
    if (header) {
      for (const cap of [...tieuDe.keys()]) if (cap >= header.cap) tieuDe.delete(cap);
      const text = raw.slice(header.start, header.end).trim();
      tieuDe.set(header.cap, text);
    }
    const path = [...tieuDe.entries()].sort(([a], [b]) => a - b).map(([, value]) => value);
    nut.push({
      loai: kind,
      batDau: startPos,
      ketThuc: endPos,
      dongBatDau: line.so,
      dongKetThuc: last.so,
      ...(header ? { capTieuDe: header.cap } : {}),
      duongDanTieuDe: path,
    });
    if (kind === 'unknown') canhBao.push({ dong: line.so, lyDo: 'khong_phan_loai_duoc_khoi' });
    i = endIndex + 1;
  }
  if (trongCode) canhBao.push({ dong: lines.at(-1)?.so ?? 1, lyDo: 'khoi_code_chua_dong' });

  const vung: VungChu[] = [];
  for (const node of nut) {
    if (
      node.loai === 'code' ||
      node.loai === 'thematic_break' ||
      node.loai === 'definition' ||
      node.loai === 'unknown'
    )
      continue;
    const startLine = lines[node.dongBatDau - 1];
    const endLine = lines[node.dongKetThuc - 1];
    if (!startLine || !endLine) continue;
    const nodeSpans: Array<{ batDau: number; ketThuc: number; dong: number }> = [];
    let fixedHeading: string | undefined;
    for (let lineNo = node.dongBatDau; lineNo <= node.dongKetThuc; lineNo++) {
      const sourceLine = lines[lineNo - 1]!;
      const raw = boDauDong(sourceLine.text);
      const header = layMocTieuDe(raw);
      const headingText = header ? raw.slice(header.start, header.end).trim() : '';
      fixedHeading = header ? TU_KHOA_TIEU_DE_CO_DINH[layTieuDeTieuChuan(headingText)] : undefined;
      const spans = tachNoiDungDong(markdown, sourceLine, vungGiuNguyen);
      for (const span of spans) {
        if (markdown.slice(span.batDau, span.ketThuc).trim())
          nodeSpans.push({ ...span, dong: lineNo });
      }
    }
    if (nodeSpans.length === 0) continue;

    const start = nodeSpans[0]!.batDau;
    const end = nodeSpans.at(-1)!.ketThuc;
    const vanBanGoc = markdown.slice(start, end);
    const khungGiuNguyen: Record<string, string> = {};
    let cursor = start;
    let vanBanDaChe = '';
    for (const span of nodeSpans) {
      const gap = markdown.slice(cursor, span.batDau);
      const whitespace = gap.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (whitespace) {
        const [, leading, immutable, trailing] = whitespace;
        vanBanDaChe += leading;
        if (immutable) {
          const token = `⟦C${Object.keys(khungGiuNguyen).length + 1}⟧`;
          khungGiuNguyen[token] = immutable;
          vanBanDaChe += token;
        }
        vanBanDaChe += trailing;
      }
      vanBanDaChe += markdown.slice(span.batDau, span.ketThuc);
      cursor = span.ketThuc;
    }
    vung.push({
      batDau: start,
      ketThuc: end,
      loai: node.loai,
      dong: nodeSpans[0]!.dong,
      tieuDeMuc: node.duongDanTieuDe,
      vanBanGoc,
      vanBanDaChe,
      khungGiuNguyen,
      ...(fixedHeading ? { coDichCoDinh: fixedHeading } : {}),
    });
  }

  const doan = vung.map((span, index) => {
    const source = span.vanBanGoc;
    const fixed = span.coDichCoDinh;
    return {
      stt: index + 1,
      maBam: tinhMaBamDoanReadme(source),
      loai: span.loai,
      viTriBatDau: span.batDau,
      viTriKetThuc: span.ketThuc,
      dong: span.dong,
      tieuDeMuc: span.tieuDeMuc,
      vanBanGoc: source,
      canDich: !fixed && /[\p{L}]/u.test(source),
      vanBanDaChe: fixed ?? span.vanBanDaChe,
      khungGiuNguyen: span.khungGiuNguyen,
    };
  });
  return { nut, doan, canhBao };
}

/** Lắp chữ đã dịch vào vị trí cũ, áp dụng từ cuối lên để không làm lệch offset. */
export function rapLaiReadme(
  markdown: string,
  cauTruc: CauTrucReadme,
  banDich: ReadonlyMap<number, string>,
): string {
  const thayDoi = cauTruc.doan
    .map((segment) => ({
      segment,
      text:
        banDich.get(segment.stt) ??
        (segment.vanBanDaChe !== segment.vanBanGoc ? segment.vanBanDaChe : undefined),
    }))
    .filter((item): item is { segment: DoanDichReadme; text: string } => item.text !== undefined)
    .sort((a, b) => b.segment.viTriBatDau - a.segment.viTriBatDau);
  let result = markdown;
  for (const { segment, text } of thayDoi) {
    if (markdown.slice(segment.viTriBatDau, segment.viTriKetThuc) !== segment.vanBanGoc) {
      throw new Error(`Vị trí đoạn README đã thay đổi tại dòng ${segment.dong}`);
    }
    const restored = goKhungGiuNguyen(segment, text);
    result = `${result.slice(0, segment.viTriBatDau)}${restored}${result.slice(segment.viTriKetThuc)}`;
  }
  return result;
}

/** Khôi phục đúng phần cú pháp đã thay bằng ký hiệu C trước khi ghép Markdown. */
export function goKhungGiuNguyen(segment: DoanDichReadme, text: string): string {
  let result = text;
  const moc = Object.keys(segment.khungGiuNguyen).map((token) => {
    const thayThe = token.replace('⟦', '[').replace('⟧', ']');
    const viTriGoc = result.indexOf(token);
    const viTriThayThe = result.indexOf(thayThe);
    const viTri = viTriGoc >= 0 ? viTriGoc : viTriThayThe;
    if (viTri < 0) throw new Error(`Thiếu ký hiệu giữ nguyên ${token} ở đoạn ${segment.stt}`);
    return { token, thayThe, viTri, dungNgoacGoc: viTriGoc >= 0 };
  });
  if (moc.some((item, index) => index > 0 && item.viTri <= moc[index - 1]!.viTri)) {
    throw new Error(`Thứ tự ký hiệu giữ nguyên bị đổi ở đoạn ${segment.stt}`);
  }
  for (const item of moc) {
    const original = segment.khungGiuNguyen[item.token]!;
    result = result.replace(item.dungNgoacGoc ? item.token : item.thayThe, () => original);
  }
  return result;
}

export interface KetQuaBatBienReadme {
  canhBao: string[];
  hang: 'A' | 'B' | 'C';
  tiLeDoDaiTong: number | null;
  tiLeDoDaiDoan: number[];
  ngonNguNguon: 'vi' | 'zh' | 'en' | 'khac';
  tiLeDoDaiMoTa: number | null;
  tiLeDoDaiEn: number | null;
  tiLeDoDaiZh: number | null;
}

const CANH_BAO_BAT_BIEN_NGHIEM_TRONG = new Set([
  'khoi_code_thay_doi',
  'ma_inline_thay_doi',
  'url_thay_doi',
  'tieu_de_h1_thay_doi',
  'tieu_de_h2_thay_doi',
  'tieu_de_h3_thay_doi',
  'tieu_de_h4_thay_doi',
  'tieu_de_h5_thay_doi',
  'tieu_de_h6_thay_doi',
  'so_muc_danh_sach_thay_doi',
  'so_hang_bang_thay_doi',
  'so_cot_bang_thay_doi',
  'khung_van_ban_thay_doi',
  'con_ma_che',
  'con_chu_han',
]);

/** Lỗi bất biến phải chặn lưu; cảnh báo benchmark và thuật ngữ vẫn được giữ để người duyệt xem. */
export function layLoiBatBienReadme(canhBao: string[]): string[] {
  return canhBao.filter((warning) => CANH_BAO_BAT_BIEN_NGHIEM_TRONG.has(warning));
}

function layKhoiCode(markdown: string): string[] {
  const blocks: string[] = [];
  const lines = tachDong(markdown);
  let open = -1;
  let delimiter = '';
  for (let i = 0; i < lines.length; i++) {
    const text = boDauDong(lines[i]!.text);
    const fence = text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence && open < 0) {
      open = i;
      delimiter = fence[1]![0]!;
    } else if (fence && open >= 0 && fence[1]![0] === delimiter) {
      blocks.push(
        lines
          .slice(open, i + 1)
          .map((line) => line.text)
          .join(''),
      );
      open = -1;
    }
  }
  if (open >= 0)
    blocks.push(
      lines
        .slice(open)
        .map((line) => line.text)
        .join(''),
    );
  return blocks;
}

function layCacMoc(markdown: string, regex: RegExp): string[] {
  return [...markdown.matchAll(regex)].map((match) => match[0]);
}

function layTapUrl(markdown: string): string[] {
  const urls = new Set<string>();
  const patterns = [
    /!?\[[^\]]*\]\(\s*<?([^\s)>]+)/g,
    /^\s*\[[^\]]+\]:\s*<?([^\s>]+)/gm,
    /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi,
    /(?:https?:\/\/|mailto:)[^\s<>)\]]+/gi,
  ];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      if (match[1]) urls.add(match[1].replace(/[)>.,;]+$/, ''));
      else urls.add(match[0].replace(/[)>.,;]+$/, ''));
    }
  }
  return [...urls].sort();
}

function demCau(text: string): number {
  return (text.match(/[.!?。！？](?:\s|$)/g) ?? []).length;
}

/** Bỏ phần chữ dịch khỏi các khối, giữ lại nguyên byte cấu trúc và nội dung kỹ thuật. */
function layKhungReadme(markdown: string): string {
  const segments = phanTichReadme(markdown).doan;
  let result = markdown;
  for (const segment of [...segments].reverse()) {
    const parts = segment.vanBanDaChe.split(/(⟦C\d+⟧)/g);
    const khungDoan = parts
      .map((part, index) => {
        if (/^⟦C\d+⟧$/.test(part))
          return `${part}:${JSON.stringify(segment.khungGiuNguyen[part] ?? '')}`;
        const truocLaKhung = index > 0 && /^⟦C\d+⟧$/.test(parts[index - 1] ?? '');
        const sauLaKhung = index + 1 < parts.length && /^⟦C\d+⟧$/.test(parts[index + 1] ?? '');
        if (!truocLaKhung && !sauLaKhung) return '';
        if (/^\s*$/.test(part)) return part;
        const dau = truocLaKhung ? (part.match(/^\s*/) ?? [''])[0] : '';
        const cuoi = sauLaKhung ? (part.match(/\s*$/) ?? [''])[0] : '';
        return dau + cuoi;
      })
      .join('');
    result = `${result.slice(0, segment.viTriBatDau)}${khungDoan}${result.slice(segment.viTriKetThuc)}`;
  }
  return result;
}

/** So bất biến cấu trúc và nội dung. Ngưỡng độ dài chưa được đo nên chỉ báo chờ, không tự đặt số. */
export function kiemBatBienReadme(
  goc: string,
  dich: string,
  tuyChon: {
    repoPhoBien?: boolean;
    nguongDoDaiDaDo?: boolean;
    moTaNgan?: { goc: string; dich: string };
    doan?: Array<{ goc: string; dich: string }>;
  } = {},
): KetQuaBatBienReadme {
  const warnings: string[] = [];
  if (layKhungReadme(goc) !== layKhungReadme(dich)) warnings.push('khung_van_ban_thay_doi');
  if (JSON.stringify(layKhoiCode(goc)) !== JSON.stringify(layKhoiCode(dich)))
    warnings.push('khoi_code_thay_doi');
  for (const [name, regex] of [['ma_inline', /`+[^`\n]+`+/g]] as const) {
    const before = layCacMoc(goc, regex).sort();
    const after = layCacMoc(dich, regex).sort();
    if (JSON.stringify(before) !== JSON.stringify(after)) warnings.push(`${name}_thay_doi`);
  }
  if (JSON.stringify(layTapUrl(goc)) !== JSON.stringify(layTapUrl(dich)))
    warnings.push('url_thay_doi');
  for (let level = 1; level <= 6; level++) {
    const heading = new RegExp(`^\\s{0,3}#{${level}}\\s`, 'gm');
    if ((goc.match(heading) ?? []).length !== (dich.match(heading) ?? []).length)
      warnings.push(`tieu_de_h${level}_thay_doi`);
  }
  const listCount = (text: string) => (text.match(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/gm) ?? []).length;
  if (listCount(goc) !== listCount(dich)) warnings.push('so_muc_danh_sach_thay_doi');
  const tableRows = (text: string) =>
    text.split(/\r?\n/).filter((line) => /^\s*\|.*\|\s*$/.test(line));
  const beforeRows = tableRows(goc);
  const afterRows = tableRows(dich);
  if (beforeRows.length !== afterRows.length) warnings.push('so_hang_bang_thay_doi');
  else if (
    beforeRows.some((row, index) => row.split('|').length !== afterRows[index]?.split('|').length)
  )
    warnings.push('so_cot_bang_thay_doi');
  if (/⟦C\d+⟧|\[C\d+\]/.test(dich)) warnings.push('con_ma_che');
  const vanGoc = (tuyChon.doan ?? [{ goc, dich }]).map((segment) => segment.goc).join('\n');
  const vanDich = (tuyChon.doan ?? [{ goc, dich }]).map((segment) => segment.dich).join('\n');
  if (/\p{Script=Han}/u.test(vanDich)) warnings.push('con_chu_han');
  if (/(.+)(?:\r?\n\1){2,}/u.test(vanDich)) warnings.push('dong_lap_lien_tiep');
  for (const term of BANG_THUAT_NGU_KIEM) {
    if (term.goc.test(vanGoc) && !term.dich.test(vanDich))
      warnings.push(`sai_thuat_ngu_${term.ma}`);
  }
  if (tuyChon.nguongDoDaiDaDo !== true) warnings.push('nguong_do_dai_cho_benchmark');
  warnings.push('nguong_ti_le_tieng_anh_cho_benchmark');
  let tiLeDoDaiMoTa: number | null = null;
  if (tuyChon.moTaNgan) {
    const moTaGoc = tuyChon.moTaNgan.goc.replace(/\s/g, '').length;
    const moTaDich = tuyChon.moTaNgan.dich.replace(/\s/g, '').length;
    tiLeDoDaiMoTa = moTaGoc ? moTaDich / moTaGoc : null;
    if (demCau(tuyChon.moTaNgan.dich) < demCau(tuyChon.moTaNgan.goc))
      warnings.push('mo_ta_thieu_cau');
    warnings.push('nguong_do_dai_mo_ta_cho_benchmark');
  }
  if (tuyChon.repoPhoBien) warnings.push('repo_pho_bien_can_doc_thu_cong');
  const sourceCharacters = vanGoc.replace(/\s/g, '').length;
  const translatedCharacters = vanDich.replace(/\s/g, '').length;
  const tiLeDoan = (tuyChon.doan ?? []).map((segment) => {
    const originalLength = segment.goc.replace(/\s/g, '').length;
    return originalLength ? segment.dich.replace(/\s/g, '').length / originalLength : 1;
  });
  const tongTheoNguon = {
    en: { goc: 0, dich: 0 },
    zh: { goc: 0, dich: 0 },
  };
  for (const segment of tuyChon.doan ?? []) {
    const sourceLength = segment.goc.replace(/\s/g, '').length;
    const translatedLength = segment.dich.replace(/\s/g, '').length;
    if (/\p{Script=Han}/u.test(segment.goc)) {
      tongTheoNguon.zh.goc += sourceLength;
      tongTheoNguon.zh.dich += translatedLength;
    } else if (
      /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(segment.goc)
    ) {
      continue;
    } else if (/\p{Script=Latin}/u.test(segment.goc)) {
      tongTheoNguon.en.goc += sourceLength;
      tongTheoNguon.en.dich += translatedLength;
    }
  }
  const tiLeDoDaiEn = tongTheoNguon.en.goc ? tongTheoNguon.en.dich / tongTheoNguon.en.goc : null;
  const tiLeDoDaiZh = tongTheoNguon.zh.goc ? tongTheoNguon.zh.dich / tongTheoNguon.zh.goc : null;
  const sourceHan = (vanGoc.match(/\p{Script=Han}/gu) ?? []).length;
  const sourceLatin = (vanGoc.match(/\p{Script=Latin}/gu) ?? []).length;
  const sourceVietnamese = (
    vanGoc.match(/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi) ?? []
  ).length;
  const ngonNguNguon =
    sourceHan > sourceLatin
      ? 'zh'
      : sourceVietnamese
        ? 'vi'
        : sourceLatin
          ? 'en'
          : goc
            ? 'khac'
            : 'vi';
  return {
    canhBao: [...new Set(warnings)],
    hang: warnings.length === 0 ? 'A' : tuyChon.repoPhoBien ? 'C' : 'B',
    tiLeDoDaiTong: sourceCharacters ? translatedCharacters / sourceCharacters : null,
    tiLeDoDaiDoan: tiLeDoan,
    ngonNguNguon,
    tiLeDoDaiMoTa,
    tiLeDoDaiEn,
    tiLeDoDaiZh,
  };
}

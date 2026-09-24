import { DinhDangTep, KienTrucChip } from '@forgestore/types';

export interface KetQuaPhanLoaiTep {
  dinhDang: DinhDangTep | null;
  kienTruc: KienTrucChip;
  boQua: boolean;
  lyDoBoQua?: string;
}

// Danh sách phần mở rộng chắc chắn bỏ qua (không phải file cài đặt cho Windows / Android)
const DUOI_TEP_BO_QUA = new Set([
  '.aab',
  '.apks',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.appimage',
  '.sig',
  '.asc',
  '.sha256',
  '.sha512',
  '.sha1',
  '.md5',
  '.txt',
  '.json',
  '.xml',
  '.yml',
  '.yaml',
  '.md',
  '.pdf',
  '.html',
  '.htm',
  '.tar',
  '.tar.gz',
  '.tar.xz',
  '.tar.bz2',
  '.tgz',
  '.ipk',
  '.flatpak',
  '.snap',
]);

// Nhãn hệ điều hành không hỗ trợ (macOS, Linux, iOS)
// Chú ý dùng ranh giới từ (word boundary) hoặc ký tự phân cách để không bắt nhầm các từ như "machine", "package"
const PATTERN_OS_BO_QUA =
  /(?:^|[-_.])(macos|mac|darwin|apple|osx|linux|ubuntu|debian|fedora|arch|ios|iphone|ipad)(?:[-_.]|$)/i;

// Nhãn mã nguồn
const PATTERN_SOURCE_CODE = /(?:^|[-_.])(source|src)(?:[-_.]|$)|source\s*code/i;

/**
 * Hàm thuần phân loại file cài đặt từ tên tệp (P2-22).
 * Độc lập 100%, không phụ thuộc NestJS runtime.
 *
 * @param tenTep Tên file đính kèm trong Release GitHub (VD: rustdesk-1.2.3-x86_64.exe)
 * @returns KetQuaPhanLoaiTep (dinhDang, kienTruc, boQua, lyDoBoQua)
 */
export function phanLoaiTep(tenTep: string): KetQuaPhanLoaiTep {
  if (!tenTep || typeof tenTep !== 'string') {
    return {
      dinhDang: null,
      kienTruc: KienTrucChip.KHONG_XAC_DINH,
      boQua: true,
      lyDoBoQua: 'Tên tệp rỗng hoặc không hợp lệ',
    };
  }

  const cleanName = tenTep.trim();
  const lowerName = cleanName.toLowerCase();

  // 1. Kiểm tra nguồn mã nguồn
  if (PATTERN_SOURCE_CODE.test(lowerName)) {
    return {
      dinhDang: null,
      kienTruc: KienTrucChip.KHONG_XAC_DINH,
      boQua: true,
      lyDoBoQua: 'Tệp chứa mã nguồn, không phải bản build nhị phân',
    };
  }

  // 2. Kiểm tra phần mở rộng tệp
  const dotIndex = cleanName.lastIndexOf('.');
  if (dotIndex === -1) {
    return {
      dinhDang: null,
      kienTruc: KienTrucChip.KHONG_XAC_DINH,
      boQua: true,
      lyDoBoQua: 'Tệp không có phần mở rộng',
    };
  }

  // Lấy đuôi tệp (xử lý cả trường hợp .tar.gz nếu có)
  let extension = lowerName.slice(dotIndex);
  if (lowerName.endsWith('.tar.gz')) extension = '.tar.gz';
  else if (lowerName.endsWith('.tar.xz')) extension = '.tar.xz';
  else if (lowerName.endsWith('.tar.bz2')) extension = '.tar.bz2';

  if (DUOI_TEP_BO_QUA.has(extension)) {
    return {
      dinhDang: null,
      kienTruc: KienTrucChip.KHONG_XAC_DINH,
      boQua: true,
      lyDoBoQua: `Phần mở rộng ${extension} không được hỗ trợ cài đặt trên Windows/Android`,
    };
  }

  // 3. Kiểm tra nhãn hệ điều hành không hỗ trợ (macOS/Linux/iOS)
  if (PATTERN_OS_BO_QUA.test(lowerName)) {
    return {
      dinhDang: null,
      kienTruc: KienTrucChip.KHONG_XAC_DINH,
      boQua: true,
      lyDoBoQua: 'Tệp dành riêng cho macOS, Linux hoặc iOS',
    };
  }

  // 4. Xác định định dạng tệp (Format)
  let dinhDang: DinhDangTep | null = null;

  if (extension === '.apk') {
    dinhDang = DinhDangTep.APK;
  } else if (extension === '.msi') {
    dinhDang = DinhDangTep.MSI;
  } else if (extension === '.exe') {
    dinhDang = DinhDangTep.EXE;
  } else if (extension === '.zip') {
    // Tệp .zip chỉ được coi là bản cài Windows Portable nếu trong tên có chỉ thị Windows
    const hasWindowsIndicator =
      /(?:^|[-_.])(win|windows|win32|win64|portable|winstore)(?:[-_.]|$)/i.test(lowerName) ||
      lowerName.includes('portable') ||
      lowerName.includes('windows') ||
      lowerName.includes('-win') ||
      lowerName.includes('_win');

    if (hasWindowsIndicator) {
      dinhDang = DinhDangTep.ZIP_PORTABLE;
    } else {
      return {
        dinhDang: null,
        kienTruc: KienTrucChip.KHONG_XAC_DINH,
        boQua: true,
        lyDoBoQua: 'Tệp ZIP không chứa chỉ báo Windows Portable hợp lệ',
      };
    }
  } else {
    // Bỏ qua mọi định dạng không mong muốn khác
    return {
      dinhDang: null,
      kienTruc: KienTrucChip.KHONG_XAC_DINH,
      boQua: true,
      lyDoBoQua: `Định dạng tệp ${extension} không thuộc danh mục hỗ trợ`,
    };
  }

  // 5. Xác định kiến trúc chip (Chip Architecture)
  // ⚠️ QUY TẮC SỐNG CÒN CỦA P2-22: PHẢI KIỂM TRA x86_64 TRƯỚC x86!
  let kienTruc: KienTrucChip = KienTrucChip.KHONG_XAC_DINH;

  // A. ARM64 (Android 64-bit hiện đại & Windows on ARM)
  if (
    /(?:^|[-_.])(arm64-v8a|arm64|aarch64|arm-64)(?:[-_.]|$)/i.test(lowerName) ||
    lowerName.includes('arm64-v8a') ||
    lowerName.includes('arm64') ||
    lowerName.includes('aarch64') ||
    lowerName.includes('arm-64')
  ) {
    kienTruc = KienTrucChip.ARM64_V8A;
  }
  // B. ARM 32-bit (Android 32-bit đời cũ)
  else if (
    /(?:^|[-_.])(armeabi-v7a|armeabi|armv7a|armv7|arm32v7|arm32)(?:[-_.]|$)/i.test(lowerName) ||
    lowerName.includes('armeabi-v7a') ||
    lowerName.includes('armeabi') ||
    lowerName.includes('armv7') ||
    lowerName.includes('arm32v7') ||
    lowerName.includes('arm32')
  ) {
    kienTruc = KienTrucChip.ARMEABI_V7A;
  }
  // C. x86_64 (PC 64-bit hoặc Android x86_64 emulator) — BẮT BUỘC KIỂM TRA TRƯỚC x86!
  else if (
    /(?:^|[-_.])(x86_64|x86-64|x64|amd64|win64)(?:[-_.]|$)/i.test(lowerName) ||
    lowerName.includes('x86_64') ||
    lowerName.includes('amd64') ||
    lowerName.includes('win64') ||
    lowerName.includes('-x64') ||
    lowerName.includes('_x64')
  ) {
    kienTruc = KienTrucChip.X86_64;
  }
  // D. x86 (PC 32-bit hoặc Android x86 emulator)
  else if (
    /(?:^|[-_.])(x86|i386|i686|win32|ia32)(?:[-_.]|$)/i.test(lowerName) ||
    lowerName.includes('i386') ||
    lowerName.includes('i686') ||
    lowerName.includes('win32') ||
    lowerName.includes('-x86') ||
    lowerName.includes('_x86')
  ) {
    kienTruc = KienTrucChip.X86;
  }
  // E. Universal / All / Noarch
  else if (
    /(?:^|[-_.])(universal|all|noarch)(?:[-_.]|$)/i.test(lowerName) ||
    lowerName.includes('universal')
  ) {
    kienTruc = KienTrucChip.DUNG_CHUNG;
  }

  // 6. Quy tắc Fallback & Phát hiện biến thể mơ hồ (P2-22 & Post-Review #9):
  // - Nếu tên file chứa các biến thể mơ hồ (-fdroid, -google-play, -foss, -debug, -unsigned)
  //   mà không xác định được chip, giữ nguyên KHONG_XAC_DINH để kích hoạt Jev Choice (P2-33.7).
  const isAmbiguousVariant =
    /(?:^|[-_.])(fdroid|f-droid|foss|google-play|googleplay|play|debug|unsigned)(?:[-_.]|$)/i.test(
      lowerName,
    );

  if (kienTruc === KienTrucChip.KHONG_XAC_DINH && !isAmbiguousVariant) {
    if (dinhDang === DinhDangTep.APK) {
      kienTruc = KienTrucChip.DUNG_CHUNG;
    } else {
      kienTruc = KienTrucChip.X86_64;
    }
  }

  return {
    dinhDang,
    kienTruc,
    boQua: false,
  };
}

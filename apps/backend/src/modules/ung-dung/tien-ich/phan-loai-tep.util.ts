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
  } else if (extension === '.zip' || extension === '.7z') {
    const extUpper = extension === '.7z' ? '7Z' : 'ZIP';
    // L-04: File .zip/.7z chứa "installer" hoặc "setup" (tách theo ranh giới từ) là bộ cài nén,
    // KHÔNG được xếp vào ZIP_PORTABLE để tránh người dùng tải portable nhưng lại nhận được installer.
    const isZippedInstaller = /(?:^|[-_.])(installer|setup)(?:[-_.]|$)/i.test(lowerName);
    if (isZippedInstaller) {
      return {
        dinhDang: null,
        kienTruc: KienTrucChip.KHONG_XAC_DINH,
        boQua: true,
        lyDoBoQua: `Tệp ${extUpper} chứa bộ cài đặt (installer/setup), không phải bản portable độc lập`,
      };
    }

    // Tệp .zip/.7z chỉ được coi là bản cài Windows Portable nếu trong tên có chỉ thị Windows (P3B-17.6)
    const hasWindowsIndicator =
      /(?:^|[-_.])(win|windows|win32|win64|portable|winstore)(?:[-_.]|$)/i.test(lowerName) ||
      lowerName.includes('portable') ||
      lowerName.includes('windows') ||
      lowerName.includes('-win') ||
      lowerName.includes('_win');

    if (hasWindowsIndicator) {
      // P3B-17.6: Gộp trực tiếp .7z portable vào ZIP_PORTABLE (không thêm giá trị enum CSDL)
      dinhDang = DinhDangTep.ZIP_PORTABLE;
    } else {
      return {
        dinhDang: null,
        kienTruc: KienTrucChip.KHONG_XAC_DINH,
        boQua: true,
        lyDoBoQua: `Tệp ${extUpper} không chứa chỉ báo Windows Portable hợp lệ`,
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
  // B. ARM 32-bit (Android 32-bit đời cũ) - V3: Bổ sung nhãn arm đứng một mình
  else if (
    /(?:^|[-_.])(armeabi-v7a|armeabi|armv7a|armv7|arm32v7|arm32|arm)(?:[-_.]|$)/i.test(lowerName) ||
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

export interface ThongTinDiemUuTien {
  diem: number;
  hopMay: boolean;
  laCli: boolean;
  laDebug: boolean;
  laPhu: boolean;
}

/**
 * Kiểm tra xem tên tệp có chứa nhãn kiến trúc rõ ràng hay không.
 */
export function coNhanKienTrucRoRang(tenTep: string): boolean {
  const lower = tenTep.toLowerCase();
  return (
    /(?:^|[-_.])(x86_64|x86-64|x64|amd64|win64|x86|i386|i686|win32|ia32|arm64-v8a|arm64|aarch64|arm-64|armeabi-v7a|armeabi|armv7a|armv7|arm32v7|arm32|arm)(?:[-_.]|$)/i.test(
      lower,
    ) ||
    lower.includes('x86_64') ||
    lower.includes('amd64') ||
    lower.includes('-x64') ||
    lower.includes('_x64') ||
    lower.includes('win64') ||
    lower.includes('win32')
  );
}

/**
 * V1: Hậu xử lý kiến trúc các tệp trong cùng một bản phát hành theo ngữ cảnh (Context-Aware Architecture Resolution).
 *
 * Nếu trong cùng bản phát hành đã có tệp ghi rõ x64/amd64/win64/x86_64:
 * Các tệp Windows không ghi nhãn kiến trúc (ví dụ npp.8.9.8.1.Installer.exe hay portable.zip)
 * sẽ được gán là X86 (thay vì mặc định X86_64).
 * Chỉ khi cả bản phát hành không có tệp nào ghi kiến trúc thì mới giữ mặc định X86_64.
 */
export function hauXuLyKienTrucBanPhatHanh<
  T extends { tenTep: string; dinhDang?: DinhDangTep | null; kienTruc: KienTrucChip },
>(assets: T[]): T[] {
  if (!assets || assets.length === 0) return assets;

  // Kiểm tra xem trong các tệp Windows có tệp nào ghi rõ x64 không
  const coFileX64RoRang = assets.some((a) => {
    const isWindows =
      a.dinhDang === DinhDangTep.EXE ||
      a.dinhDang === DinhDangTep.MSI ||
      a.dinhDang === DinhDangTep.ZIP_PORTABLE;
    if (!isWindows) return false;
    const lower = a.tenTep.toLowerCase();
    return (
      /(?:^|[-_.])(x86_64|x86-64|x64|amd64|win64)(?:[-_.]|$)/i.test(lower) ||
      lower.includes('x86_64') ||
      lower.includes('amd64') ||
      lower.includes('-x64') ||
      lower.includes('_x64') ||
      lower.includes('win64')
    );
  });

  return assets.map((asset) => {
    const isWindows =
      asset.dinhDang === DinhDangTep.EXE ||
      asset.dinhDang === DinhDangTep.MSI ||
      asset.dinhDang === DinhDangTep.ZIP_PORTABLE;

    if (isWindows && coFileX64RoRang && !coNhanKienTrucRoRang(asset.tenTep)) {
      // Tệp không ghi rõ kiến trúc trong khi đã có file x64 riêng -> gán X86 (32-bit)
      return {
        ...asset,
        kienTruc: KienTrucChip.X86,
      };
    }
    return asset;
  });
}

/**
 * V2 + K2: Tính điểm ưu tiên cho từng tệp cài đặt và kiểm tra độ tương thích với máy khách.
 *
 * @param tenTep Tên tệp cài đặt (VD: LocalSend-1.18.2-windows-x86-64.exe)
 * @param dinhDang Định dạng tệp
 * @param kienTruc Kiến trúc chip của tệp
 * @param targetArch Kiến trúc CPU của máy khách (x86_64, aarch64, arm64-v8a...)
 */
export function tinhDiemUuTienTep(
  tenTep: string,
  _dinhDang: DinhDangTep,
  kienTruc: KienTrucChip,
  targetArch?: string | null,
): ThongTinDiemUuTien {
  const lower = tenTep.toLowerCase();

  // Chỉ giữ regex có ranh giới từ rõ ràng để không khớp nhầm vào các từ như "client", "click"
  const laCli = /(?:^|[-_.])cli(?:[-_.]|$)/i.test(lower);
  const laDebug = /(?:^|[-_.])debug(?:[-_.]|$)/i.test(lower);
  const laUnsigned = /(?:^|[-_.])unsigned(?:[-_.]|$)/i.test(lower);
  const laParallel = /(?:^|[-_.])parallel(?:[-_.]|$)/i.test(lower);
  const laSymbols = /(?:^|[-_.])(symbols|pdb|nominify)(?:[-_.]|$)/i.test(lower);
  const laPhu =
    laCli ||
    laDebug ||
    laUnsigned ||
    laParallel ||
    laSymbols ||
    /(?:^|[-_.])(amazon|play|legacy|english)(?:[-_.]|$)/i.test(lower);

  let diem = 100;

  // 1. Cộng điểm bộ cài chính quy
  if (/(?:^|[-_.])(setup|installer)(?:[-_.]|$)/i.test(lower)) {
    diem += 30;
  }
  if (/(?:^|[-_.])(release|signed)(?:[-_.]|$)/i.test(lower)) {
    diem += 20;
  }

  // 2. Trừ mạnh các biến thể phụ / rác / cli / debug
  if (laCli) diem -= 200;
  if (laDebug) diem -= 200;
  if (laUnsigned) diem -= 150;
  if (laParallel) diem -= 150;
  if (laSymbols) diem -= 200;
  if (/(?:^|[-_.])(amazon|play|legacy|english)(?:[-_.]|$)/i.test(lower)) {
    diem -= 30;
  }

  // 3. Đánh giá độ tương thích kiến trúc với máy khách (K2)
  let hopMay = true;
  const archNorm = targetArch ? targetArch.toLowerCase().trim() : 'x86_64'; // Mặc định PC là x86_64

  const isClientX64 = archNorm === 'x86_64' || archNorm === 'x64' || archNorm === 'amd64';
  const isClientArm64 = archNorm === 'aarch64' || archNorm === 'arm64' || archNorm === 'arm64-v8a';

  if (isClientX64) {
    if (kienTruc === KienTrucChip.X86_64) {
      diem += 100;
      hopMay = true;
    } else if (kienTruc === KienTrucChip.DUNG_CHUNG) {
      diem += 70;
      hopMay = true;
    } else if (kienTruc === KienTrucChip.X86) {
      diem += 40; // 32-bit chạy qua WoW64
      hopMay = true;
    } else if (kienTruc === KienTrucChip.ARM64_V8A || kienTruc === KienTrucChip.ARMEABI_V7A) {
      diem -= 120; // ARM trên máy x64
      hopMay = false;
    }
  } else if (isClientArm64) {
    if (kienTruc === KienTrucChip.ARM64_V8A) {
      diem += 100;
      hopMay = true;
    } else if (kienTruc === KienTrucChip.DUNG_CHUNG) {
      diem += 70;
      hopMay = true;
    } else if (kienTruc === KienTrucChip.ARMEABI_V7A) {
      diem += 40;
      hopMay = true;
    } else {
      diem -= 80;
      hopMay = false;
    }
  }

  return {
    diem,
    hopMay,
    laCli,
    laDebug,
    laPhu,
  };
}

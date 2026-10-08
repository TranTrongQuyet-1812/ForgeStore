/**
 * Tiện ích so sánh phiên bản phần mềm (SemVer, CalVer, GitHub Tags) thuần khiết không side-effect.
 * Hỗ trợ các trường hợp P3B-17:
 * - Tag không có số phiên bản (nightly, latest, continuous) so theo ngày phát hành & hash/size (P3B-17.3).
 * - File bị đóng gói lại (cùng version nhưng sha256 hoặc kích thước khác) (P3B-17.4).
 * - Hậu tố đóng gói (debug, release, universal) và số phiên bản thêm .0 (P3B-17.5).
 */

export interface ThongTinBanPhatHanhKiemTra {
  tenPhienBan: string;
  ngayPhatHanh?: Date | string | null;
  maBamSha256?: string | null;
  dungLuongBytes?: number | bigint | string | null;
}

/**
 * Các từ khóa nhận diện tag không có số phiên bản (P3B-17.3)
 */
const TAG_KHONG_CO_SO_SET = new Set([
  'nightly',
  'latest',
  'continuous',
  'dev',
  'develop',
  'master',
  'main',
  'canary',
  'daily',
  'rolling',
]);

/**
 * Kiểm tra xem một chuỗi tag có phải là tag không có số phiên bản hay không.
 */
export function laTagKhongCoSo(tag: string): boolean {
  if (!tag) return false;
  const clean = tag.trim().toLowerCase();
  if (TAG_KHONG_CO_SO_SET.has(clean)) return true;
  // Tag hoàn toàn không chứa bất kỳ chữ số nào
  return !/\d/.test(clean);
}

/**
 * Chuẩn hóa chuỗi phiên bản:
 * - Cắt khoảng trắng
 * - Loại bỏ tiền tố 'v' hoặc 'V' (ví dụ: 'v1.2.3' -> '1.2.3')
 * - Bỏ metadata build sau dấu '+' (ví dụ: '1.2.3+2024' -> '1.2.3')
 */
export function chuanHoaPhienBan(v: string): string {
  if (!v) return '';
  const firstPart = v.trim().replace(/^[vV]/, '').split('+')[0];
  return (firstPart ?? '').trim();
}

/**
 * Các nhãn đóng gói trung tính (không coi là prerelease hạ cấp)
 */
const PACKAGING_LABELS = new Set(['universal', 'release', 'stable', 'final', 'pro', 'lite']);

/**
 * Thứ tự ưu tiên của các cấp độ prerelease / packaging
 */
const LEVEL_ORDER: Record<string, number> = {
  alpha: 1,
  a: 1,
  debug: 1,
  beta: 2,
  b: 2,
  rc: 3,
  preview: 3,
  release: 4,
  stable: 4,
  final: 4,
};

/**
 * So sánh 2 chuỗi phiên bản a (hiện tại) và b (mục tiêu/mới).
 * @returns
 *   1 nếu b MỚI HƠN a (cần cập nhật)
 *  -1 nếu b CŨ HƠN a
 *   0 nếu a và b TƯƠNG ĐƯƠNG nhau
 */
export function soSanhPhienBan(a: string, b: string): number {
  const cleanA = chuanHoaPhienBan(a);
  const cleanB = chuanHoaPhienBan(b);

  if (cleanA === cleanB) {
    return 0;
  }

  // Tách phần phiên bản chính và phần tiền phát hành (prerelease, ví dụ: '1.0.0-beta.1')
  const partsA = cleanA.split('-');
  const mainA = partsA[0] ?? '';
  let preA = partsA.slice(1).join('-');

  const partsB = cleanB.split('-');
  const mainB = partsB[0] ?? '';
  let preB = partsB.slice(1).join('-');

  // Nếu hậu tố là nhãn đóng gói trung tính (universal, release, stable...), bỏ qua coi như bản chính thức
  if (preA && PACKAGING_LABELS.has(preA.toLowerCase())) {
    preA = '';
  }
  if (preB && PACKAGING_LABELS.has(preB.toLowerCase())) {
    preB = '';
  }

  // Tách các đoạn số/chữ của phần main (hỗ trợ cả dấu chấm '.' và gạch dưới '_')
  const segsA = mainA.split(/[._]/);
  const segsB = mainB.split(/[._]/);

  const maxLen = Math.max(segsA.length, segsB.length);

  for (let i = 0; i < maxLen; i++) {
    const rawPartA = segsA[i] ?? '0';
    const rawPartB = segsB[i] ?? '0';

    const numA = Number(rawPartA);
    const numB = Number(rawPartB);

    const isNumA = !isNaN(numA) && rawPartA.trim() !== '';
    const isNumB = !isNaN(numB) && rawPartB.trim() !== '';

    if (isNumA && isNumB) {
      if (numB > numA) return 1;
      if (numB < numA) return -1;
    } else {
      // So sánh theo thứ tự từ điển nếu có ký tự chữ
      const cmp = rawPartB.localeCompare(rawPartA, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (cmp !== 0) {
        return cmp > 0 ? 1 : -1;
      }
    }
  }

  // Nếu phần main bằng nhau, xét đến prerelease
  // Quy tắc SemVer: Bản chính thức (không có prerelease) MỚI HƠN bản prerelease
  if (preA && !preB) {
    // b là bản chính thức, a là prerelease -> b mới hơn a
    return 1;
  }
  if (!preA && preB) {
    // a là bản chính thức, b là prerelease -> b cũ hơn a
    return -1;
  }

  if (preA && preB) {
    const extractLevel = (p: string) => {
      const match = p
        .toLowerCase()
        .match(/^(alpha|beta|rc|preview|debug|release|stable|final|[a-z]+)/);
      const tag = match && match[1] ? match[1] : '';
      return tag && tag in LEVEL_ORDER ? LEVEL_ORDER[tag]! : 0;
    };

    const lvlA = extractLevel(preA);
    const lvlB = extractLevel(preB);

    if (lvlB > lvlA) return 1;
    if (lvlB < lvlA) return -1;

    // Cùng level -> so sánh từ điển số tự nhiên
    const cmp = preB.localeCompare(preA, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) {
      return cmp > 0 ? 1 : -1;
    }
  }

  return 0;
}

/**
 * Kiểm tra xem phiên bản mới (b) có thực sự mới hơn phiên bản hiện tại (a) hay không (so sánh chuỗi thuần túy).
 */
export function coBanMoiHon(phienBanHienTai: string, phienBanMoi: string): boolean {
  return soSanhPhienBan(phienBanHienTai, phienBanMoi) > 0;
}

/**
 * Chuyển đổi an toàn dung lượng tệp sang BigInt (chống SyntaxError và tràn số - SEC-P3B17-03)
 */
export function parseBigIntAnToan(val: number | bigint | string | null | undefined): bigint | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'bigint') return val;
  try {
    if (typeof val === 'number') {
      if (isNaN(val) || !isFinite(val)) return null;
      return BigInt(Math.trunc(val));
    }
    const str = val.toString().trim().split('.')[0];
    return str ? BigInt(str) : null;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra toàn diện xem có bản phát hành cập nhật hay không (P3B-17.3 & P3B-17.4).
 * Nhận diện:
 * 1. SemVer mới hơn thông thường.
 * 2. Tag không có số phiên bản (nightly, latest, continuous): So theo ngày phát hành & hash/size.
 * 3. File bị đóng gói lại (cùng version nhưng sha256 hoặc kích thước khác).
 */
export function kiemTraCoBanCapNhat(
  banHienTai: ThongTinBanPhatHanhKiemTra | string,
  banMoiNhat: ThongTinBanPhatHanhKiemTra | string,
): {
  coBanCapNhat: boolean;
  lyDo?: 'PHIEN_BAN_MOI' | 'NGAY_PHAT_HANH_MOI' | 'FILE_DONG_GOI_LAI' | 'KHONG_CO_CAP_NHAT';
} {
  const infoA: ThongTinBanPhatHanhKiemTra =
    typeof banHienTai === 'string' ? { tenPhienBan: banHienTai } : banHienTai;
  const infoB: ThongTinBanPhatHanhKiemTra =
    typeof banMoiNhat === 'string' ? { tenPhienBan: banMoiNhat } : banMoiNhat;

  const verA = infoA.tenPhienBan || '';
  const verB = infoB.tenPhienBan || '';

  // 1. Kiểm tra trường hợp tag không có số phiên bản (P3B-17.3)
  const aLaKhongSo = laTagKhongCoSo(verA);
  const bLaKhongSo = laTagKhongCoSo(verB);

  if (aLaKhongSo || bLaKhongSo) {
    // Khi có ít nhất 1 tag không có số:
    // A. So theo ngày phát hành
    if (infoA.ngayPhatHanh && infoB.ngayPhatHanh) {
      const dateA = new Date(infoA.ngayPhatHanh).getTime();
      const dateB = new Date(infoB.ngayPhatHanh).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) {
        if (dateB > dateA) {
          return { coBanCapNhat: true, lyDo: 'NGAY_PHAT_HANH_MOI' };
        }
        if (dateB < dateA) {
          return { coBanCapNhat: false, lyDo: 'KHONG_CO_CAP_NHAT' };
        }
      }
    }

    // B. Nếu cùng tag (ví dụ cùng 'nightly') hoặc cùng ngày: kiểm tra mã băm SHA-256
    if (infoA.maBamSha256 && infoB.maBamSha256) {
      if (infoA.maBamSha256.trim().toLowerCase() !== infoB.maBamSha256.trim().toLowerCase()) {
        return { coBanCapNhat: true, lyDo: 'FILE_DONG_GOI_LAI' };
      }
    }

    // C. Kiểm tra dung lượng tệp nếu khác nhau (SEC-P3B17-03)
    const bytesA = parseBigIntAnToan(infoA.dungLuongBytes);
    const bytesB = parseBigIntAnToan(infoB.dungLuongBytes);
    if (bytesA !== null && bytesB !== null && bytesA !== bytesB) {
      return { coBanCapNhat: true, lyDo: 'FILE_DONG_GOI_LAI' };
    }

    // Nếu thông tin giống hệt nhau hoặc không xác định được
    return { coBanCapNhat: false, lyDo: 'KHONG_CO_CAP_NHAT' };
  }

  // 2. So sánh phiên bản SemVer/CalVer chuẩn
  const cmp = soSanhPhienBan(verA, verB);
  if (cmp > 0) {
    return { coBanCapNhat: true, lyDo: 'PHIEN_BAN_MOI' };
  }

  // 3. Trường hợp cùng số phiên bản nhưng file bị đóng gói lại (P3B-17.4 & SEC-P3B17-03, 05)
  if (cmp === 0) {
    if (infoA.maBamSha256 && infoB.maBamSha256) {
      if (infoA.maBamSha256.trim().toLowerCase() !== infoB.maBamSha256.trim().toLowerCase()) {
        return { coBanCapNhat: true, lyDo: 'FILE_DONG_GOI_LAI' };
      }
    }

    const bytesA = parseBigIntAnToan(infoA.dungLuongBytes);
    const bytesB = parseBigIntAnToan(infoB.dungLuongBytes);
    if (bytesA !== null && bytesB !== null && bytesA !== bytesB) {
      return { coBanCapNhat: true, lyDo: 'FILE_DONG_GOI_LAI' };
    }
  }

  return { coBanCapNhat: false, lyDo: 'KHONG_CO_CAP_NHAT' };
}

import { DinhDangTep, KienTrucChip } from '@forgestore/types';
import { soSanhPhienBan } from '../../cap-nhat/tien-ich/so-sanh-phien-ban.util';

export const DINH_DANG_WINDOWS: readonly DinhDangTep[] = [
  DinhDangTep.EXE,
  DinhDangTep.MSI,
  DinhDangTep.ZIP_PORTABLE,
] as const;

export const DINH_DANG_ANDROID: readonly DinhDangTep[] = [DinhDangTep.APK] as const;

export interface TepCaiDatToiThieu {
  dinhDangTep: DinhDangTep;
  [key: string]: unknown;
}

export interface BanPhatHanhToiThieu<T extends TepCaiDatToiThieu = TepCaiDatToiThieu> {
  tenPhienBan: string;
  ngayPhatHanh: Date | string;
  laBanThuNghiem?: boolean;
  danhSachTepCaiDat: T[];
  [key: string]: unknown;
}

export interface TuyChonLocPhatHanh {
  /**
   * Ưu tiên loại bỏ bản thử nghiệm (pre-release), trừ khi toàn bộ các bản đều là thử nghiệm.
   * Mặc định: true
   */
  uuTienBanChinhThuc?: boolean;
  /**
   * Lọc danh sách tệp bên trong từng bản phát hành, chỉ giữ lại tệp thuộc nền tảng đang xem.
   * Mặc định: false
   */
  chiGiuTepTheoNenTang?: boolean;
  /**
   * Nếu toàn bộ các bản phát hành đều không có tệp nào (ví dụ mock test hoặc chưa nạp asset),
   * fallback sắp xếp theo SemVer thay vì trả về rỗng.
   * Mặc định: true
   */
  fallbackSemVerKhiKhongCoTep?: boolean;
}

/**
 * Chuẩn hóa tham số nền tảng thành 'WINDOWS' | 'ANDROID' | null.
 */
export function chuanHoaNenTang(platform?: string | null): 'WINDOWS' | 'ANDROID' | null {
  if (!platform) return null;
  const p = platform.trim().toLowerCase();
  if (p === 'windows' || p === 'win') return 'WINDOWS';
  if (p === 'android' || p === 'apk') return 'ANDROID';
  return null;
}

/**
 * Kiểm tra xem một định dạng tệp có thuộc nền tảng chỉ định hay không.
 */
export function kiemTraTepThuocNenTang(
  dinhDang: DinhDangTep,
  nenTang: 'WINDOWS' | 'ANDROID' | null,
): boolean {
  if (!nenTang) return true;
  if (nenTang === 'WINDOWS') {
    return DINH_DANG_WINDOWS.includes(dinhDang);
  }
  if (nenTang === 'ANDROID') {
    return DINH_DANG_ANDROID.includes(dinhDang);
  }
  return true;
}

/**
 * Lọc và sắp xếp các bản phát hành theo nền tảng và số phiên bản SemVer (N1 + K1).
 *
 * Tiêu chí:
 * 1. Bản phát hành phải có ít nhất 1 tệp cài đặt phù hợp với nền tảng đang xem.
 * 2. Bản không có tệp cài đặt nào bị loại bỏ hoàn toàn khỏi ứng viên bản mới nhất nếu có bản khác có tệp.
 * 3. Ưu tiên bản phát hành chính thức (laBanThuNghiem === false) trước bản thử nghiệm.
 * 4. Sắp xếp phiên bản theo SemVer (soSanhPhienBan). Nếu tương đương, sắp xếp theo ngayPhatHanh giảm dần.
 */
export function locVaSapXepBanPhatHanh<
  TAsset extends TepCaiDatToiThieu,
  TRelease extends BanPhatHanhToiThieu<TAsset>,
>(releases: TRelease[], platform?: string | null, options: TuyChonLocPhatHanh = {}): TRelease[] {
  if (!releases || releases.length === 0) {
    return [];
  }

  const nenTang = chuanHoaNenTang(platform);
  const uuTienBanChinhThuc = options.uuTienBanChinhThuc ?? true;
  const chiGiuTepTheoNenTang = options.chiGiuTepTheoNenTang ?? false;
  const fallbackSemVerKhiKhongCoTep = options.fallbackSemVerKhiKhongCoTep ?? true;

  // 1. Lọc và chuẩn hóa tệp đính kèm theo nền tảng
  const validReleases: TRelease[] = [];

  for (const rel of releases) {
    const rawAssets = rel.danhSachTepCaiDat;

    // Nếu release không khai báo trường danhSachTepCaiDat (undefined)
    if (!rawAssets) {
      validReleases.push(rel);
      continue;
    }

    // Lọc các tệp thuộc nền tảng đang xét
    const matchingAssets = nenTang
      ? rawAssets.filter((a) => kiemTraTepThuocNenTang(a.dinhDangTep, nenTang))
      : rawAssets.filter((a) =>
          [...DINH_DANG_WINDOWS, ...DINH_DANG_ANDROID].includes(a.dinhDangTep),
        );

    // Bắt buộc phải có ít nhất 1 tệp cài đặt hợp lệ (N1.3: Bản không có file cài không được xuất hiện)
    if (matchingAssets.length > 0) {
      if (chiGiuTepTheoNenTang) {
        validReleases.push({
          ...rel,
          danhSachTepCaiDat: matchingAssets as TRelease['danhSachTepCaiDat'],
        });
      } else {
        validReleases.push(rel);
      }
    }
  }

  // 2. Nếu không tìm thấy bản nào có tệp khớp nền tảng
  let candidateReleases = validReleases;
  if (candidateReleases.length === 0) {
    const tatCaDeuKhongCoTep = releases.every(
      (r) => !r.danhSachTepCaiDat || r.danhSachTepCaiDat.length === 0,
    );
    // Nếu toàn bộ các bản đều không có tệp (mock test hoặc repo chưa up asset nhị phân)
    if (tatCaDeuKhongCoTep && fallbackSemVerKhiKhongCoTep) {
      candidateReleases = releases;
    } else {
      return [];
    }
  }

  // 3. Tách nhóm bản chính thức và bản thử nghiệm nếu được yêu cầu
  if (uuTienBanChinhThuc) {
    const officialReleases = candidateReleases.filter((r) => !r.laBanThuNghiem);
    // Chỉ ưu tiên nếu tồn tại ít nhất 1 bản chính thức có file cài
    if (officialReleases.length > 0) {
      candidateReleases = officialReleases;
    }
  }

  // 3. Sắp xếp theo SemVer (soSanhPhienBan), fallback sang ngayPhatHanh (N1.2)
  const sorted = [...candidateReleases].sort((a, b) => {
    // Nếu vẫn còn cả bản chính thức và thử nghiệm, bản chính thức đứng trước
    if (!a.laBanThuNghiem && b.laBanThuNghiem) return -1;
    if (a.laBanThuNghiem && !b.laBanThuNghiem) return 1;

    // So sánh SemVer: soSanhPhienBan(a, b) > 0 nghĩa là b mới hơn a -> b đứng trước a
    const cmp = soSanhPhienBan(a.tenPhienBan, b.tenPhienBan);
    if (cmp !== 0) {
      return cmp > 0 ? 1 : -1;
    }

    // Fallback sang ngày phát hành nếu phiên bản không phân định được
    const timeA = new Date(a.ngayPhatHanh).getTime();
    const timeB = new Date(b.ngayPhatHanh).getTime();
    return timeB - timeA;
  });

  return sorted;
}

/**
 * Trích xuất bản phát hành mới nhất theo nền tảng.
 */
export function layBanPhatHanhMoiNhat<
  TAsset extends TepCaiDatToiThieu,
  TRelease extends BanPhatHanhToiThieu<TAsset>,
>(releases: TRelease[], platform?: string | null): TRelease | null {
  const sorted = locVaSapXepBanPhatHanh(releases, platform, {
    uuTienBanChinhThuc: true,
    chiGiuTepTheoNenTang: true,
  });
  return sorted[0] ?? null;
}

/**
 * Trích xuất danh sách định dạng và kiến trúc chip thực tế từ các tệp cài đặt (L-03)
 */
export function trichXuatDinhDangVaKienTruc(
  danhSachTep?: Array<{
    dinhDangTep: DinhDangTep | string;
    kienTrucChip?: KienTrucChip | string | null;
  }>,
): { dinhDangCoSan: string[]; kienTrucCoSan: string[] } {
  if (!danhSachTep || danhSachTep.length === 0) {
    return { dinhDangCoSan: [], kienTrucCoSan: [] };
  }

  const dinhDangSet = new Set<string>();
  const kienTrucSet = new Set<string>();

  for (const t of danhSachTep) {
    const fmt = String(t.dinhDangTep).toUpperCase();
    if (fmt === 'EXE') dinhDangSet.add('EXE');
    else if (fmt === 'MSI') dinhDangSet.add('MSI');
    else if (fmt === 'ZIP_PORTABLE' || fmt === 'ZIP') dinhDangSet.add('ZIP');
    else if (fmt === 'APK') dinhDangSet.add('APK');

    if (t.kienTrucChip) {
      const arch = String(t.kienTrucChip).toUpperCase();
      if (arch === 'X86_64') kienTrucSet.add('x64');
      else if (arch === 'ARM64_V8A' || arch === 'ARM64') kienTrucSet.add('ARM64');
      else if (arch === 'X86') kienTrucSet.add('x86');
      else if (arch === 'DUNG_CHUNG' || arch === 'UNIVERSAL') kienTrucSet.add('Universal');
    }
  }

  const THU_TU_DINH_DANG = ['EXE', 'MSI', 'ZIP', 'APK'];
  const dinhDangCoSan = THU_TU_DINH_DANG.filter((d) => dinhDangSet.has(d));

  const THU_TU_KIEN_TRUC = ['x64', 'ARM64', 'x86', 'Universal'];
  const kienTrucCoSan = THU_TU_KIEN_TRUC.filter((k) => kienTrucSet.has(k));

  return { dinhDangCoSan, kienTrucCoSan };
}

import { describe, it, expect } from 'vitest';
import {
  soSanhPhienBan,
  coBanMoiHon,
  chuanHoaPhienBan,
  laTagKhongCoSo,
  kiemTraCoBanCapNhat,
  parseBigIntAnToan,
} from './version-comparator.util';

describe('VersionComparatorUtil (P2-52 & P3B-17)', () => {
  describe('chuanHoaPhienBan', () => {
    it('loại bỏ tiền tố v, V và cắt khoảng trắng', () => {
      expect(chuanHoaPhienBan('v1.2.3')).toBe('1.2.3');
      expect(chuanHoaPhienBan('V2.0.0')).toBe('2.0.0');
      expect(chuanHoaPhienBan('  v1.0  ')).toBe('1.0');
    });

    it('loại bỏ build metadata sau dấu +', () => {
      expect(chuanHoaPhienBan('1.2.3+build.2024')).toBe('1.2.3');
      expect(chuanHoaPhienBan('v1.0.0-beta+exp.sha.5114f85')).toBe('1.0.0-beta');
    });
  });

  describe('laTagKhongCoSo (P3B-17.3)', () => {
    it('nhận diện chính xác các tag không có số phiên bản', () => {
      expect(laTagKhongCoSo('nightly')).toBe(true);
      expect(laTagKhongCoSo('latest')).toBe(true);
      expect(laTagKhongCoSo('continuous')).toBe(true);
      expect(laTagKhongCoSo('dev')).toBe(true);
      expect(laTagKhongCoSo('master')).toBe(true);
      expect(laTagKhongCoSo('canary')).toBe(true);
      expect(laTagKhongCoSo('rolling')).toBe(true);
    });

    it('từ chối các tag có chứa số phiên bản', () => {
      expect(laTagKhongCoSo('v1.0.0')).toBe(false);
      expect(laTagKhongCoSo('2.3.4')).toBe(false);
      expect(laTagKhongCoSo('v2024.10.05')).toBe(false);
      expect(laTagKhongCoSo('nightly-20241008')).toBe(false);
    });
  });

  describe('soSanhPhienBan & coBanMoiHon (Bao gồm các ca thử P3B-17.5)', () => {
    const testCases: Array<{
      current: string;
      target: string;
      expectedCmp: number; // 1: target > current, -1: target < current, 0: bằng nhau
      description: string;
    }> = [
      // 1. SemVer 3 số thông thường
      {
        current: '1.0.0',
        target: '1.0.1',
        expectedCmp: 1,
        description: '1.0.1 mới hơn 1.0.0 (patch)',
      },
      {
        current: '1.0.1',
        target: '1.1.0',
        expectedCmp: 1,
        description: '1.1.0 mới hơn 1.0.1 (minor)',
      },
      {
        current: '1.9.9',
        target: '2.0.0',
        expectedCmp: 1,
        description: '2.0.0 mới hơn 1.9.9 (major)',
      },
      { current: '2.0.0', target: '1.9.9', expectedCmp: -1, description: '1.9.9 cũ hơn 2.0.0' },

      // 2. Tiền tố v và V
      { current: 'v1.2.0', target: 'v1.2.1', expectedCmp: 1, description: 'v1.2.1 mới hơn v1.2.0' },
      {
        current: 'v1.2.0',
        target: '1.2.0',
        expectedCmp: 0,
        description: 'v1.2.0 và 1.2.0 tương đương',
      },
      { current: 'V3.0.0', target: 'v3.0.1', expectedCmp: 1, description: 'v3.0.1 mới hơn V3.0.0' },

      // 3. Thiếu số đoạn (2 số so với 3 số) & P3B-17.5 số phiên bản thêm .0
      { current: 'v1.2', target: '1.2.0', expectedCmp: 0, description: 'v1.2 tương đương 1.2.0' },
      { current: '1.0', target: '1.0.0', expectedCmp: 0, description: '1.0 tương đương 1.0.0' },
      {
        current: '1.0.0',
        target: '1.0.0.0',
        expectedCmp: 0,
        description: '1.0.0 tương đương 1.0.0.0',
      },
      { current: '1.2.0.0', target: '1.2', expectedCmp: 0, description: '1.2.0.0 tương đương 1.2' },
      { current: '1.2.0', target: '1.2.0.1', expectedCmp: 1, description: '1.2.0.1 mới hơn 1.2.0' },
      { current: '1.2', target: '1.2.1', expectedCmp: 1, description: '1.2.1 mới hơn 1.2' },
      { current: '1.3', target: '1.2.9', expectedCmp: -1, description: '1.2.9 cũ hơn 1.3' },

      // 4. CalVer dạng ngày (YYYY.MM.DD)
      {
        current: '2024.05.01',
        target: '2024.05.02',
        expectedCmp: 1,
        description: '2024.05.02 mới hơn 2024.05.01',
      },
      {
        current: '2024.05.01',
        target: '2024.10.2',
        expectedCmp: 1,
        description: '2024.10.2 mới hơn 2024.05.01',
      },
      {
        current: '2024.12.31',
        target: '2025.01.01',
        expectedCmp: 1,
        description: '2025.01.01 mới hơn 2024.12.31',
      },
      {
        current: '2024_05_01',
        target: '2024_05_10',
        expectedCmp: 1,
        description: 'CalVer phân cách bằng dấu gạch dưới',
      },

      // 5. Prerelease so với Bản chính thức & P3B-17.5 chữ đóng gói (debug, release, universal)
      {
        current: '1.0.0-beta',
        target: '1.0.0',
        expectedCmp: 1,
        description: 'Bản chính thức 1.0.0 mới hơn 1.0.0-beta',
      },
      {
        current: '1.0.0',
        target: '1.0.0-beta',
        expectedCmp: -1,
        description: 'Bản 1.0.0-beta cũ hơn bản chính thức 1.0.0',
      },
      {
        current: '1.0.0-alpha',
        target: '1.0.0-beta',
        expectedCmp: 1,
        description: 'beta mới hơn alpha',
      },
      {
        current: '1.0.0-beta.1',
        target: '1.0.0-beta.2',
        expectedCmp: 1,
        description: 'beta.2 mới hơn beta.1',
      },
      {
        current: '1.0.0-beta.9',
        target: '1.0.0-beta.10',
        expectedCmp: 1,
        description: 'beta.10 mới hơn beta.9 (numeric order)',
      },
      {
        current: '1.0.0-beta',
        target: '1.0.0-rc.1',
        expectedCmp: 1,
        description: 'rc.1 mới hơn beta',
      },
      {
        current: '1.0.0-rc.1',
        target: '1.0.0-rc.2',
        expectedCmp: 1,
        description: 'rc.2 mới hơn rc.1',
      },
      {
        current: '1.0.0-debug',
        target: '1.0.0-release',
        expectedCmp: 1,
        description: 'bản release mới hơn bản debug',
      },
      {
        current: '1.0.0-release',
        target: '1.0.0',
        expectedCmp: 0,
        description: 'bản release và bản không hậu tố tương đương nhau',
      },
      {
        current: '1.0.0-universal',
        target: '1.0.0',
        expectedCmp: 0,
        description: 'bản universal và bản thường tương đương nhau',
      },

      // 6. Build Metadata
      {
        current: '1.0.0+20240101',
        target: '1.0.0+20240201',
        expectedCmp: 0,
        description: 'Build metadata không ảnh hưởng thứ tự phiên bản',
      },

      // 7. Hậu tố riêng nền tảng (Android / F-Droid)
      {
        current: '1.2.3-fdroid',
        target: '1.2.4-fdroid',
        expectedCmp: 1,
        description: '1.2.4-fdroid mới hơn 1.2.3-fdroid',
      },
      {
        current: '1.2.3-android',
        target: '1.2.3-android',
        expectedCmp: 0,
        description: '1.2.3-android bằng nhau',
      },

      // 8. Chuỗi đặc biệt & Trường hợp biên
      {
        current: '0.9.9',
        target: '1.0.0-alpha',
        expectedCmp: 1,
        description: '1.0.0-alpha mới hơn 0.9.9',
      },
      {
        current: '',
        target: '1.0.0',
        expectedCmp: 1,
        description: 'Bản rỗng so với 1.0.0 thì 1.0.0 mới hơn',
      },
      {
        current: 'legacy',
        target: 'legacy',
        expectedCmp: 0,
        description: 'Chuỗi text giống nhau thì bằng nhau',
      },
    ];

    testCases.forEach(({ current, target, expectedCmp, description }, idx) => {
      it(`Case #${idx + 1}: ${description} (${current} vs ${target})`, () => {
        const cmp = soSanhPhienBan(current, target);
        expect(cmp).toBe(expectedCmp);

        if (expectedCmp === 1) {
          expect(coBanMoiHon(current, target)).toBe(true);
        } else {
          expect(coBanMoiHon(current, target)).toBe(false);
        }
      });
    });
  });

  describe('kiemTraCoBanCapNhat (P3B-17.3 & P3B-17.4)', () => {
    it('báo có bản cập nhật khi tag nightly có ngày phát hành mới hơn', () => {
      const hienTai = {
        tenPhienBan: 'nightly',
        ngayPhatHanh: '2026-10-01T00:00:00Z',
      };
      const moi = {
        tenPhienBan: 'nightly',
        ngayPhatHanh: '2026-10-02T00:00:00Z',
      };
      const res = kiemTraCoBanCapNhat(hienTai, moi);
      expect(res.coBanCapNhat).toBe(true);
      expect(res.lyDo).toBe('NGAY_PHAT_HANH_MOI');
    });

    it('không báo cập nhật khi tag nightly cùng ngày phát hành và cùng hash', () => {
      const hienTai = {
        tenPhienBan: 'nightly',
        ngayPhatHanh: '2026-10-01T00:00:00Z',
        maBamSha256: 'abc123hash',
      };
      const moi = {
        tenPhienBan: 'nightly',
        ngayPhatHanh: '2026-10-01T00:00:00Z',
        maBamSha256: 'abc123hash',
      };
      const res = kiemTraCoBanCapNhat(hienTai, moi);
      expect(res.coBanCapNhat).toBe(false);
    });

    it('báo có bản cập nhật khi tag continuous có hash SHA-256 khác nhau', () => {
      const hienTai = {
        tenPhienBan: 'continuous',
        maBamSha256: 'sha256_old',
      };
      const moi = {
        tenPhienBan: 'continuous',
        maBamSha256: 'sha256_new',
      };
      const res = kiemTraCoBanCapNhat(hienTai, moi);
      expect(res.coBanCapNhat).toBe(true);
      expect(res.lyDo).toBe('FILE_DONG_GOI_LAI');
    });

    it('báo có bản cập nhật khi cùng số phiên bản nhưng file bị đóng gói lại (P3B-17.4)', () => {
      const hienTai = {
        tenPhienBan: 'v1.2.3',
        maBamSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        dungLuongBytes: 15000000,
      };
      const moi = {
        tenPhienBan: 'v1.2.3',
        maBamSha256: 'a1b2c3d4e5f60000000000000000000000000000000000000000000000000000',
        dungLuongBytes: 15000000,
      };
      const res = kiemTraCoBanCapNhat(hienTai, moi);
      expect(res.coBanCapNhat).toBe(true);
      expect(res.lyDo).toBe('FILE_DONG_GOI_LAI');
    });

    it('báo có bản cập nhật khi cùng số phiên bản nhưng dung lượng byte khác nhau', () => {
      const hienTai = {
        tenPhienBan: '2.0.0',
        dungLuongBytes: 1048576,
      };
      const moi = {
        tenPhienBan: '2.0.0',
        dungLuongBytes: 2097152,
      };
      const res = kiemTraCoBanCapNhat(hienTai, moi);
      expect(res.coBanCapNhat).toBe(true);
      expect(res.lyDo).toBe('FILE_DONG_GOI_LAI');
    });

    it('báo có bản cập nhật khi phiên bản SemVer mới hơn thông thường', () => {
      const res = kiemTraCoBanCapNhat('1.0.0', '1.1.0');
      expect(res.coBanCapNhat).toBe(true);
      expect(res.lyDo).toBe('PHIEN_BAN_MOI');
    });

    it('không báo cập nhật khi sha256 giống nhau nhưng có khoảng trắng hoặc khác hoa thường (SEC-P3B17-05)', () => {
      const hienTai = {
        tenPhienBan: '1.2.3',
        maBamSha256: '  E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855 \n',
      };
      const moi = {
        tenPhienBan: '1.2.3',
        maBamSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };
      const res = kiemTraCoBanCapNhat(hienTai, moi);
      expect(res.coBanCapNhat).toBe(false);
      expect(res.lyDo).toBe('KHONG_CO_CAP_NHAT');
    });
  });

  describe('parseBigIntAnToan (SEC-P3B17-03)', () => {
    it('chuyển đổi an toàn number, string, bigint hợp lệ', () => {
      expect(parseBigIntAnToan(1048576)).toBe(1048576n);
      expect(parseBigIntAnToan('1048576')).toBe(1048576n);
      expect(parseBigIntAnToan(1048576n)).toBe(1048576n);
    });

    it('xử lý an toàn số thực hoặc chuỗi có phần thập phân', () => {
      expect(parseBigIntAnToan(1048576.89)).toBe(1048576n);
      expect(parseBigIntAnToan('1048576.89')).toBe(1048576n);
    });

    it('trả về null an toàn khi dữ liệu rác hoặc không hợp lệ', () => {
      expect(parseBigIntAnToan(null)).toBeNull();
      expect(parseBigIntAnToan(undefined)).toBeNull();
      expect(parseBigIntAnToan('invalid-bytes')).toBeNull();
      expect(parseBigIntAnToan(NaN)).toBeNull();
      expect(parseBigIntAnToan(Infinity)).toBeNull();
    });
  });
});

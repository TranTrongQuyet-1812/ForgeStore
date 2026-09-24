import { describe, it, expect } from 'vitest';
import { soSanhPhienBan, coBanMoiHon, chuanHoaPhienBan } from './version-comparator.util';

describe('VersionComparatorUtil (P2-52)', () => {
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

  describe('soSanhPhienBan & coBanMoiHon (Tối thiểu 20 cặp phiên bản theo P2-52.5)', () => {
    // Định nghĩa bảng 25 cặp phiên bản kiểm thử
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

      // 3. Thiếu số đoạn (2 số so với 3 số)
      { current: 'v1.2', target: '1.2.0', expectedCmp: 0, description: 'v1.2 tương đương 1.2.0' },
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

      // 5. Prerelease so với Bản chính thức (SemVer rule: Official > Prerelease)
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
});

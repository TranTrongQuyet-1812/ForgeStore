import { describe, it, expect } from 'vitest';
import { phanLoaiTep } from './file-classifier.util';
import { DinhDangTep, KienTrucChip } from '@forgestore/types';

describe('P2-22: phanLoaiTep (Bộ phân loại file cài đặt)', () => {
  // Bảng test case với hơn 35 tên file thực tế từ các repo nổi tiếng
  const DANH_SACH_TEST_FILE_THAT = [
    // --- RustDesk ---
    {
      tenTep: 'rustdesk-1.2.3-x86_64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'rustdesk-1.2.3-x86.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86, boQua: false },
    },
    {
      tenTep: 'rustdesk-1.2.3-arm64-v8a.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },
    {
      tenTep: 'rustdesk-1.2.3-windows-x86_64.zip',
      expected: { dinhDang: DinhDangTep.ZIP_PORTABLE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },

    // --- VLC Media Player ---
    {
      tenTep: 'vlc-3.0.18-win64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'vlc-3.0.18-win32.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86, boQua: false },
    },
    {
      tenTep: 'VLC-Android-3.5.4-arm64-v8a.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },
    {
      tenTep: 'VLC-Android-3.5.4-armeabi-v7a.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARMEABI_V7A, boQua: false },
    },
    {
      tenTep: 'VLC-Android-3.5.4-all.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.DUNG_CHUNG, boQua: false },
    },

    // --- LocalSend ---
    {
      tenTep: 'LocalSend-1.14.0-windows-x86-64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'LocalSend-1.14.0-windows-portable.zip',
      expected: { dinhDang: DinhDangTep.ZIP_PORTABLE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'LocalSend-1.14.0-android-arm64.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },
    {
      tenTep: 'LocalSend-1.14.0-android-universal.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.DUNG_CHUNG, boQua: false },
    },

    // --- KeePassXC ---
    {
      tenTep: 'KeePassXC-2.7.6-Win64.msi',
      expected: { dinhDang: DinhDangTep.MSI, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'KeePassXC-2.7.6-Win64-portable.zip',
      expected: { dinhDang: DinhDangTep.ZIP_PORTABLE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'KeePassXC-2.7.6-Win32.msi',
      expected: { dinhDang: DinhDangTep.MSI, kienTruc: KienTrucChip.X86, boQua: false },
    },

    // --- 7-Zip ---
    {
      tenTep: '7z2301-x64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: '7z2301-x64.msi',
      expected: { dinhDang: DinhDangTep.MSI, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: '7z2301-arm64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },

    // --- Obsidian ---
    {
      tenTep: 'Obsidian.1.5.3.exe',
      // Mặc định Windows không ghi chip -> X86_64
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'Obsidian-1.5.3-arm64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },

    // --- Mihon / Tachiyomi ---
    {
      tenTep: 'mihon-v0.16.3.apk',
      // Mặc định APK không ghi chip -> DUNG_CHUNG
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.DUNG_CHUNG, boQua: false },
    },
    {
      tenTep: 'mihon-v0.16.3-arm64-v8a.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },
    {
      tenTep: 'mihon-v0.16.3-armeabi-v7a.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARMEABI_V7A, boQua: false },
    },
    {
      tenTep: 'mihon-v0.16.3-x86_64.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.X86_64, boQua: false },
    },
    {
      tenTep: 'mihon-v0.16.3-x86.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.X86, boQua: false },
    },

    // --- RetroArch ---
    {
      tenTep: 'RetroArch_aarch64.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },
    {
      tenTep: 'RetroArch-armv7a.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARMEABI_V7A, boQua: false },
    },

    // --- Revanced Manager & AntennaPod ---
    {
      tenTep: 'revanced-manager-v1.18.0.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.DUNG_CHUNG, boQua: false },
    },
    {
      tenTep: 'AntennaPod_3.2.0.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.DUNG_CHUNG, boQua: false },
    },

    // --- CÁC TỆP PHẢI BỎ QUA (IGNORE CASES) ---
    { tenTep: 'rustdesk-1.2.3-x86_64.deb', expected: { boQua: true } },
    { tenTep: 'rustdesk-1.2.3-aarch64.rpm', expected: { boQua: true } },
    { tenTep: 'rustdesk-1.2.3-x86_64.AppImage', expected: { boQua: true } },
    { tenTep: 'rustdesk-1.2.3.dmg', expected: { boQua: true } },
    { tenTep: 'rustdesk-1.2.3-mac-universal.pkg', expected: { boQua: true } },
    { tenTep: 'LocalSend-1.14.0-macOS.dmg', expected: { boQua: true } },
    { tenTep: 'LocalSend-1.14.0-linux-x86-64.tar.gz', expected: { boQua: true } },
    { tenTep: 'app-release.aab', expected: { boQua: true } },
    { tenTep: 'vlc-3.0.18.exe.asc', expected: { boQua: true } },
    { tenTep: 'Obsidian-1.5.3.exe.sha256', expected: { boQua: true } },
    { tenTep: 'KeePassXC-2.7.6.sig', expected: { boQua: true } },
    { tenTep: 'Source code (zip)', expected: { boQua: true } },
    { tenTep: 'rustdesk-src.zip', expected: { boQua: true } },
    { tenTep: 'generic-linux-tool.zip', expected: { boQua: true } },
    { tenTep: 'random-unsupported-data.zip', expected: { boQua: true } },
    { tenTep: 'release-notes.json', expected: { boQua: true } },
    { tenTep: 'README.txt', expected: { boQua: true } },
  ];

  it('kiểm thử phân loại chính xác trên hơn 35 tên file thật từ các repo mã nguồn mở', () => {
    expect(DANH_SACH_TEST_FILE_THAT.length).toBeGreaterThanOrEqual(30);

    for (const testItem of DANH_SACH_TEST_FILE_THAT) {
      const result = phanLoaiTep(testItem.tenTep);

      if (testItem.expected.boQua) {
        expect(
          result.boQua,
          `Tệp [${testItem.tenTep}] phải bị bỏ qua, nhưng nhận được dinhDang=${result.dinhDang}`,
        ).toBe(true);
      } else {
        expect(result.boQua, `Tệp [${testItem.tenTep}] không được bỏ qua`).toBe(false);
        expect(result.dinhDang, `Định dạng tệp [${testItem.tenTep}]`).toBe(
          testItem.expected.dinhDang,
        );
        expect(result.kienTruc, `Kiến trúc chip tệp [${testItem.tenTep}]`).toBe(
          testItem.expected.kienTruc,
        );
      }
    }
  });

  it('QUY TẮC CỐT LÕI: Phải kiểm tra x86_64 trước x86 để không nhận nhầm x86_64 thành x86', () => {
    const file64 = 'my-app-x86_64.exe';
    const result64 = phanLoaiTep(file64);
    expect(result64.kienTruc).toBe(KienTrucChip.X86_64);
    expect(result64.kienTruc).not.toBe(KienTrucChip.X86);

    const file32 = 'my-app-x86.exe';
    const result32 = phanLoaiTep(file32);
    expect(result32.kienTruc).toBe(KienTrucChip.X86);
  });

  it('xử lý chuỗi rỗng, null hoặc định dạng lạ an toàn không crash', () => {
    // @ts-expect-error test invalid input
    expect(phanLoaiTep(null).boQua).toBe(true);
    // @ts-expect-error test invalid input
    expect(phanLoaiTep(undefined).boQua).toBe(true);
    expect(phanLoaiTep('').boQua).toBe(true);
    expect(phanLoaiTep('   ').boQua).toBe(true);
    expect(phanLoaiTep('no-extension-file').boQua).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { phanLoaiTep, hauXuLyKienTrucBanPhatHanh, tinhDiemUuTienTep } from './file-classifier.util';
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
      tenTep: 'LocalSend-1.14.0-android-arm32v7.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.ARMEABI_V7A, boQua: false },
    },
    {
      tenTep: 'LocalSend-1.14.0-windows-arm-64.zip',
      expected: {
        dinhDang: DinhDangTep.ZIP_PORTABLE,
        kienTruc: KienTrucChip.ARM64_V8A,
        boQua: false,
      },
    },
    {
      tenTep: 'CLI-windows-arm-64.exe',
      expected: { dinhDang: DinhDangTep.EXE, kienTruc: KienTrucChip.ARM64_V8A, boQua: false },
    },
    {
      tenTep: 'app-release-fdroid.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.KHONG_XAC_DINH, boQua: false },
    },
    {
      tenTep: 'app-foss-debug.apk',
      expected: { dinhDang: DinhDangTep.APK, kienTruc: KienTrucChip.KHONG_XAC_DINH, boQua: false },
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

  describe('V3: Nhận diện kiến trúc ARM 32-bit đứng một mình (koreader)', () => {
    it('nhận diện chính xác koreader-android-arm-v2026.07.1.apk là ARMEABI_V7A', () => {
      const res = phanLoaiTep('koreader-android-arm-v2026.07.1.apk');
      expect(res.boQua).toBe(false);
      expect(res.dinhDang).toBe(DinhDangTep.APK);
      expect(res.kienTruc).toBe(KienTrucChip.ARMEABI_V7A);
    });

    it('vẫn phân biệt chính xác arm64 không bị nuốt bởi arm', () => {
      const res64 = phanLoaiTep('koreader-android-arm64-v2026.07.1.apk');
      expect(res64.kienTruc).toBe(KienTrucChip.ARM64_V8A);
    });
  });

  describe('V1: Hậu xử lý ngữ cảnh kiến trúc bản phát hành (Notepad++)', () => {
    it('gán X86 cho file không ghi kiến trúc khi trong release đã có file x64 riêng', () => {
      const nppAssets = [
        {
          tenTep: 'npp.8.9.8.1.Installer.x64.exe',
          dinhDang: DinhDangTep.EXE,
          kienTruc: KienTrucChip.X86_64,
        },
        {
          tenTep: 'npp.8.9.8.1.Installer.exe',
          dinhDang: DinhDangTep.EXE,
          kienTruc: KienTrucChip.X86_64, // Trước hậu xử lý bị gán nhầm X86_64
        },
        {
          tenTep: 'npp.8.9.8.1.portable.x64.zip',
          dinhDang: DinhDangTep.ZIP_PORTABLE,
          kienTruc: KienTrucChip.X86_64,
        },
        {
          tenTep: 'npp.8.9.8.1.portable.zip',
          dinhDang: DinhDangTep.ZIP_PORTABLE,
          kienTruc: KienTrucChip.X86_64, // Trước hậu xử lý bị gán nhầm X86_64
        },
      ];

      const processed = hauXuLyKienTrucBanPhatHanh(nppAssets);

      // Bản có x64 giữ nguyên X86_64
      expect(processed.find((a) => a.tenTep === 'npp.8.9.8.1.Installer.x64.exe')?.kienTruc).toBe(
        KienTrucChip.X86_64,
      );
      expect(processed.find((a) => a.tenTep === 'npp.8.9.8.1.portable.x64.zip')?.kienTruc).toBe(
        KienTrucChip.X86_64,
      );

      // Bản không ghi kiến trúc được chuyển thành X86 (32-bit)
      expect(processed.find((a) => a.tenTep === 'npp.8.9.8.1.Installer.exe')?.kienTruc).toBe(
        KienTrucChip.X86,
      );
      expect(processed.find((a) => a.tenTep === 'npp.8.9.8.1.portable.zip')?.kienTruc).toBe(
        KienTrucChip.X86,
      );
    });

    it('giữ nguyên X86_64 nếu cả bản phát hành không có file nào ghi kiến trúc', () => {
      const genericAssets = [
        {
          tenTep: 'simple-app-setup.exe',
          dinhDang: DinhDangTep.EXE,
          kienTruc: KienTrucChip.X86_64,
        },
      ];

      const processed = hauXuLyKienTrucBanPhatHanh(genericAssets);
      expect(processed[0].kienTruc).toBe(KienTrucChip.X86_64);
    });
  });

  describe('V2 + K2: Tính điểm ưu tiên và phân loại bộ cài (LocalSend & AnkiDroid)', () => {
    it('ưu tiên bản release chính thức, trừ mạnh bản CLI và unsigned (LocalSend)', () => {
      const diemChinhThuc = tinhDiemUuTienTep(
        'LocalSend-1.18.2-windows-x86-64.exe',
        DinhDangTep.EXE,
        KienTrucChip.X86_64,
        'x86_64',
      );
      const diemCli = tinhDiemUuTienTep(
        'LocalSend-CLI-1.18.2-windows-x86-64.exe',
        DinhDangTep.EXE,
        KienTrucChip.X86_64,
        'x86_64',
      );
      const diemUnsigned = tinhDiemUuTienTep(
        'LocalSend-1.18.2-windows-x86-64-unsigned.exe',
        DinhDangTep.EXE,
        KienTrucChip.X86_64,
        'x86_64',
      );

      expect(diemChinhThuc.diem).toBeGreaterThan(diemUnsigned.diem);
      expect(diemUnsigned.diem).toBeGreaterThan(diemCli.diem);
      expect(diemCli.laCli).toBe(true);
      expect(diemUnsigned.laPhu).toBe(true);
      expect(diemChinhThuc.hopMay).toBe(true);
    });

    it('trên máy x64, bản ARM bị gắn cờ hopMay = false và điểm thấp hơn nhiều', () => {
      const scoreX64 = tinhDiemUuTienTep(
        'npp.8.9.8.1.Installer.x64.exe',
        DinhDangTep.EXE,
        KienTrucChip.X86_64,
        'x86_64',
      );
      const scoreArm64 = tinhDiemUuTienTep(
        'npp.8.9.8.1.Installer.arm64.exe',
        DinhDangTep.EXE,
        KienTrucChip.ARM64_V8A,
        'x86_64',
      );

      expect(scoreX64.hopMay).toBe(true);
      expect(scoreArm64.hopMay).toBe(false);
      expect(scoreX64.diem).toBeGreaterThan(scoreArm64.diem);
    });

    it('không đánh dấu nhầm tệp có chữ "client" thành CLI (Transmission & MQTT client)', () => {
      const transmissionClient = tinhDiemUuTienTep(
        'Transmission-Remote-client-setup-x64.exe',
        DinhDangTep.EXE,
        KienTrucChip.X86_64,
        'x86_64',
      );
      const mqttClient = tinhDiemUuTienTep(
        'mqtt-client_x64.msi',
        DinhDangTep.MSI,
        KienTrucChip.X86_64,
        'x86_64',
      );

      expect(transmissionClient.laCli).toBe(false);
      expect(transmissionClient.laPhu).toBe(false);
      expect(transmissionClient.diem).toBeGreaterThanOrEqual(100);

      expect(mqttClient.laCli).toBe(false);
      expect(mqttClient.laPhu).toBe(false);
      expect(mqttClient.diem).toBeGreaterThanOrEqual(100);
    });

    it('L-04: Phân biệt chính xác giữa ZIP portable và ZIP chứa installer (dữ liệu thật Flameshot)', () => {
      // 1. Bản portable thật sự
      const portable = phanLoaiTep('flameshot-15.0.0-portable-win64.zip');
      expect(portable.boQua).toBe(false);
      expect(portable.dinhDang).toBe(DinhDangTep.ZIP_PORTABLE);
      expect(portable.kienTruc).toBe(KienTrucChip.X86_64);

      // 2. Bản installer bị nén trong ZIP (bộ cài nén) -> PHẢI BỎ QUA không xếp vào ZIP_PORTABLE
      const installerZip = phanLoaiTep('Flameshot-15.0.0-installer-win64.zip');
      expect(installerZip.boQua).toBe(true);
      expect(installerZip.dinhDang).toBeNull();
      expect(installerZip.lyDoBoQua).toContain('installer/setup');

      // 3. Bản setup nén trong ZIP -> BỎ QUA
      const setupZip = phanLoaiTep('app-setup-windows-x64.zip');
      expect(setupZip.boQua).toBe(true);
      expect(setupZip.dinhDang).toBeNull();
    });

    it('P3B-17.6: Nhận dạng chính xác tệp .7z portable và gộp vào ZIP_PORTABLE', () => {
      // 1. .7z có chỉ thị windows -> nhận dạng là ZIP_PORTABLE
      const portable7z = phanLoaiTep('app-v1.2.0-windows-x64.7z');
      expect(portable7z.boQua).toBe(false);
      expect(portable7z.dinhDang).toBe(DinhDangTep.ZIP_PORTABLE);
      expect(portable7z.kienTruc).toBe(KienTrucChip.X86_64);

      // 2. .7z có chỉ thị portable -> nhận dạng là ZIP_PORTABLE
      const toolPortable7z = phanLoaiTep('mytool-portable.7z');
      expect(toolPortable7z.boQua).toBe(false);
      expect(toolPortable7z.dinhDang).toBe(DinhDangTep.ZIP_PORTABLE);

      // 3. .7z chứa installer/setup -> BỎ QUA
      const setup7z = phanLoaiTep('app-setup-win-x64.7z');
      expect(setup7z.boQua).toBe(true);
      expect(setup7z.dinhDang).toBeNull();
      expect(setup7z.lyDoBoQua).toContain('installer/setup');

      // 4. .7z không có chỉ thị Windows (ví dụ package.7z) -> BỎ QUA
      const generic7z = phanLoaiTep('generic-package.7z');
      expect(generic7z.boQua).toBe(true);
      expect(generic7z.dinhDang).toBeNull();
    });
  });
});

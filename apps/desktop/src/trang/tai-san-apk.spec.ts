import { describe, it, expect } from 'vitest';
import { laUrlTaiVeAnToan, phanTichTepAndroidApk } from './TrangChiTiet';

export interface TepMock {
  maTep: string;
  tenTep: string;
  duongDanTaiVe?: string;
  dungLuongBytes?: number;
  kienTrucChip?: string;
}

describe('P3B-19.3: Nhận diện và Xử lý Ứng dụng Chỉ Có Tệp .APK Android', () => {
  it('nhận diện chính xác ứng dụng chỉ có tệp .apk (như Tachiyomi, Seal, Aniyomi)', () => {
    const assets: TepMock[] = [
      { maTep: '1', tenTep: 'tachiyomi-v0.15.3.apk', dungLuongBytes: 25_000_000 },
      { maTep: '2', tenTep: 'tachiyomi-arm64-v8a-v0.15.3.apk', dungLuongBytes: 15_000_000 },
    ];

    const ketQua = phanTichTepAndroidApk(assets);
    expect(ketQua.coFileCaiDat).toBe(false);
    expect(ketQua.apkAssets).toHaveLength(2);
    expect(ketQua.chiCoFileApkAndroid).toBe(true);
  });

  it('không coi là chiCoFileApkAndroid nếu có bất kỳ bộ cài Windows nào (.exe, .msi, .zip, .7z)', () => {
    const assetsWithExe: TepMock[] = [
      { maTep: '1', tenTep: 'app-android.apk' },
      { maTep: '2', tenTep: 'app-windows-setup.exe' },
    ];
    expect(phanTichTepAndroidApk(assetsWithExe).chiCoFileApkAndroid).toBe(false);
    expect(phanTichTepAndroidApk(assetsWithExe).coFileCaiDat).toBe(true);

    const assetsWithZip: TepMock[] = [
      { maTep: '1', tenTep: 'app-mobile.apk' },
      { maTep: '2', tenTep: 'app-portable.zip' },
    ];
    expect(phanTichTepAndroidApk(assetsWithZip).chiCoFileApkAndroid).toBe(false);
    expect(phanTichTepAndroidApk(assetsWithZip).coFileCaiDat).toBe(true);

    const assetsWith7z: TepMock[] = [
      { maTep: '1', tenTep: 'app-mobile.apk' },
      { maTep: '2', tenTep: 'app-portable.7z' },
    ];
    expect(phanTichTepAndroidApk(assetsWith7z).chiCoFileApkAndroid).toBe(false);
    expect(phanTichTepAndroidApk(assetsWith7z).coFileCaiDat).toBe(true);
  });

  it('trả về chiCoFileApkAndroid = false khi không có tệp apk nào', () => {
    const assetsRong: TepMock[] = [];
    expect(phanTichTepAndroidApk(assetsRong).chiCoFileApkAndroid).toBe(false);
    expect(phanTichTepAndroidApk(assetsRong).apkAssets).toHaveLength(0);

    const assetsLinux: TepMock[] = [
      { maTep: '1', tenTep: 'app-linux.AppImage' },
      { maTep: '2', tenTep: 'app-linux.deb' },
    ];
    expect(phanTichTepAndroidApk(assetsLinux).chiCoFileApkAndroid).toBe(false);
    expect(phanTichTepAndroidApk(assetsLinux).apkAssets).toHaveLength(0);
  });

  it('bắt đúng phần mở rộng hoa/thường (.APK, .apk)', () => {
    const assetsCase: TepMock[] = [{ maTep: '1', tenTep: 'Seal-v1.12.1-universal.APK' }];
    const ketQua = phanTichTepAndroidApk(assetsCase);
    expect(ketQua.chiCoFileApkAndroid).toBe(true);
    expect(ketQua.apkAssets).toHaveLength(1);
  });

  it('P3B-19.6: nạp được tệp APK từ androidRelease khi Windows trả về 0 tệp cài đặt (kịch bản Anki-Android, NewPipe, Termux)', () => {
    // Backend trả 0 tệp khi query platform=windows cho Anki-Android
    const windowsAssets: TepMock[] = [];
    // Backend trả 13 tệp APK khi query platform=android
    const androidAssets: TepMock[] = [
      { maTep: '1', tenTep: 'AnkiDroid-2.18.4-universal.apk', dungLuongBytes: 24_000_000 },
      { maTep: '2', tenTep: 'AnkiDroid-2.18.4-arm64-v8a.apk', dungLuongBytes: 18_000_000 },
      { maTep: '3', tenTep: 'AnkiDroid-2.18.4-armeabi-v7a.apk', dungLuongBytes: 17_000_000 },
    ];

    const { coFileCaiDat, apkAssets, chiCoFileApkAndroid } = phanTichTepAndroidApk(
      windowsAssets,
      androidAssets,
    );

    expect(coFileCaiDat).toBe(false);
    expect(apkAssets).toHaveLength(3);
    expect(chiCoFileApkAndroid).toBe(true);
    expect(apkAssets[0].tenTep).toBe('AnkiDroid-2.18.4-universal.apk');
  });
});

describe('SEC-02: Kiểm chứng an toàn URL tải tệp APK (laUrlTaiVeAnToan)', () => {
  it('cho phép URL tải hợp lệ từ GitHub Releases và objects.githubusercontent.com', () => {
    expect(
      laUrlTaiVeAnToan(
        'https://github.com/tachiyomiorg/tachiyomi/releases/download/v0.15.3/tachiyomi-v0.15.3.apk',
      ),
    ).toBe(true);
    expect(
      laUrlTaiVeAnToan(
        'https://objects.githubusercontent.com/github-production-release-asset-2e65be/12345/app.apk',
      ),
    ).toBe(true);
    expect(laUrlTaiVeAnToan('https://raw.githubusercontent.com/org/repo/master/app.apk')).toBe(
      true,
    );
  });

  it('từ chối giao thức không an toàn hoặc độc hại (http, javascript, file, data)', () => {
    expect(
      laUrlTaiVeAnToan(
        'http://github.com/tachiyomiorg/tachiyomi/releases/download/v0.15.3/tachiyomi.apk',
      ),
    ).toBe(false);
    expect(laUrlTaiVeAnToan('javascript:alert(1)')).toBe(false);
    expect(laUrlTaiVeAnToan('file:///C:/Windows/system32/cmd.exe')).toBe(false);
    expect(laUrlTaiVeAnToan('data:text/html;base64,PHNjcmlwdD5...')).toBe(false);
    expect(laUrlTaiVeAnToan('')).toBe(false);
    expect(laUrlTaiVeAnToan(null as unknown as string)).toBe(false);
    expect(laUrlTaiVeAnToan(undefined as unknown as string)).toBe(false);
  });

  it('từ chối domain mạo danh hoặc không thuộc GitHub', () => {
    expect(laUrlTaiVeAnToan('https://evil-github.com/tachiyomi.apk')).toBe(false);
    expect(laUrlTaiVeAnToan('https://fakegithubusercontent.com/app.apk')).toBe(false);
    expect(laUrlTaiVeAnToan('https://attacker.org/download.apk')).toBe(false);
  });

  it('từ chối URL có chứa thông tin xác thực nhúng (credential injection)', () => {
    expect(laUrlTaiVeAnToan('https://user:password@github.com/repo/releases/app.apk')).toBe(false);
  });
});

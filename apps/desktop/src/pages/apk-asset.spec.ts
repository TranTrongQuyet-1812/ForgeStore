import { describe, it, expect } from 'vitest';

export interface TepMock {
  maTep: string;
  tenTep: string;
  duongDanTaiVe?: string;
  dungLuongBytes?: number;
  kienTrucChip?: string;
}

export function phanTichTepAndroidApk(allAssets: TepMock[]) {
  const windowsAssets = allAssets.filter((f) => {
    const ext = f.tenTep.toLowerCase();
    return (
      ext.endsWith('.exe') || ext.endsWith('.msi') || ext.endsWith('.zip') || ext.endsWith('.7z')
    );
  });
  const coFileCaiDat = windowsAssets.length > 0;

  const apkAssets = allAssets.filter((f) => f.tenTep.toLowerCase().endsWith('.apk'));
  const chiCoFileApkAndroid = !coFileCaiDat && apkAssets.length > 0;

  return {
    windowsAssets,
    coFileCaiDat,
    apkAssets,
    chiCoFileApkAndroid,
  };
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
});

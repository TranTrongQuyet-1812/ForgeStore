import { describe, it, expect } from 'vitest';
import { timTepCaiDatToiUu } from './TrangChiTiet';

describe('timTepCaiDatToiUu - Thuật toán chọn tệp cài đặt tối ưu cho máy tính', () => {
  const notepadAssets = [
    {
      maTep: '1',
      tenTep: 'npp.8.9.8.1.Installer.arm64.exe',
      dinhDangTep: 'EXE',
      kienTrucChip: 'ARM64_V8A',
    },
    {
      maTep: '2',
      tenTep: 'npp.8.9.8.1.Installer.exe',
      dinhDangTep: 'EXE',
      kienTrucChip: 'DUNG_CHUNG',
    },
    {
      maTep: '3',
      tenTep: 'npp.8.9.8.1.Installer.x64.exe',
      dinhDangTep: 'EXE',
      kienTrucChip: 'X86_64',
    },
    {
      maTep: '4',
      tenTep: 'npp.8.9.8.1.Installer.x64.msi',
      dinhDangTep: 'MSI',
      kienTrucChip: 'X86_64',
    },
    {
      maTep: '5',
      tenTep: 'npp.8.9.8.1.portable.arm64.zip',
      dinhDangTep: 'ZIP',
      kienTrucChip: 'ARM64_V8A',
    },
    {
      maTep: '6',
      tenTep: 'npp.8.9.8.1.portable.x64.zip',
      dinhDangTep: 'ZIP',
      kienTrucChip: 'X86_64',
    },
  ];

  it('phải chọn bản Installer.x64.exe thay vì arm64.exe khi format là EXE trên máy x64', () => {
    const selected = timTepCaiDatToiUu(notepadAssets, 'EXE', 'x64');
    expect(selected).toBeDefined();
    expect(selected?.maTep).toBe('3');
    expect(selected?.tenTep).toBe('npp.8.9.8.1.Installer.x64.exe');
  });

  it('phải chọn bản Installer.x64.msi khi format là MSI', () => {
    const selected = timTepCaiDatToiUu(notepadAssets, 'MSI', 'x64');
    expect(selected).toBeDefined();
    expect(selected?.maTep).toBe('4');
    expect(selected?.tenTep).toBe('npp.8.9.8.1.Installer.x64.msi');
  });

  it('phải chọn bản portable.x64.zip khi format là ZIP hoặc ZIP_PORTABLE', () => {
    const selected = timTepCaiDatToiUu(notepadAssets, 'ZIP_PORTABLE', 'x64');
    expect(selected).toBeDefined();
    expect(selected?.maTep).toBe('6');
    expect(selected?.tenTep).toBe('npp.8.9.8.1.portable.x64.zip');
  });

  it('phải ưu tiên bản trung tính khi không có bản x64 rõ ràng thay vì chọn nhầm ARM64', () => {
    const assetsWithoutX64 = [
      {
        maTep: 'arm-1',
        tenTep: 'app-setup-arm64.exe',
        dinhDangTep: 'EXE',
        kienTrucChip: 'ARM64_V8A',
      },
      {
        maTep: 'neutral-1',
        tenTep: 'app-setup.exe',
        dinhDangTep: 'EXE',
        kienTrucChip: null,
      },
    ];

    const selected = timTepCaiDatToiUu(assetsWithoutX64, 'EXE', 'x64');
    expect(selected).toBeDefined();
    expect(selected?.maTep).toBe('neutral-1');
  });

  it('phải chọn bản 32-bit x86 nếu chỉ có x86 và ARM trên máy x64', () => {
    const assetsWithX86AndArm = [
      {
        maTep: 'arm-1',
        tenTep: 'tool-setup-arm64.exe',
        dinhDangTep: 'EXE',
        kienTrucChip: 'ARM64_V8A',
      },
      {
        maTep: 'x86-1',
        tenTep: 'tool-setup-win32.exe',
        dinhDangTep: 'EXE',
        kienTrucChip: 'X86',
      },
    ];

    const selected = timTepCaiDatToiUu(assetsWithX86AndArm, 'EXE', 'x64');
    expect(selected).toBeDefined();
    expect(selected?.maTep).toBe('x86-1');
  });

  it('FE-V3-04: loại trừ hoàn toàn các tệp Linux/macOS zip và source code zip khỏi việc chọn tệp cho Windows', () => {
    const multiPlatformAssets = [
      {
        maTep: 'linux-1',
        tenTep: 'myapp-linux-x64.zip',
        dinhDangTep: 'ZIP',
        kienTrucChip: 'X86_64',
      },
      {
        maTep: 'mac-1',
        tenTep: 'myapp-darwin-x64.zip',
        dinhDangTep: 'ZIP',
        kienTrucChip: 'X86_64',
      },
      {
        maTep: 'source-1',
        tenTep: 'source-code.zip',
        dinhDangTep: 'ZIP',
        kienTrucChip: null,
      },
      {
        maTep: 'win-1',
        tenTep: 'myapp-windows.zip',
        dinhDangTep: 'ZIP',
        kienTrucChip: 'DUNG_CHUNG',
      },
    ];

    const selected = timTepCaiDatToiUu(multiPlatformAssets, 'ZIP', 'x64');
    expect(selected).toBeDefined();
    expect(selected?.maTep).toBe('win-1');
    expect(selected?.tenTep).toBe('myapp-windows.zip');
  });

  it('phải trả về undefined nếu mảng rỗng', () => {
    const selected = timTepCaiDatToiUu([], 'EXE', 'x64');
    expect(selected).toBeUndefined();
  });
});

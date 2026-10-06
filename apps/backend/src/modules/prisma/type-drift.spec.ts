import { describe, it, expect } from 'vitest';
import * as PrismaEnums from '@prisma/client';
import * as ForgeStoreTypes from '@forgestore/types';

describe('Prisma vs @forgestore/types Enum Drift Assertion (P2-02.5)', () => {
  it('Khớp 100% enum VaiTro', () => {
    expect(PrismaEnums.VaiTro).toEqual(ForgeStoreTypes.VaiTro);
  });

  it('Khớp 100% enum LoaiThietBi', () => {
    expect(PrismaEnums.LoaiThietBi).toEqual(ForgeStoreTypes.LoaiThietBi);
  });

  it('Khớp 100% enum NenTangHoTro', () => {
    expect(PrismaEnums.NenTangHoTro).toEqual(ForgeStoreTypes.NenTangHoTro);
  });

  it('Khớp 100% enum MucDoUyTin', () => {
    expect(PrismaEnums.MucDoUyTin).toEqual(ForgeStoreTypes.MucDoUyTin);
  });

  it('Khớp 100% enum DinhDangTep', () => {
    expect(PrismaEnums.DinhDangTep).toEqual(ForgeStoreTypes.DinhDangTep);
  });

  it('Khớp 100% enum KienTrucChip', () => {
    expect(PrismaEnums.KienTrucChip).toEqual(ForgeStoreTypes.KienTrucChip);
  });

  it('Khớp 100% enum TrangThaiNapRepo', () => {
    expect(PrismaEnums.TrangThaiNapRepo).toEqual(ForgeStoreTypes.TrangThaiNapRepo);
  });

  it('Khớp 100% enum TrangThaiThamDinhJev', () => {
    expect(PrismaEnums.TrangThaiThamDinhJev).toEqual(ForgeStoreTypes.TrangThaiThamDinhJev);
  });

  it('Khớp 100% enum TrangThaiDichReadme (P3B-02)', () => {
    expect(PrismaEnums.TrangThaiDichReadme).toEqual(ForgeStoreTypes.TrangThaiDichReadme);
  });

  it('Khớp 100% enum TrangThaiUngVienRepo (P3B-02)', () => {
    expect(PrismaEnums.TrangThaiUngVienRepo).toEqual(ForgeStoreTypes.TrangThaiUngVienRepo);
  });

  it('Khớp 100% enum LyDoLoaiUngVien (P3B-02.8 / D-21)', () => {
    expect(PrismaEnums.LyDoLoaiUngVien).toEqual(ForgeStoreTypes.LyDoLoaiUngVien);
  });
});

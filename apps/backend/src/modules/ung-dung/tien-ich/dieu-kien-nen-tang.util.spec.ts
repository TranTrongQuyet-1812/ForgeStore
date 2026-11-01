import { describe, expect, it } from 'vitest';
import { DinhDangTep, NenTangHoTro } from '@prisma/client';
import { PlatformFilter } from '../dto/truy-van-ung-dung.dto';
import { taoDieuKienNenTang } from './dieu-kien-nen-tang.util';

describe('taoDieuKienNenTang', () => {
  it('Windows chỉ lọc theo nền tảng, không đòi tệp cài để repo chỉ cài bằng lệnh vẫn hiện', () => {
    const dieuKien = taoDieuKienNenTang(PlatformFilter.WINDOWS);

    expect(dieuKien.nenTangHoTro).toEqual({
      in: [NenTangHoTro.WINDOWS, NenTangHoTro.DA_NEN_TANG],
    });
    expect(dieuKien.danhSachPhatHanh).toBeUndefined();
  });

  it('Android vẫn đòi tệp APK vì không có lệnh cài trên điện thoại', () => {
    const dieuKien = taoDieuKienNenTang(PlatformFilter.ANDROID);

    expect(dieuKien.nenTangHoTro).toEqual({
      in: [NenTangHoTro.ANDROID, NenTangHoTro.DA_NEN_TANG],
    });
    expect(dieuKien.danhSachPhatHanh).toEqual({
      some: { danhSachTepCaiDat: { some: { dinhDangTep: DinhDangTep.APK } } },
    });
  });

  it('không chọn nền tảng thì không thêm điều kiện nào', () => {
    expect(taoDieuKienNenTang(undefined)).toEqual({});
  });
});

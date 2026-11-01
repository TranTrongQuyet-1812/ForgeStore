import { DinhDangTep, NenTangHoTro, Prisma } from '@prisma/client';
import { PlatformFilter } from '../dto/truy-van-ung-dung.dto';

/**
 * Điều kiện hiển thị theo nền tảng dùng chung cho danh sách, danh mục và đếm số lượng (P3B-25.13, D-30).
 *
 * Trạng thái HOAT_DONG đã nghĩa là ứng dụng cài được: có tệp cài hoặc có cách cài bằng lệnh hợp lệ
 * (do dongBoRepo quyết một chỗ). Nên với Windows không đòi thêm tệp cài, để ứng dụng chỉ cài bằng lệnh
 * nổi tiếng (nhiều sao) vẫn hiện chung với ứng dụng cài sẵn, xếp theo độ nổi bật.
 * Android thì vẫn cần tệp APK vì không có lệnh cài trên điện thoại.
 */
export function taoDieuKienNenTang(platform?: PlatformFilter): Prisma.UngDungWhereInput {
  if (platform === PlatformFilter.ANDROID) {
    return {
      nenTangHoTro: { in: [NenTangHoTro.ANDROID, NenTangHoTro.DA_NEN_TANG] },
      danhSachPhatHanh: {
        some: { danhSachTepCaiDat: { some: { dinhDangTep: DinhDangTep.APK } } },
      },
    };
  }
  if (platform === PlatformFilter.WINDOWS) {
    return { nenTangHoTro: { in: [NenTangHoTro.WINDOWS, NenTangHoTro.DA_NEN_TANG] } };
  }
  return {};
}

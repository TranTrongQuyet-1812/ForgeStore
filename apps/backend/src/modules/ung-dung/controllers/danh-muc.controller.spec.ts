import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DanhMucController } from './danh-muc.controller';
import { UngDungService } from '../ung-dung.service';
import { PlatformFilter } from '../dto/truy-van-ung-dung.dto';
import { DanhMucDto } from '@forgestore/types';

describe('DanhMucController (K3)', () => {
  let controller: DanhMucController;
  let appsService: Partial<UngDungService>;

  beforeEach(() => {
    appsService = {
      layDanhSachDanhMuc: vi.fn(),
    };
    controller = new DanhMucController(appsService as UngDungService);
  });

  it('gọi layDanhSachDanhMuc với platform=windows và trả về kết quả', async () => {
    const mockCategories: DanhMucDto[] = [
      { ten: 'Lập trình & Phát triển', soLuong: 5 },
      { ten: 'Tiện ích hệ thống', soLuong: 4 },
      { ten: 'Mạng & Giao tiếp', soLuong: 3 },
    ];
    vi.mocked(appsService.layDanhSachDanhMuc!).mockResolvedValue(mockCategories);

    const result = await controller.layDanhSachDanhMuc(PlatformFilter.WINDOWS);

    expect(appsService.layDanhSachDanhMuc).toHaveBeenCalledWith(PlatformFilter.WINDOWS);
    expect(result).toEqual(mockCategories);
  });

  it('gọi layDanhSachDanhMuc không truyền platform', async () => {
    const mockCategories: DanhMucDto[] = [{ ten: 'Đa phương tiện', soLuong: 6 }];
    vi.mocked(appsService.layDanhSachDanhMuc!).mockResolvedValue(mockCategories);

    const result = await controller.layDanhSachDanhMuc(undefined);

    expect(appsService.layDanhSachDanhMuc).toHaveBeenCalledWith(undefined);
    expect(result).toEqual(mockCategories);
  });
});

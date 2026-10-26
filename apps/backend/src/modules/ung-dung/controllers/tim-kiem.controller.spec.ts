import { describe, expect, it, vi } from 'vitest';
import { TimKiemController } from './tim-kiem.controller';
import { UngDungService } from '../ung-dung.service';
import { SearchQueryDto } from '../dto/tim-kiem.dto';

describe('TimKiemController (P2-40)', () => {
  it('Gọi timKiemThongMinh của UngDungService và trả về kết quả', async () => {
    const mockAppsService = {
      timKiemThongMinh: vi.fn().mockResolvedValue({
        duLieu: [],
        tongSo: 0,
        trangHienTai: 1,
        tongSoTrang: 0,
        kichThuocTrang: 20,
        loaiTruyVan: 'TEN_APP',
        nguonKetQua: 'CSDL',
      }),
    } as unknown as UngDungService;

    const controller = new TimKiemController(mockAppsService);
    const query: SearchQueryDto = { q: 'vlc', page: 1, limit: 20 };

    const res = await controller.timKiem(query);
    expect(res.loaiTruyVan).toBe('TEN_APP');
    expect(mockAppsService.timKiemThongMinh).toHaveBeenCalledWith(query);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { SearchController } from './tim-kiem.controller';
import { AppsService } from '../ung-dung.service';
import { SearchQueryDto } from '../dto/tim-kiem.dto';

describe('SearchController (P2-40)', () => {
  it('Gọi timKiemThongMinh của AppsService và trả về kết quả', async () => {
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
    } as unknown as AppsService;

    const controller = new SearchController(mockAppsService);
    const query: SearchQueryDto = { q: 'vlc', page: 1, limit: 20 };

    const res = await controller.timKiem(query);
    expect(res.loaiTruyVan).toBe('TEN_APP');
    expect(mockAppsService.timKiemThongMinh).toHaveBeenCalledWith(query);
  });
});

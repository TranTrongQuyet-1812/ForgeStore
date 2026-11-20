import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { TimKiemController } from './tim-kiem.controller';
import { UngDungService } from '../ung-dung.service';
import { SearchQueryDto } from '../dto/tim-kiem.dto';

describe('TimKiemController (P2-40 & P3B-43)', () => {
  it('Gọi timKiemThongMinh của UngDungService và trả về kết quả (kể cả khi truyền nguon)', async () => {
    const mockAppsService = {
      timKiemThongMinh: vi.fn().mockResolvedValue({
        duLieu: [],
        tongSo: 0,
        trangHienTai: 1,
        tongSoTrang: 0,
        kichThuocTrang: 24,
        loaiTruyVan: 'TEN_APP',
        nguonKetQua: 'GITHUB',
      }),
    } as unknown as UngDungService;

    const controller = new TimKiemController(mockAppsService);
    const query: SearchQueryDto = { q: 'vlc', page: 1, limit: 24, nguon: 'GITHUB' };

    const res = await controller.timKiem(query);
    expect(res.loaiTruyVan).toBe('TEN_APP');
    expect(res.nguonKetQua).toBe('GITHUB');
    expect(mockAppsService.timKiemThongMinh).toHaveBeenCalledWith(query);
  });

  it('SearchQueryDto: chấp nhận nguon CSDL/GITHUB không phân biệt hoa thường và từ chối giá trị sai', async () => {
    const macDinh = plainToInstance(SearchQueryDto, { q: 'bat' });
    expect(await validate(macDinh)).toHaveLength(0);
    expect(macDinh.nguon).toBeUndefined();

    const thuongCsdl = plainToInstance(SearchQueryDto, { q: 'bat', nguon: 'csdl' });
    expect(await validate(thuongCsdl)).toHaveLength(0);
    expect(thuongCsdl.nguon).toBe('CSDL');

    const thuongGithub = plainToInstance(SearchQueryDto, { q: 'bat', nguon: ' github ' });
    expect(await validate(thuongGithub)).toHaveLength(0);
    expect(thuongGithub.nguon).toBe('GITHUB');

    for (const sai of ['KHAC', '', 'ALL', 123]) {
      const dtoSai = plainToInstance(SearchQueryDto, { q: 'bat', nguon: sai });
      const errors = await validate(dtoSai);
      expect(errors.length, JSON.stringify(sai)).toBeGreaterThan(0);
    }
  });
});

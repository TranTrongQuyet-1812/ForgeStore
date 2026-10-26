import { describe, expect, it, vi } from 'vitest';
import { ReposController } from './repos.controller';
import { AppsService } from '../ung-dung.service';
import { InspectRepoDto } from '../dto/inspect-repo.dto';
import { TrangThaiNapRepo } from '@prisma/client';

describe('ReposController (P2-41 Paste & Play)', () => {
  it('Gọi kiemDinhVaNapRepo của AppsService và truyền userId nếu có', async () => {
    const mockAppsService = {
      kiemDinhVaNapRepo: vi.fn().mockResolvedValue({
        trangThai: TrangThaiNapRepo.THANH_CONG,
        thongBao: 'Nạp thành công',
      }),
    } as unknown as AppsService;

    const controller = new ReposController(mockAppsService);
    const dto: InspectRepoDto = {
      urlRepo: 'https://github.com/rustdesk/rustdesk',
      nenTang: 'ANDROID',
    };
    const req = { user: { maNguoiDung: 'user-uuid-1' } };

    const res = await controller.kiemDinhRepo(dto, req);
    expect(res.trangThai).toBe('THANH_CONG');
    expect(mockAppsService.kiemDinhVaNapRepo).toHaveBeenCalledWith(dto, 'user-uuid-1');
  });
});

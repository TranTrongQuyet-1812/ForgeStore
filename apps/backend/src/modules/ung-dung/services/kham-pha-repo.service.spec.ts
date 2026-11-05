import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KhamPhaRepoService, tienConTro } from './kham-pha-repo.service';
import { CHU_DE_KHAM_PHA, DAI_SAO, NGUONG_LOC_MAC_DINH } from '../tien-ich/bo-loc-nap-repo.util';

describe('KhamPhaRepoService (P3B-06.1, 06.2)', () => {
  it('con trỏ đi hết trang, rồi sang chủ đề, rồi sang dải sao, hết vòng thì quay lại đầu', () => {
    expect(tienConTro({ dai: 0, chuDe: 0, trang: 1 }, false)).toEqual({
      dai: 0,
      chuDe: 0,
      trang: 2,
    });
    expect(tienConTro({ dai: 0, chuDe: 0, trang: 3 }, true)).toEqual({
      dai: 0,
      chuDe: 1,
      trang: 1,
    });
    expect(tienConTro({ dai: 0, chuDe: 0, trang: 10 }, false)).toEqual({
      dai: 0,
      chuDe: 1,
      trang: 1,
    });
    const cuoi = { dai: DAI_SAO.length - 1, chuDe: CHU_DE_KHAM_PHA.length - 1, trang: 1 };
    expect(tienConTro(cuoi, true)).toEqual({ dai: 0, chuDe: 0, trang: 1 });
  });

  describe('khamPhaTuDong', () => {
    const now = Date.now();
    const repo = (ten: string, ghiDe: Record<string, unknown> = {}) => ({
      full_name: ten,
      name: ten.split('/')[1],
      description: 'app',
      stargazers_count: 3000,
      fork: false,
      archived: false,
      pushed_at: new Date(now - 5 * 86400000).toISOString(),
      license: { spdx_id: 'MIT' },
      ...ghiDe,
    });
    const prisma = {
      ungDung: { findMany: vi.fn() },
      ungVienRepo: { findMany: vi.fn(), createMany: vi.fn() },
    };
    const github = { timKiemRepo: vi.fn() };
    const cache = { setNx: vi.fn(), lay: vi.fn(), luu: vi.fn() };
    const dayChuyen = {
      tangDuocBat: vi.fn(),
      layNguongLoc: vi.fn(() => NGUONG_LOC_MAC_DINH),
      dungNganSachGithub: vi.fn(),
      chuanHoaTenRepo: vi.fn((t: string) => t),
    };
    let service: KhamPhaRepoService;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      cache.setNx.mockResolvedValue(false); // Trending hôm nay đã đọc
      cache.lay.mockResolvedValue(null);
      prisma.ungDung.findMany.mockResolvedValue([{ tenRepoDayDu: 'da/co-trong-kho' }]);
      prisma.ungVienRepo.findMany.mockResolvedValue([]);
      prisma.ungVienRepo.createMany.mockImplementation(async ({ data }) => ({
        count: data.length,
      }));
      service = new KhamPhaRepoService(
        prisma as never,
        github as never,
        cache as never,
        dayChuyen as never,
      );
    });

    it('tầng khám phá tắt thì không gọi GitHub', async () => {
      dayChuyen.tangDuocBat.mockReturnValue(false);
      expect((await service.khamPhaTuDong()).daNhayQua).toBe(true);
      expect(github.timKiemRepo).not.toHaveBeenCalled();
    });

    it('chỉ thêm repo qua lọc cục bộ và chưa có trong kho; nhiều sao ưu tiên 2, đáng chú ý ưu tiên 3', async () => {
      dayChuyen.tangDuocBat.mockReturnValue(true);
      github.timKiemRepo.mockResolvedValue({
        items: [repo('a/dat'), repo('b/it-sao', { stargazers_count: 10 }), repo('da/co-trong-kho')],
      });
      const p = service.khamPhaTuDong(true);
      await vi.runAllTimersAsync();
      const kq = await p;
      expect(kq.soYeuCauSearch).toBe(11); // 10 trang nhiều sao + 1 trang đáng chú ý
      const lanDau = prisma.ungVienRepo.createMany.mock.calls[0]![0];
      expect(lanDau.data).toEqual([
        { tenRepoDayDu: 'a/dat', nguonKhamPha: 'search_sao', doUuTien: 2 },
      ]);
      expect(lanDau.skipDuplicates).toBe(true);
      const lanCuoi = prisma.ungVienRepo.createMany.mock.calls.at(-1)![0];
      expect(lanCuoi.data[0]).toMatchObject({ nguonKhamPha: 'dang_chu_y', doUuTien: 3 });
      expect(github.timKiemRepo.mock.calls.at(-1)![3]).toBe('updated');
      vi.useRealTimers();
    });
  });
});

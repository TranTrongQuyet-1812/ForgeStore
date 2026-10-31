import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { CacheService } from '../../redis/cache.service';
import { UngDungService } from '../ung-dung.service';
import { QuetBanPhatHanhJob } from './quet-ban-phat-hanh.job';

interface MockPrisma {
  ungDung: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

interface MockGithubService {
  layRepo: ReturnType<typeof vi.fn>;
  layReleaseMoiNhat: ReturnType<typeof vi.fn>;
  getRateLimitInfo: ReturnType<typeof vi.fn>;
}

interface MockAppsService {
  dongBoRepo: ReturnType<typeof vi.fn>;
}

interface MockCacheService {
  lay: ReturnType<typeof vi.fn>;
  luu: ReturnType<typeof vi.fn>;
  xoaTheoPrefix: ReturnType<typeof vi.fn>;
}

describe('QuetBanPhatHanhJob (P2-25)', () => {
  let job: QuetBanPhatHanhJob;
  let mockPrisma: MockPrisma;
  let mockGithubService: MockGithubService;
  let mockAppsService: MockAppsService;
  let mockCacheService: MockCacheService;
  let cacheGiaLap: Map<string, string>;

  beforeEach(() => {
    mockPrisma = {
      ungDung: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    mockGithubService = {
      layRepo: vi.fn().mockResolvedValue({ archived: false }),
      layReleaseMoiNhat: vi.fn(),
      getRateLimitInfo: vi
        .fn()
        .mockReturnValue({ remaining: 4900, limit: 5000, reset: 1700000000 }),
    };

    mockAppsService = {
      dongBoRepo: vi.fn(),
    };
    cacheGiaLap = new Map();
    mockCacheService = {
      lay: vi.fn(async (key: string) => cacheGiaLap.get(key) ?? null),
      luu: vi.fn(async (key: string, value: string) => {
        cacheGiaLap.set(key, value);
      }),
      xoaTheoPrefix: vi.fn().mockResolvedValue(true),
    };

    job = new QuetBanPhatHanhJob(
      mockPrisma as unknown as PrismaService,
      mockGithubService as unknown as GithubService,
      mockAppsService as unknown as UngDungService,
      mockCacheService as unknown as CacheService,
    );
  });

  it('Quét ưu tiên các app đang có người cài/yêu thích và phát hiện release mới', async () => {
    // Giả lập 1 app có người cài đang ở bản v1.2.0
    const mockInstalledApp = {
      maUngDung: 'uuid-app-1',
      tenRepoDayDu: 'rustdesk/rustdesk',
      dongBoLanCuoi: new Date('2026-09-01T00:00:00Z'),
      danhSachPhatHanh: [{ tenPhienBan: '1.2.0' }],
    };

    // findMany lần 1 (app ưu tiên) trả về mockInstalledApp
    // findMany lần 2 (app thường) trả về rỗng
    mockPrisma.ungDung.findMany.mockResolvedValueOnce([mockInstalledApp]).mockResolvedValueOnce([]);

    // GitHub trả về bản mới 1.2.3 (khác 1.2.0)
    mockGithubService.layReleaseMoiNhat.mockResolvedValue({
      id: 999,
      tag_name: '1.2.3',
    });

    const result = await job.scanReleases(5);

    expect(result.soRepoDaQuet).toBe(1);
    expect(result.soReleaseMoi).toBe(1);
    expect(result.quotaConLai).toBe(4900);

    // Kích hoạt đồng bộ bản mới
    expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('rustdesk', 'rustdesk');
  });

  it('Không đồng bộ lại nếu GitHub release trùng phiên bản hiện tại trong DB', async () => {
    const mockApp = {
      maUngDung: 'uuid-app-2',
      tenRepoDayDu: 'videolan/vlc',
      dongBoLanCuoi: new Date('2026-09-20T00:00:00Z'),
      danhSachPhatHanh: [{ tenPhienBan: '3.0.20' }],
    };

    mockPrisma.ungDung.findMany.mockResolvedValueOnce([mockApp]).mockResolvedValueOnce([]);

    // GitHub trả về đúng 3.0.20
    mockGithubService.layReleaseMoiNhat.mockResolvedValue({
      id: 888,
      tag_name: '3.0.20',
    });

    const result = await job.scanReleases(5);

    expect(result.soRepoDaQuet).toBe(1);
    expect(result.soReleaseMoi).toBe(0);
    expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
  });

  it('cập nhật và xóa cache khi trạng thái archived đổi theo GitHub', async () => {
    const app = {
      maUngDung: 'uuid-archived',
      tenRepoDayDu: 'owner/archived',
      daLuuTru: false,
      dongBoLanCuoi: new Date(),
      danhSachPhatHanh: [{ tenPhienBan: '1.0.0' }],
    };
    mockPrisma.ungDung.findMany.mockResolvedValueOnce([app]).mockResolvedValueOnce([]);
    mockGithubService.layRepo.mockResolvedValueOnce({ archived: true });
    mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce({ tag_name: '1.0.0' });

    await job.scanReleases(1);

    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'uuid-archived' },
      data: { daLuuTru: true },
    });
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:detail:');
  });

  it('bỏ cờ lưu trữ nếu GitHub báo repo đã hoạt động lại', async () => {
    const app = {
      maUngDung: 'uuid-unarchived',
      tenRepoDayDu: 'owner/unarchived',
      daLuuTru: true,
      dongBoLanCuoi: new Date(),
      danhSachPhatHanh: [{ tenPhienBan: '1.0.0' }],
    };
    mockPrisma.ungDung.findMany.mockResolvedValueOnce([app]).mockResolvedValueOnce([]);
    mockGithubService.layRepo.mockResolvedValueOnce({ archived: false });
    mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce({ tag_name: '1.0.0' });

    await job.scanReleases(1);

    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'uuid-unarchived' },
      data: { daLuuTru: false },
    });
  });

  it('luân phiên qua các repo ở những lượt quét kế tiếp', async () => {
    const uuTien1 = {
      maUngDung: '0001',
      tenRepoDayDu: 'owner/favorite-1',
      daLuuTru: false,
      danhSachPhatHanh: [{ tenPhienBan: '1.0.0' }],
    };
    const thuong1 = {
      maUngDung: '1001',
      tenRepoDayDu: 'owner/repo-1',
      daLuuTru: false,
      danhSachPhatHanh: [{ tenPhienBan: '1.0.0' }],
    };
    const uuTien2 = { ...uuTien1, maUngDung: '0002', tenRepoDayDu: 'owner/favorite-2' };
    const thuong2 = { ...thuong1, maUngDung: '1002', tenRepoDayDu: 'owner/repo-2' };
    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce([uuTien1])
      .mockResolvedValueOnce([thuong1])
      .mockResolvedValueOnce([uuTien2])
      .mockResolvedValueOnce([thuong2])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([uuTien1])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([thuong1]);
    mockGithubService.layReleaseMoiNhat.mockResolvedValue({ tag_name: '1.0.0' });

    await job.scanReleases(2);
    await job.scanReleases(2);
    await job.scanReleases(2);

    const truyVanUuTienLuotHai = mockPrisma.ungDung.findMany.mock.calls[2]![0];
    const truyVanThuongLuotHai = mockPrisma.ungDung.findMany.mock.calls[3]![0];
    expect(truyVanUuTienLuotHai.where).toEqual({
      AND: [
        {
          trangThai: 'HOAT_DONG',
          OR: [{ danhSachDaCai: { some: {} } }, { danhSachYeuThich: { some: {} } }],
        },
        { maUngDung: { gt: '0001' } },
      ],
    });
    expect(truyVanThuongLuotHai.where).toEqual({
      AND: [
        { AND: [{ trangThai: 'HOAT_DONG', maUngDung: { notIn: ['0002'] } }] },
        { maUngDung: { gt: '1001' } },
      ],
    });
    expect(mockPrisma.ungDung.findMany.mock.calls[5]![0].where).toEqual({
      AND: [
        {
          trangThai: 'HOAT_DONG',
          OR: [{ danhSachDaCai: { some: {} } }, { danhSachYeuThich: { some: {} } }],
        },
        { maUngDung: { lte: '0002' } },
        { maUngDung: { notIn: [] } },
      ],
    });
    expect(mockPrisma.ungDung.findMany.mock.calls[7]![0].where).toEqual({
      AND: [
        { AND: [{ trangThai: 'HOAT_DONG', maUngDung: { notIn: ['0001'] } }] },
        { maUngDung: { lte: '1002' } },
        { maUngDung: { notIn: [] } },
      ],
    });
  });

  it('không tiến con trỏ qua repo bị cắt ngang vì GitHub Rate Limit', async () => {
    const taoApp = (ma: string, ten: string) => ({
      maUngDung: ma,
      tenRepoDayDu: ten,
      daLuuTru: false,
      danhSachPhatHanh: [{ tenPhienBan: '1.0.0' }],
    });
    const xong = taoApp('0001', 'owner/xong');
    const biCat = taoApp('0002', 'owner/bi-cat');
    mockPrisma.ungDung.findMany.mockResolvedValueOnce([xong, biCat]).mockResolvedValueOnce([]);
    mockGithubService.layReleaseMoiNhat
      .mockResolvedValueOnce({ tag_name: '1.0.0' })
      .mockRejectedValueOnce(new Error('GitHub API 403 rate limit'));

    await job.scanReleases(4);

    const conTro = cacheGiaLap.get('fs:jobs:release-scan:priority-cursor');
    expect(conTro).toBe('0001');
  });
});

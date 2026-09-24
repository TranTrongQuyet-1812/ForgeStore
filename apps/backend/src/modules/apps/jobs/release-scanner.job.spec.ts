import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { AppsService } from '../apps.service';
import { ReleaseScannerJob } from './release-scanner.job';

interface MockPrisma {
  ungDung: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

interface MockGithubService {
  layReleaseMoiNhat: ReturnType<typeof vi.fn>;
  getRateLimitInfo: ReturnType<typeof vi.fn>;
}

interface MockAppsService {
  dongBoRepo: ReturnType<typeof vi.fn>;
}

describe('ReleaseScannerJob (P2-25)', () => {
  let job: ReleaseScannerJob;
  let mockPrisma: MockPrisma;
  let mockGithubService: MockGithubService;
  let mockAppsService: MockAppsService;

  beforeEach(() => {
    mockPrisma = {
      ungDung: {
        findMany: vi.fn(),
      },
    };

    mockGithubService = {
      layReleaseMoiNhat: vi.fn(),
      getRateLimitInfo: vi
        .fn()
        .mockReturnValue({ remaining: 4900, limit: 5000, reset: 1700000000 }),
    };

    mockAppsService = {
      dongBoRepo: vi.fn(),
    };

    job = new ReleaseScannerJob(
      mockPrisma as unknown as PrismaService,
      mockGithubService as unknown as GithubService,
      mockAppsService as unknown as AppsService,
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
});

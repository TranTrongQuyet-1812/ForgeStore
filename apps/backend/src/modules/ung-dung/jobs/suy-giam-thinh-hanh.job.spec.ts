import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrendingDecayJob } from './suy-giam-thinh-hanh.job';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';

describe('TrendingDecayJob (P3B-03.4, DELIV-72.4)', () => {
  let job: TrendingDecayJob;
  let mockPrisma: {
    ungDung: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let mockCacheService: {
    xoaTheoPrefix: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      ungDung: {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    mockCacheService = {
      xoaTheoPrefix: vi.fn().mockResolvedValue(true),
    };

    job = new TrendingDecayJob(
      mockPrisma as unknown as PrismaService,
      mockCacheService as unknown as CacheService,
    );
  });

  it('Quét và cập nhật điểm thịnh hành cho toàn bộ ứng dụng đang hoạt động', async () => {
    const now = new Date();
    const mockApps = [
      {
        maUngDung: 'app-1',
        soSaoGithub: 1000,
        dongBoLanCuoi: now,
        danhSachPhatHanh: [
          {
            ngayPhatHanh: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 ngày trước
          },
        ],
      },
      {
        maUngDung: 'app-2',
        soSaoGithub: 50,
        dongBoLanCuoi: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        danhSachPhatHanh: [],
      },
    ];

    mockPrisma.ungDung.findMany.mockResolvedValue(mockApps);

    const result = await job.capNhatDiemThinhHanhToanBo();

    expect(result.soLuongCapNhat).toBe(2);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { maUngDung: 'app-1' },
        data: expect.objectContaining({
          diemThinhHanh: expect.any(Number),
        }),
      }),
    );
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
  });

  it('Bỏ qua chu kỳ nếu tác vụ trước đó đang chạy dở (isRunning = true)', async () => {
    // Ép trạng thái isRunning = true
    Object.assign(job, { isRunning: true });

    const result = await job.capNhatDiemThinhHanhToanBo();

    expect(result.soLuongCapNhat).toBe(0);
    expect(mockPrisma.ungDung.findMany).not.toHaveBeenCalled();
  });

  it('Bắt lỗi an toàn và giải phóng cờ isRunning khi CSDL gặp sự cố', async () => {
    mockPrisma.ungDung.findMany.mockRejectedValue(new Error('DB Connection Failed'));

    const result = await job.capNhatDiemThinhHanhToanBo();

    expect(result.soLuongCapNhat).toBe(0);
    expect((job as unknown as { isRunning: boolean }).isRunning).toBe(false);
  });

  it('handleCron kích hoạt capNhatDiemThinhHanhToanBo', async () => {
    const spy = vi
      .spyOn(job, 'capNhatDiemThinhHanhToanBo')
      .mockResolvedValue({ soLuongCapNhat: 5 });

    await job.handleCron();

    expect(spy).toHaveBeenCalled();
  });
});

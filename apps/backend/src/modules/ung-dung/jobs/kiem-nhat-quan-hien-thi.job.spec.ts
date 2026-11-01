import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KiemNhatQuanHienThiJob } from './kiem-nhat-quan-hien-thi.job';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';

describe('KiemNhatQuanHienThiJob (P3B-25.8, D-30)', () => {
  let job: KiemNhatQuanHienThiJob;
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

    job = new KiemNhatQuanHienThiJob(
      mockPrisma as unknown as PrismaService,
      mockCacheService as unknown as CacheService,
    );
  });

  it('(a) Tự sửa sang HOAT_DONG và xóa cache khi app đang KHONG_CO_BAN_CAI nhưng có tệp cài Windows', async () => {
    const mockAppAnCoTep = [
      {
        maUngDung: 'app-an-1',
        tenRepoDayDu: 'org/desktop-app',
        trangThai: 'KHONG_CO_BAN_CAI',
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            danhSachTepCaiDat: [{ maTep: 'file-exe-1' }],
          },
        ],
      },
    ];

    // Lần 1 gọi cho KHONG_CO_BAN_CAI, lần 2 gọi cho HOAT_DONG
    mockPrisma.ungDung.findMany.mockResolvedValueOnce(mockAppAnCoTep).mockResolvedValueOnce([]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(1);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-an-1' },
      data: { trangThai: 'HOAT_DONG' },
    });
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:detail:');
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:categories:');
  });

  it('(a) Tự sửa sang HOAT_DONG và xóa cache khi app đang KHONG_CO_BAN_CAI nhưng có lệnh cài CLI', async () => {
    const mockAppAnCoCli = [
      {
        maUngDung: 'app-an-cli',
        tenRepoDayDu: 'cli/tool',
        trangThai: 'KHONG_CO_BAN_CAI',
        phanTichAI: {
          huongDanCaiDat: {
            cachCai: [
              {
                trinhQuanLy: 'winget',
                tenGoi: 'tool',
                ten: 'Cài đặt qua winget',
              },
            ],
          },
        },
        danhSachPhatHanh: [],
      },
    ];

    mockPrisma.ungDung.findMany.mockResolvedValueOnce(mockAppAnCoCli).mockResolvedValueOnce([]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(1);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-an-cli' },
      data: { trangThai: 'HOAT_DONG' },
    });
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
  });

  it('(b) Chỉ cảnh báo trong log và KHÔNG tự đổi trạng thái khi app đang HOAT_DONG nhưng không có tệp cài hay CLI', async () => {
    const mockAppHienKhongCoGi = [
      {
        maUngDung: 'app-hien-loi',
        tenRepoDayDu: 'empty/repo',
        trangThai: 'HOAT_DONG',
        phanTichAI: {
          huongDanCaiDat: {
            khongCoHuongDan: true,
          },
        },
        danhSachPhatHanh: [],
      },
    ];

    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce([]) // Không có app ẩn nào bị sai
      .mockResolvedValueOnce(mockAppHienKhongCoGi); // Có 1 app hiện sai

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(1);
    expect(mockPrisma.ungDung.update).not.toHaveBeenCalled();
    expect(mockCacheService.xoaTheoPrefix).not.toHaveBeenCalled();
  });

  it('Không có lệch thì không sửa và không xóa cache', async () => {
    const mockAppAnDung = [
      {
        maUngDung: 'app-an-dung',
        tenRepoDayDu: 'doc/only',
        trangThai: 'KHONG_CO_BAN_CAI',
        phanTichAI: null,
        danhSachPhatHanh: [],
      },
    ];
    const mockAppHienDung = [
      {
        maUngDung: 'app-hien-dung',
        tenRepoDayDu: 'real/app',
        trangThai: 'HOAT_DONG',
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            danhSachTepCaiDat: [{ maTep: 'file-msi' }],
          },
        ],
      },
    ];

    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce(mockAppAnDung)
      .mockResolvedValueOnce(mockAppHienDung);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.update).not.toHaveBeenCalled();
    expect(mockCacheService.xoaTheoPrefix).not.toHaveBeenCalled();
  });

  it('Bắt lỗi an toàn và giải phóng cờ isRunning khi CSDL gặp sự cố (không sập tiến trình)', async () => {
    mockPrisma.ungDung.findMany.mockRejectedValue(new Error('Lỗi mất kết nối CSDL PostgreSQL'));

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(0);
    expect((job as unknown as { isRunning: boolean }).isRunning).toBe(false);
  });

  it('Bỏ qua chu kỳ nếu tác vụ trước đó đang chạy dở (isRunning = true)', async () => {
    Object.assign(job, { isRunning: true });

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.findMany).not.toHaveBeenCalled();
  });

  it('handleCron kích hoạt tác vụ kiemTraVaSuaNhatQuanHienThi', async () => {
    const spy = vi
      .spyOn(job, 'kiemTraVaSuaNhatQuanHienThi')
      .mockResolvedValue({ soLuongDaSua: 3, soLuongCanhBao: 1 });

    await job.handleCron();

    expect(spy).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiFallbackRetryJob } from './ai-fallback-retry.job';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { LlmRotationService } from '../services/llm-rotation.service';

describe('AiFallbackRetryJob (P2-39 & Giới Hạn 3 Lần Thử)', () => {
  let job: AiFallbackRetryJob;
  let mockPrisma: {
    phanTichAI: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let mockGithubService: {
    layReadme: ReturnType<typeof vi.fn>;
  };
  let mockLlmRotationService: {
    kiemTraKhoa: ReturnType<typeof vi.fn>;
    tomTatReadme: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      phanTichAI: {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    mockGithubService = {
      layReadme: vi.fn().mockResolvedValue('# Termux README\nAndroid terminal app'),
    };
    mockLlmRotationService = {
      kiemTraKhoa: vi.fn().mockResolvedValue(false),
      tomTatReadme: vi.fn(),
    };

    job = new AiFallbackRetryJob(
      mockPrisma as unknown as PrismaService,
      mockGithubService as unknown as GithubService,
      mockLlmRotationService as unknown as LlmRotationService,
    );
  });

  it('Bỏ qua khi tất cả các nhà cung cấp LLM đều đang bị khóa', async () => {
    mockLlmRotationService.kiemTraKhoa.mockResolvedValue(true);

    await job.chayJobTomTatLai();

    expect(mockPrisma.phanTichAI.findMany).not.toHaveBeenCalled();
  });

  it('Chỉ tìm các app có moHinhTomTat = DU_PHONG và soLanThuLai < 3', async () => {
    mockPrisma.phanTichAI.findMany.mockResolvedValue([]);

    await job.chayJobTomTatLai();

    expect(mockPrisma.phanTichAI.findMany).toHaveBeenCalledWith({
      where: {
        moHinhTomTat: 'DU_PHONG',
        soLanThuLai: { lt: 3 },
      },
      include: {
        ungDung: true,
      },
      take: 10,
    });
  });

  it('Tóm tắt lại thành công: cập nhật model mới và reset soLanThuLai = 0', async () => {
    mockPrisma.phanTichAI.findMany.mockResolvedValue([
      {
        maPhanTich: 'analysis-1',
        moHinhTomTat: 'DU_PHONG',
        soLanThuLai: 1,
        ungDung: {
          tenRepoDayDu: 'termux/termux-app',
          moTaGocTiengAnh: 'Terminal emulator for Android',
        },
      },
    ]);

    mockLlmRotationService.tomTatReadme.mockResolvedValue({
      ketQua: {
        khauHieu: 'Môi trường dòng lệnh Linux trên Android',
        tinhNang: [{ tieuDe: 'Terminal', moTa: 'Chạy Linux packages' }],
      },
      moHinhTomTat: 'gemini-3.1-flash-lite',
    });

    await job.chayJobTomTatLai();

    expect(mockPrisma.phanTichAI.update).toHaveBeenCalledWith({
      where: { maPhanTich: 'analysis-1' },
      data: expect.objectContaining({
        moHinhTomTat: 'gemini-3.1-flash-lite',
        soLanThuLai: 0,
      }),
    });
  });

  it('Tóm tắt lại vẫn ra DU_PHONG: tăng soLanThuLai lên 1', async () => {
    mockPrisma.phanTichAI.findMany.mockResolvedValue([
      {
        maPhanTich: 'analysis-1',
        moHinhTomTat: 'DU_PHONG',
        soLanThuLai: 0,
        ungDung: {
          tenRepoDayDu: 'termux/termux-app',
          moTaGocTiengAnh: 'Terminal emulator for Android',
        },
      },
    ]);

    mockLlmRotationService.tomTatReadme.mockResolvedValue({
      ketQua: {
        khauHieu: 'Fallback',
        tinhNang: [{ tieuDe: 'Fallback', moTa: 'Fallback' }],
      },
      moHinhTomTat: 'DU_PHONG',
    });

    await job.chayJobTomTatLai();

    expect(mockPrisma.phanTichAI.update).toHaveBeenCalledWith({
      where: { maPhanTich: 'analysis-1' },
      data: expect.objectContaining({
        soLanThuLai: { increment: 1 },
      }),
    });
  });

  it('Khi gặp ngoại lệ trong quá trình tóm tắt: vẫn tăng soLanThuLai để tránh kẹt vô tận', async () => {
    mockPrisma.phanTichAI.findMany.mockResolvedValue([
      {
        maPhanTich: 'analysis-1',
        moHinhTomTat: 'DU_PHONG',
        soLanThuLai: 2,
        ungDung: {
          tenRepoDayDu: 'termux/termux-app',
          moTaGocTiengAnh: 'Terminal emulator for Android',
        },
      },
    ]);

    mockLlmRotationService.tomTatReadme.mockRejectedValue(new Error('Network crash'));

    await job.chayJobTomTatLai();

    expect(mockPrisma.phanTichAI.update).toHaveBeenCalledWith({
      where: { maPhanTich: 'analysis-1' },
      data: expect.objectContaining({
        soLanThuLai: { increment: 1 },
      }),
    });
  });
});

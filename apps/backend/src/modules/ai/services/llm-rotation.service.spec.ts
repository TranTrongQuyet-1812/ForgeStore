import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../redis/cache.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { NvidiaNimProvider } from '../providers/nvidia-nim.provider';
import { LlmRotationService } from './llm-rotation.service';
import { LlmRateLimiterService } from './llm-rate-limiter.service';

describe('LlmRotationService (P2-39, D-15 & AI1: Token Bucket Rate Limiting)', () => {
  let service: LlmRotationService;
  let mockGeminiProvider: Partial<GeminiProvider>;
  let mockNvidiaNimProvider: Partial<NvidiaNimProvider>;
  let mockCacheService: {
    lay: ReturnType<typeof vi.fn>;
    luu: ReturnType<typeof vi.fn>;
    xoa: ReturnType<typeof vi.fn>;
  };
  let mockRateLimiter: {
    layToken: ReturnType<typeof vi.fn>;
    layRpm: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockGeminiProvider = {
      ten: 'GEMINI',
      tenModel: 'gemini-3.1-flash-lite',
      tomTatChangelog: vi.fn(),
    };

    mockNvidiaNimProvider = {
      ten: 'NVIDIA_NIM',
      tenModel: 'meta/llama-3.1-70b-instruct',
      tomTatChangelog: vi.fn(),
    };

    mockCacheService = {
      lay: vi.fn().mockResolvedValue(null),
      luu: vi.fn().mockResolvedValue(undefined),
      xoa: vi.fn().mockResolvedValue(undefined),
    };

    mockRateLimiter = {
      layToken: vi.fn().mockResolvedValue({
        chapNhan: true,
        conLai: 11,
        capacity: 12,
      }),
      layRpm: vi.fn((key: string) => (key.includes('gemini') ? 12 : 30)),
    };

    service = new LlmRotationService(
      mockGeminiProvider as GeminiProvider,
      mockNvidiaNimProvider as NvidiaNimProvider,
      mockCacheService as unknown as CacheService,
      mockRateLimiter as unknown as LlmRateLimiterService,
    );
  });

  describe('tomTatChangelog', () => {
    it('Tóm tắt changelog thành công qua Gemini', async () => {
      (mockGeminiProvider.tomTatChangelog as ReturnType<typeof vi.fn>).mockResolvedValue({
        diemMoi: ['Sửa lỗi kết nối', 'Tăng tốc truyền file'],
      });

      const res = await service.tomTatChangelog('Fix bug and improve perf', 'rustdesk/rustdesk');
      expect(res.moHinhTomTat).toBe('gemini-3.1-flash-lite');
      expect(res.ketQua.diemMoi).toHaveLength(2);
    });

    it('AI1: Chủ động xoay sang NVIDIA NIM cho changelog khi Gemini hết token', async () => {
      mockRateLimiter.layToken.mockImplementation(async (providerKey: string) => {
        if (providerKey === 'GEMINI') {
          return { chapNhan: false, conLai: 0, capacity: 12 };
        }
        return { chapNhan: true, conLai: 29, capacity: 30 };
      });

      (mockNvidiaNimProvider.tomTatChangelog as ReturnType<typeof vi.fn>).mockResolvedValue({
        diemMoi: ['Changelog từ NIM'],
      });

      const res = await service.tomTatChangelog('Fix bug', 'rustdesk/rustdesk');
      expect(res.moHinhTomTat).toBe('meta/llama-3.1-70b-instruct');
      expect(mockGeminiProvider.tomTatChangelog).not.toHaveBeenCalled();
      expect(mockNvidiaNimProvider.tomTatChangelog).toHaveBeenCalledTimes(1);
    });
  });

  describe('trichXuatHuongDanCaiDat', () => {
    const rawReadme = `# Test\n## Installation\n\`\`\`bash\npip install my-app\n\`\`\``;
    const installSection = `## Installation\n\`\`\`bash\npip install my-app\n\`\`\``;

    it('Trích xuất hướng dẫn CLI thành công qua Gemini', async () => {
      mockGeminiProvider.trichXuatHuongDanCaiDat = vi.fn().mockResolvedValue({
        cachCai: [
          {
            ten: 'Cài đặt bằng pip',
            nhom: 'PIP',
            heDieuHanh: 'DUNG_CHUNG',
            phanCung: 'CPU',
            buoc: [{ moTa: 'Cài đặt', lenh: 'pip install my-app' }],
          },
        ],
      });

      const res = await service.trichXuatHuongDanCaiDat(installSection, 'owner/test', rawReadme);
      expect(res).not.toBeNull();
      expect(res?.cachCai[0]?.nhom).toBe('PIP');
      expect(mockGeminiProvider.trichXuatHuongDanCaiDat).toHaveBeenCalledTimes(1);
    });

    it('Chủ động xoay sang NVIDIA NIM khi Gemini hết token bucket cho CLI guide', async () => {
      mockRateLimiter.layToken.mockImplementation(async (providerKey: string) => {
        if (providerKey === 'GEMINI') {
          return { chapNhan: false, conLai: 0, capacity: 12 };
        }
        return { chapNhan: true, conLai: 29, capacity: 30 };
      });

      mockNvidiaNimProvider.trichXuatHuongDanCaiDat = vi.fn().mockResolvedValue({
        cachCai: [
          {
            ten: 'Cài đặt từ NIM',
            nhom: 'PIP',
            heDieuHanh: 'DUNG_CHUNG',
            phanCung: 'CPU',
            buoc: [{ moTa: 'Cài đặt', lenh: 'pip install my-app' }],
          },
        ],
      });

      const res = await service.trichXuatHuongDanCaiDat(installSection, 'owner/test', rawReadme);
      expect(res).not.toBeNull();
      expect(mockNvidiaNimProvider.trichXuatHuongDanCaiDat).toHaveBeenCalledTimes(1);
    });

    it('Fallback sang bocTachHuongDanTuCodeBlocks khi cả hai provider đều bị khóa', async () => {
      mockCacheService.lay.mockResolvedValue(true); // cả 2 đều bị khóa 429

      const res = await service.trichXuatHuongDanCaiDat(installSection, 'owner/test', rawReadme);
      expect(res).not.toBeNull();
      expect(res?.cachCai.length).toBeGreaterThanOrEqual(1);
      expect(res?.cachCai[0]?.buoc[0]?.lenh).toBe('pip install my-app');
    });
  });

  describe('moKhoaProvider', () => {
    it('Xóa key khóa trong cache khi mở khóa thủ công', async () => {
      await service.moKhoaProvider('GEMINI');
      expect(mockCacheService.xoa).toHaveBeenCalledWith('fs:llm:khoa:GEMINI');
    });
  });
});

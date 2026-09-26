import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../redis/cache.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { NvidiaNimProvider } from '../providers/nvidia-nim.provider';
import { LlmRotationService } from './llm-rotation.service';
import { LlmRateLimiterService } from './llm-rate-limiter.service';
import { KetQuaTomTat } from '../dto/ai-summary.dto';

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

  const sampleKetQua: KetQuaTomTat = {
    khauHieu: 'Điều khiển máy tính từ xa siêu tốc',
    tinhNang: [
      {
        tieuDe: 'Mã hóa đầu cuối',
        moTa: 'Bảo mật an toàn dữ liệu.',
        trichDan: 'End-to-end encryption',
      },
    ],
  };

  beforeEach(() => {
    mockGeminiProvider = {
      ten: 'GEMINI',
      tenModel: 'gemini-3.1-flash-lite',
      tomTatReadme: vi.fn(),
      tomTatChangelog: vi.fn(),
    };

    mockNvidiaNimProvider = {
      ten: 'NVIDIA_NIM',
      tenModel: 'meta/llama-3.1-70b-instruct',
      tomTatReadme: vi.fn(),
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

  describe('tomTatReadme', () => {
    it('Ưu tiên gọi Gemini đầu tiên khi chưa bị khóa và còn Token Bucket', async () => {
      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValue(sampleKetQua);

      const res = await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');

      expect(res.moHinhTomTat).toBe('gemini-3.1-flash-lite');
      expect(mockRateLimiter.layToken).toHaveBeenCalledWith('GEMINI');
      expect(mockGeminiProvider.tomTatReadme).toHaveBeenCalledTimes(1);
      expect(mockNvidiaNimProvider.tomTatReadme).not.toHaveBeenCalled();
    });

    it('AI1: Chủ động xoay sang NVIDIA NIM khi Gemini hết Token Bucket mà không đợi lỗi 429', async () => {
      // Giả lập Gemini hết token, NIM còn token
      mockRateLimiter.layToken.mockImplementation(async (providerKey: string) => {
        if (providerKey === 'GEMINI') {
          return { chapNhan: false, conLai: 0, capacity: 12 };
        }
        return { chapNhan: true, conLai: 29, capacity: 30 };
      });

      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValue(
        sampleKetQua,
      );

      const res = await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');

      // Phải tự động chuyển sang NIM
      expect(res.moHinhTomTat).toBe('meta/llama-3.1-70b-instruct');
      expect(mockGeminiProvider.tomTatReadme).not.toHaveBeenCalled();
      expect(mockNvidiaNimProvider.tomTatReadme).toHaveBeenCalledTimes(1);
    });

    it('Tự động xoay tua sang NVIDIA NIM khi Gemini dính 429 và khóa Gemini', async () => {
      const err429 = new Error('Resource has been exhausted (e.g. check quota). 429');
      (err429 as unknown as { status: number }).status = 429;

      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockRejectedValue(err429);
      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValue(
        sampleKetQua,
      );

      const res = await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');

      expect(res.moHinhTomTat).toBe('meta/llama-3.1-70b-instruct');
      expect(mockGeminiProvider.tomTatReadme).toHaveBeenCalledTimes(1);
      expect(mockNvidiaNimProvider.tomTatReadme).toHaveBeenCalledTimes(1);
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        'fs:llm:khoa:GEMINI',
        true,
        service.THOI_GIAN_KHOA_PHUT,
      );
    });

    it('Chuyển sang nội dung DU_PHONG khi cả 2 nhà cung cấp đều bị lỗi hoặc bị khóa (P2-39.5)', async () => {
      const err429 = new Error('429');
      (err429 as unknown as { status: number }).status = 429;

      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockRejectedValue(err429);
      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockRejectedValue(err429);

      const res = await service.tomTatReadme(
        '# Readme',
        'rustdesk/rustdesk',
        'Phần mềm điều khiển máy tính từ xa mã nguồn mở',
      );

      expect(res.moHinhTomTat).toBe('DU_PHONG');
      expect(res.ketQua.khauHieu).toContain('Phần mềm điều khiển máy tính từ xa');
      expect(res.ketQua.tinhNang[0].tieuDe).toBe('Giới thiệu tổng quan');
    });
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

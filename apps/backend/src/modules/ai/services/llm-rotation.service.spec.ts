import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../redis/cache.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { NvidiaNimProvider } from '../providers/nvidia-nim.provider';
import { LlmRotationService } from './llm-rotation.service';
import { KetQuaTomTat } from '../dto/ai-summary.dto';

describe('LlmRotationService (P2-39 & D-15: Gemini ⇄ NVIDIA NIM Rotation)', () => {
  let service: LlmRotationService;
  let mockGeminiProvider: Partial<GeminiProvider>;
  let mockNvidiaNimProvider: Partial<NvidiaNimProvider>;
  let mockCacheService: {
    lay: ReturnType<typeof vi.fn>;
    luu: ReturnType<typeof vi.fn>;
    xoa: ReturnType<typeof vi.fn>;
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

    service = new LlmRotationService(
      mockGeminiProvider as GeminiProvider,
      mockNvidiaNimProvider as NvidiaNimProvider,
      mockCacheService as unknown as CacheService,
    );
  });

  describe('tomTatReadme', () => {
    it('Ưu tiên gọi Gemini đầu tiên khi chưa bị khóa', async () => {
      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValue(sampleKetQua);

      const res = await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');

      expect(res.moHinhTomTat).toBe('gemini-3.1-flash-lite');
      expect(res.ketQua.khauHieu).toBe(sampleKetQua.khauHieu);
      expect(mockGeminiProvider.tomTatReadme).toHaveBeenCalledTimes(1);
      expect(mockNvidiaNimProvider.tomTatReadme).not.toHaveBeenCalled();
    });

    it('Tự động xoay sang NVIDIA NIM khi Gemini gặp lỗi 429 và khóa Gemini trong Cache (D-15)', async () => {
      const err429 = new Error('Quota exceeded: 429 Too Many Requests');
      (err429 as unknown as { status: number }).status = 429;

      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockRejectedValue(err429);
      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValue(
        sampleKetQua,
      );

      const res = await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');

      expect(res.moHinhTomTat).toBe('meta/llama-3.1-70b-instruct');
      expect(mockGeminiProvider.tomTatReadme).toHaveBeenCalledTimes(1);
      expect(mockNvidiaNimProvider.tomTatReadme).toHaveBeenCalledTimes(1);

      // Xác nhận đã lưu khóa vào Redis/Cache
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        'fs:llm:khoa:GEMINI',
        true,
        expect.any(Number),
      );
    });

    it('Khóa 60 giây khi lỗi 429 theo phút và khóa 12 giờ khi lỗi theo ngày (Post-Review #11)', async () => {
      const errMinute = new Error(
        'Quota exceeded for quota metric Queries and limit Queries per minute',
      );
      (errMinute as unknown as { status: number }).status = 429;
      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        errMinute,
      );
      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sampleKetQua,
      );

      await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');
      expect(mockCacheService.luu).toHaveBeenCalledWith('fs:llm:khoa:GEMINI', true, 60);

      const errDaily = new Error('Requests per day exceeded for this project');
      (errDaily as unknown as { status: number }).status = 429;
      (mockGeminiProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockRejectedValueOnce(errDaily);
      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sampleKetQua,
      );

      await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');
      expect(mockCacheService.luu).toHaveBeenCalledWith('fs:llm:khoa:GEMINI', true, 43200);
    });

    it('Bỏ qua Gemini khi đang có khóa trong Cache và gọi thẳng NVIDIA NIM', async () => {
      // Mock key khóa Gemini tồn tại trong Cache
      mockCacheService.lay.mockImplementation((key: string) => {
        if (key === 'fs:llm:khoa:GEMINI') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      (mockNvidiaNimProvider.tomTatReadme as ReturnType<typeof vi.fn>).mockResolvedValue(
        sampleKetQua,
      );

      const res = await service.tomTatReadme('# Readme', 'rustdesk/rustdesk');

      expect(res.moHinhTomTat).toBe('meta/llama-3.1-70b-instruct');
      expect(mockGeminiProvider.tomTatReadme).not.toHaveBeenCalled();
      expect(mockNvidiaNimProvider.tomTatReadme).toHaveBeenCalledTimes(1);
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
  });

  describe('moKhoaProvider', () => {
    it('Xóa key khóa trong cache khi mở khóa thủ công', async () => {
      await service.moKhoaProvider('GEMINI');
      expect(mockCacheService.xoa).toHaveBeenCalledWith('fs:llm:khoa:GEMINI');
    });
  });
});

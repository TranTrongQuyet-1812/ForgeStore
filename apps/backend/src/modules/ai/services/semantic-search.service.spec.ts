import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SemanticSearchService } from './semantic-search.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRateLimiterService } from './llm-rate-limiter.service';

describe('SemanticSearchService (P2-36 & AI1: Embedding Rate Limiting)', () => {
  let service: SemanticSearchService;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };
  let mockPrisma: {
    $executeRaw: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let mockRateLimiter: {
    layToken: ReturnType<typeof vi.fn>;
    layRpm: ReturnType<typeof vi.fn>;
  };
  let mockEmbedContent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
        if (key === 'GEMINI_EMBEDDING_MODEL') return 'gemini-embedding-001';
        return null;
      }),
    };

    mockPrisma = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn(),
    };

    mockRateLimiter = {
      layToken: vi.fn().mockResolvedValue({
        chapNhan: true,
        conLai: 79,
        capacity: 80,
      }),
      layRpm: vi.fn().mockReturnValue(80),
    };

    mockEmbedContent = vi.fn().mockResolvedValue({
      embeddings: [
        {
          values: new Array(768).fill(0.12345),
        },
      ],
    });

    service = new SemanticSearchService(
      mockConfigService as unknown as ConfigService,
      mockPrisma as unknown as PrismaService,
      mockRateLimiter as unknown as LlmRateLimiterService,
    );

    // Gán mock client models.embedContent
    (
      service as unknown as { client: { models: { embedContent: typeof mockEmbedContent } } }
    ).client = {
      models: {
        embedContent: mockEmbedContent,
      },
    };
  });

  describe('chuanBiVanBanNhung (P2-36.1)', () => {
    it('Ghép đầy đủ các trường: tên, slogan, tính năng, chủ đề, mô tả', () => {
      const text = service.chuanBiVanBanNhung({
        tenKhoChua: 'RustDesk',
        slogan: 'Điều khiển máy tính từ xa mã nguồn mở',
        tinhNang: ['Bảo mật đầu cuối', 'Độ trễ thấp', 'Hỗ trợ đa nền tảng'],
        topics: ['remote-desktop', 'rust'],
        moTa: 'Phần mềm thay thế TeamViewer',
      });

      expect(text).toContain('Ứng dụng: RustDesk');
      expect(text).toContain('Khẩu hiệu: Điều khiển máy tính từ xa mã nguồn mở');
      expect(text).toContain('Tính năng: Bảo mật đầu cuối; Độ trễ thấp; Hỗ trợ đa nền tảng');
      expect(text).toContain('Chủ đề: remote-desktop, rust');
      expect(text).toContain('Mô tả: Phần mềm thay thế TeamViewer');
    });

    it('Xử lý an toàn khi các trường tùy chọn bị null hoặc undefined', () => {
      const text = service.chuanBiVanBanNhung({
        tenKhoChua: 'SimpleApp',
      });

      expect(text).toBe('Ứng dụng: SimpleApp');
    });
  });

  describe('sinhEmbedding (P2-36.1 & AI1)', () => {
    it('AI1: gọi layToken cho gemini_embedding trước khi gọi embedContent', async () => {
      const vector = await service.sinhEmbedding('RustDesk remote desktop software');

      expect(mockRateLimiter.layToken).toHaveBeenCalledWith('gemini_embedding', 3000);
      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: 'gemini-embedding-001',
        contents: 'RustDesk remote desktop software',
        config: {
          outputDimensionality: 768,
        },
      });
      expect(vector).toHaveLength(768);
    });

    it('AI1: ném lỗi nếu gemini_embedding bị từ chối do hết Token Bucket', async () => {
      mockRateLimiter.layToken.mockResolvedValueOnce({
        chapNhan: false,
        conLai: 0,
        capacity: 80,
      });

      await expect(service.sinhEmbedding('test text')).rejects.toThrow(
        'Gemini Embedding đã chạm trần Rate Limit (80 RPM)',
      );
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('Ném lỗi khi văn bản đầu vào rỗng', async () => {
      await expect(service.sinhEmbedding('   ')).rejects.toThrow(
        'Văn bản đầu vào sinh embedding không được để trống.',
      );
    });

    it('Ném lỗi khi client chưa cấu hình', async () => {
      (service as unknown as { client: null }).client = null;

      await expect(service.sinhEmbedding('test text')).rejects.toThrow(
        'GEMINI_API_KEY không khả dụng để sinh embedding.',
      );
    });
  });

  describe('luuVectorNguNghia (P2-36.2)', () => {
    it('Thực thi câu lệnh SQL thô $executeRaw cập nhật vector vào bảng phan_tich_ai', async () => {
      const dummyVector = [0.1, 0.2, 0.3];
      await service.luuVectorNguNghia('11111111-1111-1111-1111-111111111111', dummyVector);

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('Bỏ qua khi vector rỗng', async () => {
      await service.luuVectorNguNghia('11111111-1111-1111-1111-111111111111', []);
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('timKiemNguNghia (P2-36.3)', () => {
    it('Sinh vector và truy vấn pgvector với toán tử khoảng cách cosine <=>', async () => {
      const mockRawRows = [
        {
          maUngDung: 'uuid-1',
          tenRepoDayDu: 'rustdesk/rustdesk',
          chuSoHuu: 'rustdesk',
          tenKhoChua: 'rustdesk',
          duongDanIcon: 'https://icon.png',
          soSaoGithub: 75000,
          danhMucChinh: 'Tiện ích',
          nenTangHoTro: 'DA_NEN_TANG',
          khauHieuTiengViet: 'Điều khiển máy tính từ xa',
          diemUyTin: 92,
          mucDoAnToan: 'XUAT_SAC',
          khoangCach: 0.15,
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockRawRows);

      const results = await service.timKiemNguNghia('điều khiển máy tính từ xa', 10);

      expect(mockEmbedContent).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].tenRepoDayDu).toBe('rustdesk/rustdesk');
      expect(results[0].doTuongDong).toBeCloseTo(0.85); // 1 - 0.15
    });
  });
});

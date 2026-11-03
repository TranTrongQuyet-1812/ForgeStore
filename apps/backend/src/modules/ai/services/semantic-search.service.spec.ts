import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  MO_HINH_EMBEDDING,
  SemanticSearchService,
  locTheoNguongDoGiong,
} from './semantic-search.service';
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
    giuChoEmbedding: ReturnType<typeof vi.fn>;
  };
  let mockEmbedContent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
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
      giuChoEmbedding: vi.fn().mockResolvedValue(true),
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
    it('Ghép tên, mô tả, chủ đề và danh mục (P3B-09.1)', () => {
      const text = service.chuanBiVanBanNhung({
        tenKhoChua: 'RustDesk',
        moTa: 'Phần mềm thay thế TeamViewer',
        topics: ['remote-desktop', 'rust'],
        danhMuc: 'Tiện ích hệ thống',
      });

      expect(text).toBe(
        [
          'Ứng dụng: RustDesk',
          'Mô tả: Phần mềm thay thế TeamViewer',
          'Chủ đề: remote-desktop, rust',
          'Danh mục: Tiện ích hệ thống',
        ].join('\n'),
      );
      expect(text).not.toContain('Khẩu hiệu');
      expect(text).not.toContain('Tính năng');
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

  describe('Embedding 2, cột vector riêng (P3B-28.3)', () => {
    const [E1, E2] = MO_HINH_EMBEDDING;

    it('hết hũ ngày thì không gọi API', async () => {
      mockRateLimiter.giuChoEmbedding.mockResolvedValueOnce(false);
      await expect(service.sinhEmbedding('text', E2)).rejects.toThrow('hết lượt trong ngày');
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('sinh bằng Embedding 2 thì dùng đúng mô hình, hũ phút và cột của nó', async () => {
      await service.sinhEmbedding('text', E2);
      expect(mockRateLimiter.giuChoEmbedding).toHaveBeenCalledWith('gemini-embedding-2');
      expect(mockRateLimiter.layToken).toHaveBeenCalledWith('gemini_embedding_2', 3000);
      expect(mockEmbedContent.mock.calls[0][0].model).toBe('gemini-embedding-2');

      await service.luuVectorNguNghia('11111111-1111-1111-1111-111111111111', [0.1], E2);
      expect(JSON.stringify(mockPrisma.$executeRaw.mock.calls[0])).toContain('vector_ngu_nghia_v2');
    });

    it('hết hũ Embedding 1 thì tìm bằng Embedding 2 trong cột 2, không trộn cột 1', async () => {
      mockRateLimiter.giuChoEmbedding.mockImplementation(async (m: string) => m !== E1.model);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.timKiemNguNghia('ghi chú');

      expect(mockEmbedContent.mock.calls[0][0].model).toBe('gemini-embedding-2');
      const sql = JSON.stringify(mockPrisma.$queryRaw.mock.calls[0]);
      expect(sql).toContain('pa.\\"vector_ngu_nghia_v2\\"');
      expect(sql).not.toContain('pa.\\"vector_ngu_nghia\\"');
    });

    it('cả hai mô hình hết hũ thì báo lỗi, không gọi API', async () => {
      mockRateLimiter.giuChoEmbedding.mockResolvedValue(false);
      await expect(service.timKiemNguNghia('ghi chú')).rejects.toThrow('đều đã hết lượt');
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('bổ sung vector: chạy thử chỉ đếm, chạy thật dừng khi hết hũ ngày', async () => {
      const dong = (id: string) => ({
        maPhanTich: id,
        tenKhoChua: 'app',
        chuDe: ['notes'],
        moTa: 'Ghi chú',
        danhMuc: 'Năng suất',
      });
      mockPrisma.$queryRaw.mockResolvedValue([dong('a'), dong('b'), dong('c')]);

      await expect(service.boSungVectorConThieu(E2, 10, false)).resolves.toEqual({
        conThieu: 3,
        daGhi: 0,
        loi: 0,
      });
      expect(mockEmbedContent).not.toHaveBeenCalled();

      mockRateLimiter.giuChoEmbedding
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await expect(service.boSungVectorConThieu(E2, 10, true)).resolves.toEqual({
        conThieu: 3,
        daGhi: 1,
        loi: 1,
      });
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('locTheoNguongDoGiong (P3B-09.4)', () => {
    const r = (khoangCach: number) => ({ khoangCach });

    it('chụp màn hình: giữ 3 app sát nhau, bỏ phần đuôi', () => {
      const kq = locTheoNguongDoGiong([0.324, 0.336, 0.358, 0.432, 0.435].map(r));
      expect(kq.map((x) => x.khoangCach)).toEqual([0.324, 0.336, 0.358]);
    });

    it('câu không liên quan (tốt nhất > 0.42) trả rỗng', () => {
      expect(locTheoNguongDoGiong([0.428, 0.444, 0.446].map(r))).toEqual([]);
    });

    it('một kết quả rất giống thì chỉ trả một', () => {
      expect(locTheoNguongDoGiong([0.3, 0.446, 0.45].map(r))).toHaveLength(1);
    });

    it('danh sách rỗng trả rỗng', () => {
      expect(locTheoNguongDoGiong([])).toEqual([]);
    });
  });
});

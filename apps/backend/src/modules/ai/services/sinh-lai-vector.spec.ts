import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { MO_HINH_EMBEDDING, SemanticSearchService } from './semantic-search.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRateLimiterService } from './llm-rate-limiter.service';

describe('SemanticSearchService.sinhLaiVectorLoiThoi (P3B-09.3)', () => {
  const prisma = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  /** Các lần ghi mã băm: câu SQL có cột ma_bam_van_ban_vector, tham số là [mã băm, mã phân tích]. */
  const lanGhiMaBam = () =>
    prisma.$executeRaw.mock.calls
      .filter((c) => (c[0] as string[]).join('').includes('ma_bam_van_ban_vector'))
      .map((c) => [c[1], c[2]]);
  const rateLimiter = { giuChoEmbedding: vi.fn(), layToken: vi.fn() };
  const embedContent = vi.fn();
  let service: SemanticSearchService;

  const dong = (ma: string, moTa: string, maBam: string | null) => ({
    maPhanTich: ma,
    tenKhoChua: 'app',
    chuDe: ['cli'],
    moTa,
    danhMuc: 'Tiện ích',
    maBam,
  });
  const vanBan = (moTa: string) => `Ứng dụng: app\nMô tả: ${moTa}\nChủ đề: cli\nDanh mục: Tiện ích`;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.giuChoEmbedding.mockResolvedValue(true);
    rateLimiter.layToken.mockResolvedValue({ chapNhan: true });
    embedContent.mockResolvedValue({ embeddings: [{ values: new Array(768).fill(0.1) }] });
    service = new SemanticSearchService(
      { get: () => 'test-key' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      rateLimiter as unknown as LlmRateLimiterService,
    );
    (service as unknown as { client: unknown }).client = { models: { embedContent } };
  });

  it('chưa có mã băm thì chỉ ghi mốc, không gọi Embedding; văn bản không đổi thì bỏ qua', async () => {
    const giu = service.tinhMaBamVanBan(vanBan('Không đổi'));
    prisma.$queryRaw.mockResolvedValue([dong('a', 'Mô tả cũ', null), dong('b', 'Không đổi', giu)]);
    const kq = await service.sinhLaiVectorLoiThoi(100);
    expect(kq).toEqual({ ghiMoc: 1, sinhLai: 0, loi: 0 });
    expect(embedContent).not.toHaveBeenCalled();
    expect(lanGhiMaBam()).toEqual([[service.tinhMaBamVanBan(vanBan('Mô tả cũ')), 'a']]);
    // Ghi mã băm bằng SQL thô, không qua Prisma update, để không đổi ngay_cap_nhat
    expect((prisma.$executeRaw.mock.calls[0]![0] as string[]).join('')).not.toContain(
      'ngay_cap_nhat',
    );
  });

  it('văn bản đổi thì sinh lại đủ mọi mô hình rồi mới ghi mã băm mới', async () => {
    prisma.$queryRaw.mockResolvedValue([dong('c', 'Mô tả mới đã dịch', 'ma-bam-cu')]);
    const kq = await service.sinhLaiVectorLoiThoi(100);
    expect(kq).toEqual({ ghiMoc: 0, sinhLai: 1, loi: 0 });
    expect(embedContent).toHaveBeenCalledTimes(MO_HINH_EMBEDDING.length);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(MO_HINH_EMBEDDING.length + 1);
    expect(lanGhiMaBam()).toEqual([[service.tinhMaBamVanBan(vanBan('Mô tả mới đã dịch')), 'c']]);
  });

  it('hết hũ ngày thì dừng, không ghi mã băm để đêm sau thử lại; tôn trọng giới hạn mỗi đêm', async () => {
    prisma.$queryRaw.mockResolvedValue([dong('d', 'x', 'cu'), dong('e', 'y', 'cu')]);
    rateLimiter.giuChoEmbedding.mockResolvedValue(false);
    expect(await service.sinhLaiVectorLoiThoi(100)).toEqual({ ghiMoc: 0, sinhLai: 0, loi: 1 });
    expect(lanGhiMaBam()).toEqual([]);

    rateLimiter.giuChoEmbedding.mockResolvedValue(true);
    expect(await service.sinhLaiVectorLoiThoi(1)).toEqual({ ghiMoc: 0, sinhLai: 1, loi: 0 });
  });
});

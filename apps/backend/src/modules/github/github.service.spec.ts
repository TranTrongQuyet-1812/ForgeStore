import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../redis/cache.service';
import { GITHUB_CONSTANTS } from './github.constants';
import { GithubService } from './github.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockCacheService {
  lay: MockFn;
  luu: MockFn;
  xoa: MockFn;
}

interface MockConfigService {
  get: MockFn;
}

describe('GithubService (P2-20)', () => {
  let service: GithubService;
  let mockCacheService: MockCacheService;
  let mockConfigService: MockConfigService;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;

    mockCacheService = {
      lay: vi.fn(),
      luu: vi.fn(),
      xoa: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'GITHUB_TOKEN') return 'ghp_mock_token_12345';
        return defaultValue;
      }),
    };

    service = new GithubService(
      mockConfigService as unknown as ConfigService,
      mockCacheService as unknown as CacheService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('ETag & Cache Mechanism (P2-20)', () => {
    it('Lần gọi đầu tiên (chưa có cache ETag): gửi request, lưu etag và data vào cache', async () => {
      const mockRepoData = { id: 101, name: 'rustdesk', full_name: 'rustdesk/rustdesk' };
      mockCacheService.lay.mockResolvedValue(null);

      const mockHeaders = new Headers({
        etag: '"etag-rustdesk-v1"',
        'x-ratelimit-remaining': '4950',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1700000000',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: async () => mockRepoData,
      } as unknown as Response);

      const result = await service.layRepo('rustdesk', 'rustdesk');

      expect(result).toEqual(mockRepoData);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Kiểm tra ETag key và Data key được lưu
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        `${GITHUB_CONSTANTS.CACHE_PREFIX_ETAG}/repos/rustdesk/rustdesk`,
        '"etag-rustdesk-v1"',
        GITHUB_CONSTANTS.CACHE_DEFAULT_TTL,
      );
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        `${GITHUB_CONSTANTS.CACHE_PREFIX_DATA}/repos/rustdesk/rustdesk`,
        mockRepoData,
        GITHUB_CONSTANTS.CACHE_DEFAULT_TTL,
      );
    });

    it('Lần gọi thứ 2 (đã có ETag): gửi If-None-Match, nhận HTTP 304, trả về cache data không tốn quota', async () => {
      const mockCachedData = { id: 101, name: 'rustdesk', full_name: 'rustdesk/rustdesk' };
      // Giả lập cache có sẵn ETag và Data
      mockCacheService.lay.mockImplementation(async (key: string) => {
        if (key.includes('etag')) return '"etag-rustdesk-v1"';
        if (key.includes('data')) return mockCachedData;
        return null;
      });

      const mockHeaders = new Headers({
        'x-ratelimit-remaining': '4949',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1700000000',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 304, // Không thay đổi (NOT MODIFIED)
        headers: mockHeaders,
      } as unknown as Response);

      const result = await service.layRepo('rustdesk', 'rustdesk');

      expect(result).toEqual(mockCachedData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/repos/rustdesk/rustdesk'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'If-None-Match': '"etag-rustdesk-v1"',
          }),
        }),
      );
    });

    it('Cảnh báo khi Rate Limit quota < 10%', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      const mockHeaders = new Headers({
        etag: '"etag-low-quota"',
        'x-ratelimit-remaining': '400', // 400 / 5000 = 8% (< 10%)
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1700000000',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: async () => ({ id: 1 }),
      } as unknown as Response);

      await service.layRepo('owner', 'repo');

      const rateInfo = service.getRateLimitInfo();
      expect(rateInfo.remaining).toBe(400);
      expect(rateInfo.limit).toBe(5000);
    });

    it('Ném lỗi TOO_MANY_REQUESTS (429) khi GitHub trả về HTTP 403 hoặc 429', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        text: async () => 'API rate limit exceeded for user',
      } as unknown as Response);

      await expect(service.layRepo('owner', 'repo')).rejects.toThrow(HttpException);
    });

    it('Ném lỗi NotFoundException khi repo không tồn tại (HTTP 404)', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => 'Not Found',
      } as unknown as Response);

      await expect(service.layRepo('nonexistent', 'repo')).rejects.toThrow(NotFoundException);
    });
  });

  describe('layReadme', () => {
    it('Giải mã base64 của README thành UTF-8 string', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      const rawMarkdown = '# ForgeStore\nApp Store nguồn mở';
      const base64Content = Buffer.from(rawMarkdown, 'utf-8').toString('base64');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          content: base64Content,
          encoding: 'base64',
        }),
      } as unknown as Response);

      const readme = await service.layReadme('owner', 'repo');
      expect(readme).toBe(rawMarkdown);
    });

    it('Trả về null khi README không tồn tại (404)', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => 'Not Found',
      } as unknown as Response);

      const readme = await service.layReadme('owner', 'repo');
      expect(readme).toBeNull();
    });
  });

  describe('layReleaseMoiNhat & layDanhSachRelease', () => {
    it('Lấy Release mới nhất thành công', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      const mockRelease = { id: 1, tag_name: 'v1.0.0', draft: false, assets: [] };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockRelease,
      } as unknown as Response);

      const release = await service.layReleaseMoiNhat('owner', 'repo');
      expect(release).toEqual(mockRelease);
    });

    it('Trả về null nếu repo chưa có release nào (404)', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => 'Not Found',
      } as unknown as Response);

      const release = await service.layReleaseMoiNhat('owner', 'repo');
      expect(release).toBeNull();
    });

    it('Lấy danh sách release theo per_page', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      const mockReleases = [
        { id: 1, tag_name: 'v1.0.0' },
        { id: 2, tag_name: 'v0.9.0' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockReleases,
      } as unknown as Response);

      const releases = await service.layDanhSachRelease('owner', 'repo', 5);
      expect(releases).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/repos/owner/repo/releases?per_page=5'),
        expect.anything(),
      );
    });
  });

  describe('timKiemRepo & Search Queue', () => {
    it('Chặn từ khóa tìm kiếm rỗng', async () => {
      await expect(service.timKiemRepo('')).rejects.toThrow(BadRequestException);
      await expect(service.timKiemRepo('   ')).rejects.toThrow(BadRequestException);
    });

    it('Gọi Search API qua hàng đợi thành công', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      const mockSearchResult = {
        total_count: 1,
        incomplete_results: false,
        items: [{ id: 1, name: 'vlc', full_name: 'videolan/vlc' }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockSearchResult,
      } as unknown as Response);

      const result = await service.timKiemRepo('vlc', 10, 1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('vlc');
    });
  });

  describe('Hạn mức, hỏi có điều kiện và GraphQL (P3B-06, P3B-07)', () => {
    const traVe = (status: number, headers: Record<string, string> = {}, body: unknown = {}) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        url: 'https://api.github.com/repos/moi/ten',
        headers: new Headers(headers),
        json: async () => body,
      }) as unknown as Response;

    it('chỉ theo dõi hạn mức core: phản hồi Search không ghi đè số lượt còn lại', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          traVe(200, {
            'x-ratelimit-resource': 'core',
            'x-ratelimit-remaining': '4800',
            'x-ratelimit-limit': '5000',
          }),
        )
        .mockResolvedValueOnce(
          traVe(
            200,
            {
              'x-ratelimit-resource': 'search',
              'x-ratelimit-remaining': '29',
              'x-ratelimit-limit': '30',
            },
            { items: [] },
          ),
        );
      await service.layRepo('a', 'b');
      await service.timKiemRepo('stars:>1000');
      expect(service.getRateLimitInfo().remaining).toBe(4800);
    });

    it('hoiCoDieuKien gửi ETag của DB, 304 thì không có dữ liệu, 200 thì trả ETag mới và URL cuối', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(traVe(304));
      expect(await service.hoiCoDieuKien('/repos/a/b', '"e1"')).toEqual({ trangThai: 304 });
      const goi = (global.fetch as MockFn).mock.calls[0]![1] as { headers: Record<string, string> };
      expect(goi.headers['If-None-Match']).toBe('"e1"');

      global.fetch = vi.fn().mockResolvedValueOnce(traVe(200, { etag: '"e2"' }, { id: 1 }));
      expect(await service.hoiCoDieuKien('/repos/a/b', '"e1"')).toEqual({
        trangThai: 200,
        duLieu: { id: 1 },
        etag: '"e2"',
        urlCuoi: 'https://api.github.com/repos/moi/ten',
      });

      global.fetch = vi.fn().mockResolvedValueOnce(traVe(404));
      expect((await service.hoiCoDieuKien('/repos/a/b')).trangThai).toBe(404);

      global.fetch = vi.fn().mockResolvedValueOnce(traVe(429));
      await expect(service.hoiCoDieuKien('/repos/a/b')).rejects.toBeInstanceOf(HttpException);
    });

    it('graphql trả data, báo lỗi hạn mức khi GitHub trả RATE_LIMITED', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(traVe(200, {}, { data: { r0: { stargazerCount: 5 } } }));
      expect(
        await service.graphql('{ r0: repository(owner:"a", name:"b") { stargazerCount } }'),
      ).toEqual({
        r0: { stargazerCount: 5 },
      });
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(traVe(200, {}, { errors: [{ type: 'RATE_LIMITED' }] }));
      await expect(service.graphql('{ x }')).rejects.toBeInstanceOf(HttpException);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DinhDangTep, KienTrucChip, NenTangHoTro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GithubService } from '../github/github.service';
import { CacheService } from '../redis/cache.service';
import { AppsService } from './apps.service';
import { AppSortOption, PlatformFilter, QueryAppsDto } from './dto/query-apps.dto';

interface MockPrisma {
  $transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  ungDung: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  banPhatHanh: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  tepCaiDat: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  nhatKyNapRepo: {
    create: ReturnType<typeof vi.fn>;
  };
}

interface MockGithubService {
  layRepo: ReturnType<typeof vi.fn>;
  layReadme: ReturnType<typeof vi.fn>;
  layDanhSachRelease: ReturnType<typeof vi.fn>;
  layReleaseMoiNhat: ReturnType<typeof vi.fn>;
  getRateLimitInfo: ReturnType<typeof vi.fn>;
}

interface MockCacheService {
  lay: ReturnType<typeof vi.fn>;
  luu: ReturnType<typeof vi.fn>;
  xoa: ReturnType<typeof vi.fn>;
  xoaTheoPrefix: ReturnType<typeof vi.fn>;
}

describe('AppsService (P2-21, P2-23, P2-24)', () => {
  let service: AppsService;
  let mockPrisma: MockPrisma;
  let mockGithubService: MockGithubService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
      ungDung: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      banPhatHanh: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      tepCaiDat: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      nhatKyNapRepo: {
        create: vi.fn(),
      },
    };

    mockGithubService = {
      layRepo: vi.fn(),
      layReadme: vi.fn(),
      layDanhSachRelease: vi.fn(),
      layReleaseMoiNhat: vi.fn(),
      getRateLimitInfo: vi
        .fn()
        .mockReturnValue({ remaining: 4800, limit: 5000, reset: 1700000000 }),
    };

    mockCacheService = {
      lay: vi.fn(),
      luu: vi.fn(),
      xoa: vi.fn(),
      xoaTheoPrefix: vi.fn(),
    };

    service = new AppsService(
      mockPrisma as unknown as PrismaService,
      mockGithubService as unknown as GithubService,
      mockCacheService as unknown as CacheService,
    );
  });

  describe('phanTichUrlRepo', () => {
    it('Phân tích slug đơn giản "owner/repo"', () => {
      const res = service.phanTichUrlRepo('rustdesk/rustdesk');
      expect(res).toEqual({ owner: 'rustdesk', repo: 'rustdesk' });
    });

    it('Phân tích URL HTTPS đầy đủ', () => {
      const res = service.phanTichUrlRepo('https://github.com/rustdesk/rustdesk');
      expect(res).toEqual({ owner: 'rustdesk', repo: 'rustdesk' });
    });

    it('Phân tích URL có đuôi .git và trailing slash', () => {
      const res = service.phanTichUrlRepo('https://github.com/videolan/vlc.git/');
      expect(res).toEqual({ owner: 'videolan', repo: 'vlc' });
    });

    it('Phân tích SSH URL git@github.com:owner/repo.git', () => {
      const res = service.phanTichUrlRepo('git@github.com:localsend/localsend.git');
      expect(res).toEqual({ owner: 'localsend', repo: 'localsend' });
    });

    it('Ném BadRequestException khi chuỗi rỗng', () => {
      expect(() => service.phanTichUrlRepo('')).toThrow(BadRequestException);
    });

    it('Ném BadRequestException khi domain khác github.com', () => {
      expect(() => service.phanTichUrlRepo('https://gitlab.com/owner/repo')).toThrow(
        BadRequestException,
      );
    });

    it('Ném BadRequestException khi URL thiếu repo', () => {
      expect(() => service.phanTichUrlRepo('https://github.com/onlyowner')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('dongBoRepo (P2-21)', () => {
    it('Đồng bộ repository thành công trong một Prisma transaction, bỏ qua draft, suy nền tảng và danh mục', async () => {
      const mockRepo = {
        id: 12345,
        name: 'rustdesk',
        full_name: 'rustdesk/rustdesk',
        owner: {
          login: 'rustdesk',
          avatar_url: 'https://avatars.githubusercontent.com/u/rustdesk',
        },
        html_url: 'https://github.com/rustdesk/rustdesk',
        description: 'An open-source remote desktop application written in Rust',
        stargazers_count: 75000,
        forks_count: 9000,
        license: { key: 'gpl-3.0', name: 'GPL-3.0', spdx_id: 'GPL-3.0' },
        language: 'Rust',
        topics: ['remote-desktop', 'rust', 'p2p'],
        updated_at: '2026-09-24T00:00:00Z',
      };

      const mockReleases = [
        {
          id: 101,
          tag_name: '1.2.3',
          name: 'RustDesk 1.2.3',
          body: 'Fix bugs and improve audio',
          draft: false,
          prerelease: false,
          created_at: '2026-09-20T00:00:00Z',
          published_at: '2026-09-20T00:00:00Z',
          assets: [
            {
              id: 201,
              name: 'rustdesk-1.2.3-x86_64.exe',
              size: 25000000,
              browser_download_url:
                'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-x86_64.exe',
              download_count: 5000,
              digest: 'sha256:abc12345',
            },
            {
              id: 202,
              name: 'rustdesk-1.2.3-arm64-v8a.apk',
              size: 20000000,
              browser_download_url:
                'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-arm64-v8a.apk',
              download_count: 3000,
            },
            {
              id: 203,
              name: 'rustdesk-source-code.zip',
              size: 5000000,
              browser_download_url: 'https://github.com/rustdesk/rustdesk/archive/v1.2.3.zip',
              download_count: 100,
            },
          ],
        },
        {
          id: 102,
          tag_name: '1.2.4-draft',
          name: 'Draft Release',
          draft: true, // Bản nháp phải bị bỏ qua
          prerelease: false,
          created_at: '2026-09-21T00:00:00Z',
          published_at: '2026-09-21T00:00:00Z',
          assets: [],
        },
      ];

      mockGithubService.layRepo.mockResolvedValue(mockRepo);
      mockGithubService.layDanhSachRelease.mockResolvedValue(mockReleases);

      const mockCreatedApp = {
        maUngDung: 'app-uuid-rustdesk',
        tenRepoDayDu: 'rustdesk/rustdesk',
        chuSoHuu: 'rustdesk',
        tenKhoChua: 'rustdesk',
        duongDanGithub: 'https://github.com/rustdesk/rustdesk',
        moTaGocTiengAnh: mockRepo.description,
        duongDanIcon: mockRepo.owner.avatar_url,
        soSaoGithub: 75000,
        soLuotFork: 9000,
        loaiGiayPhep: 'GPL-3.0',
        ngonNguChinh: 'Rust',
        danhSachChuDe: mockRepo.topics,
        danhMucChinh: 'Mạng & Giao tiếp',
        nenTangHoTro: NenTangHoTro.DA_NEN_TANG, // Cả EXE và APK
        tenGoiAndroid: 'com.carriez.rustdesk',
        duocNoiBat: false,
        daXacMinh: false,
        trangThai: 'HOAT_DONG',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            maPhatHanh: 'rel-uuid-1',
            maUngDung: 'app-uuid-rustdesk',
            maReleaseGithub: BigInt(101),
            tenPhienBan: '1.2.3',
            tieuDePhatHanh: 'RustDesk 1.2.3',
            nhatKyThayDoiGoc: 'Fix bugs and improve audio',
            tomTatNangCapVi: null,
            laBanThuNghiem: false,
            ngayPhatHanh: new Date('2026-09-20T00:00:00Z'),
            danhSachTepCaiDat: [
              {
                maTep: 'file-uuid-1',
                maPhatHanh: 'rel-uuid-1',
                tenTep: 'rustdesk-1.2.3-x86_64.exe',
                duongDanTaiVe:
                  'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-x86_64.exe',
                dungLuongBytes: BigInt(25000000),
                dinhDangTep: DinhDangTep.EXE,
                kienTrucChip: KienTrucChip.X86_64,
                maBamSha256: 'sha256:abc12345',
                soLuotTai: 5000,
                ngayTao: new Date(),
              },
              {
                maTep: 'file-uuid-2',
                maPhatHanh: 'rel-uuid-1',
                tenTep: 'rustdesk-1.2.3-arm64-v8a.apk',
                duongDanTaiVe:
                  'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-arm64-v8a.apk',
                dungLuongBytes: BigInt(20000000),
                dinhDangTep: DinhDangTep.APK,
                kienTrucChip: KienTrucChip.ARM64_V8A,
                maBamSha256: null,
                soLuotTai: 3000,
                ngayTao: new Date(),
              },
            ],
          },
        ],
      };

      mockPrisma.ungDung.upsert.mockResolvedValue(mockCreatedApp);
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockCreatedApp);
      mockPrisma.banPhatHanh.upsert.mockResolvedValue({ maPhatHanh: 'rel-uuid-1' });

      const result = await service.dongBoRepo('rustdesk', 'rustdesk');

      // Xác nhận transaction được kích hoạt
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // Xác nhận app được upsert với đúng nền tảng ĐA NỀN TẢNG và danh mục Mạng & Giao tiếp
      expect(mockPrisma.ungDung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenRepoDayDu: 'rustdesk/rustdesk' },
          create: expect.objectContaining({
            nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
            danhMucChinh: 'Mạng & Giao tiếp',
            tenGoiAndroid: 'com.carriez.rustdesk',
          }),
        }),
      );

      // Bản nháp draft 102 KHÔNG được đưa vào upsert
      expect(mockPrisma.banPhatHanh.upsert).toHaveBeenCalledTimes(1);

      // Xác nhận xóa cache sau khi đồng bộ
      expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith(service.CACHE_KEY_LIST);
      expect(mockCacheService.xoa).toHaveBeenCalledWith(
        `${service.CACHE_KEY_DETAIL}app-uuid-rustdesk`,
      );

      expect(result.maUngDung).toBe('app-uuid-rustdesk');
      expect(result.banPhatHanhMoiNhat?.tenPhienBan).toBe('1.2.3');
      expect(result.danhSachBanPhatHanh).toHaveLength(1);
    });
  });

  describe('layDanhSachApps (P2-23)', () => {
    it('Trả về kết quả từ Cache nếu hit', async () => {
      const mockCachedResult = {
        duLieu: [{ maUngDung: 'uuid-1', tenRepoDayDu: 'rustdesk/rustdesk' }],
        tongSo: 1,
        trangHienTai: 1,
        tongSoTrang: 1,
        kichThuocTrang: 20,
      };
      mockCacheService.lay.mockResolvedValue(mockCachedResult);

      const res = await service.layDanhSachApps({ page: 1, limit: 20 });
      expect(res).toEqual(mockCachedResult);
      expect(mockPrisma.ungDung.findMany).not.toHaveBeenCalled();
    });

    it('Truy vấn CSDL khi Cache miss và lưu vào cache', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      const mockApps = [
        {
          maUngDung: 'uuid-1',
          tenRepoDayDu: 'rustdesk/rustdesk',
          chuSoHuu: 'rustdesk',
          tenKhoChua: 'rustdesk',
          duongDanGithub: 'https://github.com/rustdesk/rustdesk',
          duongDanIcon: null,
          soSaoGithub: 75000,
          danhMucChinh: 'Mạng & Giao tiếp',
          nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
          duocNoiBat: true,
          daXacMinh: true,
          tenGoiAndroid: 'com.carriez.rustdesk',
          dongBoLanCuoi: new Date('2026-09-24T00:00:00Z'),
          phanTichAI: {
            khauHieuTiengViet: 'Điều khiển máy tính từ xa an toàn',
            diemUyTin: 95,
            mucDoAnToan: 'AN_TOAN_CAO',
          },
          danhSachPhatHanh: [{ tenPhienBan: '1.2.3', ngayPhatHanh: new Date() }],
        },
      ];

      mockPrisma.ungDung.findMany.mockResolvedValue(mockApps);
      mockPrisma.ungDung.count.mockResolvedValue(1);

      const query: QueryAppsDto = {
        platform: PlatformFilter.WINDOWS,
        sort: AppSortOption.TRENDING,
        page: 1,
        limit: 20,
        featured: true,
      };

      const res = await service.layDanhSachApps(query);

      expect(res.duLieu).toHaveLength(1);
      expect(res.duLieu[0].tenRepoDayDu).toBe('rustdesk/rustdesk');
      expect(res.duLieu[0].diemUyTin).toBe(95);
      expect(res.duLieu[0].phienBanMoiNhat).toBe('1.2.3');

      // Kiểm tra lưu vào cache
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        expect.stringContaining(service.CACHE_KEY_LIST),
        expect.anything(),
        service.CACHE_TTL,
      );
    });

    it('Giới hạn limit không vượt quá 50', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      mockPrisma.ungDung.findMany.mockResolvedValue([]);
      mockPrisma.ungDung.count.mockResolvedValue(0);

      await service.layDanhSachApps({ limit: 100 });

      expect(mockPrisma.ungDung.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Capped at 50 per P2-23.1
        }),
      );
    });
  });

  describe('layChiTietApp (P2-24)', () => {
    it('Lấy theo UUID thành công và trả về DTO chuẩn', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      const mockApp = {
        maUngDung: '11111111-1111-1111-1111-111111111111',
        tenRepoDayDu: 'rustdesk/rustdesk',
        chuSoHuu: 'rustdesk',
        tenKhoChua: 'rustdesk',
        duongDanGithub: 'https://github.com/rustdesk/rustdesk',
        duongDanIcon: null,
        soSaoGithub: 75000,
        soLuotFork: 9000,
        loaiGiayPhep: 'GPL-3.0',
        ngonNguChinh: 'Rust',
        danhSachChuDe: ['remote-desktop'],
        danhMucChinh: 'Mạng & Giao tiếp',
        nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
        duocNoiBat: true,
        daXacMinh: true,
        tenGoiAndroid: 'com.carriez.rustdesk',
        trangThai: 'HOAT_DONG',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        moTaGocTiengAnh: 'Remote desktop',
        phanTichAI: null,
        danhSachPhatHanh: [],
      };

      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);

      const res = await service.layChiTietApp('11111111-1111-1111-1111-111111111111');
      expect(res.maUngDung).toBe('11111111-1111-1111-1111-111111111111');
      expect(res.tenRepoDayDu).toBe('rustdesk/rustdesk');
    });

    it('Lấy theo slug "owner/repo" thành công', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      const mockApp = {
        maUngDung: 'uuid-vlc',
        tenRepoDayDu: 'videolan/vlc',
        chuSoHuu: 'videolan',
        tenKhoChua: 'vlc',
        duongDanGithub: 'https://github.com/videolan/vlc',
        duongDanIcon: null,
        soSaoGithub: 12000,
        soLuotFork: 4000,
        loaiGiayPhep: 'GPL-2.0',
        ngonNguChinh: 'C',
        danhSachChuDe: ['media-player'],
        danhMucChinh: 'Đa phương tiện',
        nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
        duocNoiBat: false,
        daXacMinh: true,
        tenGoiAndroid: 'org.videolan.vlc',
        trangThai: 'HOAT_DONG',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        moTaGocTiengAnh: 'VLC Media Player',
        phanTichAI: null,
        danhSachPhatHanh: [],
      };

      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);

      const res = await service.layChiTietApp('videolan/vlc');
      expect(res.maUngDung).toBe('uuid-vlc');
      expect(res.tenKhoChua).toBe('vlc');
    });

    it('Ném NotFoundException khi app không tồn tại', async () => {
      mockCacheService.lay.mockResolvedValue(null);
      mockPrisma.ungDung.findFirst.mockResolvedValue(null);

      await expect(service.layChiTietApp('nonexistent/app')).rejects.toThrow(NotFoundException);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DinhDangTep, KienTrucChip, NenTangHoTro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GithubService } from '../github/github.service';
import { CacheService } from '../redis/cache.service';
import { UngDungService, daCoKetQuaBocTachCli, PHIEN_BAN_BOC_TACH_CLI } from './ung-dung.service';
import {
  AppSortOption,
  PlatformFilter,
  QueryAppsDto,
  TimeWindowFilter,
} from './dto/truy-van-ung-dung.dto';
import { JevClientService } from '../ai/services/jev-client.service';
import { LlmRotationService } from '../ai/services/llm-rotation.service';
import { TrustScoreService } from '../ai/services/trust-score.service';
import { ApkInspectorService } from '../ai/services/apk-inspector.service';
import { SemanticSearchService } from '../ai/services/semantic-search.service';
import { SearchTranslatorService } from '../ai/services/search-translator.service';

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
  timKiemRepo: ReturnType<typeof vi.fn>;
}

interface MockCacheService {
  lay: ReturnType<typeof vi.fn>;
  dat: ReturnType<typeof vi.fn>;
  luu: ReturnType<typeof vi.fn>;
  xoa: ReturnType<typeof vi.fn>;
  xoaTheoPrefix: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  withLock: ReturnType<typeof vi.fn>;
}

describe('UngDungService (P2-21, P2-23, P2-24, P2-40, P2-41)', () => {
  let service: UngDungService;
  let mockPrisma: MockPrisma;
  let mockGithubService: MockGithubService;
  let mockCacheService: MockCacheService;
  let mockJevClientService: {
    isEnabled: boolean;
    hoiChoice: ReturnType<typeof vi.fn>;
    hoiNoulBatch: ReturnType<typeof vi.fn>;
  };
  let mockLlmRotationService: {
    tomTatChangelog: ReturnType<typeof vi.fn>;
  };
  let mockTrustScoreService: {
    tinhTrustScore: ReturnType<typeof vi.fn>;
  };
  let mockApkInspectorService: {
    docQuyenApkTuUrl: ReturnType<typeof vi.fn>;
  };
  let mockSemanticSearchService: {
    chuanBiVanBanNhung: ReturnType<typeof vi.fn>;
    sinhEmbedding: ReturnType<typeof vi.fn>;
    luuVectorNguNghia: ReturnType<typeof vi.fn>;
    timKiemNguNghia: ReturnType<typeof vi.fn>;
  };
  let mockSearchTranslatorService: {
    dichCauTimKiem: ReturnType<typeof vi.fn>;
    ghepQueryAnToan: ReturnType<typeof vi.fn>;
    dichVaGhepQuery: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
      ungDung: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi
          .fn()
          .mockImplementation(
            (args: { where?: { maUngDung?: string }; data?: Record<string, unknown> }) =>
              Promise.resolve({
                maUngDung: args?.where?.maUngDung || 'app-uuid-rustdesk',
                tenRepoDayDu: 'rustdesk/rustdesk',
                ...args?.data,
              }),
          ),
        groupBy: vi.fn(),
      },
      phanTichAI: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      banPhatHanh: {
        upsert: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      tepCaiDat: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      },
      nhatKyNapRepo: {
        create: vi.fn().mockResolvedValue({ maNhatKy: 'uuid-log-1' }),
      },
    };

    mockGithubService = {
      layRepo: vi.fn(),
      layReadme: vi.fn(),
      layDanhSachRelease: vi.fn(),
      layReleaseMoiNhat: vi.fn(),
      laySoLuongContributor: vi.fn().mockResolvedValue(10),
      getRateLimitInfo: vi
        .fn()
        .mockReturnValue({ remaining: 4800, limit: 5000, reset: 1700000000 }),
      timKiemRepo: vi.fn().mockResolvedValue({
        total_count: 1,
        incomplete_results: false,
        items: [
          {
            id: 12345,
            name: 'vlc',
            full_name: 'videolan/vlc',
            html_url: 'https://github.com/videolan/vlc',
            description: 'VLC media player',
            stargazers_count: 15000,
            forks_count: 3000,
            language: 'C++',
            topics: ['media-player', 'video'],
            owner: { login: 'videolan', avatar_url: 'https://avatar.com/vlc' },
            updated_at: new Date().toISOString(),
          },
        ],
      }),
    };

    mockCacheService = {
      lay: vi.fn(),
      dat: vi.fn(),
      luu: vi.fn(),
      xoa: vi.fn(),
      xoaTheoPrefix: vi.fn(),
      del: vi.fn(),
      withLock: vi.fn(async (_k, _ttl, cb) => cb()),
    };

    mockJevClientService = {
      isEnabled: true,
      hoiChoice: vi.fn(),
      hoiNoulBatch: vi.fn(),
    };

    mockLlmRotationService = {
      tomTatChangelog: vi.fn().mockResolvedValue({
        ketQua: {
          tomTatNangCapVi: ['Sửa lỗi âm thanh', 'Tăng tốc kết nối'],
        },
        moHinhTomTat: 'gemini-2.0-flash',
      }),
    };

    mockTrustScoreService = {
      tinhTrustScore: vi.fn().mockResolvedValue({
        diemUyTin: 95,
        mucDoAnToan: 'XUAT_SAC',
        yeuToRuiRo: [],
        daThamDinhJev: true,
        trangThaiThamDinhJev: 'DA_THAM_DINH',
      }),
    };

    mockApkInspectorService = {
      docQuyenApkTuUrl: vi.fn().mockResolvedValue({
        thanhCong: true,
        permissions: ['android.permission.INTERNET'],
        coAccessibilityService: false,
        packageName: 'com.carriez.rustdesk',
      }),
    };

    mockSemanticSearchService = {
      chuanBiVanBanNhung: vi.fn().mockReturnValue('van ban nhung text'),
      sinhEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
      luuVectorNguNghia: vi.fn().mockResolvedValue(undefined),
      timKiemNguNghia: vi.fn().mockResolvedValue([
        {
          maUngDung: 'uuid-obsidian',
          tenRepoDayDu: 'obsidianmd/obsidian-releases',
          chuSoHuu: 'obsidianmd',
          tenKhoChua: 'obsidian-releases',
          duongDanIcon: null,
          soSaoGithub: 25000,
          danhMucChinh: 'VanPhongGhiChu',
          nenTangHoTro: 'DA_NEN_TANG',
          khauHieuTiengViet: 'Trình ghi chú Markdown bảo mật',
          diemUyTin: 98,
          mucDoAnToan: 'AN_TOAN_CAO',
          doTuongDong: 0.88,
        },
      ]),
    };

    mockSearchTranslatorService = {
      dichCauTimKiem: vi.fn().mockResolvedValue({
        tuKhoa: ['video', 'player'],
        topics: ['video-player'],
      }),
      ghepQueryAnToan: vi
        .fn()
        .mockReturnValue('video player topic:video-player stars:>=100 archived:false'),
      dichVaGhepQuery: vi
        .fn()
        .mockResolvedValue('video player topic:video-player stars:>=100 archived:false'),
    };

    service = new UngDungService(
      mockPrisma as unknown as PrismaService,
      mockGithubService as unknown as GithubService,
      mockCacheService as unknown as CacheService,
      mockJevClientService as unknown as JevClientService,
      mockLlmRotationService as unknown as LlmRotationService,
      mockTrustScoreService as unknown as TrustScoreService,
      mockApkInspectorService as unknown as ApkInspectorService,
      mockSemanticSearchService as unknown as SemanticSearchService,
      mockSearchTranslatorService as unknown as SearchTranslatorService,
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

    it('Ném BadRequestException khi owner hoặc repo chứa ký tự độc hại / không hợp lệ', () => {
      expect(() => service.phanTichUrlRepo('owner/repo;injection')).toThrow(BadRequestException);
      expect(() => service.phanTichUrlRepo('https://github.com/owner$/repo')).toThrow(
        BadRequestException,
      );
      expect(() => service.phanTichUrlRepo('../etc/passwd')).toThrow(BadRequestException);
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
      mockGithubService.layReadme.mockResolvedValueOnce(
        '## Installation\n```bash\nnpm install -g rustdesk-cli\n```',
      );

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
            trangThai: 'HOAT_DONG',
          }),
        }),
      );

      // Bản nháp draft 102 KHÔNG được đưa vào upsert
      expect(mockPrisma.banPhatHanh.upsert).toHaveBeenCalledTimes(1);
      expect(mockGithubService.layReadme).not.toHaveBeenCalled();

      // Xác nhận xóa cache sau khi đồng bộ
      expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith(service.CACHE_KEY_LIST);
      // Phải xóa THEO TIỀN TỐ để dọn cả khóa có đuôi :platform:arch mà Desktop dùng
      expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith(
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
          daLuuTru: true,
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
      expect(res.duLieu[0].daLuuTru).toBe(true);

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

      const res = await service.layDanhSachApps({ limit: 100, sort: AppSortOption.STARS });

      expect(res.kichThuocTrang).toBe(50);
      expect(mockPrisma.ungDung.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Giới hạn tối đa 50 bản ghi theo P2-23.1
        }),
      );
    });

    it('B2: Lọc thật sự theo khung thời gian phát hành bản mới nhất (TODAY / WEEK)', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      const now = new Date();
      const appMoiHomNay = {
        maUngDung: 'app-today',
        tenRepoDayDu: 'org/today-app',
        chuSoHuu: 'org',
        tenKhoChua: 'today-app',
        duongDanGithub: 'https://github.com/org/today-app',
        duongDanIcon: null,
        soSaoGithub: 100,
        danhMucChinh: 'Tiện ích',
        nenTangHoTro: NenTangHoTro.WINDOWS,
        duocNoiBat: false,
        daXacMinh: false,
        tenGoiAndroid: null,
        dongBoLanCuoi: now,
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            tenPhienBan: '1.0.0',
            ngayPhatHanh: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 giờ trước
            laBanThuNghiem: false,
            danhSachTepCaiDat: [{ dinhDangTep: DinhDangTep.EXE }],
          },
        ],
      };

      const appCuBaTuan = {
        maUngDung: 'app-old',
        tenRepoDayDu: 'org/old-app',
        chuSoHuu: 'org',
        tenKhoChua: 'old-app',
        duongDanGithub: 'https://github.com/org/old-app',
        duongDanIcon: null,
        soSaoGithub: 5000,
        danhMucChinh: 'Tiện ích',
        nenTangHoTro: NenTangHoTro.WINDOWS,
        duocNoiBat: false,
        daXacMinh: false,
        tenGoiAndroid: null,
        dongBoLanCuoi: now,
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            tenPhienBan: '2.0.0',
            ngayPhatHanh: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 ngày trước
            laBanThuNghiem: false,
            danhSachTepCaiDat: [{ dinhDangTep: DinhDangTep.EXE }],
          },
        ],
      };

      mockPrisma.ungDung.findMany.mockResolvedValue([appMoiHomNay, appCuBaTuan]);

      // Khi lọc TODAY: chỉ appMoiHomNay thỏa mãn (trong vòng 1 ngày)
      const resToday = await service.layDanhSachApps({
        window: TimeWindowFilter.TODAY,
        sort: AppSortOption.TRENDING,
      });
      expect(resToday.duLieu).toHaveLength(1);
      expect(resToday.duLieu[0].maUngDung).toBe('app-today');

      // Khi lọc WEEK: appCuBaTuan (20 ngày trước) vẫn bị loại bỏ
      const resWeek = await service.layDanhSachApps({
        window: TimeWindowFilter.WEEK,
        sort: AppSortOption.TRENDING,
      });
      expect(resWeek.duLieu).toHaveLength(1);
      expect(resWeek.duLieu[0].maUngDung).toBe('app-today');

      // Khi lọc MONTH: cả 2 app đều thỏa mãn (trong vòng 30 ngày)
      const resMonth = await service.layDanhSachApps({
        window: TimeWindowFilter.MONTH,
        sort: AppSortOption.TRENDING,
      });
      expect(resMonth.duLieu).toHaveLength(2);
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
        daLuuTru: true,
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
      expect(res.daLuuTru).toBe(true);
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

    it('Ưu tiên moTaVi hiện tại làm khauHieuTiengViet thay vì giá trị tiếng Anh cũ đã lưu trong phanTichAI (Điểm Vàng P3B-10)', async () => {
      mockCacheService.lay.mockResolvedValue(null);

      const mockApp = {
        maUngDung: 'uuid-translated',
        tenRepoDayDu: 'test/translated',
        chuSoHuu: 'test',
        tenKhoChua: 'translated',
        duongDanGithub: 'https://github.com/test/translated',
        duongDanIcon: null,
        soSaoGithub: 1000,
        soLuotFork: 100,
        loaiGiayPhep: 'MIT',
        ngonNguChinh: 'TypeScript',
        danhSachChuDe: ['tools'],
        danhMucChinh: 'Tiện ích',
        nenTangHoTro: NenTangHoTro.WINDOWS,
        duocNoiBat: false,
        daXacMinh: false,
        tenGoiAndroid: null,
        trangThai: 'HOAT_DONG',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        moTaGocTiengAnh: 'A very cool tool originally in English',
        moTaVi: 'Công cụ tuyệt vời đã được dịch tiếng Việt chuẩn xác',
        phanTichAI: {
          maPhanTich: 'analysis-1',
          maUngDung: 'uuid-translated',
          khauHieuTiengViet: 'A very cool tool originally in English...',
          tomTatTinhNangVi: null,
          diemUyTin: 90,
          mucDoAnToan: 'AN_TOAN',
          daThamDinhJev: false,
          trangThaiThamDinhJev: 'CHUA_THAM_DINH',
          yeuToRuiRo: [],
          quyenHanDaKiemTra: [],
          moHinhTomTat: null,
          huongDanCaiDat: null,
          thoiGianPhanTich: new Date(),
        },
        danhSachPhatHanh: [],
      };

      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);

      const res = await service.layChiTietApp('uuid-translated');
      expect(res.khauHieuTiengViet).toBe('Công cụ tuyệt vời đã được dịch tiếng Việt chuẩn xác');
      expect(res.phanTichAi?.khauHieuTiengViet).toBe(
        'Công cụ tuyệt vời đã được dịch tiếng Việt chuẩn xác',
      );
    });
  });

  describe('giaiQuyetFileCaiDat (P2-33)', () => {
    const mockApp = {
      maUngDung: 'app-uuid-rustdesk',
      tenRepoDayDu: 'rustdesk/rustdesk',
    };

    const mockApkArm64 = {
      maTep: 'file-arm64',
      maPhatHanh: 'rel-1',
      tenTep: 'rustdesk-arm64-v8a.apk',
      duongDanTaiVe:
        'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-arm64-v8a.apk',
      dungLuongBytes: BigInt(25000000),
      dinhDangTep: DinhDangTep.APK,
      kienTrucChip: KienTrucChip.ARM64_V8A,
      maBamSha256: 'sha256arm64',
      soLuotTai: 100,
      ngayTao: new Date(),
    };

    const mockApkUniversal = {
      maTep: 'file-universal',
      maPhatHanh: 'rel-1',
      tenTep: 'rustdesk-universal.apk',
      duongDanTaiVe:
        'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-universal.apk',
      dungLuongBytes: BigInt(45000000),
      dinhDangTep: DinhDangTep.APK,
      kienTrucChip: KienTrucChip.DUNG_CHUNG,
      maBamSha256: 'sha256uni',
      soLuotTai: 200,
      ngayTao: new Date(),
    };

    const mockApkAmbiguous = {
      maTep: 'file-ambiguous',
      maPhatHanh: 'rel-1',
      tenTep: 'rustdesk-custom-build.apk',
      duongDanTaiVe:
        'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-custom-build.apk',
      dungLuongBytes: BigInt(22000000),
      dinhDangTep: DinhDangTep.APK,
      kienTrucChip: KienTrucChip.KHONG_XAC_DINH,
      maBamSha256: 'sha256amb',
      soLuotTai: 50,
      ngayTao: new Date(),
    };

    const mockExeX64 = {
      maTep: 'file-exe-x64',
      maPhatHanh: 'rel-1',
      tenTep: 'rustdesk-x86_64.exe',
      duongDanTaiVe:
        'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-x86_64.exe',
      dungLuongBytes: BigInt(30000000),
      dinhDangTep: DinhDangTep.EXE,
      kienTrucChip: KienTrucChip.X86_64,
      maBamSha256: 'sha256win64',
      soLuotTai: 500,
      ngayTao: new Date(),
    };

    const mockZipPortable = {
      maTep: 'file-zip-x64',
      maPhatHanh: 'rel-1',
      tenTep: 'rustdesk-portable-x86_64.zip',
      duongDanTaiVe:
        'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-portable-x86_64.zip',
      dungLuongBytes: BigInt(28000000),
      dinhDangTep: DinhDangTep.ZIP_PORTABLE,
      kienTrucChip: KienTrucChip.X86_64,
      maBamSha256: 'sha256zip',
      soLuotTai: 120,
      ngayTao: new Date(),
    };

    it('Thiết bị Android arm64: ưu tiên chọn APK arm64-v8a theo luật không cần gọi Jev', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [mockApkUniversal, mockApkArm64],
        },
      ]);

      const res = await service.giaiQuyetFileCaiDat({
        maUngDung: 'rustdesk/rustdesk',
        nenTang: 'ANDROID',
        abis: ['arm64-v8a', 'armeabi-v7a'],
      });

      expect(res.tepCaiDat.maTep).toBe('file-arm64');
      expect(res.nguonQuyetDinh).toBe('LUAT');
      expect(mockJevClientService.hoiChoice).not.toHaveBeenCalled();
    });

    it('Thiết bị Android x86_64: fallback về Universal APK khi không có bản riêng x86_64', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [mockApkArm64, mockApkUniversal],
        },
      ]);

      const res = await service.giaiQuyetFileCaiDat({
        maUngDung: 'rustdesk/rustdesk',
        nenTang: 'ANDROID',
        abis: ['x86_64'],
      });

      expect(res.tepCaiDat.maTep).toBe('file-universal');
      expect(res.nguonQuyetDinh).toBe('LUAT');
    });

    it('Thiết bị Android: tên file mơ hồ (KHONG_XAC_DINH), gọi Jev Choice thành công để chọn tệp phù hợp', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [mockApkAmbiguous],
        },
      ]);

      mockJevClientService.hoiChoice.mockResolvedValue({
        luaChon: 'file-ambiguous',
        doTinCay: 0.92,
      });

      const res = await service.giaiQuyetFileCaiDat({
        maUngDung: 'rustdesk/rustdesk',
        nenTang: 'ANDROID',
        abis: ['arm64-v8a'],
      });

      expect(res.tepCaiDat.maTep).toBe('file-ambiguous');
      expect(res.nguonQuyetDinh).toBe('JEV');
      expect(res.doTinCay).toBe(0.92);
      expect(mockJevClientService.hoiChoice).toHaveBeenCalledTimes(1);
      expect(mockPrisma.tepCaiDat.update).not.toHaveBeenCalled();
    });

    it('Thiết bị Android: không có APK nào phù hợp ném NotFoundException với mã KHONG_CO_FILE_PHU_HOP', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [mockExeX64], // Chỉ có file Windows
        },
      ]);

      await expect(
        service.giaiQuyetFileCaiDat({
          maUngDung: 'rustdesk/rustdesk',
          nenTang: 'ANDROID',
          abis: ['arm64-v8a'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Thiết bị Windows: ưu tiên chọn EXE x86_64 theo luật', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [mockZipPortable, mockExeX64],
        },
      ]);

      const res = await service.giaiQuyetFileCaiDat({
        maUngDung: 'rustdesk/rustdesk',
        nenTang: 'WINDOWS',
        abis: ['x86_64'],
      });

      expect(res.tepCaiDat.maTep).toBe('file-exe-x64');
      expect(res.nguonQuyetDinh).toBe('LUAT');
    });

    it('Thiết bị Windows: chọn ZIP_PORTABLE khi không có MSI hoặc EXE', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [mockZipPortable],
        },
      ]);

      const res = await service.giaiQuyetFileCaiDat({
        maUngDung: 'rustdesk/rustdesk',
        nenTang: 'WINDOWS',
        abis: ['x86_64'],
      });

      expect(res.tepCaiDat.maTep).toBe('file-zip-x64');
      expect(res.nguonQuyetDinh).toBe('LUAT');
    });

    it('Bản phát hành không có tệp nào ném NotFoundException', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(mockApp);
      mockPrisma.banPhatHanh.findMany.mockResolvedValue([
        {
          maPhatHanh: 'rel-1',
          tenPhienBan: '1.2.3',
          danhSachTepCaiDat: [],
        },
      ]);

      await expect(
        service.giaiQuyetFileCaiDat({
          maUngDung: 'rustdesk/rustdesk',
          nenTang: 'WINDOWS',
          abis: ['x86_64'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Không tìm thấy ứng dụng ném NotFoundException', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValue(null);

      await expect(
        service.giaiQuyetFileCaiDat({
          maUngDung: 'nonexistent/app',
          nenTang: 'WINDOWS',
          abis: ['x86_64'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Lazy AI & Distributed Lock (P2-31)', () => {
    it('10 request mở app đồng thời chỉ gọi Gemini tóm tắt đúng 1 lần duy nhất qua withLock (Nghiệm thu P2-31)', async () => {
      // Giả lập lock: request đầu tiên thấy record chưa có, các request sau thấy record đã có
      let count = 0;
      mockPrisma.phanTichAI.findUnique.mockImplementation(async () => {
        count++;
        if (count === 1) return null;
        return { maPhanTich: 'existing-analysis' };
      });

      mockPrisma.ungDung.findUnique.mockResolvedValue({
        maUngDung: 'app-uuid-rustdesk',
        tenRepoDayDu: 'rustdesk/rustdesk',
        chuSoHuu: 'rustdesk',
        tenKhoChua: 'rustdesk',
        moTaGocTiengAnh: 'Remote desktop software',
        danhSachChuDe: ['remote-desktop'],
        soSaoGithub: 75000,
        soLuotFork: 9000,
        loaiGiayPhep: 'GPL-3.0',
        dongBoLanCuoi: new Date(),
        danhSachPhatHanh: [],
      });

      mockPrisma.phanTichAI.upsert.mockResolvedValue({
        maPhanTich: 'new-analysis-uuid',
      });

      // 10 yêu cầu đồng thời (song song)
      await Promise.all(
        Array.from({ length: 10 }).map(() => service.phanTichUngDung('app-uuid-rustdesk')),
      );

      // Nghiệm thu P3B-10.1 & D-17: Không còn gọi LLM tóm tắt README khi nạp app (method đã bị gỡ bỏ 100%)
      expect((mockLlmRotationService as Record<string, unknown>).tomTatReadme).toBeUndefined();
      // Single-flight lock vẫn đảm bảo chỉ chạy phân tích đúng 1 lần
      expect(mockTrustScoreService.tinhTrustScore).toHaveBeenCalledTimes(1);
    });

    it('Không gọi LLM tóm tắt README khi nạp app mới; lưu khẩu hiệu từ mô tả và tomTatTinhNangVi là null (P3B-10.1 & D-17)', async () => {
      mockPrisma.phanTichAI.findUnique.mockResolvedValue(null);
      mockPrisma.ungDung.findUnique.mockResolvedValue({
        maUngDung: 'app-uuid-rustdesk',
        tenRepoDayDu: 'rustdesk/rustdesk',
        chuSoHuu: 'rustdesk',
        tenKhoChua: 'rustdesk',
        moTaVi: 'Phần mềm điều khiển máy tính từ xa mã nguồn mở',
        moTaGocTiengAnh: 'Remote desktop software',
        danhSachChuDe: ['remote-desktop'],
        soSaoGithub: 75000,
        soLuotFork: 9000,
        loaiGiayPhep: 'GPL-3.0',
        dongBoLanCuoi: new Date(),
        danhSachPhatHanh: [],
      });

      mockPrisma.phanTichAI.upsert.mockResolvedValue({
        maPhanTich: 'new-analysis-uuid',
      });

      await service.phanTichUngDung('app-uuid-rustdesk');

      expect((mockLlmRotationService as Record<string, unknown>).tomTatReadme).toBeUndefined();
      expect(mockPrisma.phanTichAI.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            khauHieuTiengViet: 'Phần mềm điều khiển máy tính từ xa mã nguồn mở',
            tomTatTinhNangVi: null,
            moHinhTomTat: null,
            diemUyTin: 95,
          }),
        }),
      );
    });

    it('Admin prewarm chạy phân tích hàng loạt cho các app (P2-31.5)', async () => {
      mockPrisma.ungDung.findMany.mockResolvedValue([
        { maUngDung: 'app-1' },
        { maUngDung: 'app-2' },
      ]);
      mockPrisma.phanTichAI.findUnique.mockResolvedValue({ maPhanTich: 'done' });

      const res = await service.chayLamNongAI(['app-1', 'app-2']);
      expect(res.daChay).toBe(2);
      expect(res.thanhCong).toBe(2);
    });
  });

  describe('timKiemThongMinh (P2-40 & P2-42)', () => {
    it('1. Luồng URL: link đã có trong CSDL Store', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValue({
        maUngDung: 'uuid-vlc',
        tenRepoDayDu: 'videolan/vlc',
        chuSoHuu: 'videolan',
        tenKhoChua: 'vlc',
        duongDanGithub: 'https://github.com/videolan/vlc',
        duongDanIcon: null,
        soSaoGithub: 20000,
        danhMucChinh: 'GiaiTri',
        nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
        duocNoiBat: true,
        daXacMinh: true,
        trangThai: 'HOAT_DONG',
        tenGoiAndroid: 'org.videolan.vlc',
        dongBoLanCuoi: new Date(),
        phanTichAI: {
          khauHieuTiengViet: 'Trình phát đa phương tiện miễn phí',
          diemUyTin: 98,
          mucDoAnToan: 'AN_TOAN_CAO',
        },
        danhSachPhatHanh: [{ tenPhienBan: '3.0.20' }],
      });

      const res = await service.timKiemThongMinh({ q: 'https://github.com/videolan/vlc' });
      expect(res.loaiTruyVan).toBe('URL');
      expect(res.nguonKetQua).toBe('URL');
      expect(res.duongDanUrl?.daCoTrongStore).toBe(true);
      expect(res.duLieu).toHaveLength(1);
      expect(res.duLieu[0].tenRepoDayDu).toBe('videolan/vlc');
    });

    it('2. Luồng URL: link chưa có trong CSDL Store (sẵn sàng Paste & Play)', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValue(null);

      const res = await service.timKiemThongMinh({ q: 'https://github.com/newuser/newapp' });
      expect(res.loaiTruyVan).toBe('URL');
      expect(res.nguonKetQua).toBe('URL');
      expect(res.duongDanUrl?.daCoTrongStore).toBe(false);
      expect(res.duLieu).toHaveLength(0);
      expect(res.thongDiep).toContain('Paste & Play');
    });

    it('3. Luồng TEN_APP: tìm thấy trong CSDL Store qua ILIKE', async () => {
      mockPrisma.ungDung.findMany.mockResolvedValue([
        {
          maUngDung: 'uuid-rustdesk',
          tenRepoDayDu: 'rustdesk/rustdesk',
          chuSoHuu: 'rustdesk',
          tenKhoChua: 'rustdesk',
          duongDanGithub: 'https://github.com/rustdesk/rustdesk',
          duongDanIcon: null,
          soSaoGithub: 75000,
          danhMucChinh: 'TienIch',
          nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
          duocNoiBat: true,
          daXacMinh: true,
          tenGoiAndroid: 'com.carriez.rustdesk',
          dongBoLanCuoi: new Date(),
          phanTichAI: null,
          danhSachPhatHanh: [],
        },
      ]);
      mockPrisma.ungDung.count.mockResolvedValue(1);

      const res = await service.timKiemThongMinh({ q: 'rustdesk' });
      expect(res.loaiTruyVan).toBe('TEN_APP');
      expect(res.nguonKetQua).toBe('CSDL');
      expect(res.duLieu).toHaveLength(1);
      expect(res.duLieu[0].tenKhoChua).toBe('rustdesk');
    });

    it('4. Luồng TEN_APP: CSDL rỗng -> fallback tìm kiếm trên GitHub Search API', async () => {
      mockPrisma.ungDung.findMany.mockResolvedValue([]);
      mockPrisma.ungDung.count.mockResolvedValue(0);

      const res = await service.timKiemThongMinh({ q: 'vlc' });
      expect(res.loaiTruyVan).toBe('TEN_APP');
      expect(res.nguonKetQua).toBe('GITHUB');
      expect(mockGithubService.timKiemRepo).toHaveBeenCalledWith('vlc', 20, 1);
      expect(res.duLieu).toHaveLength(1);
      expect(res.duLieu[0].tenKhoChua).toBe('vlc');
    });

    it('4b. Cụm ngắn tiếng Việt ("chụp màn hình") không có app trùng tên -> chuyển sang luồng ý định, không tìm chữ đó trên GitHub', async () => {
      mockPrisma.ungDung.findMany.mockResolvedValue([]);
      mockPrisma.ungDung.count.mockResolvedValue(0);

      const res = await service.timKiemThongMinh({ q: 'chụp màn hình' });
      expect(res.loaiTruyVan).toBe('Y_DINH');
      expect(mockSearchTranslatorService.dichVaGhepQuery).toHaveBeenCalledWith(
        'ứng dụng chụp màn hình',
      );
      expect(mockGithubService.timKiemRepo).not.toHaveBeenCalledWith('chụp màn hình', 20, 1);
    });

    it('4c. Tên app tiếng Anh nhiều từ không có trong Store -> vẫn tìm theo tên trên GitHub', async () => {
      mockPrisma.ungDung.findMany.mockResolvedValue([]);
      mockPrisma.ungDung.count.mockResolvedValue(0);

      const res = await service.timKiemThongMinh({ q: 'visual studio' });
      expect(res.loaiTruyVan).toBe('TEN_APP');
      expect(mockGithubService.timKiemRepo).toHaveBeenCalledWith('visual studio', 20, 1);
    });

    it('5. Luồng Y_DINH: kết hợp pgvector ngữ nghĩa và Gemini dịch truy vấn', async () => {
      const res = await service.timKiemThongMinh({ q: 'app xem phim không quảng cáo' });
      expect(res.loaiTruyVan).toBe('Y_DINH');
      expect(mockSemanticSearchService.timKiemNguNghia).toHaveBeenCalled();
      expect(mockSearchTranslatorService.dichVaGhepQuery).toHaveBeenCalledWith(
        'app xem phim không quảng cáo',
      );
      expect(mockGithubService.timKiemRepo).toHaveBeenCalled();
      expect(res.duLieu.length).toBeGreaterThan(0);
    });
  });

  describe('kiemDinhVaNapRepo (P2-41 Paste & Play)', () => {
    it('1. Repo đã có sẵn trong Store -> trả về ngay, không nạp lại', async () => {
      const existingApp = {
        maUngDung: 'uuid-existing',
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
        danhMucChinh: 'TienIch',
        nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
        duocNoiBat: true,
        daXacMinh: true,
        trangThai: 'HOAT_DONG',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        phanTichAI: null,
        danhSachPhatHanh: [],
      };
      mockPrisma.ungDung.findUnique.mockResolvedValue(existingApp);
      mockPrisma.ungDung.findFirst.mockResolvedValue(existingApp);

      const res = await service.kiemDinhVaNapRepo({
        urlRepo: 'https://github.com/rustdesk/rustdesk',
      });

      expect(res.trangThai).toBe('THANH_CONG');
      expect(res.thongBao).toContain('đã có sẵn');
      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'THANH_CONG',
          }),
        }),
      );
    });

    it('2. URL không hợp lệ -> ném BadRequestException và ghi nhật ký LINK_KHONG_HOP_LE', async () => {
      await expect(
        service.kiemDinhVaNapRepo({
          urlRepo: 'https://google.com/search?q=rustdesk',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'LINK_KHONG_HOP_LE',
          }),
        }),
      );
    });

    it('3. Repo không tồn tại trên GitHub -> ném NotFoundException và ghi nhật ký THAT_BAI', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValue(null);
      mockGithubService.layRepo.mockRejectedValue(new NotFoundException('Not found'));

      await expect(
        service.kiemDinhVaNapRepo({
          urlRepo: 'https://github.com/nonexistent-user-1234/nonexistent-repo-999',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'THAT_BAI',
          }),
        }),
      );
    });

    it('4. Repo không có bản phát hành (release) -> ném BadRequestException và ghi KHONG_CO_RELEASE', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValue(null);
      mockGithubService.layRepo.mockResolvedValue({ id: 1, full_name: 'test/no-release' });
      mockGithubService.layDanhSachRelease.mockResolvedValue([]);

      await expect(
        service.kiemDinhVaNapRepo({
          urlRepo: 'https://github.com/test/no-release',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'KHONG_CO_RELEASE',
          }),
        }),
      );
    });

    it('5. Repo không có file cài đặt phù hợp với nền tảng yêu cầu -> ném KHONG_CO_FILE_CAI_DAT', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValue(null);
      mockGithubService.layRepo.mockResolvedValue({ id: 1, full_name: 'test/windows-only' });
      mockGithubService.layDanhSachRelease.mockResolvedValue([
        {
          id: 101,
          tag_name: 'v1.0.0',
          draft: false,
          prerelease: false,
          assets: [{ name: 'setup-windows.exe' }],
        },
      ]);

      // Yêu cầu ANDROID nhưng chỉ có .exe
      await expect(
        service.kiemDinhVaNapRepo({
          urlRepo: 'https://github.com/test/windows-only',
          nenTang: 'ANDROID',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'KHONG_CO_FILE_CAI_DAT',
          }),
        }),
      );
    });

    it('6. Nạp mới thành công -> gọi dongBoRepo, Lazy AI và ghi nhật ký THANH_CONG', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValue(null);
      mockGithubService.layRepo.mockResolvedValue({
        id: 1,
        full_name: 'newowner/coolapp',
        name: 'coolapp',
        owner: { login: 'newowner', avatar_url: '' },
        html_url: 'https://github.com/newowner/coolapp',
        stargazers_count: 500,
        forks_count: 50,
        topics: ['android', 'tools'],
        description: 'A cool Android tool',
      });
      mockGithubService.layDanhSachRelease.mockResolvedValue([
        {
          id: 201,
          tag_name: 'v2.0.0',
          draft: false,
          prerelease: false,
          assets: [
            {
              name: 'coolapp-arm64-v8a.apk',
              size: 15000000,
              browser_download_url: 'http://apk.url',
            },
          ],
        },
      ]);

      // Mock dongBoRepo trả về app mới
      vi.spyOn(service, 'dongBoRepo').mockResolvedValueOnce({
        maUngDung: 'new-app-uuid',
        tenRepoDayDu: 'newowner/coolapp',
        chuSoHuu: 'newowner',
        tenKhoChua: 'coolapp',
        duongDanGithub: 'https://github.com/newowner/coolapp',
        soSaoGithub: 500,
        soLuotFork: 50,
        danhSachChuDe: ['android'],
        danhMucChinh: 'TienIch',
        nenTangHoTro: NenTangHoTro.ANDROID,
        duocNoiBat: false,
        daXacMinh: false,
        trangThai: 'HOAT_DONG',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        banPhatHanhMoiNhat: {
          maPhatHanh: 'rel-uuid',
          maUngDung: 'new-app-uuid',
          tenPhienBan: 'v2.0.0',
          laBanThuNghiem: false,
          ngayPhatHanh: new Date(),
          danhSachTepCaiDat: [],
        },
      });

      // Giả lập xử lý AI tải chậm (Lazy AI)
      vi.spyOn(service, 'phanTichUngDung').mockResolvedValueOnce(undefined as unknown as never);

      const res = await service.kiemDinhVaNapRepo({
        urlRepo: 'https://github.com/newowner/coolapp',
        nenTang: 'ANDROID',
        abis: ['arm64-v8a'],
      });

      expect(res.trangThai).toBe('THANH_CONG');
      expect(res.ungDung?.maUngDung).toBe('new-app-uuid');
      expect(service.dongBoRepo).toHaveBeenCalledWith('newowner', 'coolapp');
      expect(service.phanTichUngDung).toHaveBeenCalledWith('new-app-uuid');
      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'THANH_CONG',
            maUngDungTaoRa: 'new-app-uuid',
          }),
        }),
      );
    });

    it('dán link repo chỉ có lệnh cài gọi dongBoRepo mà không cần cờ riêng', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce(null);
      mockGithubService.layRepo.mockResolvedValueOnce({ full_name: 'owner/cli-only' });
      mockGithubService.layDanhSachRelease.mockResolvedValueOnce([]);
      mockGithubService.layReadme.mockResolvedValueOnce(
        '## Installation\n```bash\nnpm install -g cli-only@latest\n```',
      );
      vi.spyOn(service, 'dongBoRepo').mockResolvedValueOnce({
        maUngDung: 'cli-only-id',
        tenRepoDayDu: 'owner/cli-only',
      } as unknown as never);
      vi.spyOn(service, 'phanTichUngDung').mockResolvedValueOnce(undefined as unknown as never);
      vi.spyOn(service, 'layChiTietApp').mockResolvedValueOnce({
        maUngDung: 'cli-only-id',
        tenRepoDayDu: 'owner/cli-only',
        huongDanCaiDat: {
          cachCai: [{ nhom: 'NPM', trinhQuanLy: 'npm', tenGoi: 'cli-only', buoc: [] }],
        },
      } as unknown as never);

      const result = await service.kiemDinhVaNapRepo({
        urlRepo: 'https://github.com/owner/cli-only',
      });

      expect(service.dongBoRepo).toHaveBeenCalledWith('owner', 'cli-only');
      expect(result.chiCoHuongDanCli).toBe(true);
    });
  });

  describe('layDanhSachDanhMuc (K3)', () => {
    it('trả về kết quả từ Cache nếu đã có', async () => {
      const cached = [{ ten: 'Lập trình & Phát triển', soLuong: 5 }];
      mockCacheService.lay.mockResolvedValueOnce(cached);

      const result = await service.layDanhSachDanhMuc(PlatformFilter.WINDOWS);

      expect(mockCacheService.lay).toHaveBeenCalledWith('fs:categories:windows');
      expect(result).toEqual(cached);
      expect(mockPrisma.ungDung.groupBy).not.toHaveBeenCalled();
    });

    it('trả AI với số lượng 0, lọc danh mục rỗng khác và lưu cache', async () => {
      mockCacheService.lay.mockResolvedValueOnce(null);
      mockPrisma.ungDung.groupBy.mockResolvedValueOnce([
        { danhMucChinh: 'Lập trình & Phát triển', _count: { _all: 6 } },
        { danhMucChinh: 'Đa phương tiện', _count: { _all: 3 } },
        { danhMucChinh: 'Học tập & Giáo dục', _count: { _all: 0 } }, // 0 app -> bị loại bỏ
        { danhMucChinh: 'Tiện ích hệ thống', _count: { _all: 4 } },
      ]);

      const result = await service.layDanhSachDanhMuc(PlatformFilter.WINDOWS);

      expect(mockPrisma.ungDung.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['danhMucChinh'],
          where: expect.objectContaining({
            trangThai: 'HOAT_DONG',
            nenTangHoTro: { in: [NenTangHoTro.WINDOWS, NenTangHoTro.DA_NEN_TANG] },
          }),
        }),
      );

      // AI vẫn có mặt để giao diện hiển thị danh mục mới trước khi dữ liệu được xếp loại.
      expect(result[0]).toEqual({ ten: 'AI', soLuong: 0 });
      // Các danh mục cũ không có ứng dụng tiếp tục bị ẩn.
      expect(result.some((r) => r.ten === 'Học tập & Giáo dục')).toBe(false);
      // Kết quả phải giữ các danh mục có > 0 app
      expect(result).toEqual(
        expect.arrayContaining([
          { ten: 'Tiện ích hệ thống', soLuong: 4 },
          { ten: 'Đa phương tiện', soLuong: 3 },
          { ten: 'Lập trình & Phát triển', soLuong: 6 },
        ]),
      );
      // Lưu cache 300s
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        'fs:categories:windows',
        expect.any(Array),
        300,
      );
    });

    it('đặt AI đứng đầu khi có ứng dụng và giữ AI với số lượng 0 khi chưa có ứng dụng nào', async () => {
      mockCacheService.lay.mockResolvedValueOnce(null);
      mockPrisma.ungDung.groupBy.mockResolvedValueOnce([
        { danhMucChinh: 'Lập trình & Phát triển', _count: { _all: 6 } },
        { danhMucChinh: 'AI', _count: { _all: 2 } },
      ]);
      const coAi = await service.layDanhSachDanhMuc(PlatformFilter.WINDOWS);
      expect(coAi[0]).toEqual({ ten: 'AI', soLuong: 2 });

      mockCacheService.lay.mockResolvedValueOnce(null);
      mockPrisma.ungDung.groupBy.mockResolvedValueOnce([
        { danhMucChinh: 'Lập trình & Phát triển', _count: { _all: 6 } },
      ]);
      const khongAi = await service.layDanhSachDanhMuc(PlatformFilter.WINDOWS);
      expect(khongAi[0]).toEqual({ ten: 'AI', soLuong: 0 });
    });
  });

  describe('Xử lý app không có file cài đặt (L1)', () => {
    const cauHinhRepoChiCli = (ten: string) => {
      mockGithubService.layRepo.mockResolvedValueOnce({
        name: ten,
        full_name: `owner/${ten}`,
        owner: { login: 'owner', avatar_url: null },
        html_url: `https://github.com/owner/${ten}`,
        description: 'A CLI tool',
        stargazers_count: 10,
        forks_count: 1,
        license: null,
        language: 'TypeScript',
        topics: [],
      });
      mockGithubService.layDanhSachRelease.mockResolvedValueOnce([]);
      mockPrisma.ungDung.upsert.mockResolvedValueOnce({
        maUngDung: 'cli-app-id',
        tenRepoDayDu: `owner/${ten}`,
        trangThai: 'HOAT_DONG',
      });
      vi.spyOn(service, 'layChiTietApp').mockResolvedValueOnce({
        maUngDung: 'cli-app-id',
        tenRepoDayDu: `owner/${ten}`,
        trangThai: 'HOAT_DONG',
      } as unknown as never);
    };

    it('hiện repo chỉ có lệnh cài khi dongBoRepo được gọi không kèm cờ', async () => {
      cauHinhRepoChiCli('cli-tool');
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce(null);
      mockGithubService.layReadme.mockResolvedValueOnce(
        '## Installation\n```bash\nnpm install -g cli-tool@latest\n```',
      );

      await service.dongBoRepo('owner', 'cli-tool');

      expect(mockGithubService.layReadme).toHaveBeenCalledWith('owner', 'cli-tool');
      expect(mockPrisma.ungDung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ trangThai: 'HOAT_DONG' }),
          update: expect.objectContaining({ trangThai: 'HOAT_DONG' }),
        }),
      );
    });

    it('job đồng bộ release không ẩn app đã có hướng dẫn CLI hợp lệ', async () => {
      cauHinhRepoChiCli('release-cli');
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        trangThai: 'HOAT_DONG',
        phanTichAI: {
          huongDanCaiDat: {
            cachCai: [{ trinhQuanLy: 'npm', tenGoi: 'release-cli' }],
          },
        },
      });

      await service.dongBoRepo('owner', 'release-cli');

      expect(mockGithubService.layReadme).not.toHaveBeenCalled();
      expect(mockPrisma.ungDung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ trangThai: 'HOAT_DONG' }) }),
      );
    });

    it('giữ nguyên trạng thái hiện tại nếu README lỗi mạng tạm thời', async () => {
      cauHinhRepoChiCli('offline-cli');
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        trangThai: 'HOAT_DONG',
        phanTichAI: null,
      });
      mockGithubService.layReadme.mockRejectedValueOnce(new Error('network unavailable'));

      await service.dongBoRepo('owner', 'offline-cli');

      expect(mockPrisma.ungDung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ trangThai: 'HOAT_DONG' }),
          update: expect.objectContaining({ trangThai: 'HOAT_DONG' }),
        }),
      );
    });

    it('ẩn app đã hiện nếu GitHub xác nhận README không tồn tại và app không có hướng dẫn CLI lưu sẵn', async () => {
      cauHinhRepoChiCli('no-readme');
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        trangThai: 'HOAT_DONG',
        phanTichAI: null,
      });
      mockGithubService.layReadme.mockResolvedValueOnce(null);

      await service.dongBoRepo('owner', 'no-readme');

      expect(mockPrisma.ungDung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ trangThai: 'KHONG_CO_BAN_CAI' }),
          update: expect.objectContaining({ trangThai: 'KHONG_CO_BAN_CAI' }),
        }),
      );
    });

    it('dongBoRepo gán trangThai = KHONG_CO_BAN_CAI khi repo không có file cài hợp lệ (VLC/RetroArch)', async () => {
      mockGithubService.layRepo.mockResolvedValueOnce({
        name: 'vlc',
        full_name: 'videolan/vlc',
        owner: { login: 'videolan', avatar_url: 'https://example.com/vlc.png' },
        html_url: 'https://github.com/videolan/vlc',
        description: 'VLC media player official source code',
        stargazers_count: 10000,
        forks_count: 3000,
        license: { name: 'GPL-2.0' },
        language: 'C',
        topics: ['multimedia', 'video', 'player'],
      });

      // Mock 0 releases hoặc releases không có asset
      mockGithubService.layDanhSachRelease.mockResolvedValueOnce([]);

      mockPrisma.ungDung.upsert.mockResolvedValueOnce({
        maUngDung: 'vlc-uuid',
        tenRepoDayDu: 'videolan/vlc',
        trangThai: 'KHONG_CO_BAN_CAI',
        nenTangHoTro: NenTangHoTro.WINDOWS,
      });

      vi.spyOn(service, 'layChiTietApp').mockResolvedValueOnce({
        maUngDung: 'vlc-uuid',
        tenRepoDayDu: 'videolan/vlc',
        trangThai: 'KHONG_CO_BAN_CAI',
      } as unknown as never);

      await service.dongBoRepo('videolan', 'vlc');

      expect(mockPrisma.ungDung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            trangThai: 'KHONG_CO_BAN_CAI',
          }),
          create: expect.objectContaining({
            trangThai: 'KHONG_CO_BAN_CAI',
          }),
        }),
      );
    });

    it('kiemDinhVaNapRepo ném BadRequestException và ghi nhật ký KHONG_CO_FILE_CAI_DAT khi repo trong DB có trangThai = KHONG_CO_BAN_CAI', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        maUngDung: 'retroarch-uuid',
        tenRepoDayDu: 'libretro/retroarch',
        trangThai: 'KHONG_CO_BAN_CAI',
        danhSachPhatHanh: [],
      });

      await expect(
        service.kiemDinhVaNapRepo({
          urlRepo: 'https://github.com/libretro/retroarch',
          nenTang: 'WINDOWS',
          abis: ['x86_64'],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.nhatKyNapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'KHONG_CO_FILE_CAI_DAT',
            maUngDungTaoRa: 'retroarch-uuid',
          }),
        }),
      );
    });

    it('timKiemThongMinh luồng URL không đánh dấu daCoTrongStore khi repo trong DB có trangThai = KHONG_CO_BAN_CAI', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        maUngDung: 'vlc-uuid',
        tenRepoDayDu: 'videolan/vlc',
        trangThai: 'KHONG_CO_BAN_CAI',
        danhSachPhatHanh: [],
      });

      const res = await service.timKiemThongMinh({
        q: 'https://github.com/videolan/vlc',
        limit: 10,
        page: 1,
      });

      expect(res.loaiTruyVan).toBe('URL');
      expect(res.duongDanUrl?.daCoTrongStore).toBe(false);
    });

    it('DELIV-33.3: layChiTietApp lọc huongDanCaiDat theo platform Windows (loại LINUX_MAC) và Android (trả null)', async () => {
      mockPrisma.ungDung.findFirst.mockResolvedValueOnce({
        maUngDung: 'app-cli-1',
        tenRepoDayDu: 'open-webui/open-webui',
        chuSoHuu: 'open-webui',
        tenKhoChua: 'open-webui',
        duongDanGithub: 'https://github.com/open-webui/open-webui',
        soSaoGithub: 45000,
        soLuotFork: 5000,
        danhMucChinh: 'Tiện ích hệ thống',
        nenTangHoTro: 'WINDOWS',
        duocNoiBat: false,
        daXacMinh: true,
        trangThai: 'KHONG_CO_BAN_CAI',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        danhSachPhatHanh: [],
        phanTichAI: {
          maPhanTich: 'pt-1',
          maUngDung: 'app-cli-1',
          khauHieuTiengViet: 'Giao diện web AI tự lưu trữ',
          tomTatTinhNangVi: '- Tiện lợi',
          diemUyTin: 85,
          mucDoAnToan: 'AN_TOAN_CAO',
          daThamDinhJev: true,
          yeuToRuiRo: [],
          quyenHanDaKiemTra: [],
          thoiGianPhanTich: new Date(),
          huongDanCaiDat: {
            cachCai: [
              {
                ten: 'Cài đặt bằng pip',
                nhom: 'PIP',
                heDieuHanh: 'DUNG_CHUNG',
                phanCung: 'CPU',
                buoc: [{ moTa: 'Cài đặt', lenh: 'pip install open-webui' }],
              },
              {
                ten: 'Cài trên Linux',
                nhom: 'NGUON',
                heDieuHanh: 'LINUX_MAC',
                phanCung: 'CPU',
                buoc: [{ moTa: 'Lệnh Linux', lenh: 'sudo apt install open-webui' }],
              },
            ],
          },
        },
      });

      // 1. Kiểm tra trên Windows: phải loại bỏ cách cài LINUX_MAC
      const resWindows = await service.layChiTietApp('app-cli-1', undefined, 'windows');
      expect(resWindows.huongDanCaiDat).toBeDefined();
      expect(resWindows.huongDanCaiDat?.cachCai).toHaveLength(1);
      expect(resWindows.huongDanCaiDat?.cachCai[0]?.nhom).toBe('PIP');

      // 2. Kiểm tra trên Android: trả về null
      mockPrisma.ungDung.findFirst.mockResolvedValueOnce({
        maUngDung: 'app-cli-1',
        tenRepoDayDu: 'open-webui/open-webui',
        chuSoHuu: 'open-webui',
        tenKhoChua: 'open-webui',
        duongDanGithub: 'https://github.com/open-webui/open-webui',
        soSaoGithub: 45000,
        soLuotFork: 5000,
        danhMucChinh: 'Tiện ích hệ thống',
        nenTangHoTro: 'WINDOWS',
        duocNoiBat: false,
        daXacMinh: true,
        trangThai: 'KHONG_CO_BAN_CAI',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        danhSachPhatHanh: [],
        phanTichAI: {
          maPhanTich: 'pt-1',
          maUngDung: 'app-cli-1',
          khauHieuTiengViet: 'Giao diện web AI tự lưu trữ',
          tomTatTinhNangVi: '- Tiện lợi',
          diemUyTin: 85,
          mucDoAnToan: 'AN_TOAN_CAO',
          daThamDinhJev: true,
          yeuToRuiRo: [],
          quyenHanDaKiemTra: [],
          thoiGianPhanTich: new Date(),
          huongDanCaiDat: {
            cachCai: [
              {
                ten: 'Cài đặt bằng pip',
                nhom: 'PIP',
                heDieuHanh: 'DUNG_CHUNG',
                phanCung: 'CPU',
                buoc: [{ moTa: 'Cài đặt', lenh: 'pip install open-webui' }],
              },
            ],
          },
        },
      });

      const resAndroid = await service.layChiTietApp('app-cli-1', undefined, 'android');
      expect(resAndroid.huongDanCaiDat).toBeNull();
    });

    it('DELIV-33.3: kiemDinhVaNapRepo trả chiCoHuongDanCli = true khi repo không có file cài nhưng có hướng dẫn CLI', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        maUngDung: 'openwebui-uuid',
        tenRepoDayDu: 'open-webui/open-webui',
        trangThai: 'KHONG_CO_BAN_CAI',
        danhSachPhatHanh: [],
        phanTichAI: {
          huongDanCaiDat: {
            cachCai: [
              {
                ten: 'Cài bằng pip',
                nhom: 'PIP',
                heDieuHanh: 'DUNG_CHUNG',
                phanCung: 'CPU',
                buoc: [{ moTa: 'Cài đặt', lenh: 'pip install open-webui' }],
              },
            ],
          },
        },
      });

      // Mock layChiTietApp trả về appChiTiet có huongDanCaiDat
      mockPrisma.ungDung.findFirst.mockResolvedValueOnce({
        maUngDung: 'openwebui-uuid',
        tenRepoDayDu: 'open-webui/open-webui',
        chuSoHuu: 'open-webui',
        tenKhoChua: 'open-webui',
        duongDanGithub: 'https://github.com/open-webui/open-webui',
        soSaoGithub: 45000,
        soLuotFork: 5000,
        danhMucChinh: 'Tiện ích hệ thống',
        nenTangHoTro: 'WINDOWS',
        duocNoiBat: false,
        daXacMinh: true,
        trangThai: 'KHONG_CO_BAN_CAI',
        dongBoLanCuoi: new Date(),
        ngayTao: new Date(),
        danhSachPhatHanh: [],
        phanTichAI: {
          maPhanTich: 'pt-1',
          maUngDung: 'openwebui-uuid',
          khauHieuTiengViet: 'Giao diện web AI tự lưu trữ',
          tomTatTinhNangVi: '- Tiện lợi',
          diemUyTin: 85,
          mucDoAnToan: 'AN_TOAN_CAO',
          daThamDinhJev: true,
          yeuToRuiRo: [],
          quyenHanDaKiemTra: [],
          thoiGianPhanTich: new Date(),
          huongDanCaiDat: {
            cachCai: [
              {
                ten: 'Cài bằng pip',
                nhom: 'PIP',
                heDieuHanh: 'DUNG_CHUNG',
                phanCung: 'CPU',
                buoc: [{ moTa: 'Cài đặt', lenh: 'pip install open-webui' }],
              },
            ],
          },
        },
      });

      const res = await service.kiemDinhVaNapRepo({
        urlRepo: 'https://github.com/open-webui/open-webui',
        nenTang: 'WINDOWS',
        abis: ['x86_64'],
      });

      expect(res.trangThai).toBe('THANH_CONG');
      expect(res.chiCoHuongDanCli).toBe(true);
      expect(res.huongDanCaiDat).toBeDefined();
      expect(res.huongDanCaiDat?.cachCai[0]?.nhom).toBe('PIP');
    });

    it('không lưu marker khongCoHuongDan khi tải README bị lỗi hoặc AI gặp sự cố (DELIV-39.1)', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        maUngDung: 'test-app-id',
        tenRepoDayDu: 'test/error-repo',
        chuSoHuu: 'test',
        tenKhoChua: 'error-repo',
        danhSachPhatHanh: [],
      });
      mockPrisma.phanTichAI.findUnique.mockResolvedValueOnce({
        maUngDung: 'test-app-id',
        huongDanCaiDat: null,
      });
      // Giả lập lỗi tải README (ví dụ lỗi mạng / rate limit 403)
      mockGithubService.layReadme.mockRejectedValueOnce(new Error('GitHub API rate limit 403'));

      await service.phanTichUngDung('test-app-id');

      // Khi tải README lỗi, KHÔNG ĐƯỢC update phanTichAI với khongCoHuongDan: true!
      expect(mockPrisma.phanTichAI.update).not.toHaveBeenCalled();
    });

    it('bổ sung CLI cho app cũ (marker lỗi thời) rồi xóa cache chi tiết mọi biến thể', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        maUngDung: 'rg-id',
        tenRepoDayDu: 'BurntSushi/ripgrep',
        chuSoHuu: 'BurntSushi',
        tenKhoChua: 'ripgrep',
        danhSachPhatHanh: [],
      });
      // Marker do bản cũ ghi: thiếu phienBanBocTach nên phải bóc tách lại
      mockPrisma.phanTichAI.findUnique.mockResolvedValueOnce({
        maUngDung: 'rg-id',
        huongDanCaiDat: { khongCoHuongDan: true, cachCai: [] },
      });
      mockGithubService.layReadme.mockResolvedValueOnce(
        '### Installation\n\n```\n$ winget install BurntSushi.ripgrep.MSVC\n```\n',
      );

      await service.phanTichUngDung('rg-id');

      expect(mockPrisma.phanTichAI.update).toHaveBeenCalledTimes(1);
      const saved = mockPrisma.phanTichAI.update.mock.calls[0]![0].data.huongDanCaiDat;
      expect(saved.cachCai[0].tenGoi).toBe('BurntSushi.ripgrep.MSVC');
      // Cache phải bị xóa theo tiền tố cho cả mã app và slug owner/repo
      expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith(
        `${service.CACHE_KEY_DETAIL}rg-id`,
      );
      expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith(
        `${service.CACHE_KEY_DETAIL}burntsushi/ripgrep`,
      );
    });
  });

  describe('P3B-25: bóc tách CLI không phụ thuộc mục "Cài đặt"', () => {
    it('README không có tiêu đề cài đặt nhưng có lệnh pip install vẫn lưu hướng dẫn hợp lệ', async () => {
      mockPrisma.ungDung.findUnique.mockResolvedValueOnce({
        maUngDung: 'tk-id',
        tenRepoDayDu: 'openai/tiktoken',
        chuSoHuu: 'openai',
        tenKhoChua: 'tiktoken',
        danhSachPhatHanh: [],
      });
      // Dấu "không có" do phiên bản cũ ghi: phải được tính lại
      mockPrisma.phanTichAI.findUnique.mockResolvedValueOnce({
        maUngDung: 'tk-id',
        huongDanCaiDat: { khongCoHuongDan: true, phienBanBocTach: 2, cachCai: [] },
      });
      mockGithubService.layReadme.mockResolvedValueOnce(
        '# tiktoken\n\ntiktoken is a fast BPE tokeniser.\n\n```\npip install tiktoken\n```\n\n## Performance\n',
      );

      await service.phanTichUngDung('tk-id');

      expect(mockPrisma.phanTichAI.update).toHaveBeenCalledTimes(1);
      const saved = mockPrisma.phanTichAI.update.mock.calls[0]![0].data.huongDanCaiDat;
      expect(saved.khongCoHuongDan).toBeUndefined();
      expect(saved.cachCai[0].tenGoi).toBe('tiktoken');
    });
  });

  describe('Task P3B-03: Tính Sẵn Thịnh Hành & Tối Ưu Truy Vấn CSDL (P3B-03.1 -> P3B-03.5)', () => {
    it('dongBoRepo lấy 15 releases và dọn dẹp các bản phát hành vượt quá 15 bản (P3B-03.5)', async () => {
      mockGithubService.layRepo.mockResolvedValueOnce({
        id: 111,
        name: 'test-app',
        full_name: 'test/test-app',
        owner: { login: 'test', avatar_url: null },
        html_url: 'https://github.com/test/test-app',
        description: 'Test application',
        stargazers_count: 500,
        forks_count: 50,
        topics: ['utility'],
      });

      mockGithubService.layDanhSachRelease.mockResolvedValueOnce([
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'v1.0.0',
          published_at: new Date().toISOString(),
          assets: [
            {
              id: 101,
              name: 'app-setup.exe',
              browser_download_url: 'https://github.com/.../app-setup.exe',
              size: 1000000,
            },
          ],
        },
      ]);

      mockPrisma.ungDung.upsert.mockResolvedValueOnce({
        maUngDung: 'app-uuid-15',
        tenRepoDayDu: 'test/test-app',
      });

      mockPrisma.banPhatHanh.upsert.mockResolvedValueOnce({
        maPhatHanh: 'rel-1',
        maUngDung: 'app-uuid-15',
        tenPhienBan: 'v1.0.0',
      });

      // Giả lập DB có 2 bản phát hành cũ vượt quá 15 bản
      mockPrisma.banPhatHanh.findMany
        .mockResolvedValueOnce([{ maPhatHanh: 'excess-1' }, { maPhatHanh: 'excess-2' }]) // lần gọi skip: 15
        .mockResolvedValueOnce([
          {
            maPhatHanh: 'rel-1',
            tenPhienBan: 'v1.0.0',
            ngayPhatHanh: new Date(),
            laBanThuNghiem: false,
            danhSachTepCaiDat: [
              {
                dinhDangTep: DinhDangTep.EXE,
                kienTrucChip: KienTrucChip.X86_64,
              },
            ],
          },
        ]); // lần gọi lấy 15 bản mới nhất để tính toán

      vi.spyOn(service, 'layChiTietApp').mockResolvedValueOnce({
        maUngDung: 'app-uuid-15',
        tenRepoDayDu: 'test/test-app',
      } as unknown as UngDungChiTietDto);

      await service.dongBoRepo('test', 'test-app');

      // Xác nhận lấy đúng 15 releases từ GitHub
      expect(mockGithubService.layDanhSachRelease).toHaveBeenCalledWith('test', 'test-app', 15);

      // Xác nhận xóa các bản phát hành vượt quá 15 bản
      expect(mockPrisma.tepCaiDat.deleteMany).toHaveBeenCalledWith({
        where: { maPhatHanh: { in: ['excess-1', 'excess-2'] } },
      });
      expect(mockPrisma.banPhatHanh.deleteMany).toHaveBeenCalledWith({
        where: { maPhatHanh: { in: ['excess-1', 'excess-2'] } },
      });

      // Xác nhận tính sẵn và lưu các cột D-19 vào CSDL
      expect(mockPrisma.ungDung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { maUngDung: 'app-uuid-15' },
          data: expect.objectContaining({
            banMoiNhatWindows: 'v1.0.0',
            dinhDangCoSan: [DinhDangTep.EXE],
            kienTrucCoSan: [KienTrucChip.X86_64],
            diemThinhHanh: expect.any(Number),
          }),
        }),
      );
    });

    it('layDanhSachApps đẩy trực tiếp orderBy diemThinhHanh xuống PostgreSQL và đọc từ cột tính sẵn (P3B-03.3, P3B-03.4)', async () => {
      mockCacheService.lay.mockResolvedValueOnce(null);

      const mockAppCalculated = {
        maUngDung: 'app-calc-1',
        tenRepoDayDu: 'fast/app',
        chuSoHuu: 'fast',
        tenKhoChua: 'app',
        duongDanGithub: 'https://github.com/fast/app',
        duongDanIcon: null,
        soSaoGithub: 2000,
        danhMucChinh: 'Tiện ích hệ thống',
        nenTangHoTro: NenTangHoTro.WINDOWS,
        duocNoiBat: false,
        daXacMinh: true,
        tenGoiAndroid: null,
        dongBoLanCuoi: new Date(),
        diemThinhHanh: 12.5,
        banMoiNhatWindows: 'v3.2.1',
        banMoiNhatAndroid: null,
        dinhDangCoSan: [DinhDangTep.EXE, DinhDangTep.MSI],
        kienTrucCoSan: [KienTrucChip.X86_64],
        phanTichAI: {
          khauHieuTiengViet: 'App tối ưu cực nhanh',
          diemUyTin: 98,
          mucDoAnToan: 'AN_TOAN_TUYET_DOI',
        },
      };

      mockPrisma.ungDung.findMany.mockResolvedValueOnce([mockAppCalculated]);
      mockPrisma.ungDung.count.mockResolvedValueOnce(1);

      const res = await service.layDanhSachApps({
        sort: AppSortOption.TRENDING,
        platform: PlatformFilter.WINDOWS,
        page: 1,
        limit: 20,
      });

      // Kiểm tra findMany được gọi trực tiếp với orderBy diemThinhHanh
      expect(mockPrisma.ungDung.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ diemThinhHanh: 'desc' }, { soSaoGithub: 'desc' }],
          skip: 0,
          take: 20,
        }),
      );

      // Kiểm tra kết quả map chính xác từ các cột tính sẵn mà không cần join release
      expect(res.duLieu).toHaveLength(1);
      const app = res.duLieu[0];
      expect(app.phienBanMoiNhat).toBe('v3.2.1');
      expect(app.dinhDangCoSan).toEqual(['EXE', 'MSI']);
      expect(app.kienTrucCoSan).toEqual(['x64']);
      expect(app.khauHieuTiengViet).toBe('App tối ưu cực nhanh');
    });
  });
});

describe('daCoKetQuaBocTachCli (làm mới dấu "không có CLI" của bản cũ)', () => {
  it('null/undefined là chưa có kết quả', () => {
    expect(daCoKetQuaBocTachCli(null)).toBe(false);
    expect(daCoKetQuaBocTachCli(undefined)).toBe(false);
  });

  it('dấu khongCoHuongDan do bản cũ ghi (thiếu phienBanBocTach) bị coi là lỗi thời', () => {
    expect(daCoKetQuaBocTachCli({ khongCoHuongDan: true, cachCai: [] })).toBe(false);
  });

  it('dấu khongCoHuongDan ở phiên bản hiện tại thì giữ nguyên, không bóc tách lại', () => {
    expect(
      daCoKetQuaBocTachCli({
        khongCoHuongDan: true,
        phienBanBocTach: PHIEN_BAN_BOC_TACH_CLI,
        cachCai: [],
      }),
    ).toBe(true);
  });

  it('hướng dẫn thật luôn được coi là đã có kết quả', () => {
    expect(daCoKetQuaBocTachCli({ cachCai: [{ ten: 'x' }] })).toBe(true);
  });
});

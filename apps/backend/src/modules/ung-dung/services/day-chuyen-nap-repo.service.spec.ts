import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DayChuyenNapRepoService, DANH_SACH_SEED_REPOS } from './day-chuyen-nap-repo.service';
import { TrangThaiUngVienRepo, LyDoLoaiUngVien, TrangThaiDichReadme } from '@prisma/client';

describe('DayChuyenNapRepoService (P3B-06 & P3B-05.4)', () => {
  let service: DayChuyenNapRepoService;

  const mockPrisma = {
    ungVienRepo: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    ungDung: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  };

  const mockGithubService = {
    getRateLimitInfo: vi.fn(),
    layRepo: vi.fn(),
    layReleaseMoiNhat: vi.fn(),
    layReadme: vi.fn(),
    graphql: vi.fn(),
  };

  const mockCacheService = {
    dat: vi.fn(),
    lay: vi.fn(),
    luu: vi.fn(),
    xoa: vi.fn(),
    tangSo: vi.fn(),
    withLock: vi.fn().mockImplementation((key, ttl, action) => action()),
  };

  const mockAppsService = {
    dongBoRepo: vi.fn(),
  };

  const mockTrendingDecayJob = {
    capNhatDiemThinhHanhToanBo: vi.fn(),
  };

  const mockAppDescriptionTranslationService = {
    dichMoTaCacApp: vi.fn(),
  };

  const mockReadmeTranslationService = {
    layHoacKichHoatDichReadme: vi.fn(),
    dangChoDenNgayMai: vi.fn().mockResolvedValue({ dangCho: false, daGoiGitHub: false }),
  };

  const mockConfig = {
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.withLock.mockImplementation((key, ttl, action) => action());
    mockConfig.get.mockImplementation((key: string, defaultVal: unknown) => {
      if (key === 'INGESTION_ENABLED') return true;
      if (key.startsWith('INGESTION_') && key.endsWith('_ENABLED')) return true;
      if (key === 'INGESTION_BATCH_SIZE') return 30;
      if (key === 'INGESTION_DAILY_README_BUDGET') return 50;
      return defaultVal;
    });

    service = new DayChuyenNapRepoService(
      mockPrisma as any,
      mockGithubService as any,
      mockCacheService as any,
      mockAppsService as any,
      mockTrendingDecayJob as any,
      mockAppDescriptionTranslationService as any,
      mockReadmeTranslationService as any,
      mockConfig as any,
    );
  });

  describe('chuanHoaTenRepo (Chốt chặn 5 - Kiểm tra dữ liệu)', () => {
    it('chấp nhận định dạng owner/repo hợp lệ', () => {
      expect(service.chuanHoaTenRepo('rustdesk/rustdesk')).toBe('rustdesk/rustdesk');
      expect(service.chuanHoaTenRepo('notepad-plus-plus/notepad-plus-plus')).toBe(
        'notepad-plus-plus/notepad-plus-plus',
      );
      expect(service.chuanHoaTenRepo('microsoft/winget-cli')).toBe('microsoft/winget-cli');
    });

    it('từ chối chuỗi rỗng, không đúng định dạng hoặc quá dài', () => {
      expect(service.chuanHoaTenRepo('')).toBeNull();
      expect(service.chuanHoaTenRepo('just-a-name')).toBeNull();
      expect(service.chuanHoaTenRepo('owner/repo/extra')).toBeNull();
      expect(service.chuanHoaTenRepo('owner/repo; rm -rf /')).toBeNull();
      expect(service.chuanHoaTenRepo('a'.repeat(105) + '/repo')).toBeNull();
    });
  });

  describe('khamPhaUngVien (P3B-06.1 & Chốt chặn 4 - Chống sinh trùng)', () => {
    it('chỉ nạp các repo chưa tồn tại, bỏ qua repo trùng lặp', async () => {
      mockPrisma.ungVienRepo.findUnique.mockResolvedValueOnce(null); // chưa có
      mockPrisma.ungVienRepo.findUnique.mockResolvedValueOnce({
        tenRepoDayDu: 'existing/repo',
      }); // đã có
      mockPrisma.ungVienRepo.count.mockResolvedValueOnce(1);

      const res = await service.khamPhaUngVien(['new/repo', 'existing/repo']);

      expect(res.daThem).toBe(1);
      expect(res.daBoQua).toBe(1);
      expect(mockPrisma.ungVienRepo.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ungVienRepo.create).toHaveBeenCalledWith({
        data: {
          tenRepoDayDu: 'new/repo',
          nguonKhamPha: 'seed_curated',
          trangThai: TrangThaiUngVienRepo.CHO_SANG_LOC,
        },
      });
    });

    it('sử dụng DANH_SACH_SEED_REPOS nếu không truyền danh sách', async () => {
      mockPrisma.ungVienRepo.findUnique.mockResolvedValue(null);
      mockPrisma.ungVienRepo.count.mockResolvedValue(DANH_SACH_SEED_REPOS.length);

      const res = await service.khamPhaUngVien();

      expect(res.daThem).toBe(DANH_SACH_SEED_REPOS.length);
      expect(mockPrisma.ungVienRepo.create).toHaveBeenCalledTimes(DANH_SACH_SEED_REPOS.length);
    });
  });

  describe('sangLocVaNapLauNho (P3B-06.3 đến 06.8, sàng lọc bằng GraphQL)', () => {
    const now = new Date();
    const ngayTruoc = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
    const uv = (ten: string, soLanThu = 0) => ({
      maUngVien: `uv-${ten}`,
      tenRepoDayDu: ten,
      soLanThu,
      trangThai: TrangThaiUngVienRepo.CHO_SANG_LOC,
    });
    /** Một repo GraphQL đạt mọi lọc cục bộ; ghi đè từng trường cho từng ca. */
    const repoGql = (ten: string, ghiDe: Record<string, unknown> = {}) => ({
      nameWithOwner: ten,
      name: ten.split('/')[1],
      description: 'A desktop app',
      stargazerCount: 5000,
      isFork: false,
      isArchived: false,
      pushedAt: ngayTruoc(10),
      licenseInfo: { spdxId: 'MIT' },
      repositoryTopics: { nodes: [] },
      latestRelease: {
        tagName: 'v1.0.0',
        publishedAt: ngayTruoc(20),
        isPrerelease: false,
        isDraft: false,
        releaseAssets: { nodes: [{ name: 'app-setup-x64.exe' }] },
      },
      ...ghiDe,
    });
    const datHangCho = (...ds: ReturnType<typeof uv>[]) =>
      mockPrisma.ungVienRepo.findMany.mockResolvedValue(ds);
    const lyDoCuaUngVien = (ma: string) =>
      mockPrisma.ungVienRepo.update.mock.calls.find((c) => c[0].where.maUngVien === ma)?.[0].data;

    beforeEach(() => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 0,
      });
      mockCacheService.lay.mockResolvedValue(0);
      mockPrisma.ungDung.count.mockResolvedValue(800);
      mockPrisma.ungDung.findFirst.mockResolvedValue(null);
      mockPrisma.ungVienRepo.updateMany.mockResolvedValue({ count: 0 });
    });

    it('bỏ qua khi tầng sàng lọc tắt (dù công tắc tổng bật) và không forceRun', async () => {
      mockConfig.get.mockImplementation((key: string, d: unknown) =>
        key === 'INGESTION_SCREENING_ENABLED' ? false : key === 'INGESTION_ENABLED' ? true : d,
      );
      const res = await service.sangLocVaNapLauNho(30, false);
      expect(res).toMatchObject({ daNhayQua: true, lyDo: 'ingestion_disabled' });
      expect(mockCacheService.withLock).not.toHaveBeenCalled();
    });

    it('bỏ qua nếu job đang bị khóa trên Redis (fs:ingestion:lock)', async () => {
      mockCacheService.withLock.mockRejectedValueOnce(
        new Error('Tài nguyên [fs:ingestion:lock] đang bị khóa bởi tiến trình khác.'),
      );
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(res).toMatchObject({ dangChay: true, lyDo: 'job_locked' });
      expect(mockPrisma.ungVienRepo.findMany).not.toHaveBeenCalled();
    });

    it('P3B-06.8: dừng khi hạn mức core còn dưới 1.000 hoặc đã hết ngân sách giờ', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({ remaining: 900, limit: 5000, reset: 0 });
      expect(await service.sangLocVaNapLauNho(30, true)).toMatchObject({
        dungDoRateLimit: true,
        lyDo: 'github_rate_limited',
      });
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 0,
      });
      mockCacheService.lay.mockResolvedValue(2000);
      expect(await service.sangLocVaNapLauNho(30, true)).toMatchObject({
        lyDo: 'het_ngan_sach_gio',
      });
      expect(mockPrisma.ungVienRepo.findMany).not.toHaveBeenCalled();
    });

    it('lấy hàng chờ theo độ ưu tiên rồi ngày tạo, và xét lại ứng viên bị loại quá 30 ngày', async () => {
      datHangCho();
      await service.sangLocVaNapLauNho(30, true);
      expect(mockPrisma.ungVienRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ doUuTien: 'asc' }, { ngayTao: 'asc' }] }),
      );
      const xetLai = mockPrisma.ungVienRepo.updateMany.mock.calls[0]![0];
      expect(xetLai.data).toEqual({ trangThai: 'CHO_SANG_LOC', lyDoLoai: null, soLanThu: 0 });
      expect(xetLai.where.lyDoLoai.notIn).toEqual(['TRONG_DANH_SACH_CHAN', 'LA_FORK']);
    });

    it('một yêu cầu GraphQL cho cả nhóm; phân loại bằng bộ lọc dùng chung, không xóa dòng', async () => {
      datHangCho(
        uv('a/luu-tru'),
        uv('b/fork'),
        uv('c/khong-gp'),
        uv('d/crack-tool'),
        uv('e/da-xoa'),
      );
      mockGithubService.graphql.mockResolvedValue({
        r0: repoGql('a/luu-tru', { isArchived: true }),
        r1: repoGql('b/fork', { isFork: true }),
        r2: repoGql('c/khong-gp', { licenseInfo: null }),
        r3: repoGql('d/crack-tool'),
        r4: null,
      });
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(mockGithubService.graphql).toHaveBeenCalledTimes(1);
      expect(res.chiTietBiLoai).toEqual({
        DA_LUU_TRU: 1,
        LA_FORK: 1,
        GIAY_PHEP_KHONG_MO: 1,
        TRONG_DANH_SACH_CHAN: 1,
        LOI_KHI_SANG_LOC: 1,
      });
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
    });

    it('D-36: nhận giấy phép NOASSERTION/other; nạp bằng tên chuẩn GitHub và tính Thịnh hành một lần', async () => {
      datHangCho(uv('cu/ten-cu'), uv('f/khac'));
      mockGithubService.graphql.mockResolvedValue({
        r0: repoGql('moi/ten-moi'),
        r1: repoGql('f/khac', { licenseInfo: { spdxId: 'NOASSERTION' } }),
      });
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(res.soLuongDaNap).toBe(2);
      expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('moi', 'ten-moi');
      expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('f', 'khac');
      expect(lyDoCuaUngVien('uv-cu/ten-cu')).toEqual({ trangThai: 'DA_NAP', lyDoLoai: null });
      expect(mockTrendingDecayJob.capNhatDiemThinhHanhToanBo).toHaveBeenCalledTimes(1);
    });

    it('D-30: không có tệp cài thì xét README; có lệnh cài thì nạp, không có thì loại đúng mã', async () => {
      datHangCho(uv('g/cli'), uv('h/khong-file'), uv('i/khong-ban'), uv('k/release-cu'));
      mockGithubService.graphql.mockResolvedValue({
        r0: repoGql('g/cli', { latestRelease: null }),
        r1: repoGql('h/khong-file', {
          latestRelease: {
            ...repoGql('x/y').latestRelease,
            releaseAssets: { nodes: [{ name: 'src.tar.gz' }] },
          },
        }),
        r2: repoGql('i/khong-ban', { latestRelease: null }),
        r3: repoGql('k/release-cu', {
          latestRelease: { ...repoGql('x/y').latestRelease, publishedAt: ngayTruoc(1200) },
        }),
      });
      mockGithubService.layReadme.mockImplementation(async (owner: string) =>
        owner === 'g'
          ? '## Install\n```sh\nnpm install -g cli\n```'
          : '# Chỉ là thư viện\n```sh\npip install -r requirements.txt\n```',
      );
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('g', 'cli');
      expect(res.chiTietBiLoai).toEqual({
        KHONG_CO_FILE_CAI: 1,
        KHONG_CO_BAN_PHAT_HANH: 1,
        KHONG_CON_CAP_NHAT: 1,
      });
    });

    it('P3B-06.7: lỗi tạm thời khi lấy README thì giữ chờ, tăng số lần thử và dừng lô', async () => {
      datHangCho(uv('l/tam-thoi'), uv('m/sau'));
      mockGithubService.graphql.mockResolvedValue({
        r0: repoGql('l/tam-thoi', { latestRelease: null }),
        r1: repoGql('m/sau'),
      });
      mockGithubService.layReadme.mockRejectedValue(
        Object.assign(new Error('rate limit'), { status: 429 }),
      );
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(lyDoCuaUngVien('uv-l/tam-thoi')).toEqual({ soLanThu: { increment: 1 } });
      expect(res.soLuongBiLoai).toBe(0);
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
    });

    it('P3B-06.7: quá 3 lần lỗi tạm thời thì chuyển sang LOI_KHI_SANG_LOC để không chặn đầu hàng chờ', async () => {
      datHangCho(uv('n/lo-gql', 3));
      mockGithubService.graphql.mockRejectedValue(new Error('fetch failed'));
      await service.sangLocVaNapLauNho(30, true);
      expect(lyDoCuaUngVien('uv-n/lo-gql')).toEqual({
        trangThai: 'BI_LOAI',
        lyDoLoai: LyDoLoaiUngVien.LOI_KHI_SANG_LOC,
      });
    });

    it('bỏ qua repo đã có trong kho (vd. tên cũ của app đã nạp) mà không đồng bộ lại', async () => {
      datHangCho(uv('o/da-co'));
      mockGithubService.graphql.mockResolvedValue({ r0: repoGql('o/da-co') });
      mockPrisma.ungDung.findFirst.mockResolvedValue({ maUngDung: 'app-o' });
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
      expect(res.soLuongDaNap).toBe(0);
      expect(lyDoCuaUngVien('uv-o/da-co')).toEqual({ trangThai: 'DA_NAP', lyDoLoai: null });
    });

    it('P3B-06.3 lọc 11: dừng khi kho đã chạm trần INGESTION_MAX_APPS', async () => {
      datHangCho(uv('p/moi'));
      mockGithubService.graphql.mockResolvedValue({ r0: repoGql('p/moi') });
      mockPrisma.ungDung.count.mockResolvedValue(10000);
      const res = await service.sangLocVaNapLauNho(30, true);
      expect(res.lyDo).toBe('dat_tran_so_app');
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
    });
  });

  describe('dichNenTheoNganSachNgay (P3B-05.4 - Chốt chặn 3 & 4: Chống bão AI và đếm chuẩn ngân sách)', () => {
    it('bỏ qua dịch nền nếu INGESTION_ENABLED = false và không forceRun', async () => {
      mockConfig.get.mockReturnValueOnce(false); // Tắt tính năng nạp tự động (INGESTION_ENABLED = false)

      const res = await service.dichNenTheoNganSachNgay(50, false);

      expect(res.daDichMoTa).toBe(0);
      expect(res.daDichReadme).toBe(0);
      expect(mockAppDescriptionTranslationService.dichMoTaCacApp).not.toHaveBeenCalled();
    });

    it('gọi dịch gom lô mô tả và tuân thủ ngân sách ngày cho README', async () => {
      mockAppDescriptionTranslationService.dichMoTaCacApp.mockResolvedValueOnce({
        dichThanhCong: 15,
        dichThatBai: 0,
      });
      mockCacheService.lay.mockResolvedValueOnce(48); // Hôm nay đã dịch 48 README (trần 50)
      mockPrisma.ungDung.findMany.mockResolvedValueOnce([
        { maUngDung: 'app-1', tenRepoDayDu: 'app/one' },
        { maUngDung: 'app-2', tenRepoDayDu: 'app/two' },
      ]);
      mockReadmeTranslationService.layHoacKichHoatDichReadme.mockResolvedValue({
        trangThai: 'DANG_DICH',
      });

      const res = await service.dichNenTheoNganSachNgay(50, true);

      expect(res.daDichMoTa).toBe(15);
      expect(res.daDichReadme).toBe(2);
      expect(res.nganSachConLai).toBe(0); // 50 - (48 + 2) = 0
      expect(mockCacheService.luu).toHaveBeenCalled();
    });

    it('không trừ ngân sách nếu bản dịch README trả về trạng thái THAT_BAI (cooldown)', async () => {
      mockAppDescriptionTranslationService.dichMoTaCacApp.mockResolvedValueOnce({
        dichThanhCong: 0,
        dichThatBai: 0,
      });
      mockCacheService.lay.mockResolvedValueOnce(10);
      mockPrisma.ungDung.findMany.mockResolvedValueOnce([
        { maUngDung: 'app-fail', tenRepoDayDu: 'app/fail' },
      ]);
      // Trả về THAT_BAI do đang cooldown 15 phút
      mockReadmeTranslationService.layHoacKichHoatDichReadme.mockResolvedValueOnce({
        trangThai: 'THAT_BAI',
      });

      const res = await service.dichNenTheoNganSachNgay(50, true);

      expect(res.daDichReadme).toBe(0); // Không trừ ngân sách!
      expect(res.nganSachConLai).toBe(40);
    });

    it('bỏ README đang hoãn và tiếp tục tới ứng viên kế tiếp trong job nền', async () => {
      mockAppDescriptionTranslationService.dichMoTaCacApp.mockResolvedValueOnce({
        dichThanhCong: 0,
        dichThatBai: 0,
      });
      mockCacheService.lay.mockResolvedValueOnce(0);
      mockPrisma.ungDung.findMany.mockResolvedValueOnce([
        {
          maUngDung: 'app-queued',
          tenRepoDayDu: 'app/queued',
          chuSoHuu: 'app',
          tenKhoChua: 'queued',
        },
        {
          maUngDung: 'app-ready',
          tenRepoDayDu: 'app/ready',
          chuSoHuu: 'app',
          tenKhoChua: 'ready',
        },
      ]);
      mockReadmeTranslationService.dangChoDenNgayMai
        .mockResolvedValueOnce({ dangCho: true, daGoiGitHub: false })
        .mockResolvedValueOnce({ dangCho: false, daGoiGitHub: false });
      mockReadmeTranslationService.layHoacKichHoatDichReadme.mockResolvedValueOnce({
        trangThai: 'DANG_DICH',
      });

      const result = await service.dichNenTheoNganSachNgay(50, true);

      expect(mockPrisma.ungDung.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                danhSachBanDichReadme: expect.objectContaining({
                  some: expect.objectContaining({ trangThai: TrangThaiDichReadme.DANG_DICH }),
                }),
              }),
            ]),
          }),
        }),
      );
      expect(mockReadmeTranslationService.layHoacKichHoatDichReadme).toHaveBeenCalledTimes(1);
      expect(mockReadmeTranslationService.layHoacKichHoatDichReadme).toHaveBeenCalledWith(
        'app-ready',
      );
      expect(mockReadmeTranslationService.dangChoDenNgayMai).toHaveBeenNthCalledWith(
        2,
        'app-ready',
        'app',
        'ready',
        true,
      );
      expect(result.daDichReadme).toBe(1);
    });

    it('giới hạn tối đa năm lượt kiểm tra README hoãn trên GitHub mỗi chu kỳ job', async () => {
      mockAppDescriptionTranslationService.dichMoTaCacApp.mockResolvedValueOnce({
        dichThanhCong: 0,
        dichThatBai: 0,
      });
      mockCacheService.lay.mockResolvedValueOnce(0);
      mockPrisma.ungDung.findMany.mockResolvedValueOnce(
        Array.from({ length: 7 }, (_, index) => ({
          maUngDung: `app-${index}`,
          tenRepoDayDu: `owner/repo-${index}`,
          chuSoHuu: 'owner',
          tenKhoChua: `repo-${index}`,
        })),
      );
      mockReadmeTranslationService.dangChoDenNgayMai.mockImplementation(
        async (_id, _owner, _repo, choPhepGitHub) => ({
          dangCho: true,
          daGoiGitHub: Boolean(choPhepGitHub),
        }),
      );

      await service.dichNenTheoNganSachNgay(50, true);

      expect(mockReadmeTranslationService.dangChoDenNgayMai).toHaveBeenCalledTimes(7);
      expect(
        mockReadmeTranslationService.dangChoDenNgayMai.mock.calls.map((call) => call[3]),
      ).toEqual([true, true, true, true, true, false, false]);
    });

    it('dừng dịch README nếu đã chạm trần ngân sách hôm nay', async () => {
      mockAppDescriptionTranslationService.dichMoTaCacApp.mockResolvedValueOnce({
        dichThanhCong: 5,
        dichThatBai: 0,
      });
      mockCacheService.lay.mockResolvedValueOnce(50); // Đã chạm trần 50/50

      const res = await service.dichNenTheoNganSachNgay(50, true);

      expect(res.daDichMoTa).toBe(5);
      expect(res.daDichReadme).toBe(0);
      expect(res.nganSachConLai).toBe(0);
      expect(mockPrisma.ungDung.findMany).not.toHaveBeenCalled();
    });
  });
});

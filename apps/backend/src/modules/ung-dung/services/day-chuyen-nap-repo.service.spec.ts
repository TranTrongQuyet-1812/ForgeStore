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
      count: vi.fn(),
    },
    ungDung: {
      findMany: vi.fn(),
    },
  };

  const mockGithubService = {
    getRateLimitInfo: vi.fn(),
    layRepo: vi.fn(),
    layReleaseMoiNhat: vi.fn(),
    layReadme: vi.fn(),
  };

  const mockCacheService = {
    dat: vi.fn(),
    lay: vi.fn(),
    luu: vi.fn(),
    xoa: vi.fn(),
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

  describe('sangLocVaNapLauNho (P3B-06.2, 06.3 & 6 Chốt Chặn)', () => {
    it('Chốt chặn 6: bỏ qua nếu INGESTION_ENABLED = false và không forceRun', async () => {
      mockConfig.get.mockReturnValueOnce(false); // Tắt tính năng nạp tự động (INGESTION_ENABLED = false)

      const res = await service.sangLocVaNapLauNho(30, false);

      expect(res.daNhayQua).toBe(true);
      expect(res.lyDo).toBe('ingestion_disabled');
      expect(mockCacheService.withLock).not.toHaveBeenCalled();
    });

    it('Chốt chặn 4: bỏ qua nếu job đang bị khóa trên Redis (fs:ingestion:lock)', async () => {
      mockCacheService.withLock.mockRejectedValueOnce(
        new Error('Tài nguyên [fs:ingestion:lock] đang bị khóa bởi tiến trình khác.'),
      );

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.dangChay).toBe(true);
      expect(res.lyDo).toBe('job_locked');
      expect(mockPrisma.ungVienRepo.findMany).not.toHaveBeenCalled();
    });

    it('Chốt chặn 2: ngắt ngay nếu hạn mức GitHub API sắp hết (< 100 req)', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 45,
        limit: 5000,
        reset: 123456,
      });

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.dungDoRateLimit).toBe(true);
      expect(res.rateLimitConLai).toBe(45);
      expect(mockPrisma.ungVienRepo.findMany).not.toHaveBeenCalled();
    });

    it('Chốt chặn 1: loại repo archived gán DA_LUU_TRU, không xóa dòng', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-1', tenRepoDayDu: 'archived/project' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: true,
        license: { key: 'mit' },
      });

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(1);
      expect(res.chiTietBiLoai[LyDoLoaiUngVien.DA_LUU_TRU]).toBe(1);
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-1' },
        data: {
          trangThai: TrangThaiUngVienRepo.BI_LOAI,
          lyDoLoai: LyDoLoaiUngVien.DA_LUU_TRU,
        },
      });
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
    });

    it('Chốt chặn 5: loại repo không có giấy phép mã nguồn mở gán GIAY_PHEP_KHONG_MO', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-no-lic', tenRepoDayDu: 'closed/app' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: null, // Không có license
      });

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(1);
      expect(res.chiTietBiLoai[LyDoLoaiUngVien.GIAY_PHEP_KHONG_MO]).toBe(1);
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-no-lic' },
        data: {
          trangThai: TrangThaiUngVienRepo.BI_LOAI,
          lyDoLoai: LyDoLoaiUngVien.GIAY_PHEP_KHONG_MO,
        },
      });
    });

    it('Chốt chặn 2: lỗi rate limit hoặc rớt mạng giữa lô -> giữ CHO_SANG_LOC và dừng lô ngay', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-err', tenRepoDayDu: 'busy/app' },
        { maUngVien: 'uv-next', tenRepoDayDu: 'next/app' },
      ]);
      // Ném lỗi 429 rate limit
      mockGithubService.layRepo.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded',
      });

      const res = await service.sangLocVaNapLauNho(30, true);

      // Không loại ứng viên, không gọi update BI_LOAI
      expect(res.soLuongBiLoai).toBe(0);
      expect(res.soLuongDaNap).toBe(0);
      expect(mockPrisma.ungVienRepo.update).not.toHaveBeenCalled();
    });

    it('P3B-25.5 (D-30): nạp đầy đủ repo chỉ có lệnh cài CLI thay vì loại bỏ', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-cli', tenRepoDayDu: 'cli-tool/fzf' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: { key: 'mit' },
      });
      mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce({
        tag_name: 'v1.0.0',
        assets: [{ name: 'source.tar.gz' }],
      });
      mockGithubService.layReadme.mockResolvedValueOnce(
        '# Installation\nRun `winget install fzf` or `scoop install fzf`',
      );

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(0);
      expect(res.soLuongDaNap).toBe(1);
      expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('cli-tool', 'fzf');
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-cli' },
        data: {
          trangThai: TrangThaiUngVienRepo.DA_NAP,
          lyDoLoai: null,
        },
      });
    });

    it('P3B-25.5 (D-30): nạp đầy đủ repo không có bản phát hành nhưng có lệnh cài CLI trong README', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-no-rel-cli', tenRepoDayDu: 'npm-pkg/serve' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: { key: 'mit' },
      });
      mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce(null);
      mockGithubService.layReadme.mockResolvedValueOnce(
        '# Installation\n```bash\nnpm install -g serve\n```',
      );

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(0);
      expect(res.soLuongDaNap).toBe(1);
      expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('npm-pkg', 'serve');
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-no-rel-cli' },
        data: {
          trangThai: TrangThaiUngVienRepo.DA_NAP,
          lyDoLoai: null,
        },
      });
    });

    it('P3B-25.5 (D-30): loại repo không có bản phát hành và không có lệnh CLI gán KHONG_CO_BAN_PHAT_HANH', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-no-rel-no-cli', tenRepoDayDu: 'docs/guide' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: { key: 'mit' },
      });
      mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce(null);
      mockGithubService.layReadme.mockResolvedValueOnce('# Just Documentation');

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(1);
      expect(res.chiTietBiLoai[LyDoLoaiUngVien.KHONG_CO_BAN_PHAT_HANH]).toBe(1);
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-no-rel-no-cli' },
        data: {
          trangThai: TrangThaiUngVienRepo.BI_LOAI,
          lyDoLoai: LyDoLoaiUngVien.KHONG_CO_BAN_PHAT_HANH,
        },
      });
    });

    it.each([
      ['không có bản phát hành', null],
      ['có bản phát hành nhưng không có file cài', { tag_name: 'v1', assets: [{ name: 'a.txt' }] }],
    ])(
      'P3B-25.5 (D-30): lỗi rate limit khi lấy README (%s) -> giữ CHO_SANG_LOC, dừng lô, không loại oan',
      async (_moTa, release) => {
        mockGithubService.getRateLimitInfo.mockReturnValue({
          remaining: 4500,
          limit: 5000,
          reset: 123456,
        });
        mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
          { maUngVien: 'uv-readme-429', tenRepoDayDu: 'cli-tool/busy' },
          { maUngVien: 'uv-sau', tenRepoDayDu: 'cli-tool/sau' },
        ]);
        mockGithubService.layRepo.mockResolvedValueOnce({
          archived: false,
          license: { key: 'mit' },
        });
        mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce(release);
        mockGithubService.layReadme.mockRejectedValueOnce({
          status: 429,
          message: 'Rate limit exceeded',
        });

        const res = await service.sangLocVaNapLauNho(30, true);

        expect(res.soLuongBiLoai).toBe(0);
        expect(res.soLuongDaNap).toBe(0);
        expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
        expect(mockPrisma.ungVienRepo.update).not.toHaveBeenCalled();
        // Dừng lô: ứng viên phía sau không bị đụng tới
        expect(mockGithubService.layRepo).toHaveBeenCalledTimes(1);
      },
    );

    it('Chốt chặn 1: loại repo không có bộ cài và không có CLI gán KHONG_CO_FILE_CAI', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-no-file', tenRepoDayDu: 'library/utils' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: { key: 'apache-2.0' },
      });
      mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce({
        tag_name: 'v1.0.0',
        assets: [{ name: 'changelog.txt' }],
      });
      mockGithubService.layReadme.mockResolvedValueOnce('# Pure Library with no CLI or binaries');

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(1);
      expect(res.chiTietBiLoai[LyDoLoaiUngVien.KHONG_CO_FILE_CAI]).toBe(1);
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-no-file' },
        data: {
          trangThai: TrangThaiUngVienRepo.BI_LOAI,
          lyDoLoai: LyDoLoaiUngVien.KHONG_CO_FILE_CAI,
        },
      });
    });

    it('Chốt chặn 1: loại repo chỉ có lệnh dev (pip install -r requirements.txt) gán KHONG_CO_FILE_CAI, không gán CHI_CO_CAI_CLI (D-23)', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-dev-only', tenRepoDayDu: 'dev/python-lib' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: { key: 'mit' },
      });
      mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce({
        tag_name: 'v1.0.0',
        assets: [{ name: 'source.tar.gz' }],
      });
      mockGithubService.layReadme.mockResolvedValueOnce(
        '# Dev Guide\n## Development\npip install -r requirements.txt\npython main.py',
      );

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongBiLoai).toBe(1);
      expect(res.chiTietBiLoai[LyDoLoaiUngVien.KHONG_CO_FILE_CAI]).toBe(1);
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-dev-only' },
        data: {
          trangThai: TrangThaiUngVienRepo.BI_LOAI,
          lyDoLoai: LyDoLoaiUngVien.KHONG_CO_FILE_CAI,
        },
      });
      expect(mockAppsService.dongBoRepo).not.toHaveBeenCalled();
    });

    it('nạp thành công repo có file cài đặt Windows và tính lại Thịnh hành 1 lần', async () => {
      mockGithubService.getRateLimitInfo.mockReturnValue({
        remaining: 4500,
        limit: 5000,
        reset: 123456,
      });
      mockPrisma.ungVienRepo.findMany.mockResolvedValueOnce([
        { maUngVien: 'uv-ok', tenRepoDayDu: 'rustdesk/rustdesk' },
      ]);
      mockGithubService.layRepo.mockResolvedValueOnce({
        archived: false,
        license: { key: 'gpl-3.0' },
      });
      mockGithubService.layReleaseMoiNhat.mockResolvedValueOnce({
        tag_name: '1.2.3',
        assets: [{ name: 'rustdesk-1.2.3-x86_64.exe' }],
      });
      mockAppsService.dongBoRepo.mockResolvedValueOnce({ maUngDung: 'app-rustdesk' });
      mockTrendingDecayJob.capNhatDiemThinhHanhToanBo.mockResolvedValueOnce({ soLuongCapNhat: 1 });

      const res = await service.sangLocVaNapLauNho(30, true);

      expect(res.soLuongDaNap).toBe(1);
      expect(mockAppsService.dongBoRepo).toHaveBeenCalledWith('rustdesk', 'rustdesk');
      expect(mockPrisma.ungVienRepo.update).toHaveBeenCalledWith({
        where: { maUngVien: 'uv-ok' },
        data: {
          trangThai: TrangThaiUngVienRepo.DA_NAP,
          lyDoLoai: null,
        },
      });
      // Tính lại điểm Thịnh hành MỘT LẦN sau lô
      expect(mockTrendingDecayJob.capNhatDiemThinhHanhToanBo).toHaveBeenCalledTimes(1);
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

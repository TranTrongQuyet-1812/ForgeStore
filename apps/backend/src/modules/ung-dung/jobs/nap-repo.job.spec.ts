import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NapRepoJob } from './nap-repo.job';

describe('NapRepoJob (P3B-06 & P3B-05.4)', () => {
  let job: NapRepoJob;

  const mockPipelineService = {
    isIngestionEnabled: vi.fn(),
    khamPhaUngVien: vi.fn(),
    sangLocVaNapLauNho: vi.fn(),
    dichNenTheoNganSachNgay: vi.fn(),
  };
  const mockKhamPha = { khamPhaTuDong: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelineService.isIngestionEnabled.mockReturnValue(true);
    job = new NapRepoJob(mockPipelineService as never, mockKhamPha as never);
  });

  it('handleCron kích hoạt chayChuKyDinhKy khi INGESTION_ENABLED = true', async () => {
    mockKhamPha.khamPhaTuDong.mockResolvedValueOnce({ trending: 2, nhieuSao: 0, dangChuY: 0 });
    mockPipelineService.sangLocVaNapLauNho.mockResolvedValueOnce({
      soLuongUngVienQuet: 10,
      soLuongDaNap: 2,
      soLuongBiLoai: 8,
    });
    mockPipelineService.dichNenTheoNganSachNgay.mockResolvedValueOnce({
      daDichMoTa: 5,
      daDichReadme: 2,
      nganSachConLai: 48,
    });

    const res = await job.chayChuKyDinhKy();

    // P3B-06.1: khám phá tự động thay cho nạp danh sách hạt giống
    expect(mockKhamPha.khamPhaTuDong).toHaveBeenCalledWith(false);
    expect(mockPipelineService.sangLocVaNapLauNho).toHaveBeenCalledWith(undefined, false);
    expect(mockPipelineService.dichNenTheoNganSachNgay).toHaveBeenCalledWith(undefined, false);
    expect(res.ketQuaNap.soLuongDaNap).toBe(2);
    expect(res.ketQuaDich.daDichReadme).toBe(2);
  });

  it('bỏ qua chu kỳ và không gọi AI khi INGESTION_ENABLED = false và không force', async () => {
    mockPipelineService.isIngestionEnabled.mockReturnValueOnce(false);

    const res = await job.chayChuKyDinhKy(false);

    expect(res.ketQuaNap.daNhayQua).toBe(true);
    expect(res.ketQuaNap.lyDo).toBe('ingestion_disabled');
    expect(mockKhamPha.khamPhaTuDong).not.toHaveBeenCalled();
    expect(mockPipelineService.sangLocVaNapLauNho).not.toHaveBeenCalled();
    expect(mockPipelineService.dichNenTheoNganSachNgay).not.toHaveBeenCalled();
  });

  it('handleCron chạy trơn tru khi được gọi tự động theo lịch', async () => {
    const spy = vi.spyOn(job, 'chayChuKyDinhKy').mockResolvedValueOnce({} as any);

    await job.handleCron();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

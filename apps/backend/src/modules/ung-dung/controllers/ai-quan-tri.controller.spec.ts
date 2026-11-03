import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiQuanTriController } from './ai-quan-tri.controller';
import { UngDungService } from '../ung-dung.service';
import { AppDescriptionTranslationService } from '../../ai/translation/services/app-description-translation.service';
import { DayChuyenNapRepoService } from '../services/day-chuyen-nap-repo.service';
import { LlmRateLimiterService } from '../../ai/services/llm-rate-limiter.service';

describe('AiQuanTriController', () => {
  let controller: AiQuanTriController;
  let mockAppsService: Partial<UngDungService>;
  let mockAppDescService: Partial<AppDescriptionTranslationService>;
  let mockPipelineService: Partial<DayChuyenNapRepoService>;
  let mockRateLimiterService: Partial<LlmRateLimiterService>;

  beforeEach(() => {
    mockAppsService = {
      chayLamNongAI: vi.fn().mockResolvedValue({ tongSo: 5, thanhCong: 5 }),
    };
    mockAppDescService = {
      dichMoTaCacApp: vi.fn().mockResolvedValue({ tongSoQuet: 10, dichThanhCong: 8 }),
    };
    mockPipelineService = {
      khamPhaUngVien: vi.fn().mockResolvedValue({ tongSo: 20 }),
      sangLocVaNapLauNho: vi.fn().mockResolvedValue({ daNap: 5 }),
      dichNenTheoNganSachNgay: vi.fn().mockResolvedValue({ daDich: 3 }),
    };
    mockRateLimiterService = {
      layThongKeGeminiTheoNgay: vi.fn().mockResolvedValue({
        ngayPacific: '2026-11-04',
        theoMoHinh: {
          'gemini-3.1-flash-lite': 45,
          'gemini-3.5-flash-lite': 20,
        },
        soMucChoSangNgayMai: 2,
      }),
    };

    controller = new AiQuanTriController(
      mockAppsService as UngDungService,
      mockAppDescService as AppDescriptionTranslationService,
      mockPipelineService as DayChuyenNapRepoService,
      mockRateLimiterService as LlmRateLimiterService,
    );
  });

  it('layThongKeNgay trả về số liệu hạn mức AI theo ngày (P3B-28.6)', async () => {
    const ketQua = await controller.layThongKeNgay();
    expect(ketQua).toEqual({
      ngayPacific: '2026-11-04',
      theoMoHinh: {
        'gemini-3.1-flash-lite': 45,
        'gemini-3.5-flash-lite': 20,
      },
      soMucChoSangNgayMai: 2,
    });
    expect(mockRateLimiterService.layThongKeGeminiTheoNgay).toHaveBeenCalledOnce();
  });
});

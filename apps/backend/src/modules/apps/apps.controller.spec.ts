import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { ReadmeTranslationService } from '../ai/translation/services/readme-translation.service';
import { TrangThaiDichReadme } from '@forgestore/types';

describe('AppsController', () => {
  let controller: AppsController;
  let mockAppsService: AppsService;
  let mockReadmeService: ReadmeTranslationService;

  beforeEach(() => {
    mockAppsService = {
      layDanhSachDanhMuc: vi.fn(),
      layDanhSachApps: vi.fn(),
      layChiTietApp: vi.fn(),
    } as unknown as AppsService;

    mockReadmeService = {
      layHoacKichHoatDichReadme: vi.fn(),
    } as unknown as ReadmeTranslationService;

    controller = new AppsController(mockAppsService, mockReadmeService);
  });

  describe('GET :owner/:repo/readme', () => {
    it('gọi layHoacKichHoatDichReadme với slug owner/repo', async () => {
      const mockResult = {
        maUngDung: 'uuid-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        banGoc: '# RustDesk',
        banDich: '# RustDesk Tiếng Việt',
        trangThai: TrangThaiDichReadme.HOAN_TAT,
        moHinhDich: 'gemini-3.1-flash-lite',
        readmeSha: 'sha256',
      };

      vi.mocked(mockReadmeService.layHoacKichHoatDichReadme).mockResolvedValue(mockResult);

      const res = await controller.layReadmeTheoSlug('rustdesk', 'rustdesk');

      expect(res).toEqual(mockResult);
      expect(mockReadmeService.layHoacKichHoatDichReadme).toHaveBeenCalledWith(
        'rustdesk/rustdesk',
        false,
      );
    });

    it('gọi layHoacKichHoatDichReadme với cờ isForce = true khi query force=true', async () => {
      vi.mocked(mockReadmeService.layHoacKichHoatDichReadme).mockResolvedValue({} as any);

      await controller.layReadmeTheoSlug('rustdesk', 'rustdesk', 'true');

      expect(mockReadmeService.layHoacKichHoatDichReadme).toHaveBeenCalledWith(
        'rustdesk/rustdesk',
        true,
      );
    });
  });

  describe('GET :id/readme', () => {
    it('gọi layHoacKichHoatDichReadme với id hoặc uuid', async () => {
      const mockResult = {
        maUngDung: 'uuid-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        banGoc: '# RustDesk',
        banDich: null,
        trangThai: 'CHUA_DICH' as const,
        moHinhDich: null,
        readmeSha: 'sha256',
      };

      vi.mocked(mockReadmeService.layHoacKichHoatDichReadme).mockResolvedValue(mockResult);

      const res = await controller.layReadmeTheoId('uuid-1');

      expect(res).toEqual(mockResult);
      expect(mockReadmeService.layHoacKichHoatDichReadme).toHaveBeenCalledWith('uuid-1', false);
    });

    it('gọi layHoacKichHoatDichReadme với cờ isForce = true khi query force=true', async () => {
      vi.mocked(mockReadmeService.layHoacKichHoatDichReadme).mockResolvedValue({} as any);

      await controller.layReadmeTheoId('uuid-1', 'true');

      expect(mockReadmeService.layHoacKichHoatDichReadme).toHaveBeenCalledWith('uuid-1', true);
    });
  });
});

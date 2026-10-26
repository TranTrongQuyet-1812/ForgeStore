import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UngDungController } from './ung-dung.controller';
import { UngDungService } from './ung-dung.service';
import { ReadmeTranslationService } from '../ai/translation/services/readme-translation.service';
import { TrangThaiDichReadme } from '@forgestore/types';

describe('UngDungController', () => {
  let controller: UngDungController;
  let mockAppsService: UngDungService;
  let mockReadmeService: ReadmeTranslationService;

  beforeEach(() => {
    mockAppsService = {
      layDanhSachDanhMuc: vi.fn(),
      layDanhSachApps: vi.fn(),
      layChiTietApp: vi.fn(),
    } as unknown as UngDungService;

    mockReadmeService = {
      layHoacKichHoatDichReadme: vi.fn(),
    } as unknown as ReadmeTranslationService;

    controller = new UngDungController(mockAppsService, mockReadmeService);
  });

  describe('GET :owner/:repo/readme', () => {
    it('gọi layHoacKichHoatDichReadme với slug owner/repo (idempotent read)', async () => {
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
      expect(mockReadmeService.layHoacKichHoatDichReadme).toHaveBeenCalledWith('rustdesk/rustdesk');
    });
  });

  describe('GET :id/readme', () => {
    it('gọi layHoacKichHoatDichReadme với id hoặc uuid (idempotent read)', async () => {
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
      expect(mockReadmeService.layHoacKichHoatDichReadme).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('POST :owner/:repo/readme/retry (Fix Claude DELIV-77.7)', () => {
    it('gọi yeuCauDichLaiReadme với slug owner/repo', async () => {
      const mockResult = {
        maUngDung: 'uuid-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        banGoc: '# RustDesk',
        banDich: null,
        trangThai: TrangThaiDichReadme.DANG_DICH,
        moHinhDich: null,
        readmeSha: 'sha256',
      };

      mockReadmeService.yeuCauDichLaiReadme = vi.fn().mockResolvedValue(mockResult);

      const res = await controller.retryReadmeTheoSlug('rustdesk', 'rustdesk');

      expect(res).toEqual(mockResult);
      expect(mockReadmeService.yeuCauDichLaiReadme).toHaveBeenCalledWith('rustdesk/rustdesk');
    });
  });

  describe('POST :id/readme/retry (Fix Claude DELIV-77.7)', () => {
    it('gọi yeuCauDichLaiReadme với id hoặc slug', async () => {
      const mockResult = {
        maUngDung: 'uuid-1',
        tenRepoDayDu: 'rustdesk/rustdesk',
        banGoc: '# RustDesk',
        banDich: null,
        trangThai: TrangThaiDichReadme.DANG_DICH,
        moHinhDich: null,
        readmeSha: 'sha256',
      };

      mockReadmeService.yeuCauDichLaiReadme = vi.fn().mockResolvedValue(mockResult);

      const res = await controller.retryReadmeTheoId('uuid-1');

      expect(res).toEqual(mockResult);
      expect(mockReadmeService.yeuCauDichLaiReadme).toHaveBeenCalledWith('uuid-1');
    });
  });
});

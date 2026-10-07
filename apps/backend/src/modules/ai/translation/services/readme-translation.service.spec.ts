import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReadmeTranslationService } from './readme-translation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubService } from '../../../github/github.service';
import { CacheService } from '../../../redis/cache.service';
import { TranslationRotationService } from './translation-rotation.service';
import { TrangThaiDichReadme } from '@forgestore/types';

describe('ReadmeTranslationService', () => {
  let service: ReadmeTranslationService;
  let mockPrisma: PrismaService;
  let mockGithub: GithubService;
  let mockRotationService: TranslationRotationService;
  let mockCacheService: CacheService;

  beforeEach(() => {
    mockPrisma = {
      ungDung: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      banDichReadme: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      boNhoDichChung: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    } as unknown as PrismaService;

    mockGithub = {
      layReadme: vi.fn(),
    } as unknown as GithubService;

    mockRotationService = {
      dichVanBan: vi.fn(),
    } as unknown as TranslationRotationService;

    mockCacheService = {
      lay: vi.fn().mockResolvedValue(null),
      luu: vi.fn().mockResolvedValue(true),
      xoa: vi.fn().mockResolvedValue(true),
    } as unknown as CacheService;

    service = new ReadmeTranslationService(
      mockPrisma,
      mockGithub,
      mockRotationService,
      mockCacheService,
    );
  });

  describe('phanDoanReadme (P3B-05.1 & Lỗi 1)', () => {
    it('bóc tách văn bản README theo các heading ## chính xác', () => {
      const markdown = `# RustDesk
The open source remote desktop access software.

## Features
- Fast and secure
- Multiplatform

## Installation
Run cargo build to install.`;

      const doanList = service.phanDoanReadme(markdown);

      expect(doanList).toHaveLength(3);
      expect(doanList[0]).toContain('# RustDesk');
      expect(doanList[1]).toContain('## Features');
      expect(doanList[2]).toContain('## Installation');
    });

    it('chia nhỏ các phân đoạn quá dài theo heading ###', () => {
      const longSection =
        `## Huge Section\n` + 'A'.repeat(2600) + `\n### Sub Section\n` + 'B'.repeat(500);
      const doanList = service.phanDoanReadme(longSection, 2500);

      expect(doanList.length).toBeGreaterThanOrEqual(2);
      expect(doanList[0]).toContain('## Huge Section');
      expect(doanList[1]).toContain('### Sub Section');
    });

    it('Lỗi 1: TUYỆT ĐỐI KHÔNG cắt dòng ## nếu nằm bên trong khối code bash', () => {
      const markdown = `# Tool Repo
Overview text.

## How to build
Here is bash instructions:
\`\`\`bash
# Setup env
export VAR=1
## clone the repo and build
git clone https://github.com/test/repo
cd repo && cargo build
\`\`\`

## License
MIT License.`;

      const doanList = service.phanDoanReadme(markdown);

      // Phải chỉ có 3 đoạn: Header, How to build (chứa trọn vẹn khối code), License
      expect(doanList).toHaveLength(3);
      expect(doanList[1]).toContain('```bash');
      expect(doanList[1]).toContain('## clone the repo and build');
      expect(doanList[1]).toContain('cargo build\n```');
      expect(doanList[2]).toContain('## License');
    });

    it('Lỗi 1: chia nhỏ phân đoạn > 5000 ký tự không có heading H3 theo dòng trống kép', () => {
      const hugeParagraph =
        '## Long Documentation\n' +
        'Line 1 of intro.\n\n' +
        'A'.repeat(3000) +
        '\n\n' +
        'B'.repeat(3000);

      const doanList = service.phanDoanReadme(hugeParagraph, 2500);

      expect(doanList.length).toBeGreaterThanOrEqual(2);
      for (const doan of doanList) {
        expect(doan.length).toBeLessThanOrEqual(5000);
      }
    });
  });

  describe('layHoacKichHoatDichReadme (P3B-05.7, Lỗi 4, Lỗi 8)', () => {
    it('trả về bản dịch HOAN_TAT ngay lập tức khi DB đã có bản dịch trùng khớp hash', async () => {
      const banGoc = '# RustDesk\nRemote desktop';
      const hash = service.tinhMaBam(banGoc);

      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'rustdesk/rustdesk',
        chuSoHuu: 'rustdesk',
        tenKhoChua: 'rustdesk',
        readmeSha: hash,
      } as unknown as ReturnType<typeof mockPrisma.ungDung.findFirst>);

      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);

      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        readmeSha: hash,
        noiDungDich: '# RustDesk\nĐiều khiển từ xa',
        moHinhDich: 'gemini-3.1-flash-lite',
        trangThai: TrangThaiDichReadme.HOAN_TAT,
      } as unknown as ReturnType<typeof mockPrisma.banDichReadme.findUnique>);

      const res = await service.layHoacKichHoatDichReadme('rustdesk/rustdesk');

      expect(res.trangThai).toBe(TrangThaiDichReadme.HOAN_TAT);
      expect(res.banDich).toBe('# RustDesk\nĐiều khiển từ xa');
      expect(res.banGoc).toBe(banGoc);
      expect(mockRotationService.dichVanBan).not.toHaveBeenCalled();
    });

    it('Lỗi 4: đọc README từ Cache thay vì gọi lại GitHub API để tránh cạn rate limit', async () => {
      const banGoc = '# Cached Bitwarden';
      const hash = service.tinhMaBam(banGoc);

      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid-2',
        tenRepoDayDu: 'bitwarden/clients',
        chuSoHuu: 'bitwarden',
        tenKhoChua: 'clients',
        readmeSha: hash,
      } as unknown as ReturnType<typeof mockPrisma.ungDung.findFirst>);

      // Cache đã lưu nội dung README
      vi.mocked(mockCacheService.lay).mockResolvedValue(banGoc);

      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maUngDung: 'app-uuid-2',
        ngonNgu: 'vi',
        readmeSha: hash,
        noiDungDich: '# Bitwarden tiếng Việt',
        moHinhDich: 'gemini-3.1-flash-lite',
        trangThai: TrangThaiDichReadme.HOAN_TAT,
      } as unknown as ReturnType<typeof mockPrisma.banDichReadme.findUnique>);

      const res = await service.layHoacKichHoatDichReadme('bitwarden/clients');

      expect(res.banDich).toBe('# Bitwarden tiếng Việt');
      expect(mockCacheService.lay).toHaveBeenCalledWith('fs:github:readme:bitwarden:clients');
      // Không hề gọi sang GitHub API
      expect(mockGithub.layReadme).not.toHaveBeenCalled();
    });

    it('Lỗi 4: phát hiện stale lock khi DANG_DICH quá 10 phút và tự động kích hoạt dịch lại', async () => {
      const banGoc = '# Stale App';
      const hash = service.tinhMaBam(banGoc);

      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'stale-uuid',
        tenRepoDayDu: 'org/stale-app',
        chuSoHuu: 'org',
        tenKhoChua: 'stale-app',
        readmeSha: null,
      } as unknown as ReturnType<typeof mockPrisma.ungDung.findFirst>);

      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);

      // Trạng thái DANG_DICH từ 15 phút trước (stale lock do server restart)
      const thoiGianCachDay15Phut = new Date(Date.now() - 15 * 60 * 1000);
      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maUngDung: 'stale-uuid',
        ngonNgu: 'vi',
        readmeSha: hash,
        noiDungDich: null,
        moHinhDich: 'pending',
        trangThai: TrangThaiDichReadme.DANG_DICH,
        thoiGianDich: thoiGianCachDay15Phut,
      } as unknown as ReturnType<typeof mockPrisma.banDichReadme.findUnique>);

      const spyNen = vi.spyOn(service, 'kichHoatDichReadmeNen').mockResolvedValue(true);

      const res = await service.layHoacKichHoatDichReadme('org/stale-app');

      expect(spyNen).toHaveBeenCalledWith('stale-uuid', 'org', 'stale-app', banGoc, hash);
      expect(res.banGoc).toBe(banGoc);
    });

    it('Lỗi 8: xử lý an toàn khi tham số idOrSlug chứa URI malformed không ném lỗi 500', async () => {
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue(null);

      // Truyền một chuỗi URI malformed '%E0%A4%A'
      await expect(service.layHoacKichHoatDichReadme('%E0%A4%A')).rejects.toThrow(
        'Không tìm thấy ứng dụng với định danh: %E0%A4%A',
      );
    });
  });

  describe('kichHoatDichReadmeNen (P3B-05.3, P3B-05.4 & Lỗi 8)', () => {
    it('tận dụng bo_nho_dich_chung khi đoạn đã có trong cache và tổng hợp danh sách mo_hinh_dich', async () => {
      const banGoc = '## Features\nOpen source\n\n## Install\nRun command';
      const hash = service.tinhMaBam(banGoc);

      // Đoạn 1 đã có trong bo_nho_dich_chung do mô hình sea-lion dịch
      vi.mocked(mockPrisma.boNhoDichChung.findUnique)
        .mockResolvedValueOnce({
          maBam: 'hash1',
          ngonNgu: 'vi',
          doanGoc: '## Features\nOpen source',
          doanDich: '## Tính năng\nMã nguồn mở',
          moHinhDich: 'sealion-27b',
          ngayTao: new Date(),
        })
        .mockResolvedValueOnce(null); // Đoạn 2 chưa có

      // Đoạn 2 gọi AI dịch bằng gemini
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: true,
        banDich: '## Cài đặt\nChạy câu lệnh',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        thoiGianMs: 100,
        chiTietLoi: [],
      });

      const success = await service.kichHoatDichReadmeNen(
        'app-uuid',
        'rustdesk',
        'rustdesk',
        banGoc,
        hash,
      );

      expect(success).toBe(true);
      expect(mockRotationService.dichVanBan).toHaveBeenCalledTimes(1);

      // Kiểm tra Bảng 12 được lưu với moHinhDich tổng hợp chứa cả hai mô hình (Lỗi 8)
      expect(mockPrisma.banDichReadme.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            moHinhDich: expect.stringMatching(/sealion-27b.*gemini-3.1-flash-lite/),
            trangThai: TrangThaiDichReadme.HOAN_TAT,
          }),
        }),
      );
    });

    it('đánh dấu THAT_BAI khi AI thất bại và TUYỆT ĐỐI không lưu bản gốc làm bản dịch', async () => {
      const banGoc = '## Section 1\nContent';
      const hash = service.tinhMaBam(banGoc);

      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue(null);
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: false,
        banDich: null, // Claude chốt chặn: thất bại thì banDich là null
        provider: null,
        model: null,
        thoiGianMs: 50,
        chiTietLoi: [],
      });

      const success = await service.kichHoatDichReadmeNen(
        'app-uuid',
        'owner',
        'repo',
        banGoc,
        hash,
      );

      expect(success).toBe(false);
      expect(mockPrisma.banDichReadme.update).toHaveBeenCalledWith({
        where: { maUngDung_ngonNgu: { maUngDung: 'app-uuid', ngonNgu: 'vi' } },
        // Ghi lại mốc thất bại để thời gian chờ 15 phút tính từ lần thất bại này
        data: { trangThai: TrangThaiDichReadme.THAT_BAI, thoiGianDich: expect.any(Date) },
      });
    });

    it('cập nhật mốc thoiGianDich khi bắt đầu dịch lại một bản dịch cũ (khóa DANG_DICH quá hạn tính đúng)', async () => {
      const banGoc = '## Section 1\nContent';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue(null);
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: false,
        banDich: null,
        provider: null,
        model: null,
        thoiGianMs: 10,
        chiTietLoi: [],
      });

      await service.kichHoatDichReadmeNen('app-uuid', 'owner', 'repo', banGoc, hash);

      expect(mockPrisma.banDichReadme.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            trangThai: TrangThaiDichReadme.DANG_DICH,
            thoiGianDich: expect.any(Date),
          }),
        }),
      );
    });
  });
});

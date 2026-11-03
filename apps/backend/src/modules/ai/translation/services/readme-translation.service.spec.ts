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
        update: vi.fn().mockResolvedValue({}),
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
      dichGomLoJson: vi.fn(),
      ghiNhanMucChoNgayMai: vi.fn().mockResolvedValue(undefined),
    } as unknown as TranslationRotationService;

    mockCacheService = {
      lay: vi.fn().mockResolvedValue(null),
      luu: vi.fn().mockResolvedValue(true),
      xoa: vi.fn().mockResolvedValue(true),
      setNx: vi.fn().mockResolvedValue(true),
      tangSo: vi.fn().mockResolvedValue(1),
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
          doanDich: 'Mã nguồn mở',
          moHinhDich: 'sealion-27b',
          ngayTao: new Date(),
        })
        .mockResolvedValueOnce(null); // Đoạn 2 chưa có

      // Đoạn 2 gọi AI dịch bằng gemini
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: true,
        banDich: 'Chạy câu lệnh',
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

    it('đánh dấu THAT_BAI và không ghi cache nếu bản dịch làm thay đổi URL', async () => {
      const banGoc = 'Use this tool carefully.';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue(null);
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: true,
        banDich: 'Dùng công cụ này https://evil.example',
        provider: 'gemini',
        model: 'gemini-test',
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
      expect(mockPrisma.boNhoDichChung.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.banDichReadme.update).toHaveBeenCalledWith({
        where: { maUngDung_ngonNgu: { maUngDung: 'app-uuid', ngonNgu: 'vi' } },
        data: { trangThai: TrangThaiDichReadme.THAT_BAI, thoiGianDich: expect.any(Date) },
      });
    });

    it('bỏ qua cache vi phạm bất biến rồi dịch lại để thay bằng kết quả hợp lệ', async () => {
      const banGoc = 'Use this tool carefully.';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue({
        maBam: 'old-hash',
        ngonNgu: 'vi',
        doanGoc: banGoc,
        doanDich: 'Use https://evil.example',
        moHinhDich: 'old-model',
        ngayTao: new Date(),
      } as unknown as Awaited<ReturnType<typeof mockPrisma.boNhoDichChung.findUnique>>);
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: true,
        banDich: 'Dùng công cụ này cẩn thận.',
        provider: 'gemini',
        model: 'gemini-test',
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

      expect(success).toBe(true);
      expect(mockRotationService.dichVanBan).toHaveBeenCalledTimes(1);
      expect(mockPrisma.boNhoDichChung.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ doanDich: 'Dùng công cụ này cẩn thận.' }),
        }),
      );
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

    it('Lỗi 2: chia nhỏ triệt để đoạn văn xuôi dài > 5000 ký tự không có dòng trống', () => {
      const cau = 'Đây là một câu văn xuôi mô tả tính năng của phần mềm rất chi tiết và dài dòng. ';
      const vanXuoiDai = cau.repeat(100); // ~8000 ký tự
      expect(vanXuoiDai.length).toBeGreaterThan(5000);

      const doan = service.phanDoanReadme(vanXuoiDai);
      expect(doan.length).toBeGreaterThan(1);
      for (const d of doan) {
        expect(d.length).toBeLessThanOrEqual(5000);
      }
    });

    it('Lỗi 1: cờ force = true cho phép nút Dịch lại kích hoạt dịch ngay dù đang trong cooldown 15 phút', async () => {
      const banGoc = '# App Title\nSome content';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'test/app',
        chuSoHuu: 'test',
        tenKhoChua: 'app',
        readmeSha: hash,
      } as any);
      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);

      // Giả lập trạng thái THAT_BAI vừa xảy ra 2 phút trước
      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maBanDich: 'bd-1',
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        noiDungDich: null,
        trangThai: TrangThaiDichReadme.THAT_BAI,
        readmeSha: hash,
        thoiGianDich: new Date(Date.now() - 2 * 60 * 1000), // 2 phút trước
      } as any);

      // Khi gọi thông thường (force = false): bị chặn bởi cooldown
      const resCooldown = await service.layHoacKichHoatDichReadme('test/app', false);
      expect(resCooldown.trangThai).toBe(TrangThaiDichReadme.THAT_BAI);

      // Khi bấm nút "Dịch lại" (force = true): vượt qua cooldown và chuyển sang DANG_DICH
      const resForce = await service.layHoacKichHoatDichReadme('test/app', true);
      expect(resForce.trangThai).toBe(TrangThaiDichReadme.DANG_DICH);
    });

    it('Lỗi 1: khi README gốc đổi hash, trả về trạng thái DA_CU kèm bản dịch cũ mà không ghi DB thừa', async () => {
      const banGocMoi = '# App Title Updated\nNew content added';
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'test/app',
        chuSoHuu: 'test',
        tenKhoChua: 'app',
        readmeSha: 'hash-cu',
      } as any);
      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGocMoi);

      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maBanDich: 'bd-1',
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        noiDungDich: '# Bản dịch cũ tiếng Việt',
        trangThai: TrangThaiDichReadme.HOAN_TAT,
        readmeSha: 'hash-cu',
      } as any);

      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: true,
        banDich: '# Bản dịch mới',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        thoiGianMs: 10,
        chiTietLoi: [],
      });

      const res = await service.layHoacKichHoatDichReadme('test/app');
      expect(res.trangThai).toBe(TrangThaiDichReadme.DA_CU);
      expect(res.banDich).toBe('# Bản dịch cũ tiếng Việt');
      // Không ghi DB DA_CU thừa vì kichHoatDichReadmeNen sẽ chạy upsert ngay sau đó
      expect(mockPrisma.banDichReadme.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { trangThai: TrangThaiDichReadme.DA_CU },
        }),
      );
    });

    it('Lỗi Đỏ 2: bảo toàn 100% khối code JSON 11k ký tự không bị cắt đôi', () => {
      const jsonContent = JSON.stringify(
        {
          data: Array.from({ length: 300 }, (_, i) => ({
            id: i,
            name: `item_${i}`,
            note: 'long description for testing code fence safety',
          })),
        },
        null,
        2,
      );
      expect(jsonContent.length).toBeGreaterThan(11000);

      const markdown = `# API Specification\n\nHere is the large sample response:\n\n\`\`\`json\n${jsonContent}\n\`\`\`\n\n## Conclusion\nEnd of documentation.`;
      const doanList = service.phanDoanReadme(markdown);

      // Tìm đoạn chứa khối JSON
      const jsonBlockDoan = doanList.find((d) => d.includes('```json'));
      expect(jsonBlockDoan).toBeDefined();
      // Khối code phải còn nguyên vẹn 1 cặp mở và đóng ```
      const countCodeFences = (jsonBlockDoan!.match(/```/g) || []).length;
      expect(countCodeFences).toBe(2);
      expect(jsonBlockDoan).toContain('```json');
      expect(jsonBlockDoan).toContain(jsonContent);
    });

    it('Lỗi Đỏ 1: cờ force = true bị bỏ qua khi trạng thái là HOAN_TAT (không ép dịch lại)', async () => {
      const banGoc = '# App Title\nSome content';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'test/app',
        chuSoHuu: 'test',
        tenKhoChua: 'app',
        readmeSha: hash,
      } as any);
      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);
      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maBanDich: 'bd-1',
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        noiDungDich: '# Tiêu đề tiếng Việt',
        trangThai: TrangThaiDichReadme.HOAN_TAT,
        readmeSha: hash,
      } as any);

      const res = await service.layHoacKichHoatDichReadme('test/app', true);
      expect(res.trangThai).toBe(TrangThaiDichReadme.HOAN_TAT);
      expect(res.banDich).toBe('# Tiêu đề tiếng Việt');
    });

    it('Lỗi Đỏ 1: cờ force = true bị bỏ qua khi trạng thái là DANG_DICH (không làm gián đoạn tiến trình in-flight)', async () => {
      const banGoc = '# App Title\nSome content';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'test/app',
        chuSoHuu: 'test',
        tenKhoChua: 'app',
        readmeSha: hash,
      } as any);
      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);
      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maBanDich: 'bd-1',
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        noiDungDich: null,
        trangThai: TrangThaiDichReadme.DANG_DICH,
        readmeSha: hash,
        thoiGianDich: new Date(),
      } as any);

      const res = await service.layHoacKichHoatDichReadme('test/app', true);
      expect(res.trangThai).toBe(TrangThaiDichReadme.DANG_DICH);
    });

    it('Lỗi Đỏ 1: cờ force = true khi THAT_BAI bị chặn nếu đang trong 60s cooldown Redis', async () => {
      const banGoc = '# App Title\nSome content';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'test/app',
        chuSoHuu: 'test',
        tenKhoChua: 'app',
        readmeSha: hash,
      } as any);
      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);
      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maBanDich: 'bd-1',
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        noiDungDich: null,
        trangThai: TrangThaiDichReadme.THAT_BAI,
        readmeSha: hash,
        thoiGianDich: new Date(Date.now() - 2 * 60 * 1000), // 2 phút trước
      } as any);

      // Đã có khóa Redis 60s cooldown nguyên tử (setNx trả về false vì key đã tồn tại)
      vi.mocked(mockCacheService.setNx).mockResolvedValue(false);

      const res = await service.layHoacKichHoatDichReadme('test/app', true);
      expect(res.trangThai).toBe(TrangThaiDichReadme.THAT_BAI);
    });

    it('yeuCauDichLaiReadme gọi layHoacKichHoatDichReadme với force = true (Fix Claude DELIV-77.7)', async () => {
      const banGoc = '# App Title\nContent';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.ungDung.findFirst).mockResolvedValue({
        maUngDung: 'app-uuid',
        tenRepoDayDu: 'test/app',
        chuSoHuu: 'test',
        tenKhoChua: 'app',
        readmeSha: hash,
      } as any);
      vi.mocked(mockGithub.layReadme).mockResolvedValue(banGoc);
      vi.mocked(mockPrisma.banDichReadme.findUnique).mockResolvedValue({
        maBanDich: 'bd-1',
        maUngDung: 'app-uuid',
        ngonNgu: 'vi',
        noiDungDich: null,
        trangThai: TrangThaiDichReadme.THAT_BAI,
        readmeSha: hash,
        thoiGianDich: new Date(Date.now() - 2 * 60 * 1000),
      } as any);
      vi.mocked(mockCacheService.setNx).mockResolvedValue(true);

      const res = await service.yeuCauDichLaiReadme('test/app');
      expect(res.trangThai).toBe(TrangThaiDichReadme.DANG_DICH);
    });
  });

  describe('P3B-28.4 Gom lô dịch README', () => {
    it('gomLoDoanReadme gom các đoạn vào từng lô theo ngưỡng khoảng 2.500 ký tự', () => {
      const doan1 = { vanBanDaChe: 'A'.repeat(1200), stt: 1 };
      const doan2 = { vanBanDaChe: 'B'.repeat(1200), stt: 2 };
      const doan3 = { vanBanDaChe: 'C'.repeat(500), stt: 3 }; // Tổng 1200 + 1200 + 500 = 2900 > 2500 -> ngắt lô
      const doan4 = { vanBanDaChe: 'D'.repeat(800), stt: 4 };

      const danhSachLo = service.gomLoDoanReadme([doan1, doan2, doan3, doan4], 2500);

      expect(danhSachLo).toHaveLength(2);
      expect(danhSachLo[0]).toEqual([doan1, doan2]); // 2400 ký tự <= 2500
      expect(danhSachLo[1]).toEqual([doan3, doan4]); // 1300 ký tự
    });

    it('kiemTraGiuChoKyHieu phát hiện chính xác tính bảo toàn ký hiệu giữ chỗ', () => {
      const goc = 'Cài đặt với ⟦C1⟧ và chạy ⟦C2⟧.';
      const dichDung = 'Cài đặt bằng ⟦C1⟧ rồi chạy ⟦C2⟧.';
      const dichThieu = 'Cài đặt bằng ⟦C1⟧.';
      const dichSaiThuTu = 'Chạy ⟦C2⟧ rồi cài đặt ⟦C1⟧.'; // Cả 2 đều có C1 và C2
      const dichMatKyHieu = 'Cài đặt bằng mã nguồn.';

      expect(service.kiemTraGiuChoKyHieu(goc, dichDung)).toBe(true);
      expect(service.kiemTraGiuChoKyHieu(goc, dichThieu)).toBe(false);
      expect(service.kiemTraGiuChoKyHieu(goc, dichMatKyHieu)).toBe(false);
      expect(service.kiemTraGiuChoKyHieu(goc, dichSaiThuTu)).toBe(true);
    });

    it('kichHoatDichReadmeNen gọi dichGomLoJson với loai = readme và gom các đoạn vào lô', async () => {
      const banGoc = 'Hello `tool`\n\nWorld `library`';
      const hash = service.tinhMaBam(banGoc);

      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue(null);
      vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
        thanhCong: true,
        ketQua: {
          '1': 'Xin chào ⟦C1⟧',
          '2': 'Thế giới ⟦C1⟧',
        },
        thieuIds: [],
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        chiTietLoi: [],
      });

      const success = await service.kichHoatDichReadmeNen(
        'app-uuid',
        'owner',
        'repo',
        banGoc,
        hash,
      );

      expect(success).toBe(true);
      expect(mockRotationService.dichGomLoJson).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '1', text: expect.stringContaining('Hello') }),
          expect.objectContaining({ id: '2', text: expect.stringContaining('World') }),
        ]),
        expect.objectContaining({ loai: 'readme' }),
      );
      // Khi gom lô thành công, không cần gọi dichVanBan lẻ
      expect(mockRotationService.dichVanBan).not.toHaveBeenCalled();
    });

    it('xếp README sang ngày mai khi hai hũ hết lượt và giữ trạng thái đang dịch', async () => {
      const banGoc = 'New README text';
      const hash = service.tinhMaBam(banGoc);
      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue(null);
      vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
        thanhCong: false,
        ketQua: {},
        thieuIds: ['1'],
        provider: null,
        model: null,
        chiTietLoi: [],
        choNgayMai: true,
        retryAfterSec: 3600,
      });

      const success = await service.kichHoatDichReadmeNen(
        'app-uuid',
        'owner',
        'repo',
        banGoc,
        hash,
      );

      expect(success).toBe(false);
      expect(mockCacheService.luu).toHaveBeenCalledWith(
        'fs:ai:translation:deferred:app-uuid',
        expect.objectContaining({ readmeSha: hash, retryAt: expect.any(Number) }),
        3900,
      );
      expect(mockRotationService.ghiNhanMucChoNgayMai).toHaveBeenCalledWith(['app-uuid']);
      expect(mockPrisma.banDichReadme.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { trangThai: TrangThaiDichReadme.DANG_DICH, thoiGianDich: expect.any(Date) },
        }),
      );
      expect(mockPrisma.banDichReadme.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ trangThai: TrangThaiDichReadme.THAT_BAI }),
        }),
      );
    });

    it('fallback sang dichVanBan khi một đoạn trong lô bị lỗi ký hiệu giữ chỗ', async () => {
      const banGoc = 'Hello `tool`';
      const hash = service.tinhMaBam(banGoc);

      vi.mocked(mockPrisma.boNhoDichChung.findUnique).mockResolvedValue(null);
      // Batch JSON trả về thiếu ký hiệu ⟦C1⟧
      vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
        thanhCong: true,
        ketQua: {
          '1': 'Xin chào', // Thiếu ⟦C1⟧
        },
        thieuIds: [],
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        chiTietLoi: [],
      });

      // Fallback dịch đơn lẻ thành công và giữ đủ ký hiệu
      vi.mocked(mockRotationService.dichVanBan).mockResolvedValue({
        thanhCong: true,
        banDich: 'Xin chào ⟦C1⟧',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        thoiGianMs: 60,
        chiTietLoi: [],
      });

      const success = await service.kichHoatDichReadmeNen(
        'app-uuid',
        'owner',
        'repo',
        banGoc,
        hash,
      );

      expect(success).toBe(true);
      expect(mockRotationService.dichVanBan).toHaveBeenCalledTimes(1);
    });

    it('giữ nguyên đoạn cũ theo maBam từ boNhoDichChung và chỉ gọi gom lô AI cho đoạn mới (repo cập nhật)', async () => {
      const banGoc = 'Unchanged text\n\nNew updated text';
      const hash = service.tinhMaBam(banGoc);

      // Đoạn 1 đã có trong cache
      vi.mocked(mockPrisma.boNhoDichChung.findUnique)
        .mockResolvedValueOnce({
          maBam: 'hash-doan-1',
          ngonNgu: 'vi',
          doanGoc: 'Unchanged text',
          doanDich: 'Nội dung không đổi',
          moHinhDich: 'gemini-3.1-flash-lite',
          ngayTao: new Date(),
        })
        .mockResolvedValueOnce(null); // Đoạn 2 mới tinh chưa có cache

      vi.mocked(mockRotationService.dichGomLoJson).mockResolvedValue({
        thanhCong: true,
        ketQua: {
          '2': 'Nội dung mới cập nhật',
        },
        thieuIds: [],
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        chiTietLoi: [],
      });

      const success = await service.kichHoatDichReadmeNen(
        'app-uuid',
        'owner',
        'repo',
        banGoc,
        hash,
      );

      expect(success).toBe(true);
      // Chỉ gửi đoạn 2 đi dịch gom lô
      expect(mockRotationService.dichGomLoJson).toHaveBeenCalledWith(
        [expect.objectContaining({ id: '2', text: expect.stringContaining('New updated text') })],
        expect.objectContaining({ loai: 'readme' }),
      );
    });
  });
});

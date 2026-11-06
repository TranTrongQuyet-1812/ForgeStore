import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KiemNhatQuanHienThiJob } from './kiem-nhat-quan-hien-thi.job';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { UngDungService, PHIEN_BAN_BOC_TACH_CLI } from '../ung-dung.service';
import { SemanticSearchService } from '../../ai/services/semantic-search.service';
import { AppDescriptionTranslationService } from '../../ai/translation/services/app-description-translation.service';

describe('KiemNhatQuanHienThiJob (P3B-25.8, D-30)', () => {
  let job: KiemNhatQuanHienThiJob;
  let mockPrisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    ungDung: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    phanTichAI: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };
  let mockAppsService: { phanTichUngDung: ReturnType<typeof vi.fn> };
  const mockSemantic = {
    sinhLaiVectorLoiThoi: vi.fn().mockResolvedValue({ ghiMoc: 0, sinhLai: 0, loi: 0 }),
  };
  const mockMoTa = {
    dichMoTaCacApp: vi
      .fn()
      .mockResolvedValue({ soAppCanDich: 0, dichThanhCong: 0, soAppChoNgayMai: 0 }),
  };
  let mockCacheService: {
    xoaTheoPrefix: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      ungDung: {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      phanTichAI: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    mockAppsService = { phanTichUngDung: vi.fn().mockResolvedValue(undefined) };

    mockCacheService = {
      xoaTheoPrefix: vi.fn().mockResolvedValue(true),
    };

    job = new KiemNhatQuanHienThiJob(
      mockPrisma as unknown as PrismaService,
      mockCacheService as unknown as CacheService,
      mockAppsService as unknown as UngDungService,
      mockSemantic as unknown as SemanticSearchService,
      mockMoTa as unknown as AppDescriptionTranslationService,
    );
  });

  it('(a) Tự sửa sang HOAT_DONG và xóa cache khi app đang KHONG_CO_BAN_CAI nhưng có tệp cài Windows', async () => {
    const mockAppAnCoTep = [
      {
        maUngDung: 'app-an-1',
        tenRepoDayDu: 'org/desktop-app',
        trangThai: 'KHONG_CO_BAN_CAI',
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            danhSachTepCaiDat: [{ maTep: 'file-exe-1' }],
          },
        ],
      },
    ];

    // Lần 1 gọi cho KHONG_CO_BAN_CAI, lần 2 gọi cho HOAT_DONG
    mockPrisma.ungDung.findMany.mockResolvedValueOnce(mockAppAnCoTep).mockResolvedValueOnce([]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(1);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-an-1' },
      data: { trangThai: 'HOAT_DONG' },
    });
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:detail:');
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:categories:');
  });

  it('(a) Tự sửa sang HOAT_DONG và xóa cache khi app đang KHONG_CO_BAN_CAI nhưng có lệnh cài CLI', async () => {
    const mockAppAnCoCli = [
      {
        maUngDung: 'app-an-cli',
        tenRepoDayDu: 'cli/tool',
        trangThai: 'KHONG_CO_BAN_CAI',
        phanTichAI: {
          huongDanCaiDat: {
            cachCai: [
              {
                trinhQuanLy: 'winget',
                tenGoi: 'tool',
                ten: 'Cài đặt qua winget',
              },
            ],
          },
        },
        danhSachPhatHanh: [],
      },
    ];

    mockPrisma.ungDung.findMany.mockResolvedValueOnce(mockAppAnCoCli).mockResolvedValueOnce([]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(1);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'app-an-cli' },
      data: { trangThai: 'HOAT_DONG' },
    });
    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
  });

  it('(b) Chỉ cảnh báo trong log và KHÔNG tự đổi trạng thái khi app đang HOAT_DONG nhưng không có tệp cài hay CLI', async () => {
    const mockAppHienKhongCoGi = [
      {
        maUngDung: 'app-hien-loi',
        tenRepoDayDu: 'empty/repo',
        trangThai: 'HOAT_DONG',
        phanTichAI: {
          huongDanCaiDat: {
            khongCoHuongDan: true,
          },
        },
        danhSachPhatHanh: [],
      },
    ];

    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce([]) // Không có app ẩn nào bị sai
      .mockResolvedValueOnce(mockAppHienKhongCoGi); // Có 1 app hiện sai

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(1);
    expect(mockPrisma.ungDung.update).not.toHaveBeenCalled();
    expect(mockCacheService.xoaTheoPrefix).not.toHaveBeenCalled();
  });

  it('Không có lệch thì không sửa và không xóa cache', async () => {
    const mockAppAnDung = [
      {
        maUngDung: 'app-an-dung',
        tenRepoDayDu: 'doc/only',
        trangThai: 'KHONG_CO_BAN_CAI',
        phanTichAI: null,
        danhSachPhatHanh: [],
      },
    ];
    const mockAppHienDung = [
      {
        maUngDung: 'app-hien-dung',
        tenRepoDayDu: 'real/app',
        trangThai: 'HOAT_DONG',
        phanTichAI: null,
        danhSachPhatHanh: [
          {
            danhSachTepCaiDat: [{ maTep: 'file-msi' }],
          },
        ],
      },
    ];

    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce(mockAppAnDung)
      .mockResolvedValueOnce(mockAppHienDung);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.update).not.toHaveBeenCalled();
    expect(mockCacheService.xoaTheoPrefix).not.toHaveBeenCalled();
  });

  it('Bắt lỗi an toàn và giải phóng cờ isRunning khi CSDL gặp sự cố (không sập tiến trình)', async () => {
    mockPrisma.ungDung.findMany.mockRejectedValue(new Error('Lỗi mất kết nối CSDL PostgreSQL'));

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(0);
    expect((job as unknown as { isRunning: boolean }).isRunning).toBe(false);
  });

  it('Bỏ qua chu kỳ nếu tác vụ trước đó đang chạy dở (isRunning = true)', async () => {
    Object.assign(job, { isRunning: true });

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(0);
    expect(result.soLuongCanhBao).toBe(0);
    expect(mockPrisma.ungDung.findMany).not.toHaveBeenCalled();
  });

  it('handleCron kích hoạt tác vụ kiemTraVaSuaNhatQuanHienThi', async () => {
    const spy = vi
      .spyOn(job, 'kiemTraVaSuaNhatQuanHienThi')
      .mockResolvedValue({ soLuongDaSua: 3, soLuongCanhBao: 1 });

    await job.handleCron();

    expect(spy).toHaveBeenCalled();
  });

  const taoApp = (ma: string, coTep: boolean) => ({
    maUngDung: ma,
    tenRepoDayDu: `org/${ma}`,
    trangThai: 'KHONG_CO_BAN_CAI',
    phanTichAI: null,
    danhSachPhatHanh: coTep ? [{ danhSachTepCaiDat: [{ maTep: `f-${ma}` }] }] : [],
  });

  it('(a) Duyệt sang trang sau: 200 dòng đầu không đủ điều kiện không được chặn dòng phía sau', async () => {
    const trangDau = Array.from({ length: 200 }, (_, i) =>
      taoApp(`a-${String(i).padStart(3, '0')}`, false),
    );
    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce(trangDau)
      .mockResolvedValueOnce([taoApp('b-001', true)])
      .mockResolvedValueOnce([]); // (b) không có app HOAT_DONG

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongDaSua).toBe(1);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledWith({
      where: { maUngDung: 'b-001' },
      data: { trangThai: 'HOAT_DONG' },
    });
    // Trang 2 phải bắt đầu sau dòng cuối của trang 1
    expect(mockPrisma.ungDung.findMany.mock.calls[1][0].where).toEqual({
      trangThai: 'KHONG_CO_BAN_CAI',
      maUngDung: { gt: 'a-199' },
    });
  });

  it('(a) Tôn trọng giới hạn số app tự sửa mỗi lần chạy', async () => {
    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce([taoApp('x-1', true), taoApp('x-2', true), taoApp('x-3', true)])
      .mockResolvedValueOnce([]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi(2);

    expect(result.soLuongDaSua).toBe(2);
    expect(mockPrisma.ungDung.update).toHaveBeenCalledTimes(2);
  });

  it('(a) Lỗi giữa chừng vẫn xóa cache cho các app đã sửa trước đó', async () => {
    mockPrisma.ungDung.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Mất kết nối giữa chừng'));
    mockPrisma.ungDung.findMany.mockResolvedValueOnce([taoApp('y-1', true), taoApp('y-2', true)]);

    await job.kiemTraVaSuaNhatQuanHienThi();

    expect(mockCacheService.xoaTheoPrefix).toHaveBeenCalledWith('fs:apps:list:');
    expect((job as unknown as { isRunning: boolean }).isRunning).toBe(false);
  });

  it('(b) Duyệt hết các trang HOAT_DONG và đếm đủ số cảnh báo', async () => {
    const hienNham = (ma: string) => ({ ...taoApp(ma, false), trangThai: 'HOAT_DONG' });
    const trangDau = Array.from({ length: 200 }, (_, i) =>
      hienNham(`h-${String(i).padStart(3, '0')}`),
    );
    mockPrisma.ungDung.findMany
      .mockResolvedValueOnce([]) // (a) không có app ẩn nào
      .mockResolvedValueOnce(trangDau)
      .mockResolvedValueOnce([hienNham('h-200'), hienNham('h-201')]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongCanhBao).toBe(202);
    expect(mockPrisma.ungDung.update).not.toHaveBeenCalled();
  });

  it('(c) P3B-25.15: chỉ bóc tách lại dấu "không có hướng dẫn" của phiên bản bộ bóc tách cũ', async () => {
    mockPrisma.phanTichAI.findMany.mockResolvedValueOnce([
      {
        maUngDung: 'cu',
        huongDanCaiDat: { khongCoHuongDan: true, phienBanBocTach: 1, cachCai: [] },
      },
      {
        maUngDung: 'moi',
        huongDanCaiDat: {
          khongCoHuongDan: true,
          phienBanBocTach: PHIEN_BAN_BOC_TACH_CLI,
          cachCai: [],
        },
      },
    ]);
    mockPrisma.ungDung.findMany.mockResolvedValue([]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongBocTachLai).toBe(1);
    expect(mockAppsService.phanTichUngDung).toHaveBeenCalledTimes(1);
    expect(mockAppsService.phanTichUngDung).toHaveBeenCalledWith('cu');
  });

  it('(d) P3B-09.3: mỗi đêm sinh lại vector cho tối đa 100 app có văn bản đổi', async () => {
    mockPrisma.ungDung.findMany.mockResolvedValue([]);
    await job.kiemTraVaSuaNhatQuanHienThi();
    expect(mockSemantic.sinhLaiVectorLoiThoi).toHaveBeenCalledWith(100);
  });

  it('(e) dịch mô tả còn thiếu hoặc lệch, và (f) tính lại điểm khi repo bị lưu trữ sau lần phân tích', async () => {
    mockPrisma.ungDung.findMany.mockResolvedValue([]);
    mockPrisma.phanTichAI.findMany
      .mockResolvedValueOnce([]) // (c)
      .mockResolvedValueOnce([
        {
          maPhanTich: 'pt-1',
          maUngDung: 'app-1',
          diemUyTin: 100,
          yeuToRuiRo: [],
          ungDung: { daLuuTru: true, pushedAt: null },
        },
        {
          maPhanTich: 'pt-2',
          maUngDung: 'app-2',
          diemUyTin: 100,
          yeuToRuiRo: [],
          ungDung: { daLuuTru: false, pushedAt: null },
        },
      ]);

    await job.kiemTraVaSuaNhatQuanHienThi();

    expect(mockMoTa.dichMoTaCacApp).toHaveBeenCalledWith(false);
    expect(mockPrisma.phanTichAI.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.phanTichAI.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { maPhanTich: 'pt-1' },
        data: expect.objectContaining({ diemUyTin: 60 }),
      }),
    );
  });

  it('(c) bóc lại cả hướng dẫn còn lệnh npm cài thư viện (không -g), bỏ qua hướng dẫn dùng -g', async () => {
    mockPrisma.ungDung.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        maUngDung: 'lib',
        huongDanCaiDat: { cachCai: [{ buoc: [{ lenh: 'npm install ioredis' }] }] },
      },
      {
        maUngDung: 'cli',
        huongDanCaiDat: { cachCai: [{ buoc: [{ lenh: 'npm install -g serve' }] }] },
      },
    ]);

    const result = await job.kiemTraVaSuaNhatQuanHienThi();

    expect(result.soLuongBocTachLai).toBe(1);
    expect(mockAppsService.phanTichUngDung).toHaveBeenCalledWith('lib');
    expect(mockAppsService.phanTichUngDung).not.toHaveBeenCalledWith('cli');
  });
});

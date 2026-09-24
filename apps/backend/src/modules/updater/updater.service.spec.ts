import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdaterService } from './updater.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UpdaterService (P2-52)', () => {
  let service: UpdaterService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      thietBi: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ungDung: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      ungDungDaCai: {
        findMany: vi.fn(),
      },
      tepCaiDat: {
        findUnique: vi.fn(),
      },
    };

    service = new UpdaterService(mockPrisma as unknown as PrismaService);
  });

  const maThietBi = 'dev-uuid-1';
  const maUngDung = 'app-uuid-rustdesk';

  it('ném NotFoundException nếu thiết bị không tồn tại trong CSDL', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue(null);

    await expect(service.kiemTraCapNhat({ maThietBi: 'dev-khong-ton-tai' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('phát hiện bản cập nhật mới khi client gửi danh sách ứng dụng', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue({
      maThietBi,
      tenThietBi: 'Laptop Dell',
    });
    mockPrisma.thietBi.update.mockResolvedValue({});

    // App trong Store có bản phát hành 1.2.3
    mockPrisma.ungDung.findUnique.mockResolvedValue({
      maUngDung,
      tenRepoDayDu: 'rustdesk/rustdesk',
      danhSachPhatHanh: [
        {
          maPhatHanh: 'rel-2',
          maUngDung,
          tenPhienBan: 'v1.2.3',
          tieuDePhatHanh: 'Bản vá bảo mật',
          tomTatNangCapVi: 'Sửa lỗi kết nối',
          laBanThuNghiem: false,
          ngayPhatHanh: new Date('2026-09-20'),
          danhSachTepCaiDat: [
            {
              maTep: 'tep-2',
              maPhatHanh: 'rel-2',
              tenTep: 'rustdesk-1.2.3-x86_64.msi',
              duongDanTaiVe:
                'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk.msi',
              dungLuongBytes: BigInt(25000000),
              dinhDangTep: 'MSI',
              kienTrucChip: 'X86_64',
              maBamSha256: 'sha256-hash',
              soLuotTai: 100,
              ngayTao: new Date(),
            },
          ],
        },
      ],
    });

    const result = await service.kiemTraCapNhat({
      maThietBi,
      ungDung: [
        {
          maUngDung,
          phienBan: '1.2.0', // Bản cũ hơn 1.2.3
        },
      ],
    });

    expect(result.danhSachCapNhat).toHaveLength(1);
    expect(result.danhSachCapNhat[0].maUngDung).toBe(maUngDung);
    expect(result.danhSachCapNhat[0].phienBanHienTai).toBe('1.2.0');
    expect(result.danhSachCapNhat[0].phienBanMoiNhat).toBe('v1.2.3');
    expect(result.danhSachCapNhat[0].coBanCapNhat).toBe(true);
    expect(result.danhSachCapNhat[0].banPhatHanhMoiNhat?.tenPhienBan).toBe('v1.2.3');
    expect(mockPrisma.thietBi.update).toHaveBeenCalled();
  });

  it('không báo cập nhật nếu phiên bản hiện tại đã là mới nhất hoặc mới hơn', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue({ maThietBi });
    mockPrisma.thietBi.update.mockResolvedValue({});

    mockPrisma.ungDung.findUnique.mockResolvedValue({
      maUngDung,
      danhSachPhatHanh: [
        {
          maPhatHanh: 'rel-2',
          tenPhienBan: '1.2.3',
          laBanThuNghiem: false,
          ngayPhatHanh: new Date(),
          danhSachTepCaiDat: [],
        },
      ],
    });

    const result = await service.kiemTraCapNhat({
      maThietBi,
      ungDung: [
        {
          maUngDung,
          phienBan: '1.2.3', // Trùng bản mới nhất
        },
      ],
    });

    expect(result.danhSachCapNhat).toHaveLength(0);
  });

  it('tự động lấy danh sách ứng dụng đã cài từ CSDL khi client không truyền mảng ungDung', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue({ maThietBi });
    mockPrisma.thietBi.update.mockResolvedValue({});

    // DB ung_dung_da_cai có 1 app đang ở bản 1.0.0
    mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
      {
        maUngDung,
        phienBanHienTai: '1.0.0',
        maTepDaCai: null,
        ungDung: { tenGoiAndroid: null },
      },
    ]);

    mockPrisma.ungDung.findUnique.mockResolvedValue({
      maUngDung,
      danhSachPhatHanh: [
        {
          maPhatHanh: 'rel-3',
          tenPhienBan: '2.0.0',
          laBanThuNghiem: false,
          ngayPhatHanh: new Date(),
          danhSachTepCaiDat: [],
        },
      ],
    });

    const result = await service.kiemTraCapNhat({ maThietBi });

    expect(result.danhSachCapNhat).toHaveLength(1);
    expect(result.danhSachCapNhat[0].phienBanHienTai).toBe('1.0.0');
    expect(result.danhSachCapNhat[0].phienBanMoiNhat).toBe('2.0.0');
  });

  it('ưu tiên so sánh ngày phát hành theo maTepDaCai cho Android per D-13', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue({ maThietBi });
    mockPrisma.thietBi.update.mockResolvedValue({});

    // Release trong Store có ngày phát hành 2026-09-20
    mockPrisma.ungDung.findUnique.mockResolvedValue({
      maUngDung,
      danhSachPhatHanh: [
        {
          maPhatHanh: 'rel-moi',
          tenPhienBan: '1.2.3-fdroid',
          laBanThuNghiem: false,
          ngayPhatHanh: new Date('2026-09-20'),
          danhSachTepCaiDat: [],
        },
      ],
    });

    // File đã cài thuộc release cũ ngày 2026-08-15
    mockPrisma.tepCaiDat.findUnique.mockResolvedValue({
      maTep: 'tep-cu',
      maPhatHanh: 'rel-cu',
      banPhatHanh: {
        maPhatHanh: 'rel-cu',
        ngayPhatHanh: new Date('2026-08-15'),
      },
    });

    mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
      {
        maUngDung,
        phienBanHienTai: '1.2.3-custom', // Tên phiên bản Android dị thường
        maTepDaCai: 'tep-cu',
        ungDung: { tenGoiAndroid: 'com.app.test' },
      },
    ]);

    const result = await service.kiemTraCapNhat({ maThietBi });

    expect(result.danhSachCapNhat).toHaveLength(1);
    expect(result.danhSachCapNhat[0].coBanCapNhat).toBe(true);
  });

  it('ném ForbiddenException nếu thiết bị không thuộc về người dùng đang đăng nhập', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue({
      maThietBi,
      maNguoiDung: 'user-chinh-chu',
    });

    await expect(service.kiemTraCapNhat({ maThietBi }, 'user-xa-la')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('không báo có bản mới khi maTepDaCai đã thuộc release mới nhất (chống lỗi lặp update với suffix -fdroid)', async () => {
    mockPrisma.thietBi.findUnique.mockResolvedValue({
      maThietBi,
      maNguoiDung: 'user-chinh-chu',
    });
    mockPrisma.thietBi.update.mockResolvedValue({});

    // Release mới nhất trong store là rel-moi
    mockPrisma.ungDung.findUnique.mockResolvedValue({
      maUngDung,
      danhSachPhatHanh: [
        {
          maPhatHanh: 'rel-moi',
          tenPhienBan: '1.2.3',
          laBanThuNghiem: false,
          ngayPhatHanh: new Date('2026-09-20'),
          danhSachTepCaiDat: [],
        },
      ],
    });

    // File đã cài trên máy thuộc CHÍNH rel-moi
    mockPrisma.tepCaiDat.findUnique.mockResolvedValue({
      maTep: 'tep-moi',
      maPhatHanh: 'rel-moi',
      banPhatHanh: {
        maPhatHanh: 'rel-moi',
        ngayPhatHanh: new Date('2026-09-20'),
      },
    });

    mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
      {
        maUngDung,
        phienBanHienTai: '1.2.3-fdroid', // chuỗi versionName khác nhưng release là một
        maTepDaCai: 'tep-moi',
        ungDung: { tenGoiAndroid: 'com.app.test' },
      },
    ]);

    const result = await service.kiemTraCapNhat({ maThietBi }, 'user-chinh-chu');

    // Không được báo có bản cập nhật!
    expect(result.danhSachCapNhat).toHaveLength(0);
  });
});

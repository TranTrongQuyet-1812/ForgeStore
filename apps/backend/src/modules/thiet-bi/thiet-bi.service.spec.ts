import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ThietBiService } from './thiet-bi.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoaiThietBi } from '@prisma/client';

describe('ThietBiService', () => {
  let service: ThietBiService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCacheService: any;

  beforeEach(() => {
    mockCacheService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      thietBi: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ungDungDaCai: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      ungDung: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tepCaiDat: {
        findFirst: vi.fn().mockResolvedValue({ maTep: 'tep-uuid-1' }),
        update: vi.fn(),
      },
    };

    service = new ThietBiService(mockPrisma as unknown as PrismaService, mockCacheService);
  });

  describe('dangKyThietBi', () => {
    it('đăng ký hoặc cập nhật thiết bị thành công theo composite unique (maNguoiDung, dinhDanhPhanCung)', async () => {
      const mockResult = {
        maThietBi: 'device-uuid-1',
        maNguoiDung: 'user-uuid-1',
        dinhDanhPhanCung: 'sha256-hardware-hash',
        tenThietBi: 'Laptop Dell',
        loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
      };

      mockPrisma.thietBi.upsert.mockResolvedValue(mockResult);

      const result = await service.dangKyThietBi('user-uuid-1', {
        dinhDanhPhanCung: 'sha256-hardware-hash',
        tenThietBi: 'Laptop Dell',
        loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
      });

      expect(result).toEqual(mockResult);
      expect(mockPrisma.thietBi.upsert).toHaveBeenCalledWith({
        where: {
          maNguoiDung_dinhDanhPhanCung: {
            maNguoiDung: 'user-uuid-1',
            dinhDanhPhanCung: 'sha256-hardware-hash',
          },
        },
        create: {
          maNguoiDung: 'user-uuid-1',
          dinhDanhPhanCung: 'sha256-hardware-hash',
          tenThietBi: 'Laptop Dell',
          loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
        },
        update: {
          tenThietBi: 'Laptop Dell',
          loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
          hoatDongLanCuoi: expect.any(Date),
        },
      });
    });
  });

  describe('layDanhSachThietBi', () => {
    it('lấy danh sách thiết bị của đúng người dùng hiện tại', async () => {
      const mockList = [
        { maThietBi: 'dev-1', tenThietBi: 'Dell XPS' },
        { maThietBi: 'dev-2', tenThietBi: 'Pixel 7' },
      ];
      mockPrisma.thietBi.findMany.mockResolvedValue(mockList);

      const list = await service.layDanhSachThietBi('user-uuid-1');

      expect(list).toEqual(mockList);
      expect(mockPrisma.thietBi.findMany).toHaveBeenCalledWith({
        where: { maNguoiDung: 'user-uuid-1' },
        orderBy: { hoatDongLanCuoi: 'desc' },
      });
    });
  });

  describe('doiTenThietBi', () => {
    it('đổi tên thành công khi thiết bị thuộc sở hữu của người dùng', async () => {
      mockPrisma.thietBi.findUnique.mockResolvedValue({
        maThietBi: 'dev-1',
        maNguoiDung: 'user-uuid-1',
        tenThietBi: 'Tên cũ',
      });
      mockPrisma.thietBi.update.mockResolvedValue({
        maThietBi: 'dev-1',
        maNguoiDung: 'user-uuid-1',
        tenThietBi: 'Tên mới',
      });

      const updated = await service.doiTenThietBi('user-uuid-1', 'dev-1', 'Tên mới');

      expect(updated.tenThietBi).toBe('Tên mới');
      expect(mockPrisma.thietBi.update).toHaveBeenCalledWith({
        where: { maThietBi: 'dev-1' },
        data: {
          tenThietBi: 'Tên mới',
          hoatDongLanCuoi: expect.any(Date),
        },
      });
    });

    it('ném lỗi NotFoundException khi không tìm thấy thiết bị', async () => {
      mockPrisma.thietBi.findUnique.mockResolvedValue(null);

      await expect(
        service.doiTenThietBi('user-uuid-1', 'dev-nonexistent', 'Tên mới'),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném lỗi ForbiddenException khi người dùng cố đổi tên thiết bị của người khác', async () => {
      mockPrisma.thietBi.findUnique.mockResolvedValue({
        maThietBi: 'dev-1',
        maNguoiDung: 'user-khac',
        tenThietBi: 'Máy của người khác',
      });

      await expect(service.doiTenThietBi('user-uuid-1', 'dev-1', 'Hack tên máy')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('capNhatHoatDong', () => {
    it('cập nhật thời gian hoatDongLanCuoi', async () => {
      mockPrisma.thietBi.update.mockResolvedValue({});

      await service.capNhatHoatDong('dev-1');

      expect(mockPrisma.thietBi.update).toHaveBeenCalledWith({
        where: { maThietBi: 'dev-1' },
        data: { hoatDongLanCuoi: expect.any(Date) },
      });
    });
  });

  describe('P2-51: Quản lý ứng dụng đã cài trên thiết bị', () => {
    const maNguoiDung = 'user-uuid-1';
    const maThietBi = 'device-uuid-1';
    const maUngDung = 'app-uuid-rustdesk';

    beforeEach(() => {
      mockPrisma.thietBi.findUnique.mockResolvedValue({
        maThietBi,
        maNguoiDung,
        tenThietBi: 'Laptop Dell',
        loaiThietBi: LoaiThietBi.MAY_TINH_WINDOWS,
      });
    });

    describe('layDanhSachAppDaCai (P2-51.1 & P2-51.4)', () => {
      it('ném lỗi ForbiddenException nếu thiết bị thuộc người dùng khác', async () => {
        mockPrisma.thietBi.findUnique.mockResolvedValue({
          maThietBi,
          maNguoiDung: 'user-khac',
        });

        await expect(service.layDanhSachAppDaCai(maNguoiDung, maThietBi)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('ném lỗi NotFoundException nếu thiết bị không tồn tại', async () => {
        mockPrisma.thietBi.findUnique.mockResolvedValue(null);

        await expect(service.layDanhSachAppDaCai(maNguoiDung, 'dev-khong-ton-tai')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('trả về danh sách app đã cài kèm cờ coBanMoi chính xác', async () => {
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
          {
            maBanGhi: 'record-1',
            maNguoiDung,
            maUngDung,
            maThietBi,
            phienBanHienTai: '1.2.0',
            maTepDaCai: 'tep-1',
            duongDanThuMuc: null,
            khoaRegistry: 'Notepad++',
            tenHienThiRegistry: 'Notepad++ (64-bit x64)',
            ngayCaiDat: new Date('2026-09-01'),
            ngayCapNhatCuoi: new Date('2026-09-01'),
            ungDung: {
              maUngDung,
              tenKhoChua: 'rustdesk',
              tenRepoDayDu: 'rustdesk/rustdesk',
              anhDaiDien: 'icon.png',
              soSaoGithub: 80000,
              danhMucChinh: 'CONG_CU',
              nenTangHoTro: 'TAT_CA',
              daXacMinh: true,
              phanTichAI: {
                khauHieuTiengViet: 'Remote desktop',
                diemUyTin: 95,
                mucDoAnToan: 'AN_TOAN',
              },
              danhSachPhatHanh: [{ tenPhienBan: 'v1.2.3', ngayPhatHanh: new Date() }],
            },
          },
        ]);

        const result = await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(result).toHaveLength(1);
        expect(result[0].maUngDung).toBe(maUngDung);
        expect(result[0].phienBanHienTai).toBe('1.2.0');
        expect(result[0].khoaRegistry).toBe('Notepad++');
        expect(result[0].tenHienThiRegistry).toBe('Notepad++ (64-bit x64)');
        expect(result[0].coBanMoi).toBe(true);
        expect(result[0].phienBanMoiNhat).toBe('v1.2.3');
      });

      it('R-02: BleachBit v4.6.0 không bị báo có bản mới khi repo có pre-release v0.1.0', async () => {
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
          {
            maBanGhi: 'rec-bleachbit',
            maNguoiDung,
            maUngDung: 'bleachbit',
            maThietBi,
            phienBanHienTai: 'v4.6.0',
            maTepDaCai: 'tep-bb',
            duongDanThuMuc: null,
            khoaRegistry: 'BleachBit',
            tenHienThiRegistry: 'BleachBit',
            ngayCaiDat: new Date('2026-09-01'),
            ngayCapNhatCuoi: new Date('2026-09-01'),
            ungDung: {
              maUngDung: 'bleachbit',
              tenKhoChua: 'bleachbit',
              tenRepoDayDu: 'bleachbit/bleachbit',
              duongDanIcon: null,
              soSaoGithub: 5000,
              danhMucChinh: 'HE_THONG',
              nenTangHoTro: 'TAT_CA',
              daXacMinh: true,
              phanTichAI: null,
              danhSachPhatHanh: [
                {
                  maPhatHanh: 'rel-old',
                  tenPhienBan: 'v0.1.0',
                  ngayPhatHanh: new Date('2026-09-20'),
                  laBanMoiNhat: true,
                  laBanThuNghiem: false,
                  danhSachTepCaiDat: [
                    { maTep: 't1', tenTep: 'BleachBit-0.1.0-setup.exe', dinhDangTep: 'EXE' },
                  ],
                },
              ],
            },
          },
        ]);

        const result = await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(result).toHaveLength(1);
        expect(result[0].phienBanHienTai).toBe('v4.6.0');
        expect(result[0].phienBanMoiNhat).toBe('v0.1.0');
        // Không khuyên hạ cấp xuống v0.1.0
        expect(result[0].coBanMoi).toBe(false);
      });

      it('R-02: Obsidian Windows không lấy bản phát hành chỉ có file Android và không báo bản mới', async () => {
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
          {
            maBanGhi: 'rec-obsidian',
            maNguoiDung,
            maUngDung: 'obsidian',
            maThietBi,
            phienBanHienTai: '1.13.0',
            maTepDaCai: 'tep-obsidian',
            duongDanThuMuc: null,
            khoaRegistry: 'Obsidian',
            tenHienThiRegistry: 'Obsidian',
            ngayCaiDat: new Date('2026-09-01'),
            ngayCapNhatCuoi: new Date('2026-09-01'),
            ungDung: {
              maUngDung: 'obsidian',
              tenKhoChua: 'obsidian-releases',
              tenRepoDayDu: 'obsidianmd/obsidian-releases',
              duongDanIcon: null,
              soSaoGithub: 90000,
              danhMucChinh: 'VAN_PHONG',
              nenTangHoTro: 'TAT_CA',
              daXacMinh: true,
              phanTichAI: null,
              danhSachPhatHanh: [
                // Bản mới nhất về thời gian nhưng chỉ có file Android APK
                {
                  maPhatHanh: 'rel-apk-only',
                  tenPhienBan: 'v1.13.8',
                  ngayPhatHanh: new Date('2026-09-25'),
                  laBanMoiNhat: true,
                  laBanThuNghiem: false,
                  danhSachTepCaiDat: [
                    { maTep: 't-apk', tenTep: 'Obsidian.apk', dinhDangTep: 'APK' },
                  ],
                },
                // Bản Windows hợp lệ
                {
                  maPhatHanh: 'rel-win',
                  tenPhienBan: 'v1.13.0',
                  ngayPhatHanh: new Date('2026-09-20'),
                  laBanMoiNhat: false,
                  laBanThuNghiem: false,
                  danhSachTepCaiDat: [
                    { maTep: 't-exe', tenTep: 'Obsidian-1.13.0.exe', dinhDangTep: 'EXE' },
                  ],
                },
              ],
            },
          },
        ]);

        const result = await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(result).toHaveLength(1);
        expect(result[0].phienBanHienTai).toBe('1.13.0');
        // Phải chọn bản Windows v1.13.0 thay vì bản Android v1.13.8
        expect(result[0].phienBanMoiNhat).toBe('v1.13.0');
        expect(result[0].coBanMoi).toBe(false);
      });

      it('R-02: diemUyTin giữ nguyên null khi phanTichAI không có hoặc null, không gán sẵn 100', async () => {
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([
          {
            maBanGhi: 'rec-test',
            maNguoiDung,
            maUngDung: 'app-chua-danh-gia',
            maThietBi,
            phienBanHienTai: '1.0.0',
            maTepDaCai: null,
            duongDanThuMuc: null,
            khoaRegistry: null,
            tenHienThiRegistry: null,
            ngayCaiDat: new Date('2026-09-01'),
            ngayCapNhatCuoi: new Date('2026-09-01'),
            ungDung: {
              maUngDung: 'app-chua-danh-gia',
              tenKhoChua: 'test-repo',
              tenRepoDayDu: 'org/test-repo',
              duongDanIcon: null,
              soSaoGithub: 10,
              danhMucChinh: 'KHAC',
              nenTangHoTro: 'MAY_TINH_WINDOWS',
              daXacMinh: false,
              phanTichAI: null,
              danhSachPhatHanh: [],
            },
          },
        ]);

        const result = await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(result[0].ungDung.diemUyTin).toBeNull();
      });

      it('R-02: Cache Redis - trả về dữ liệu cache khi có cache hit và không gọi Prisma', async () => {
        const cachedData = [{ maBanGhi: 'rec-from-cache', maUngDung: 'cached-app' }];
        mockCacheService.get.mockResolvedValue(cachedData);

        const result = await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(result).toEqual(cachedData);
        expect(mockCacheService.get).toHaveBeenCalledWith(`device:installed:${maThietBi}`);
        expect(mockPrisma.ungDungDaCai.findMany).not.toHaveBeenCalled();
      });

      it('R-02: Cache Redis - lưu dữ liệu vào cache với TTL 120s khi cache miss', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([]);

        await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(mockCacheService.set).toHaveBeenCalledWith(
          `device:installed:${maThietBi}`,
          expect.any(Array),
          120,
        );
      });

      it('R-02: Cache Invalidation - xóa cache khi ghi nhận cài đặt, gỡ cài đặt, và cập nhật khóa registry', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung: 'app-test',
          tenRepoDayDu: 'org/test',
        });
        mockPrisma.ungDungDaCai.upsert.mockResolvedValue({});
        mockPrisma.ungDungDaCai.findUnique.mockResolvedValue({ maBanGhi: 'rec-1' });
        mockPrisma.ungDungDaCai.update.mockResolvedValue({});
        mockPrisma.ungDungDaCai.deleteMany.mockResolvedValue({ count: 1 });

        // Ghi nhận cài đặt
        await service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
          maUngDung: 'app-test',
          phienBanHienTai: '1.0.0',
        });
        expect(mockCacheService.del).toHaveBeenCalledWith(`device:installed:${maThietBi}`);

        mockCacheService.del.mockClear();

        // Gỡ cài đặt
        await service.goCaiDat(maNguoiDung, maThietBi, 'app-test');
        expect(mockCacheService.del).toHaveBeenCalledWith(`device:installed:${maThietBi}`);

        mockCacheService.del.mockClear();

        // Cập nhật registry
        await service.capNhatKhoaRegistry(maNguoiDung, maThietBi, 'app-test', {
          khoaRegistry: 'AppTest',
        });
        expect(mockCacheService.del).toHaveBeenCalledWith(`device:installed:${maThietBi}`);
      });

      it('P3B-16.5 & Review: layDanhSachAppDaCai là pure read (CQRS), không gọi deleteMany và lọc ẩn bản ghi hết hạn qua query OR', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([]);

        await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(mockPrisma.ungDungDaCai.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.ungDungDaCai.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              maThietBi,
              OR: [{ thoiGianHetHan: null }, { thoiGianHetHan: { gt: expect.any(Date) } }],
            }),
          }),
        );
      });

      it('P3B-16.7: Trả về lenhCapNhatCli an toàn khi ứng dụng CLI có bản mới', async () => {
        mockCacheService.get.mockResolvedValue(null);
        const mockItem = {
          maBanGhi: 'rec-cli-1',
          maNguoiDung,
          maUngDung,
          maThietBi,
          phienBanHienTai: '1.0.0',
          trinhQuanLyGoi: 'winget',
          tenGoiCli: 'Fastfetch-cli.Fastfetch',
          lenhGoCli: 'winget uninstall --id Fastfetch-cli.Fastfetch',
          trangThaiXacNhan: 'DA_XAC_NHAN',
          thoiGianHetHan: null,
          ngayCaiDat: new Date(),
          ngayCapNhatCuoi: new Date(),
          ungDung: {
            maUngDung,
            tenKhoChua: 'fastfetch',
            tenRepoDayDu: 'fastfetch-cli/fastfetch',
            danhMucChinh: 'TienIch',
            nenTangHoTro: ['windows'],
            danhSachPhatHanh: [
              {
                maPhatHanh: 'rel-2',
                tenPhienBan: '2.0.0',
                ngayPhatHanh: new Date(),
                laBanThuNghiem: false,
                danhSachTepCaiDat: [
                  { maTep: 'file-1', tenTep: 'fastfetch-win.exe', dinhDangTep: 'EXE' },
                ],
              },
            ],
          },
        };
        mockPrisma.ungDungDaCai.findMany.mockResolvedValue([mockItem]);

        const res = await service.layDanhSachAppDaCai(maNguoiDung, maThietBi);

        expect(res[0].coBanMoi).toBe(true);
        expect(res[0].phienBanMoiNhat).toBe('2.0.0');
        expect(res[0].lenhCapNhatCli).toBe('winget upgrade --id Fastfetch-cli.Fastfetch');
      });
    });

    describe('ghiNhanCaiDat (P2-51.2)', () => {
      it('ném NotFoundException nếu mã ứng dụng không tồn tại trong Store', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue(null);

        await expect(
          service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
            maUngDung: 'app-la',
            phienBanHienTai: '1.0.0',
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('ghi nhận cài đặt thành công qua upsert kèm khoaRegistry và tăng soLuotTai cho tệp cài đặt', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung,
          tenRepoDayDu: 'rustdesk/rustdesk',
        });
        mockPrisma.ungDungDaCai.upsert.mockResolvedValue({
          maBanGhi: 'rec-new',
          maThietBi,
          maUngDung,
          phienBanHienTai: '1.2.3',
          maTepDaCai: 'tep-1',
          khoaRegistry: 'Notepad++',
          tenHienThiRegistry: 'Notepad++ (64-bit x64)',
        });
        mockPrisma.tepCaiDat.update.mockResolvedValue({});

        const res = await service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
          maUngDung,
          phienBanHienTai: '1.2.3',
          maTepDaCai: 'tep-1',
          khoaRegistry: 'Notepad++',
          tenHienThiRegistry: 'Notepad++ (64-bit x64)',
        });

        expect(res.phienBanHienTai).toBe('1.2.3');
        expect(mockPrisma.ungDungDaCai.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              khoaRegistry: 'Notepad++',
              tenHienThiRegistry: 'Notepad++ (64-bit x64)',
            }),
            update: expect.objectContaining({
              khoaRegistry: 'Notepad++',
              tenHienThiRegistry: 'Notepad++ (64-bit x64)',
            }),
          }),
        );
        expect(mockPrisma.tepCaiDat.update).toHaveBeenCalledWith({
          where: { maTep: 'tep-1' },
          data: { soLuotTai: { increment: 1 } },
        });
      });

      it('tạo mới bản ghi cài đặt lưu đúng khoaRegistry và tenHienThiRegistry (DELIV-39.2)', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung,
          tenRepoDayDu: 'notepad-plus-plus/notepad-plus-plus',
        });
        mockPrisma.ungDungDaCai.upsert.mockResolvedValue({
          maBanGhi: 'rec-new-npp',
          maThietBi,
          maUngDung,
          phienBanHienTai: '8.6.0',
          khoaRegistry: 'Notepad++',
          tenHienThiRegistry: 'Notepad++ (64-bit x64)',
        });

        await service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
          maUngDung,
          phienBanHienTai: '8.6.0',
          khoaRegistry: 'Notepad++',
          tenHienThiRegistry: 'Notepad++ (64-bit x64)',
        });

        expect(mockPrisma.ungDungDaCai.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              maThietBi,
              maUngDung,
              phienBanHienTai: '8.6.0',
              khoaRegistry: 'Notepad++',
              tenHienThiRegistry: 'Notepad++ (64-bit x64)',
            }),
          }),
        );
      });

      it('cập nhật bản ghi cài đặt bảo toàn khoaRegistry cũ khi client không gửi trường này (undefined) và cập nhật khi client gửi lên (DELIV-39.2)', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung,
          tenRepoDayDu: 'notepad-plus-plus/notepad-plus-plus',
        });

        // 1. Khi client không gửi khoaRegistry (ví dụ client Android gửi cập nhật) -> update giữ undefined để Prisma không ghi đè null
        mockPrisma.ungDungDaCai.upsert.mockResolvedValueOnce({
          maBanGhi: 'rec-npp',
          maThietBi,
          maUngDung,
          phienBanHienTai: '8.6.1',
          khoaRegistry: 'Notepad++',
        });

        await service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
          maUngDung,
          phienBanHienTai: '8.6.1',
        });

        expect(mockPrisma.ungDungDaCai.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              phienBanHienTai: '8.6.1',
              maTepDaCai: undefined,
              duongDanThuMuc: undefined,
              khoaRegistry: undefined,
              tenHienThiRegistry: undefined,
            }),
          }),
        );

        // 2. Khi client gửi khoaRegistry mới -> update cập nhật đúng giá trị mới
        mockPrisma.ungDungDaCai.upsert.mockResolvedValueOnce({
          maBanGhi: 'rec-npp',
          maThietBi,
          maUngDung,
          phienBanHienTai: '8.6.2',
          khoaRegistry: 'Notepad++_v8.6',
          tenHienThiRegistry: 'Notepad++ (x64)',
        });

        await service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
          maUngDung,
          phienBanHienTai: '8.6.2',
          khoaRegistry: 'Notepad++_v8.6',
          tenHienThiRegistry: 'Notepad++ (x64)',
        });

        expect(mockPrisma.ungDungDaCai.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              phienBanHienTai: '8.6.2',
              khoaRegistry: 'Notepad++_v8.6',
              tenHienThiRegistry: 'Notepad++ (x64)',
            }),
          }),
        );
      });

      it('bảo toàn tuyệt đối maTepDaCai và duongDanThuMuc khi client không gửi (undefined) trong nhánh update (DELIV-40.1 & DELIV-40.3)', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung,
          tenRepoDayDu: 'notepad-plus-plus/notepad-plus-plus',
        });

        mockPrisma.ungDungDaCai.upsert.mockResolvedValue({
          maBanGhi: 'rec-npp-existing',
          maThietBi,
          maUngDung,
          phienBanHienTai: '8.6.0',
          maTepDaCai: 'file-uuid-x64',
          duongDanThuMuc: 'C:\\Program Files\\Notepad++',
        });

        // Client chỉ gửi maUngDung và phienBanHienTai (không gửi maTepDaCai)
        await service.ghiNhanCaiDat(maNguoiDung, maThietBi, {
          maUngDung,
          phienBanHienTai: '8.6.0',
        });

        // Prisma update PHẢI nhận maTepDaCai và duongDanThuMuc là undefined (không phải null)
        expect(mockPrisma.ungDungDaCai.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              maTepDaCai: undefined,
              duongDanThuMuc: undefined,
            }),
          }),
        );
      });
    });

    describe('capNhatKhoaRegistry (DELIV-40.1 & DELIV-40.3)', () => {
      it('ném NotFoundException nếu không tìm thấy bản ghi cài đặt của ứng dụng trên thiết bị', async () => {
        mockPrisma.ungDungDaCai.findUnique.mockResolvedValue(null);

        await expect(
          service.capNhatKhoaRegistry(maNguoiDung, maThietBi, maUngDung, {
            khoaRegistry: 'Notepad++',
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('cập nhật thành công khoaRegistry và tenHienThiRegistry bảo toàn nguyên vẹn bản ghi cài đặt', async () => {
        mockPrisma.ungDungDaCai.findUnique.mockResolvedValue({
          maBanGhi: 'rec-installed-1',
          maThietBi,
          maUngDung,
          maTepDaCai: 'bfd17254-x64-installer',
          duongDanThuMuc: null,
          phienBanHienTai: '8.9.8.1',
        });

        mockPrisma.ungDungDaCai.update.mockResolvedValue({
          maBanGhi: 'rec-installed-1',
          maThietBi,
          maUngDung,
          khoaRegistry: 'Notepad++',
          tenHienThiRegistry: 'Notepad++ (64-bit x64)',
          maTepDaCai: 'bfd17254-x64-installer',
        });

        const res = await service.capNhatKhoaRegistry(maNguoiDung, maThietBi, maUngDung, {
          khoaRegistry: 'Notepad++',
          tenHienThiRegistry: 'Notepad++ (64-bit x64)',
        });

        expect(res.khoaRegistry).toBe('Notepad++');
        expect(mockPrisma.ungDungDaCai.update).toHaveBeenCalledWith({
          where: {
            maThietBi_maUngDung: {
              maThietBi,
              maUngDung,
            },
          },
          data: {
            khoaRegistry: 'Notepad++',
            tenHienThiRegistry: 'Notepad++ (64-bit x64)',
          },
        });
      });
    });

    describe('goCaiDat (P2-51.3)', () => {
      it('gỡ cài đặt ứng dụng thành công khỏi thiết bị', async () => {
        mockPrisma.ungDungDaCai.deleteMany.mockResolvedValue({ count: 1 });

        const res = await service.goCaiDat(maNguoiDung, maThietBi, maUngDung);

        expect(res).toEqual({ daGo: true, soLuong: 1 });
        expect(mockPrisma.ungDungDaCai.deleteMany).toHaveBeenCalledWith({
          where: { maThietBi, maUngDung },
        });
      });
    });

    describe('ghiNhanCaiDatCli (P3B-16)', () => {
      it('từ chối khi tên gói chứa ký tự độc hại', async () => {
        await expect(
          service.ghiNhanCaiDatCli(maNguoiDung, maThietBi, {
            maUngDung,
            trinhQuanLy: 'winget',
            tenGoi: 'Fastfetch; rm -rf /',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('từ chối khi phiên bản chứa ký tự độc hại', async () => {
        await expect(
          service.ghiNhanCaiDatCli(maNguoiDung, maThietBi, {
            maUngDung,
            trinhQuanLy: 'winget',
            tenGoi: 'Fastfetch-cli.Fastfetch',
            phienBan: '1.0.0 && whoami',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('ném NotFoundException nếu không tìm thấy ứng dụng', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue(null);

        await expect(
          service.ghiNhanCaiDatCli(maNguoiDung, maThietBi, {
            maUngDung,
            trinhQuanLy: 'winget',
            tenGoi: 'Fastfetch-cli.Fastfetch',
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('ghi nhận thành công trạng thái CHO_XAC_NHAN với thời gian hết hạn sau 24 giờ', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung,
          tenRepoDayDu: 'fastfetch-cli/fastfetch',
        });

        const mockExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const mockCreated = {
          maBanGhi: 'rec-cli-1',
          maUngDung,
          maThietBi,
          phienBanHienTai: '2.30.0',
          trinhQuanLyGoi: 'winget',
          tenGoiCli: 'Fastfetch-cli.Fastfetch',
          lenhGoCli: 'winget uninstall --id Fastfetch-cli.Fastfetch',
          trangThaiXacNhan: 'CHO_XAC_NHAN',
          thoiGianHetHan: mockExpiry,
          ngayCaiDat: new Date(),
        };
        mockPrisma.ungDungDaCai.upsert.mockResolvedValue(mockCreated);

        const res = await service.ghiNhanCaiDatCli(maNguoiDung, maThietBi, {
          maUngDung,
          trinhQuanLy: 'winget',
          tenGoi: 'Fastfetch-cli.Fastfetch',
          phienBan: '2.30.0',
        });

        expect(res.trangThaiXacNhan).toBe('CHO_XAC_NHAN');
        expect(res.lenhGo).toBe('winget uninstall --id Fastfetch-cli.Fastfetch');
        expect(res.lenhCapNhat).toBe('winget upgrade --id Fastfetch-cli.Fastfetch');
        expect(mockPrisma.ungDungDaCai.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trangThaiXacNhan: 'CHO_XAC_NHAN',
              tenGoiCli: 'Fastfetch-cli.Fastfetch',
              trinhQuanLyGoi: 'winget',
              lenhGoCli: 'winget uninstall --id Fastfetch-cli.Fastfetch',
            }),
          }),
        );
      });

      it('từ chối ghi đè nếu ứng dụng đã có bản ghi cài đặt thật (EXE/MSI/Portable) (🟡 Điểm Vàng 2)', async () => {
        mockPrisma.ungDung.findUnique.mockResolvedValue({
          maUngDung,
          tenRepoDayDu: 'fastfetch-cli/fastfetch',
        });
        mockPrisma.ungDungDaCai.findUnique.mockResolvedValue({
          maBanGhi: 'rec-real-installer',
          maThietBi,
          maUngDung,
          khoaRegistry: 'Fastfetch',
          duongDanThuMuc: 'C:\\Program Files\\Fastfetch',
          trinhQuanLyGoi: null,
        });

        await expect(
          service.ghiNhanCaiDatCli(maNguoiDung, maThietBi, {
            maUngDung,
            trinhQuanLy: 'winget',
            tenGoi: 'Fastfetch-cli.Fastfetch',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('xacNhanCaiDatCli (P3B-16)', () => {
      it('ném NotFoundException nếu không tìm thấy bản ghi cài đặt', async () => {
        mockPrisma.ungDungDaCai.findUnique.mockResolvedValue(null);

        await expect(service.xacNhanCaiDatCli(maNguoiDung, maThietBi, maUngDung)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('chuyển trạng thái sang DA_XAC_NHAN và xóa thời gian hết hạn', async () => {
        mockPrisma.ungDungDaCai.findUnique.mockResolvedValue({
          maBanGhi: 'rec-cli-1',
          maThietBi,
          maUngDung,
          trangThaiXacNhan: 'CHO_XAC_NHAN',
        });
        mockPrisma.ungDungDaCai.update.mockResolvedValue({
          maBanGhi: 'rec-cli-1',
          maUngDung,
          trangThaiXacNhan: 'DA_XAC_NHAN',
          thoiGianHetHan: null,
        });

        const res = await service.xacNhanCaiDatCli(maNguoiDung, maThietBi, maUngDung);

        expect(res.thanhCong).toBe(true);
        expect(res.trangThaiXacNhan).toBe('DA_XAC_NHAN');
        expect(mockPrisma.ungDungDaCai.update).toHaveBeenCalledWith({
          where: {
            maThietBi_maUngDung: {
              maThietBi,
              maUngDung,
            },
          },
          data: {
            trangThaiXacNhan: 'DA_XAC_NHAN',
            thoiGianHetHan: null,
          },
        });
      });
    });

    describe('donDepBanGhiCliQuaHan (P3B-16.5 & Review)', () => {
      it('dọn dẹp các bản ghi CLI CHO_XAC_NHAN đã hết hạn qua deleteMany', async () => {
        mockPrisma.ungDungDaCai.deleteMany.mockResolvedValue({ count: 5 });

        const count = await service.donDepBanGhiCliQuaHan();

        expect(count).toBe(5);
        expect(mockPrisma.ungDungDaCai.deleteMany).toHaveBeenCalledWith({
          where: {
            trangThaiXacNhan: 'CHO_XAC_NHAN',
            thoiGianHetHan: { lt: expect.any(Date) },
          },
        });
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoaiThietBi } from '@prisma/client';

describe('DevicesService', () => {
  let service: DevicesService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  beforeEach(() => {
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
        deleteMany: vi.fn(),
      },
      ungDung: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tepCaiDat: {
        update: vi.fn(),
      },
    };

    service = new DevicesService(mockPrisma as unknown as PrismaService);
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
  });
});

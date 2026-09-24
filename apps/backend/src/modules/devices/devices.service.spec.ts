import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoaiThietBi } from '@prisma/client';

describe('DevicesService', () => {
  let service: DevicesService;
  let mockPrisma: {
    thietBi: {
      upsert: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      thietBi: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
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
});

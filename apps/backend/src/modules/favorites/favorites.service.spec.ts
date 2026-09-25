import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FavoritesService (P2-50)', () => {
  let service: FavoritesService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(() => {
    prisma = {
      khoYeuThich: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      ungDung: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    };

    service = new FavoritesService(prisma as unknown as PrismaService);
  });

  describe('chuyenDoiYeuThich (P2-50.2 & P2-50.3)', () => {
    const maNguoiDung = 'user-uuid-1';
    const maUngDung = 'app-uuid-rustdesk';

    it('ném NotFoundException nếu ứng dụng không tồn tại trong Store', async () => {
      prisma.ungDung.findUnique.mockResolvedValue(null);

      await expect(service.chuyenDoiYeuThich(maNguoiDung, 'app-khong-ton-tai')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('thêm vào yêu thích nếu chưa có bản ghi (toggle ON -> true)', async () => {
      prisma.ungDung.findUnique.mockResolvedValue({
        maUngDung,
        tenRepoDayDu: 'rustdesk/rustdesk',
      });
      // Chưa có trong DB
      prisma.khoYeuThich.findUnique.mockResolvedValue(null);
      prisma.khoYeuThich.create.mockResolvedValue({
        maYeuThich: 'fav-1',
        maNguoiDung,
        maUngDung,
        thietBiThem: 'MAY_TINH',
      });

      const result = await service.chuyenDoiYeuThich(maNguoiDung, maUngDung, 'MAY_TINH');

      expect(result).toEqual({ daYeuThich: true });
      expect(prisma.khoYeuThich.create).toHaveBeenCalledWith({
        data: {
          maNguoiDung,
          maUngDung,
          thietBiThem: 'MAY_TINH',
        },
      });
    });

    it('xóa khỏi yêu thích nếu đã có bản ghi (toggle OFF -> false)', async () => {
      prisma.ungDung.findUnique.mockResolvedValue({
        maUngDung,
        tenRepoDayDu: 'rustdesk/rustdesk',
      });
      // Đã có trong DB
      prisma.khoYeuThich.findUnique.mockResolvedValue({
        maYeuThich: 'fav-1',
        maNguoiDung,
        maUngDung,
      });
      prisma.khoYeuThich.delete.mockResolvedValue({});

      const result = await service.chuyenDoiYeuThich(maNguoiDung, maUngDung);

      expect(result).toEqual({ daYeuThich: false });
      expect(prisma.khoYeuThich.delete).toHaveBeenCalledWith({
        where: {
          maNguoiDung_maUngDung: {
            maNguoiDung,
            maUngDung,
          },
        },
      });
    });

    it('tìm ứng dụng theo repo slug nếu không phải UUID và toggle thành công', async () => {
      prisma.ungDung.findUnique.mockResolvedValue(null);
      prisma.ungDung.findFirst.mockResolvedValue({
        maUngDung,
        tenRepoDayDu: 'microsoft/PowerToys',
      });
      prisma.khoYeuThich.findUnique.mockResolvedValue(null);
      prisma.khoYeuThich.create.mockResolvedValue({
        maYeuThich: 'fav-powertoys',
        maNguoiDung,
        maUngDung,
        thietBiThem: 'MAY_TINH',
      });

      const result = await service.chuyenDoiYeuThich(
        maNguoiDung,
        'microsoft/PowerToys',
        'MAY_TINH',
      );

      expect(result).toEqual({ daYeuThich: true });
      expect(prisma.ungDung.findFirst).toHaveBeenCalled();
    });

    it('bấm 2 lần liên tiếp không gây trùng lặp bản ghi nhờ ràng buộc UNIQUE', async () => {
      prisma.ungDung.findUnique.mockResolvedValue({
        maUngDung,
        tenRepoDayDu: 'rustdesk/rustdesk',
      });

      // Lần 1: Chưa có -> Tạo mới (true)
      prisma.khoYeuThich.findUnique.mockResolvedValueOnce(null);
      const res1 = await service.chuyenDoiYeuThich(maNguoiDung, maUngDung);
      expect(res1.daYeuThich).toBe(true);

      // Lần 2: Đã có -> Xóa (false)
      prisma.khoYeuThich.findUnique.mockResolvedValueOnce({
        maYeuThich: 'fav-1',
        maNguoiDung,
        maUngDung,
      });
      const res2 = await service.chuyenDoiYeuThich(maNguoiDung, maUngDung);
      expect(res2.daYeuThich).toBe(false);
    });
  });

  describe('layDanhSachYeuThich (P2-50.1)', () => {
    it('trả về danh sách ứng dụng yêu thích có phân trang, bản mới đứng trước và cờ daYeuThich=true', async () => {
      const mockUngDung = {
        maUngDung: 'app-uuid-1',
        tenKhoChua: 'rustdesk',
        chuSoHuu: 'rustdesk',
        duongDanGithub: 'https://github.com/rustdesk/rustdesk',
        tenRepoDayDu: 'rustdesk/rustdesk',
        duongDanIcon: 'https://example.com/icon.png',
        soSaoGithub: 80000,
        danhMucChinh: 'CONG_CU',
        nenTangHoTro: 'TAT_CA',
        ngayCapNhat: new Date('2026-09-20'),
        daXacMinh: true,
        duocNoiBat: true,
        phanTichAI: {
          khauHieuTiengViet: 'Điều khiển máy tính từ xa',
          diemUyTin: 95,
          mucDoAnToan: 'AN_TOAN',
        },
        danhSachPhatHanh: [
          {
            tenPhienBan: '1.2.3',
            ngayPhatHanh: new Date('2026-09-21'),
          },
        ],
      };

      prisma.khoYeuThich.findMany.mockResolvedValue([
        {
          maYeuThich: 'fav-1',
          maNguoiDung: 'user-1',
          maUngDung: 'app-uuid-1',
          ngayThem: new Date('2026-09-22'),
          ungDung: mockUngDung,
        },
      ]);
      prisma.khoYeuThich.count.mockResolvedValue(1);

      const result = await service.layDanhSachYeuThich('user-1', 1, 20);

      expect(result.tongSo).toBe(1);
      expect(result.trangHienTai).toBe(1);
      expect(result.duLieu).toHaveLength(1);
      expect(result.duLieu[0].maUngDung).toBe('app-uuid-1');
      expect(result.duLieu[0].daYeuThich).toBe(true);
      expect(result.duLieu[0].phienBanMoiNhat).toBe('1.2.3');
    });
  });

  describe('kiemTraDaYeuThich & layTapHopUngDungDaYeuThich', () => {
    it('kiemTraDaYeuThich trả về true khi có bản ghi, false khi không', async () => {
      prisma.khoYeuThich.findUnique.mockResolvedValueOnce({ maYeuThich: 'fav-1' });
      expect(await service.kiemTraDaYeuThich('u1', 'app1')).toBe(true);

      prisma.khoYeuThich.findUnique.mockResolvedValueOnce(null);
      expect(await service.kiemTraDaYeuThich('u1', 'app2')).toBe(false);
    });

    it('layTapHopUngDungDaYeuThich trả về Set các mã ứng dụng đã thích', async () => {
      prisma.khoYeuThich.findMany.mockResolvedValue([{ maUngDung: 'app1' }, { maUngDung: 'app3' }]);

      const set = await service.layTapHopUngDungDaYeuThich('u1', ['app1', 'app2', 'app3']);
      expect(set.has('app1')).toBe(true);
      expect(set.has('app2')).toBe(false);
      expect(set.has('app3')).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DanhGiaService } from './danh-gia.service';
import { ReviewSortOption } from './dto/truy-van-danh-gia.dto';

describe('DanhGiaService (P2-53)', () => {
  let service: DanhGiaService;

  let prisma: any;

  let cacheService: any;

  const mockUngDung = {
    maUngDung: '11111111-1111-1111-1111-111111111111',
    tenRepoDayDu: 'rustdesk/rustdesk',
    chuSoHuu: 'rustdesk',
    tenKhoChua: 'rustdesk',
    moTaGocTiengAnh: 'Remote desktop software',
    duongDanGithub: 'https://github.com/rustdesk/rustdesk',
    ngayCapNhat: new Date('2026-09-01'),
    danhSachPhatHanh: [{ tenPhienBan: '1.2.3' }],
  };

  const mockReview = {
    maDanhGia: '22222222-2222-2222-2222-222222222222',
    maNguoiDung: 'user-1',
    maUngDung: mockUngDung.maUngDung,
    soSao: 5,
    tieuDe: 'Tuyệt vời',
    noiDungNhanXet: 'Dùng rất mượt, kết nối nhanh.',
    phienBanDanhGia: '1.2.3',
    thietBiDanhGia: 'Windows 11',
    soLuotHuuIch: 3,
    ngayDanhGia: new Date('2026-09-10'),
    ngayCapNhat: new Date('2026-09-10'),
    nguoiDung: {
      maNguoiDung: 'user-1',
      tenHienThi: 'Nguyễn Văn A',
      tenDangNhap: 'nguyenvana',
      duongDanAvatar: 'https://avatar.url',
    },
    ungDung: mockUngDung,
  };

  beforeEach(() => {
    prisma = {
      ungDung: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      danhGiaUngDung: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      banPhatHanh: {
        findUnique: vi.fn().mockResolvedValue({ maPhatHanh: 'ph-1' }),
      },
    };

    cacheService = {
      lay: vi.fn(),
      luu: vi.fn(),
      xoa: vi.fn(),
      xoaTheoPrefix: vi.fn(),
      setNx: vi.fn().mockResolvedValue(true),
      del: vi.fn(),
    };

    service = new DanhGiaService(prisma, cacheService);
  });

  describe('layDanhSachDanhGia', () => {
    it('ném lỗi NotFoundException nếu không tìm thấy ứng dụng', async () => {
      prisma.ungDung.findFirst.mockResolvedValue(null);

      await expect(
        service.layDanhSachDanhGia('non-existent', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('trả về danh sách nhận xét phân trang thành công', async () => {
      prisma.ungDung.findFirst.mockResolvedValue({ maUngDung: mockUngDung.maUngDung });
      prisma.danhGiaUngDung.findMany.mockResolvedValue([mockReview]);
      prisma.danhGiaUngDung.count.mockResolvedValue(1);

      const res = await service.layDanhSachDanhGia('rustdesk/rustdesk', {
        page: 1,
        limit: 10,
        sort: ReviewSortOption.HUU_ICH_NHAT,
      });

      expect(res.duLieu).toHaveLength(1);
      expect(res.duLieu[0]?.maDanhGia).toBe(mockReview.maDanhGia);
      expect(res.duLieu[0]?.tenNguoiDung).toBe('Nguyễn Văn A');
      expect(res.tongSo).toBe(1);
      expect(res.trangHienTai).toBe(1);
      expect(res.kichThuocTrang).toBe(10);
      expect(res.tongSoTrang).toBe(1);
    });
  });

  describe('taoDanhGia', () => {
    it('ném lỗi NotFoundException nếu app không tồn tại', async () => {
      prisma.ungDung.findFirst.mockResolvedValue(null);

      await expect(
        service.taoDanhGia('user-1', 'invalid-app', {
          soSao: 5,
          noiDungNhanXet: 'Rất tốt',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném lỗi ConflictException nếu người dùng đã đánh giá phiên bản này rồi', async () => {
      prisma.ungDung.findFirst.mockResolvedValue(mockUngDung);
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.taoDanhGia('user-1', mockUngDung.maUngDung, {
          soSao: 4,
          noiDungNhanXet: 'Đánh giá lần hai',
          phienBanDanhGia: '1.2.3',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('từ chối phiên bản không có thật (chặn lách khóa chống trùng bằng chuỗi tùy ý)', async () => {
      prisma.ungDung.findFirst.mockResolvedValue(mockUngDung);
      prisma.banPhatHanh.findUnique.mockResolvedValue(null);

      await expect(
        service.taoDanhGia('user-1', mockUngDung.maUngDung, {
          soSao: 1,
          noiDungNhanXet: 'Spam',
          phienBanDanhGia: 'bia-dat-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.danhGiaUngDung.create).not.toHaveBeenCalled();
    });

    it('tạo đánh giá mới thành công và xóa cache chi tiết app', async () => {
      prisma.ungDung.findFirst.mockResolvedValue(mockUngDung);
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(null);
      prisma.danhGiaUngDung.create.mockResolvedValue(mockReview);

      const res = await service.taoDanhGia('user-1', mockUngDung.maUngDung, {
        soSao: 5,
        tieuDe: 'Tuyệt vời',
        noiDungNhanXet: 'Dùng rất mượt, kết nối nhanh.',
        phienBanDanhGia: '1.2.3',
      });

      expect(res.maDanhGia).toBe(mockReview.maDanhGia);
      expect(res.soSao).toBe(5);
      expect(cacheService.xoaTheoPrefix).toHaveBeenCalledWith(
        `fs:apps:detail:${mockUngDung.maUngDung}`,
      );
    });
  });

  describe('suaDanhGia', () => {
    it('ném lỗi NotFoundException nếu không tìm thấy bài đánh giá', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(null);

      await expect(service.suaDanhGia('user-1', 'non-existent-id', { soSao: 4 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném lỗi ForbiddenException nếu không phải chủ sở hữu và không phải admin', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.suaDanhGia('other-user', mockReview.maDanhGia, { soSao: 4 }, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('chủ sở hữu sửa bài thành công', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);
      prisma.danhGiaUngDung.update.mockResolvedValue({
        ...mockReview,
        soSao: 4,
        tieuDe: 'Cập nhật tiêu đề',
      });

      const res = await service.suaDanhGia(
        'user-1',
        mockReview.maDanhGia,
        { soSao: 4, tieuDe: 'Cập nhật tiêu đề' },
        false,
      );

      expect(res.soSao).toBe(4);
      expect(res.tieuDe).toBe('Cập nhật tiêu đề');
    });

    it('admin sửa bài của người khác thành công', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);
      prisma.danhGiaUngDung.update.mockResolvedValue({
        ...mockReview,
        tieuDe: 'Admin đã kiểm duyệt',
      });

      const res = await service.suaDanhGia(
        'admin-user',
        mockReview.maDanhGia,
        { tieuDe: 'Admin đã kiểm duyệt' },
        true,
      );

      expect(res.tieuDe).toBe('Admin đã kiểm duyệt');
    });
  });

  describe('xoaDanhGia', () => {
    it('ném lỗi NotFoundException nếu bài không tồn tại', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(null);

      await expect(service.xoaDanhGia('user-1', 'non-existent-id', false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném lỗi ForbiddenException nếu không phải chủ sở hữu', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);

      await expect(service.xoaDanhGia('other-user', mockReview.maDanhGia, false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('chủ sở hữu xóa bài thành công', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);
      prisma.danhGiaUngDung.delete.mockResolvedValue(mockReview);

      const res = await service.xoaDanhGia('user-1', mockReview.maDanhGia, false);

      expect(res.daXoa).toBe(true);
      expect(prisma.danhGiaUngDung.delete).toHaveBeenCalledWith({
        where: { maDanhGia: mockReview.maDanhGia },
      });
    });

    it('admin xóa bài của người khác thành công', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(mockReview);
      prisma.danhGiaUngDung.delete.mockResolvedValue(mockReview);

      const res = await service.xoaDanhGia('admin-user', mockReview.maDanhGia, true);

      expect(res.daXoa).toBe(true);
    });
  });

  describe('binhChonHuuIch', () => {
    it('ném lỗi NotFoundException nếu không tìm thấy bài đánh giá', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue(null);

      await expect(service.binhChonHuuIch('user-1', 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném lỗi BadRequestException nếu đã bình chọn trước đó', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue({
        maDanhGia: mockReview.maDanhGia,
        soLuotHuuIch: 3,
        maNguoiDung: 'user-9',
      });
      cacheService.setNx.mockResolvedValue(false);

      await expect(service.binhChonHuuIch('user-1', mockReview.maDanhGia)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ghi CSDL lỗi thì nhả khóa bình chọn để bấm lại được', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue({
        maDanhGia: mockReview.maDanhGia,
        soLuotHuuIch: 3,
        maNguoiDung: 'user-9',
      });
      prisma.danhGiaUngDung.update.mockRejectedValue(new Error('db down'));

      await expect(service.binhChonHuuIch('user-1', mockReview.maDanhGia)).rejects.toThrow(
        'db down',
      );
      expect(cacheService.del).toHaveBeenCalledWith(
        `fs:review:helpful:${mockReview.maDanhGia}:user-1`,
      );
    });

    it('không cho tự bình chọn nhận xét của chính mình', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue({
        maDanhGia: mockReview.maDanhGia,
        soLuotHuuIch: 3,
        maNguoiDung: 'user-1',
      });

      await expect(service.binhChonHuuIch('user-1', mockReview.maDanhGia)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.danhGiaUngDung.update).not.toHaveBeenCalled();
    });

    it('bình chọn hữu ích thành công lần đầu và giữ khóa Redis TTL 30 ngày', async () => {
      prisma.danhGiaUngDung.findUnique.mockResolvedValue({
        maDanhGia: mockReview.maDanhGia,
        soLuotHuuIch: 3,
        maNguoiDung: 'user-9',
      });
      prisma.danhGiaUngDung.update.mockResolvedValue({ soLuotHuuIch: 4 });

      const res = await service.binhChonHuuIch('user-1', mockReview.maDanhGia);

      expect(res.daBinhChon).toBe(true);
      expect(res.soLuotHuuIch).toBe(4);
      expect(prisma.danhGiaUngDung.update).toHaveBeenCalledWith({
        where: { maDanhGia: mockReview.maDanhGia },
        data: { soLuotHuuIch: { increment: 1 } },
        select: { soLuotHuuIch: true },
      });
      expect(cacheService.setNx).toHaveBeenCalledWith(
        `fs:review:helpful:${mockReview.maDanhGia}:user-1`,
        30 * 24 * 60 * 60,
      );
    });
  });
});

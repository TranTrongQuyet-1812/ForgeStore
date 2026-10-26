import { describe, expect, it, vi, beforeEach } from 'vitest';
import { yeuThichService } from './yeu-thich.service';
import { apiClient } from '../api/api-client';

describe('YeuThichService (P3-12.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lấy danh sách ứng dụng yêu thích từ API backend', async () => {
    const mockResponse = {
      duLieu: [
        {
          maUngDung: 'obsidian-id',
          tenRepoDayDu: 'obsidianmd/obsidian-releases',
          tenKhoChua: 'Obsidian',
          chuSoHuu: 'obsidianmd',
          duongDanGithub: 'https://github.com/obsidianmd/obsidian-releases',
          soSaoGithub: 112000,
          danhMucChinh: 'Năng suất & Văn phòng',
          nenTangHoTro: 'WINDOWS',
          duocNoiBat: false,
          daXacMinh: true,
          diemUyTin: 98,
        },
      ],
      tongSo: 1,
      trangHienTai: 1,
      tongSoTrang: 1,
      kichThuocTrang: 20,
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse as never);

    const res = await yeuThichService.layDanhSachYeuThich(1, 20);

    expect(getSpy).toHaveBeenCalledWith('/user/favorites?page=1&limit=20');
    expect(res.duLieu).toHaveLength(1);
    expect(res.duLieu[0].tenKhoChua).toBe('Obsidian');
  });

  it('gửi request chuyển đổi yêu thích KHÔNG kèm header tự đặt (tránh bị preflight CORS chặn)', async () => {
    const mockToggleRes = {
      daYeuThich: true,
      tongSoYeuThich: 42,
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockToggleRes as never);

    const res = await yeuThichService.chuyenDoiYeuThich('app-uuid-1');

    // Header lạ như x-device-type không nằm trong allowedHeaders của backend,
    // WebView2 sẽ chặn request ở bước preflight nên backend không bao giờ nhận được.
    expect(postSpy).toHaveBeenCalledWith('/apps/app-uuid-1/favorite');
    expect(res.daYeuThich).toBe(true);
    expect(res.tongSoYeuThich).toBe(42);
  });

  it('mã hóa slug owner/repo thành một đoạn URL', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ daYeuThich: false, tongSoYeuThich: 0 } as never);

    await yeuThichService.chuyenDoiYeuThich('microsoft/PowerToys');

    expect(postSpy).toHaveBeenCalledWith('/apps/microsoft%2FPowerToys/favorite');
  });
});

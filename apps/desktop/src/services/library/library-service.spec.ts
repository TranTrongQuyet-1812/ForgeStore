import { describe, expect, it, vi, beforeEach } from 'vitest';
import { libraryService } from './library-service';
import { apiClient } from '../api/api-client';
import type { GhiNhanCaiDatRequest, UngDungDaCaiDto } from '@forgestore/types';
import { NenTangHoTro } from '@forgestore/types';

describe('LibraryService (P3-12.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lấy danh sách ứng dụng đã cài đặt trên thiết bị từ backend API', async () => {
    const mockData: UngDungDaCaiDto[] = [
      {
        maBanGhi: 'record-1',
        maNguoiDung: 'user-1',
        maThietBi: 'device-123',
        maUngDung: 'app-obsidian',
        phienBanHienTai: '1.5.8',
        duongDanThuMuc: 'C:\\Users\\User\\AppData\\Local\\Obsidian',
        ngayCaiDat: '2026-09-20T10:00:00.000Z',
        ngayCapNhatCuoi: '2026-09-20T10:00:00.000Z',
        ungDung: {
          maUngDung: 'app-obsidian',
          tenRepoDayDu: 'obsidianmd/obsidian-releases',
          chuSoHuu: 'obsidianmd',
          tenKhoChua: 'Obsidian',
          duongDanGithub: 'https://github.com/obsidianmd/obsidian-releases',
          soSaoGithub: 112000,
          danhMucChinh: 'Năng suất & Văn phòng',
          nenTangHoTro: NenTangHoTro.WINDOWS,
          duocNoiBat: false,
          daXacMinh: true,
        },
      },
    ];

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockData as never);

    const res = await libraryService.layDanhSachAppDaCai('device-123');

    expect(getSpy).toHaveBeenCalledWith('/devices/device-123/installed');
    expect(res).toHaveLength(1);
    expect(res[0].maUngDung).toBe('app-obsidian');
    expect(res[0].ungDung?.tenKhoChua).toBe('Obsidian');
  });

  it('trả về mảng rỗng khi lấy danh sách ứng dụng thất bại do mạng', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network error'));

    const res = await libraryService.layDanhSachAppDaCai('device-123');

    expect(res).toEqual([]);
  });

  it('ghi nhận cài đặt ứng dụng mới lên backend API', async () => {
    const dto: GhiNhanCaiDatRequest = {
      maUngDung: 'app-rustdesk',
      phienBanHienTai: '1.3.1',
      duongDanThuMuc: 'C:\\Program Files\\RustDesk',
    };

    const mockResponse: UngDungDaCaiDto = {
      maBanGhi: 'record-2',
      maNguoiDung: 'user-1',
      maThietBi: 'device-123',
      maUngDung: 'app-rustdesk',
      phienBanHienTai: '1.3.1',
      duongDanThuMuc: 'C:\\Program Files\\RustDesk',
      ngayCaiDat: '2026-09-25T12:00:00.000Z',
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResponse as never);

    const res = await libraryService.ghiNhanCaiDat('device-123', dto);

    expect(postSpy).toHaveBeenCalledWith('/devices/device-123/installed', dto);
    expect(res).not.toBeNull();
    expect(res?.maUngDung).toBe('app-rustdesk');
  });

  it('trả về null khi ghi nhận cài đặt thất bại', async () => {
    const dto: GhiNhanCaiDatRequest = {
      maUngDung: 'app-rustdesk',
      phienBanHienTai: '1.3.1',
    };

    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Server 500'));

    const res = await libraryService.ghiNhanCaiDat('device-123', dto);

    expect(res).toBeNull();
  });

  it('gỡ ứng dụng khỏi danh sách thiết bị thành công', async () => {
    const deleteSpy = vi
      .spyOn(apiClient, 'delete')
      .mockResolvedValueOnce({ success: true } as never);

    const ok = await libraryService.goCaiDat('device-123', 'app-obsidian');

    expect(deleteSpy).toHaveBeenCalledWith('/devices/device-123/installed/app-obsidian');
    expect(ok).toBe(true);
  });

  it('trả về false khi gỡ ứng dụng gặp lỗi', async () => {
    vi.spyOn(apiClient, 'delete').mockRejectedValueOnce(new Error('Device not found'));

    const ok = await libraryService.goCaiDat('device-123', 'app-obsidian');

    expect(ok).toBe(false);
  });

  it('cập nhật khóa registry thành công qua PATCH endpoint (DELIV-40.2)', async () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ success: true } as never);

    const ok = await libraryService.capNhatKhoaRegistry('device-123', 'app-npp', {
      khoaRegistry: 'Notepad++',
      tenHienThiRegistry: 'Notepad++ (64-bit x64)',
    });

    expect(patchSpy).toHaveBeenCalledWith('/devices/device-123/installed/app-npp/registry', {
      khoaRegistry: 'Notepad++',
      tenHienThiRegistry: 'Notepad++ (64-bit x64)',
    });
    expect(ok).toBe(true);
  });

  it('trả về false khi cập nhật khóa registry gặp lỗi (DELIV-40.2)', async () => {
    vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(new Error('Network error'));

    const ok = await libraryService.capNhatKhoaRegistry('device-123', 'app-npp', {
      khoaRegistry: 'Notepad++',
    });

    expect(ok).toBe(false);
  });
});

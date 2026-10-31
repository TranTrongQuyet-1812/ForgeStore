import { describe, expect, it, vi, beforeEach } from 'vitest';
import { thuVienService } from './thu-vien.service';
import { apiClient } from '../api/api-client';
import type { GhiNhanCaiDatRequest, UngDungDaCaiDto } from '@forgestore/types';
import { NenTangHoTro } from '@forgestore/types';

describe('ThuVienService (P3-12.2)', () => {
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
          daLuuTru: false,
          nenTangHoTro: NenTangHoTro.WINDOWS,
          duocNoiBat: false,
          daXacMinh: true,
        },
      },
    ];

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockData as never);

    const res = await thuVienService.layDanhSachAppDaCai('device-123');

    expect(getSpy).toHaveBeenCalledWith('/thiet-bi/device-123/da-cai');
    expect(res).toHaveLength(1);
    expect(res[0].maUngDung).toBe('app-obsidian');
    expect(res[0].ungDung?.tenKhoChua).toBe('Obsidian');
  });

  it('ném lỗi khi lấy danh sách ứng dụng thất bại do mạng', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network error'));

    await expect(thuVienService.layDanhSachAppDaCai('device-123')).rejects.toThrow('Network error');
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

    const res = await thuVienService.ghiNhanCaiDat('device-123', dto);

    expect(postSpy).toHaveBeenCalledWith('/thiet-bi/device-123/da-cai', dto);
    expect(res).not.toBeNull();
    expect(res?.maUngDung).toBe('app-rustdesk');
  });

  it('trả về null khi ghi nhận cài đặt thất bại', async () => {
    const dto: GhiNhanCaiDatRequest = {
      maUngDung: 'app-rustdesk',
      phienBanHienTai: '1.3.1',
    };

    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Server 500'));

    const res = await thuVienService.ghiNhanCaiDat('device-123', dto);

    expect(res).toBeNull();
  });

  it('gỡ ứng dụng khỏi danh sách thiết bị thành công', async () => {
    const deleteSpy = vi
      .spyOn(apiClient, 'delete')
      .mockResolvedValueOnce({ success: true } as never);

    const ok = await thuVienService.goCaiDat('device-123', 'app-obsidian');

    expect(deleteSpy).toHaveBeenCalledWith('/thiet-bi/device-123/da-cai/app-obsidian');
    expect(ok).toBe(true);
  });

  it('trả về false khi gỡ ứng dụng gặp lỗi', async () => {
    vi.spyOn(apiClient, 'delete').mockRejectedValueOnce(new Error('Device not found'));

    const ok = await thuVienService.goCaiDat('device-123', 'app-obsidian');

    expect(ok).toBe(false);
  });

  it('cập nhật khóa registry thành công qua PATCH endpoint (DELIV-40.2)', async () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ success: true } as never);

    const ok = await thuVienService.capNhatKhoaRegistry('device-123', 'app-npp', {
      khoaRegistry: 'Notepad++',
      tenHienThiRegistry: 'Notepad++ (64-bit x64)',
    });

    expect(patchSpy).toHaveBeenCalledWith('/thiet-bi/device-123/da-cai/app-npp/registry', {
      khoaRegistry: 'Notepad++',
      tenHienThiRegistry: 'Notepad++ (64-bit x64)',
    });
    expect(ok).toBe(true);
  });

  it('trả về false khi cập nhật khóa registry gặp lỗi (DELIV-40.2)', async () => {
    vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(new Error('Network error'));

    const ok = await thuVienService.capNhatKhoaRegistry('device-123', 'app-npp', {
      khoaRegistry: 'Notepad++',
    });

    expect(ok).toBe(false);
  });

  describe('CLI Installation Flow (P3B-16)', () => {
    it('ghi nhận "Tôi đã cài" qua CLI thành công lưu trạng thái CHO_XAC_NHAN', async () => {
      const mockResult: UngDungDaCaiDto = {
        maBanGhi: 'rec-cli-1',
        maNguoiDung: 'user-1',
        maThietBi: 'device-123',
        maUngDung: 'app-fastfetch',
        phienBanHienTai: '2.30.0',
        trinhQuanLyGoi: 'winget',
        tenGoiCli: 'Fastfetch-cli.Fastfetch',
        trangThaiXacNhan: 'CHO_XAC_NHAN',
        ngayCaiDat: '2026-10-08T00:00:00.000Z',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResult as never);

      const res = await thuVienService.ghiNhanCaiDatCli('device-123', {
        maUngDung: 'app-fastfetch',
        trinhQuanLy: 'winget',
        tenGoi: 'Fastfetch-cli.Fastfetch',
        phienBan: '2.30.0',
      });

      expect(postSpy).toHaveBeenCalledWith('/thiet-bi/device-123/da-cai/cli', {
        maUngDung: 'app-fastfetch',
        trinhQuanLy: 'winget',
        tenGoi: 'Fastfetch-cli.Fastfetch',
        phienBan: '2.30.0',
      });
      expect(res).toEqual(mockResult);
      expect(res?.trangThaiXacNhan).toBe('CHO_XAC_NHAN');
    });

    it('trả về null khi ghi nhận CLI gặp lỗi', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Bad request'));

      const res = await thuVienService.ghiNhanCaiDatCli('device-123', {
        maUngDung: 'app-fastfetch',
        trinhQuanLy: 'winget',
        tenGoi: 'Fastfetch-cli.Fastfetch',
      });

      expect(res).toBeNull();
    });

    it('xác nhận lại ứng dụng CLI đã cài thành công qua PATCH endpoint', async () => {
      const mockResult = {
        maBanGhi: 'rec-cli-1',
        maUngDung: 'app-fastfetch',
        trangThaiXacNhan: 'DA_XAC_NHAN',
        thanhCong: true,
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockResult as never);

      const res = await thuVienService.xacNhanCaiDatCli('device-123', 'app-fastfetch');

      expect(patchSpy).toHaveBeenCalledWith(
        '/thiet-bi/device-123/da-cai/app-fastfetch/xac-nhan-cli',
      );
      expect(res).toEqual(mockResult);
      expect(res?.trangThaiXacNhan).toBe('DA_XAC_NHAN');
    });

    it('trả về null khi xác nhận CLI thất bại', async () => {
      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(new Error('Not found'));

      const res = await thuVienService.xacNhanCaiDatCli('device-123', 'app-fastfetch');

      expect(res).toBeNull();
    });
  });
});

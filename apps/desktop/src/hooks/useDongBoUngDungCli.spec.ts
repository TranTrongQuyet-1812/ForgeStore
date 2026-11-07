import { describe, expect, it, vi } from 'vitest';
import type { UngDungDaCaiDto } from '@forgestore/types';
import {
  SO_LAN_TOI_DA,
  layDanhSachBanGhiCli,
  quyetDinhChayDongBoCli,
  taoKhoaDongBoCli,
  xuLySauDongBoCli,
} from './useDongBoUngDungCli';

function taoApp(phan: Partial<UngDungDaCaiDto>): UngDungDaCaiDto {
  return {
    maBanGhi: 'b-1',
    maNguoiDung: 'u-1',
    maUngDung: 'app-1',
    maThietBi: 'tb-1',
    phienBanHienTai: '1.0.0',
    ngayCaiDat: '2026-11-08',
    ...phan,
  } as UngDungDaCaiDto;
}

describe('useDongBoUngDungCli (P3B-30)', () => {
  const appCli1 = taoApp({
    maUngDung: 'app-cli-1',
    trinhQuanLyGoi: 'npm',
    tenGoiCli: 'pkg-1',
    trangThaiXacNhan: 'CHO_XAC_NHAN',
    phienBanHienTai: '1.0.0',
  });
  const appCli2 = taoApp({
    maUngDung: 'app-cli-2',
    trinhQuanLyGoi: 'pip',
    tenGoiCli: 'pkg-2',
    trangThaiXacNhan: 'DA_XAC_NHAN',
    phienBanHienTai: '2.0.0',
  });
  const appThuong = taoApp({
    maUngDung: 'app-exe-1',
    trinhQuanLyGoi: null,
    tenGoiCli: null,
  });

  describe('layDanhSachBanGhiCli & taoKhoaDongBoCli', () => {
    it('chỉ lọc ra các ứng dụng cài bằng dòng lệnh (có trinhQuanLyGoi và tenGoiCli)', () => {
      const ketQua = layDanhSachBanGhiCli([appCli1, appThuong, appCli2]);
      expect(ketQua).toEqual([appCli1, appCli2]);
    });

    it('tạo khóa duy nhất theo mã, trạng thái xác nhận và phiên bản hiện tại', () => {
      const khoa = taoKhoaDongBoCli([appCli1, appCli2]);
      expect(khoa).toBe('app-cli-1:CHO_XAC_NHAN:1.0.0|app-cli-2:DA_XAC_NHAN:2.0.0');
    });
  });

  describe('quyetDinhChayDongBoCli', () => {
    it('không có maThietBi thì không chạy', () => {
      expect(quyetDinhChayDongBoCli(null, [appCli1], '', 0).canChay).toBe(false);
      expect(quyetDinhChayDongBoCli(undefined, [appCli1], '', 0).canChay).toBe(false);
      expect(quyetDinhChayDongBoCli('', [appCli1], '', 0).canChay).toBe(false);
    });

    it('không có bản ghi cài bằng lệnh thì không chạy', () => {
      const res = quyetDinhChayDongBoCli('tb-1', [appThuong], '', 0);
      expect(res.canChay).toBe(false);
      expect(res.banCli).toEqual([]);
    });

    it('danh sách có bản ghi CLI lần đầu thì kích hoạt chạy', () => {
      const res = quyetDinhChayDongBoCli('tb-1', [appCli1], '', 0);
      expect(res.canChay).toBe(true);
      expect(res.khoaMoi).toBe('app-cli-1:CHO_XAC_NHAN:1.0.0');
      expect(res.banCli).toEqual([appCli1]);
    });

    it('danh sách không đổi nội dung thì không chạy lại', () => {
      const khoaHienTai = 'app-cli-1:CHO_XAC_NHAN:1.0.0';
      const res = quyetDinhChayDongBoCli('tb-1', [appCli1], khoaHienTai, 1);
      expect(res.canChay).toBe(false);
    });

    it('danh sách đổi nội dung (trạng thái hoặc phiên bản) thì chạy lại', () => {
      const khoaCu = 'app-cli-1:CHO_XAC_NHAN:1.0.0';
      const appCliDaXacNhan = { ...appCli1, trangThaiXacNhan: 'DA_XAC_NHAN' };
      const res1 = quyetDinhChayDongBoCli('tb-1', [appCliDaXacNhan], khoaCu, 1);
      expect(res1.canChay).toBe(true);
      expect(res1.khoaMoi).toBe('app-cli-1:DA_XAC_NHAN:1.0.0');

      const appCliPhienBanMoi = { ...appCli1, phienBanHienTai: '1.1.0' };
      const res2 = quyetDinhChayDongBoCli('tb-1', [appCliPhienBanMoi], khoaCu, 1);
      expect(res2.canChay).toBe(true);
      expect(res2.khoaMoi).toBe('app-cli-1:CHO_XAC_NHAN:1.1.0');
    });

    it(`dừng sau ${SO_LAN_TOI_DA} lần mỗi lần gắn trang (chặn lặp vô tận)`, () => {
      const appCliMoi = { ...appCli1, phienBanHienTai: '2.0.0' };
      const res = quyetDinhChayDongBoCli('tb-1', [appCliMoi], 'khoa-cu', SO_LAN_TOI_DA);
      expect(res.canChay).toBe(false);
    });
  });

  describe('xuLySauDongBoCli (Việc 2)', () => {
    it('khi có thay đổi (soDoi > 0): làm mới cache installed apps và gọi lại kiểm tra cập nhật để tắt nhãn có bản mới', async () => {
      const mockQueryClient = { invalidateQueries: vi.fn().mockResolvedValue(undefined) };
      const mockCapNhatStore = { kiemTraCapNhat: vi.fn().mockResolvedValue(0) };

      await xuLySauDongBoCli('tb-1', 1, mockQueryClient, mockCapNhatStore);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['device-installed-apps'],
      });
      expect(mockCapNhatStore.kiemTraCapNhat).toHaveBeenCalledWith('tb-1');
    });

    it('khi không có thay đổi (soDoi = 0): không làm phiền query cache hay store cập nhật', async () => {
      const mockQueryClient = { invalidateQueries: vi.fn() };
      const mockCapNhatStore = { kiemTraCapNhat: vi.fn() };

      await xuLySauDongBoCli('tb-1', 0, mockQueryClient, mockCapNhatStore);

      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
      expect(mockCapNhatStore.kiemTraCapNhat).not.toHaveBeenCalled();
    });
  });
});

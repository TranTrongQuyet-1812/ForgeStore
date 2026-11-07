import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThietBiController } from './thiet-bi.controller';
import { ThietBiService } from './thiet-bi.service';
import { UserSessionContext } from '../xac-thuc/interfaces/jwt-payload.interface';
import {
  GhiNhanCaiDatCliDto,
  GhiNhanCaiDatDto,
  CapNhatKhoaRegistryDto,
  CapNhatPhienBanCliDto,
} from './dto/ung-dung-da-cai.dto';
import { UpdateDeviceDto } from './dto/cap-nhat-thiet-bi.dto';

describe('ThietBiController', () => {
  let controller: ThietBiController;
  let mockService: Partial<Record<keyof ThietBiService, ReturnType<typeof vi.fn>>>;

  const mockUser: UserSessionContext = {
    maNguoiDung: 'user-uuid-1',
    email: 'user@example.com',
    vaiTro: 'NGUOI_DUNG',
  };

  const deviceId = 'a0000000-0000-0000-0000-000000000001';
  const appId = 'b0000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    mockService = {
      layDanhSachThietBi: vi.fn(),
      doiTenThietBi: vi.fn(),
      layDanhSachAppDaCai: vi.fn(),
      ghiNhanCaiDat: vi.fn(),
      ghiNhanCaiDatCli: vi.fn(),
      xacNhanCaiDatCli: vi.fn(),
      capNhatPhienBanCli: vi.fn(),
      goCaiDat: vi.fn(),
      capNhatKhoaRegistry: vi.fn(),
    };

    controller = new ThietBiController(mockService as unknown as ThietBiService);
  });

  describe('layDanhSach', () => {
    it('gọi layDanhSachThietBi với đúng maNguoiDung', async () => {
      const mockResult = [{ maThietBi: deviceId, tenThietBi: 'Laptop' }];
      mockService.layDanhSachThietBi!.mockResolvedValue(mockResult as never);

      const res = await controller.layDanhSach(mockUser);

      expect(res).toBe(mockResult);
      expect(mockService.layDanhSachThietBi).toHaveBeenCalledWith(mockUser.maNguoiDung);
    });
  });

  describe('doiTen', () => {
    it('gọi doiTenThietBi với đúng thông tin', async () => {
      const dto: UpdateDeviceDto = { tenThietBi: 'Laptop Cong Ty' };
      mockService.doiTenThietBi!.mockResolvedValue({
        maThietBi: deviceId,
        tenThietBi: 'Laptop Cong Ty',
      } as never);

      await controller.doiTen(mockUser, deviceId, dto);

      expect(mockService.doiTenThietBi).toHaveBeenCalledWith(
        mockUser.maNguoiDung,
        deviceId,
        'Laptop Cong Ty',
      );
    });
  });

  describe('layDanhSachAppDaCai', () => {
    it('gọi layDanhSachAppDaCai với đúng mã người dùng và thiết bị', async () => {
      mockService.layDanhSachAppDaCai!.mockResolvedValue([] as never);

      const res = await controller.layDanhSachAppDaCai(mockUser, deviceId);

      expect(res).toEqual([]);
      expect(mockService.layDanhSachAppDaCai).toHaveBeenCalledWith(mockUser.maNguoiDung, deviceId);
    });
  });

  describe('ghiNhanCaiDat', () => {
    it('gọi ghiNhanCaiDat với đúng DTO', async () => {
      const dto: GhiNhanCaiDatDto = { maUngDung: appId, phienBanHienTai: '1.0.0' };
      mockService.ghiNhanCaiDat!.mockResolvedValue({ maBanGhi: 'rec-1' } as never);

      const res = await controller.ghiNhanCaiDat(mockUser, deviceId, dto);

      expect(res).toEqual({ maBanGhi: 'rec-1' });
      expect(mockService.ghiNhanCaiDat).toHaveBeenCalledWith(mockUser.maNguoiDung, deviceId, dto);
    });
  });

  describe('ghiNhanCaiDatCli (P3B-16)', () => {
    it('gọi ghiNhanCaiDatCli lưu trạng thái CHO_XAC_NHAN', async () => {
      const dto: GhiNhanCaiDatCliDto = {
        maUngDung: appId,
        trinhQuanLy: 'winget',
        tenGoi: 'Fastfetch-cli.Fastfetch',
        phienBan: '2.30.0',
      };
      const mockResult = {
        maBanGhi: 'rec-cli-1',
        trangThaiXacNhan: 'CHO_XAC_NHAN',
      };
      mockService.ghiNhanCaiDatCli!.mockResolvedValue(mockResult as never);

      const res = await controller.ghiNhanCaiDatCli(mockUser, deviceId, dto);

      expect(res).toEqual(mockResult);
      expect(mockService.ghiNhanCaiDatCli).toHaveBeenCalledWith(
        mockUser.maNguoiDung,
        deviceId,
        dto,
      );
    });
  });

  describe('xacNhanCaiDatCli (P3B-16)', () => {
    it('gọi xacNhanCaiDatCli chuyển trạng thái DA_XAC_NHAN', async () => {
      const mockResult = {
        maBanGhi: 'rec-cli-1',
        trangThaiXacNhan: 'DA_XAC_NHAN',
        thanhCong: true,
      };
      mockService.xacNhanCaiDatCli!.mockResolvedValue(mockResult as never);

      const res = await controller.xacNhanCaiDatCli(mockUser, deviceId, appId);

      expect(res).toEqual(mockResult);
      expect(mockService.xacNhanCaiDatCli).toHaveBeenCalledWith(
        mockUser.maNguoiDung,
        deviceId,
        appId,
      );
    });
  });

  describe('capNhatPhienBanCli (P3B-30)', () => {
    it('gọi capNhatPhienBanCli cập nhật đúng phiên bản gói CLI', async () => {
      const dto: CapNhatPhienBanCliDto = { phienBan: '1.2.3' };
      const mockResult = {
        maBanGhi: 'rec-cli-1',
        phienBanHienTai: '1.2.3',
      };
      mockService.capNhatPhienBanCli!.mockResolvedValue(mockResult as never);

      const res = await controller.capNhatPhienBanCli(mockUser, deviceId, appId, dto);

      expect(res).toEqual(mockResult);
      expect(mockService.capNhatPhienBanCli).toHaveBeenCalledWith(
        mockUser.maNguoiDung,
        deviceId,
        appId,
        '1.2.3',
      );
    });
  });

  describe('goCaiDat', () => {
    it('gọi goCaiDat xóa bản ghi cài đặt', async () => {
      mockService.goCaiDat!.mockResolvedValue({ daGo: true, soLuong: 1 } as never);

      const res = await controller.goCaiDat(mockUser, deviceId, appId);

      expect(res).toEqual({ daGo: true, soLuong: 1 });
      expect(mockService.goCaiDat).toHaveBeenCalledWith(mockUser.maNguoiDung, deviceId, appId);
    });
  });

  describe('capNhatKhoaRegistry', () => {
    it('gọi capNhatKhoaRegistry cập nhật khóa registry', async () => {
      const dto: CapNhatKhoaRegistryDto = { khoaRegistry: 'AppKey' };
      mockService.capNhatKhoaRegistry!.mockResolvedValue({ khoaRegistry: 'AppKey' } as never);

      const res = await controller.capNhatKhoaRegistry(mockUser, deviceId, appId, dto);

      expect(res).toEqual({ khoaRegistry: 'AppKey' });
      expect(mockService.capNhatKhoaRegistry).toHaveBeenCalledWith(
        mockUser.maNguoiDung,
        deviceId,
        appId,
        dto,
      );
    });
  });
});

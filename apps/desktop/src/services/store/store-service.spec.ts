import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreService } from './store-service';
import { apiClient } from '../api/api-client';
import type { UngDungTomTatDto, UngDungChiTietDto, TrangKetQua } from '@forgestore/types';
import { MucDoAnToan } from '@forgestore/types';

vi.mock('../api/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('StoreService (P3-05 Storefront API Client)', () => {
  let service: StoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StoreService();
  });

  it('layDanhSachApps gọi đúng endpoint với đầy đủ tham số query', async () => {
    const mockResult: TrangKetQua<UngDungTomTatDto> = {
      duLieu: [],
      tongSo: 0,
      trangHienTai: 1,
      kichThuocTrang: 20,
      tongSoTrang: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockResult);

    const result = await service.layDanhSachApps({
      platform: 'windows',
      category: 'Tiện ích hệ thống',
      sort: 'trending',
      page: 2,
      limit: 15,
      featured: true,
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/apps?platform=windows&category=Ti%E1%BB%87n+%C3%ADch+h%E1%BB%87+th%E1%BB%91ng&sort=trending&page=2&limit=15&featured=true',
    );
    expect(result).toEqual(mockResult);
  });

  it('layDanhSachApps bỏ qua category nếu là "Tất cả"', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ duLieu: [] });

    await service.layDanhSachApps({
      category: 'Tất cả',
      sort: 'stars',
    });

    expect(apiClient.get).toHaveBeenCalledWith('/apps?sort=stars');
  });

  it('layAppsNoiBat gọi endpoint với featured=true và limit=10', async () => {
    const mockApp: UngDungTomTatDto = {
      maUngDung: 'app-1',
      tenRepoDayDu: 'rustdesk/rustdesk',
      chuSoHuu: 'rustdesk',
      tenKhoChua: 'rustdesk',
      duongDanGithub: 'https://github.com/rustdesk/rustdesk',
      soSaoGithub: 78000,
      danhMucChinh: 'Tiện ích hệ thống',
      nenTangHoTro: 'WINDOWS',
      duocNoiBat: true,
      daXacMinh: true,
      khauHieuTiengViet: 'Điều khiển máy tính từ xa an toàn',
      diemUyTin: 95,
      phienBanMoiNhat: 'v1.3.8',
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      duLieu: [mockApp],
      tongSo: 1,
      trangHienTai: 1,
      kichThuocTrang: 10,
      tongSoTrang: 1,
    });

    const items = await service.layAppsNoiBat();
    expect(apiClient.get).toHaveBeenCalledWith('/apps?limit=10&featured=true');
    expect(items).toHaveLength(1);
    expect(items[0].tenRepoDayDu).toBe('rustdesk/rustdesk');
  });

  it('layChiTietApp gọi đúng endpoint theo mã ứng dụng', async () => {
    const mockDetail = { maUngDung: 'uuid-123' };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockDetail);

    const result = await service.layChiTietApp('uuid-123');
    expect(apiClient.get).toHaveBeenCalledWith('/apps/uuid-123');
    expect(result).toEqual(mockDetail);
  });

  it('mapDtoToAppCard chuyển đổi UngDungTomTatDto sang AppCardData chính xác', () => {
    const dto: UngDungTomTatDto = {
      maUngDung: 'app-powertoys',
      tenRepoDayDu: 'microsoft/PowerToys',
      chuSoHuu: 'microsoft',
      tenKhoChua: 'PowerToys',
      duongDanGithub: 'https://github.com/microsoft/PowerToys',
      duongDanIcon: 'https://example.com/icon.png',
      soSaoGithub: 138000,
      danhMucChinh: 'Tiện ích hệ thống',
      nenTangHoTro: 'WINDOWS',
      duocNoiBat: true,
      daXacMinh: true,
      khauHieuTiengViet: 'Bộ công cụ tối ưu hóa Windows',
      diemUyTin: 100,
      phienBanMoiNhat: 'v0.84.0',
    };

    const card = service.mapDtoToAppCard(dto);

    expect(card.id).toBe('app-powertoys');
    expect(card.tenApp).toBe('PowerToys');
    expect(card.repoHandle).toBe('microsoft/PowerToys');
    expect(card.tacGia).toBe('microsoft');
    expect(card.moTaNgan).toBe('Bộ công cụ tối ưu hóa Windows');
    expect(card.iconUrl).toBe('https://example.com/icon.png');
    expect(card.soSaoGithub).toBe(138000);
    expect(card.phienBanMoiNhat).toBe('v0.84.0');
    expect(card.dinhDangFile).toEqual(['EXE', 'MSI']);
    expect(card.diemUyTin).toBe(100);
    expect(card.isVerifiedFoss).toBe(true);
  });

  it('mapChiTietToAppCard ưu tiên slogan AI từ phanTichAi và giấy phép thật', () => {
    const detailDto: UngDungChiTietDto = {
      maUngDung: 'app-obsidian',
      tenRepoDayDu: 'obsidianmd/obsidian',
      chuSoHuu: 'obsidianmd',
      tenKhoChua: 'obsidian',
      duongDanGithub: 'https://github.com/obsidianmd/obsidian',
      soSaoGithub: 112000,
      danhMucChinh: 'Văn phòng',
      nenTangHoTro: 'WINDOWS',
      duocNoiBat: true,
      daXacMinh: true,
      soLuotFork: 5000,
      loaiGiayPhep: 'MIT',
      ngonNguChinh: 'TypeScript',
      danhSachChuDe: ['markdown', 'notes'],
      trangThai: 'HOAT_DONG',
      dongBoLanCuoi: new Date().toISOString(),
      ngayTao: new Date().toISOString(),
      phanTichAi: {
        khauHieuTiengViet: 'Ghi chú kiến thức cá nhân Second Brain',
        tomTatTinhNangVi: 'Hỗ trợ Markdown\nBảo mật offline\nMạng lưới liên kết',
        diemUyTin: 98,
        mucDoAnToan: MucDoAnToan.AN_TOAN_CAO,
        daThamDinhJev: true,
        yeuToRuiRo: [],
        quyenHanDaKiemTra: [],
      },
    };

    const card = service.mapChiTietToAppCard(detailDto);

    expect(card.moTaNgan).toBe('Ghi chú kiến thức cá nhân Second Brain');
    expect(card.giayPhep).toBe('MIT');
    expect(card.diemUyTin).toBe(98);
  });
});

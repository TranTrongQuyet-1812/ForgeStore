import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreService } from './store-service';
import { apiClient } from '../api/api-client';
import type { UngDungTomTatDto, UngDungChiTietDto, TrangKetQua } from '@forgestore/types';
import { MucDoUyTin } from '@forgestore/types';

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

  it('layChiTietApp gọi đúng endpoint theo mã ứng dụng hoặc slug', async () => {
    const mockDetail = { maUngDung: 'uuid-123' };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockDetail);

    const result = await service.layChiTietApp('uuid-123');
    expect(apiClient.get).toHaveBeenCalledWith('/apps/uuid-123');
    expect(result).toEqual(mockDetail);

    // Kiểm tra gọi qua slug owner/repo
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockDetail);
    await service.layChiTietApp('rustdesk/rustdesk');
    expect(apiClient.get).toHaveBeenCalledWith('/apps/rustdesk/rustdesk');
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
        mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
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

  it('layChiTietApp xử lý dữ liệu đầy đủ với Dual-AI và danh sách bản phát hành', async () => {
    const mockFullDetail: UngDungChiTietDto = {
      maUngDung: 'uuid-rustdesk',
      tenRepoDayDu: 'rustdesk/rustdesk',
      chuSoHuu: 'rustdesk',
      tenKhoChua: 'rustdesk',
      duongDanGithub: 'https://github.com/rustdesk/rustdesk',
      soSaoGithub: 78400,
      soLuotFork: 9100,
      danhMucChinh: 'Tiện ích hệ thống',
      nenTangHoTro: 'WINDOWS',
      duocNoiBat: true,
      daXacMinh: true,
      loaiGiayPhep: 'GPL-3.0',
      ngonNguChinh: 'Rust',
      danhSachChuDe: ['remote-desktop'],
      trangThai: 'HOAT_DONG',
      dongBoLanCuoi: new Date().toISOString(),
      ngayTao: new Date().toISOString(),
      phanTichAi: {
        khauHieuTiengViet: 'Điều khiển máy tính từ xa an toàn',
        tomTatTinhNangVi: 'Tự dựng server\nHiệu suất Rust\nMã hóa NaCl',
        diemUyTin: 95,
        mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
        daThamDinhJev: true,
        yeuToRuiRo: [
          {
            ma: 'YEU_CAU_QUYEN_MANG',
            moTa: 'Yêu cầu quyền mạng UDP listening cho P2P',
            diemTru: 5,
            nguon: 'JEV',
            xacSuat: 0.95,
          },
        ],
        quyenHanDaKiemTra: [],
        moHinhTomTat: 'gemini-3.1-flash-lite',
      },
      banPhatHanhMoiNhat: {
        maPhatHanh: 'rel-1',
        maUngDung: 'uuid-rustdesk',
        tenPhienBan: '1.3.8',
        tieuDePhatHanh: 'RustDesk 1.3.8 Release',
        nhatKyThayDoiGoc: 'Fix bugs and improve stability',
        tomTatNangCapVi: 'Sửa lỗi và nâng cao độ ổn định kết nối',
        laBanThuNghiem: false,
        ngayPhatHanh: new Date().toISOString(),
        danhSachTepCaiDat: [
          {
            maTep: 'file-exe',
            maPhatHanh: 'rel-1',
            tenTep: 'rustdesk-1.3.8-x86_64.exe',
            duongDanTaiVe:
              'https://github.com/rustdesk/rustdesk/releases/download/1.3.8/rustdesk-1.3.8-x86_64.exe',
            dungLuongBytes: '19084000',
            dinhDangTep: 'EXE',
            kienTrucChip: 'X86_64',
            maBamSha256: 'a4b8c912e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b',
            soLuotTai: 15000,
          },
        ],
      },
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce(mockFullDetail);

    const result = await service.layChiTietApp('rustdesk/rustdesk');
    expect(result.tenKhoChua).toBe('rustdesk');
    expect(result.phanTichAi?.diemUyTin).toBe(95);
    expect(result.phanTichAi?.yeuToRuiRo).toHaveLength(1);
    expect(result.banPhatHanhMoiNhat?.danhSachTepCaiDat[0].maBamSha256).toBe(
      'a4b8c912e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b',
    );
  });

  it('mapChiTietToAppCard fallback mượt mà khi ứng dụng chưa có phanTichAi', () => {
    const detailWithoutAi: UngDungChiTietDto = {
      maUngDung: 'app-no-ai',
      tenRepoDayDu: 'sample/unprocessed-app',
      chuSoHuu: 'sample',
      tenKhoChua: 'unprocessed-app',
      duongDanGithub: 'https://github.com/sample/unprocessed-app',
      soSaoGithub: 500,
      soLuotFork: 50,
      danhMucChinh: 'Tiện ích',
      nenTangHoTro: 'WINDOWS',
      duocNoiBat: false,
      daXacMinh: false,
      danhSachChuDe: [],
      trangThai: 'HOAT_DONG',
      dongBoLanCuoi: new Date().toISOString(),
      ngayTao: new Date().toISOString(),
      moTaGocTiengAnh: 'A helpful desktop utility',
      phanTichAi: null,
    };

    const card = service.mapChiTietToAppCard(detailWithoutAi);
    expect(card.moTaNgan).toBe('A helpful desktop utility');
    expect(card.diemUyTin).toBe(92);
    expect(card.giayPhep).toBe('FOSS');
  });
});

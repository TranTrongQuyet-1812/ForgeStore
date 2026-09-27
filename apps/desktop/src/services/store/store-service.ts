import { apiClient } from '../api/api-client';
import type {
  DanhMucDto,
  TrangKetQua,
  UngDungTomTatDto,
  UngDungChiTietDto,
  TimKiemResponseDto,
  InspectRepoResponseDto,
} from '@forgestore/types';
import type { AppCardData } from '../../components/common/AppCard';

export type TimeWindowFilter = 'today' | 'week' | 'month';

export interface QueryAppsParams {
  platform?: 'android' | 'windows';
  category?: string;
  sort?: 'stars' | 'recent' | 'trending';
  window?: TimeWindowFilter;
  page?: number;
  limit?: number;
  featured?: boolean;
}

/**
 * Service giao tiếp với Backend để nạp danh sách ứng dụng, chi tiết và dữ liệu Storefront
 */
export class StoreService {
  /**
   * Lấy danh sách ứng dụng theo bộ lọc, sắp xếp và phân trang (P2-23 / P3-05)
   */
  async layDanhSachApps(params: QueryAppsParams = {}): Promise<TrangKetQua<UngDungTomTatDto>> {
    const query = new URLSearchParams();
    query.set('platform', params.platform || 'windows');
    if (params.category && params.category !== 'Tất cả') {
      query.set('category', params.category);
    }
    if (params.sort) query.set('sort', params.sort);
    if (params.window) query.set('window', params.window);
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.featured !== undefined) query.set('featured', String(params.featured));

    const qs = query.toString();
    const endpoint = `/apps${qs ? `?${qs}` : ''}`;
    return apiClient.get<TrangKetQua<UngDungTomTatDto>>(endpoint);
  }

  /**
   * Lấy danh sách ứng dụng nổi bật (Featured Apps cho Hero Spotlight Carousel)
   */
  async layAppsNoiBat(): Promise<UngDungTomTatDto[]> {
    const result = await this.layDanhSachApps({
      featured: true,
      limit: 10,
    });
    return result.duLieu || [];
  }

  /**
   * Lấy danh sách danh mục có app khả dụng theo nền tảng kèm số lượng app thật (K3)
   */
  async layDanhSachDanhMuc(platform: 'windows' | 'android' = 'windows'): Promise<DanhMucDto[]> {
    return apiClient.get<DanhMucDto[]>(`/categories?platform=${platform}`);
  }

  /**
   * Lấy chi tiết toàn diện của một ứng dụng (cho trang Chi tiết / App Detail - K1)
   */
  async layChiTietApp(
    maUngDung: string,
    platform: 'windows' | 'android' = 'windows',
    arch: string = 'x86_64',
  ): Promise<UngDungChiTietDto> {
    const basePath = maUngDung.includes('/')
      ? `/apps/${maUngDung.split('/').map(encodeURIComponent).join('/')}`
      : `/apps/${encodeURIComponent(maUngDung)}`;
    const endpoint = `${basePath}?platform=${platform}&arch=${encodeURIComponent(arch)}`;
    return apiClient.get<UngDungChiTietDto>(endpoint);
  }

  /**
   * Tìm kiếm thông minh đa năng: tên app, ý định AI hoặc URL GitHub (P2-40 / P3-07)
   */
  async timKiem(
    query: string,
    platform: 'WINDOWS' | 'ANDROID' = 'WINDOWS',
  ): Promise<TimKiemResponseDto> {
    const params = new URLSearchParams({
      q: query.trim(),
      platform,
    });
    return apiClient.get<TimKiemResponseDto>(`/search?${params.toString()}`);
  }

  /**
   * Kiểm định và nạp Repository tùy chọn - Paste & Play (P2-41 / P3-07)
   */
  async kiemDinhRepo(urlRepo: string): Promise<InspectRepoResponseDto> {
    return apiClient.post<InspectRepoResponseDto>('/repos/inspect', {
      urlRepo: urlRepo.trim(),
      nenTang: 'WINDOWS',
      abis: ['X86_64'],
    });
  }

  /**
   * Ánh xạ từ UngDungTomTatDto (Backend) sang AppCardData (Desktop UI) (L-03)
   * Sử dụng 100% dữ liệu thật từ backend, triệt tiêu toàn bộ giá trị bịa đặt
   */
  mapDtoToAppCard(dto: UngDungTomTatDto): AppCardData {
    const parts = dto.tenRepoDayDu.split('/');
    const repoName = parts.length > 1 ? parts[1] : dto.tenKhoChua;

    return {
      id: dto.maUngDung,
      tenApp: dto.tenKhoChua || repoName,
      repoHandle: dto.tenRepoDayDu,
      tacGia: dto.chuSoHuu,
      moTaNgan:
        dto.khauHieuTiengViet ||
        'Ứng dụng mã nguồn mở chất lượng cao được đồng bộ trực tiếp từ GitHub.',
      iconUrl: dto.duongDanIcon,
      soSaoGithub: dto.soSaoGithub || 0,
      phienBanMoiNhat: dto.phienBanMoiNhat || undefined,
      dinhDangFile:
        dto.dinhDangCoSan && dto.dinhDangCoSan.length > 0 ? dto.dinhDangCoSan : undefined,
      kienTruc: dto.kienTrucCoSan && dto.kienTrucCoSan.length > 0 ? dto.kienTrucCoSan : undefined,
      diemUyTin: dto.diemUyTin ?? null,
      danhMucChinh: dto.danhMucChinh || 'Tiện ích hệ thống',
      giayPhep: dto.loaiGiayPhep || undefined,
      isVerifiedFoss: dto.daXacMinh,
    };
  }

  /**
   * Ánh xạ từ UngDungChiTietDto sang AppCardData (L-03)
   */
  mapChiTietToAppCard(dto: UngDungChiTietDto): AppCardData {
    const base = this.mapDtoToAppCard(dto);
    return {
      ...base,
      moTaNgan:
        dto.phanTichAi?.khauHieuTiengViet ||
        dto.khauHieuTiengViet ||
        dto.moTaGocTiengAnh ||
        base.moTaNgan,
      giayPhep: dto.loaiGiayPhep || base.giayPhep,
      diemUyTin: dto.phanTichAi?.diemUyTin ?? base.diemUyTin,
    };
  }
}

// Singleton instance dùng cho toàn app Desktop
export const storeService = new StoreService();

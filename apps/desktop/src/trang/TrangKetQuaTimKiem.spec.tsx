import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TimKiemResponseDto, UngDungTomTatDto } from '@forgestore/types';

// Zustand khi render tĩnh (renderToStaticMarkup) dùng server snapshot cố định, nên mock kho để đặt từng ca.
const trangThai = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  enabled: undefined as boolean | undefined,
  dieuHuong: {
    searchQuery: '',
    trangTimKiem: 1,
    setTrangTimKiem: vi.fn(),
    navigateTo: vi.fn(),
    openAppDetail: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
  useQuery: (opts: { enabled?: boolean }) => {
    trangThai.enabled = opts.enabled;
    return trangThai.query;
  },
}));

vi.mock('../hooks/useDeviceInstalledApps', () => ({
  useDeviceInstalledApps: () => ({
    layTrangThaiCaiDat: () => ({ trangThai: 'CHUA_CAI', label: 'Cài đặt' }),
  }),
}));

vi.mock('../kho-trang-thai/useDieuHuongStore', () => ({
  useDieuHuongStore: (selector?: (s: typeof trangThai.dieuHuong) => unknown) =>
    selector ? selector(trangThai.dieuHuong) : trangThai.dieuHuong,
}));

import { TrangKetQuaTimKiem } from './TrangKetQuaTimKiem';

function taoApp(ghiDe: Partial<UngDungTomTatDto> = {}): UngDungTomTatDto {
  return {
    maUngDung: 'app-1',
    daLuuTru: false,
    tenRepoDayDu: 'sharkdp/bat',
    chuSoHuu: 'sharkdp',
    tenKhoChua: 'bat',
    duongDanGithub: 'https://github.com/sharkdp/bat',
    soSaoGithub: 50000,
    danhMucChinh: 'Tiện ích hệ thống',
    nenTangHoTro: 'WINDOWS',
    duocNoiBat: false,
    daXacMinh: true,
    ...ghiDe,
  };
}

function taoKetQua(ghiDe: Partial<TimKiemResponseDto> = {}): TimKiemResponseDto {
  return {
    duLieu: [taoApp()],
    tongSo: 60,
    trangHienTai: 1,
    kichThuocTrang: 48,
    tongSoTrang: 2,
    loaiTruyVan: 'TEN_APP',
    nguonKetQua: 'CSDL',
    ...ghiDe,
  };
}

describe('TrangKetQuaTimKiem (P3B-41)', () => {
  beforeEach(() => {
    trangThai.enabled = undefined;
    trangThai.query = {
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    trangThai.dieuHuong = {
      searchQuery: '',
      trangTimKiem: 1,
      setTrangTimKiem: vi.fn(),
      navigateTo: vi.fn(),
      openAppDetail: vi.fn(),
    };
  });

  it('từ khóa rỗng hoặc dưới 2 ký tự thì không gọi API và hiện hướng dẫn', () => {
    trangThai.dieuHuong.searchQuery = ' ';
    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(trangThai.enabled).toBe(false);
    expect(html).toContain('Nhập từ khóa để tìm ứng dụng');
    expect(html).toContain('Quay lại Khám phá');
  });

  it('lỗi mạng hiện câu tiếng Việt kèm nút Thử lại', () => {
    trangThai.dieuHuong.searchQuery = 'rustdesk';
    trangThai.query = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(trangThai.enabled).toBe(true);
    expect(html).toContain('Không thể tải kết quả tìm kiếm');
    expect(html).toContain('Thử lại');
  });

  it('luồng tìm tên CSDL có nhiều hơn 1 trang thì hiện số thật và thanh phân trang', () => {
    trangThai.dieuHuong.searchQuery = 'terminal';
    trangThai.query = {
      data: taoKetQua({ tongSo: 60, tongSoTrang: 2, trangHienTai: 1 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(html).toContain('Kết quả cho “terminal”');
    expect(html).toContain('Tìm thấy 60 ứng dụng');
    expect(html).toContain('Chuyển trang danh sách ứng dụng');
    expect(html).toContain('bat');
  });

  it('luồng ý định lọc bỏ app chưa thẩm định từ GitHub và không hiện phân trang', () => {
    trangThai.dieuHuong.searchQuery = 'ghi chú markdown';
    trangThai.query = {
      data: taoKetQua({
        loaiTruyVan: 'Y_DINH',
        nguonKetQua: 'KET_HOP',
        tongSo: 2,
        tongSoTrang: 1,
        duLieu: [
          taoApp({ maUngDung: 'app-obsidian', tenKhoChua: 'Obsidian', chuaThamDinh: false }),
          taoApp({
            maUngDung: 'someone/unvetted-app',
            tenKhoChua: 'unvetted-app',
            tenRepoDayDu: 'someone/unvetted-app',
            chuaThamDinh: true,
          }),
        ],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(html).toContain('Các kết quả phù hợp nhất');
    expect(html).toContain('Obsidian');
    expect(html).not.toContain('unvetted-app');
    expect(html).not.toContain('Chuyển trang danh sách ứng dụng');
  });
});

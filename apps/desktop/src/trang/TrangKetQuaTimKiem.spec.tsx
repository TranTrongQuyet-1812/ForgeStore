import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TimKiemResponseDto, UngDungTomTatDto } from '@forgestore/types';

// Zustand khi render tĩnh (renderToStaticMarkup) dùng server snapshot cố định, nên mock kho để đặt từng ca.
const trangThai = vi.hoisted(() => ({
  truyVanNhanDuoc: [] as Array<{
    queryKey: readonly unknown[];
    enabled?: boolean;
    staleTime?: number;
    placeholderData?: (
      prev: TimKiemResponseDto | undefined,
      prevQuery?: { queryKey: readonly unknown[] },
    ) => TimKiemResponseDto | undefined;
  }>,
  prefetchQuery: vi.fn(),
  ketQuaKho: {} as Record<string, unknown>,
  ketQuaGithub: {} as Record<string, unknown>,
  dieuHuong: {
    searchQuery: '',
    trangTimKiem: 1,
    trangTimKiemGithub: 1,
    setTrangTimKiem: vi.fn(),
    setTrangTimKiemGithub: vi.fn(),
    navigateTo: vi.fn(),
    openAppDetail: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: trangThai.prefetchQuery }),
  useQuery: (opts: {
    queryKey: readonly unknown[];
    enabled?: boolean;
    staleTime?: number;
    placeholderData?: (
      prev: TimKiemResponseDto | undefined,
      prevQuery?: { queryKey: readonly unknown[] },
    ) => TimKiemResponseDto | undefined;
  }) => {
    trangThai.truyVanNhanDuoc.push(opts);
    return opts.queryKey[0] === 'tim-kiem-trang-github'
      ? trangThai.ketQuaGithub
      : trangThai.ketQuaKho;
  },
}));

vi.mock('../hooks/useDeviceInstalledApps', () => ({
  useDeviceInstalledApps: () => ({
    layTrangThaiCaiDat: () => ({ trangThai: 'CHUA_CAI', label: 'Cài đặt' }),
  }),
}));

vi.mock('../hooks/useKiemDinhRepo', () => ({
  useKiemDinhRepo: () => ({
    dangKiemDinh: false,
    loiKiemDinh: null,
    ketQuaThanhCong: null,
    kiemDinh: vi.fn(),
    xoaTrangThai: vi.fn(),
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

function taoRepoGithub(ghiDe: Partial<UngDungTomTatDto> = {}): UngDungTomTatDto {
  return taoApp({
    maUngDung: 'https://github.com/EbookFoundation/free-programming-books',
    tenRepoDayDu: 'EbookFoundation/free-programming-books',
    chuSoHuu: 'EbookFoundation',
    tenKhoChua: 'free-programming-books',
    duongDanGithub: 'https://github.com/EbookFoundation/free-programming-books',
    soSaoGithub: 350000,
    nenTangHoTro: null,
    chuaThamDinh: true,
    daXacMinh: false,
    moTaGocTiengAnh: 'Freely available programming books',
    ...ghiDe,
  });
}

describe('TrangKetQuaTimKiem (P3B-43 hai phần)', () => {
  beforeEach(() => {
    trangThai.truyVanNhanDuoc = [];
    trangThai.prefetchQuery.mockReset();
    const macDinh = {
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    trangThai.ketQuaKho = { ...macDinh };
    trangThai.ketQuaGithub = { ...macDinh };
    trangThai.dieuHuong = {
      searchQuery: '',
      trangTimKiem: 1,
      trangTimKiemGithub: 1,
      setTrangTimKiem: vi.fn(),
      setTrangTimKiemGithub: vi.fn(),
      navigateTo: vi.fn(),
      openAppDetail: vi.fn(),
    };
  });

  it('từ khóa rỗng hoặc dưới 2 ký tự thì không gọi API nào và hiện hướng dẫn', () => {
    trangThai.dieuHuong.searchQuery = ' ';
    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(trangThai.truyVanNhanDuoc).toHaveLength(2);
    expect(trangThai.truyVanNhanDuoc.every((q) => q.enabled === false)).toBe(true);
    expect(html).toContain('Nhập từ khóa để tìm ứng dụng');
    expect(html).toContain('Quay lại Khám phá');
  });

  it('lỗi mạng ở phần 1 hiện câu tiếng Việt kèm nút Thử lại và chưa bật phần 2', () => {
    trangThai.dieuHuong.searchQuery = 'rustdesk';
    trangThai.ketQuaKho = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    const qKho = trangThai.truyVanNhanDuoc.find((q) => q.queryKey[0] === 'tim-kiem-trang');
    const qGithub = trangThai.truyVanNhanDuoc.find(
      (q) => q.queryKey[0] === 'tim-kiem-trang-github',
    );
    expect(qKho?.enabled).toBe(true);
    expect(qGithub?.enabled).toBe(false);
    expect(html).toContain('Không thể tải kết quả tìm kiếm');
    expect(html).toContain('Thử lại');
  });

  it('luồng TEN_APP: hiện cả Phần 1 (Trong ForgeStore) lẫn Phần 2 (Từ GitHub), chỉ tải trang 1 GitHub và không gọi trang 2', () => {
    trangThai.dieuHuong.searchQuery = 'craft';
    trangThai.ketQuaKho = {
      data: taoKetQua({ tongSo: 60, tongSoTrang: 2, trangHienTai: 1 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    trangThai.ketQuaGithub = {
      data: taoKetQua({
        nguonKetQua: 'GITHUB',
        tongSo: 1000,
        kichThuocTrang: 24,
        tongSoTrang: 42,
        duLieu: [taoRepoGithub({ tenKhoChua: 'craft-cli', tenRepoDayDu: 'dev/craft-cli' })],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };

    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    const qGithub = trangThai.truyVanNhanDuoc.find(
      (q) => q.queryKey[0] === 'tim-kiem-trang-github',
    );
    expect(qGithub?.enabled).toBe(true);
    expect(qGithub?.queryKey).toEqual(['tim-kiem-trang-github', 'craft', 1]);
    expect(qGithub?.staleTime).toBe(1000 * 60 * 5);
    expect(
      trangThai.truyVanNhanDuoc.filter((q) => q.queryKey[0] === 'tim-kiem-trang-github'),
    ).toHaveLength(1);
    expect(trangThai.prefetchQuery).not.toHaveBeenCalled();

    expect(html).toContain('Trong ForgeStore');
    expect(html).toContain('Tìm thấy 60 ứng dụng trong ForgeStore');
    expect(html).toContain('bat');
    expect(html).toContain('Từ GitHub, chưa có trong ForgeStore');
    expect(html).toContain('Bấm vào để ForgeStore kiểm tra và thêm vào kho. Cần đăng nhập.');
    expect(html).toContain('craft-cli');
    expect(html).toContain('Thêm vào ForgeStore');
  });

  it('Phần 1 trống vẫn hiện Phần 2 và hiển thị thông báo trần/lỗi GitHub nếu có', () => {
    trangThai.dieuHuong.searchQuery = 'free-programming-books';
    trangThai.ketQuaKho = {
      data: taoKetQua({ duLieu: [], tongSo: 0, tongSoTrang: 0 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    trangThai.ketQuaGithub = {
      data: taoKetQua({
        nguonKetQua: 'GITHUB',
        tongSo: 1,
        kichThuocTrang: 24,
        tongSoTrang: 1,
        duLieu: [taoRepoGithub()],
        thongDiep: 'GitHub chỉ cho xem tối đa 1.000 kết quả đầu tiên.',
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };

    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(html).toContain('Trong ForgeStore');
    expect(html).toContain(
      'Chưa có ứng dụng nào trong ForgeStore khớp với “free-programming-books”.',
    );
    expect(html).not.toContain('Không tìm thấy ứng dụng nào khớp với');
    expect(html).toContain('Từ GitHub, chưa có trong ForgeStore');
    expect(html).toContain('EbookFoundation/free-programming-books');
    expect(html).toContain('GitHub chỉ cho xem tối đa 1.000 kết quả đầu tiên.');
  });

  it('luồng Y_DINH: không bật Phần 2, không phân trang, hiện cả app trong kho lẫn thẻ repo GitHub', () => {
    trangThai.dieuHuong.searchQuery = 'ghi chú markdown';
    trangThai.ketQuaKho = {
      data: taoKetQua({
        loaiTruyVan: 'Y_DINH',
        nguonKetQua: 'KET_HOP',
        tongSo: 2,
        tongSoTrang: 1,
        duLieu: [
          taoApp({ maUngDung: 'app-obsidian', tenKhoChua: 'Obsidian', chuaThamDinh: false }),
          taoRepoGithub({
            maUngDung: 'https://github.com/someone/markdown-note',
            tenKhoChua: 'markdown-note',
            tenRepoDayDu: 'someone/markdown-note',
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

    const qGithub = trangThai.truyVanNhanDuoc.find(
      (q) => q.queryKey[0] === 'tim-kiem-trang-github',
    );
    expect(qGithub?.enabled).toBe(false);
    expect(html).toContain('Các kết quả phù hợp nhất');
    expect(html).toContain('Obsidian');
    expect(html).toContain('markdown-note');
    expect(html).toContain('GitHub');
    expect(html).not.toContain('Từ GitHub, chưa có trong ForgeStore');
    expect(html).not.toContain('Chuyển trang danh sách ứng dụng');
  });

  it('Phần 2 bị loại trùng hết trang hiện tại nhưng tongSoTrang > 1 vẫn giữ thanh phân trang; không giữ placeholder khi đổi từ khóa', () => {
    trangThai.dieuHuong.searchQuery = 'craft';
    const duLieuCu = taoKetQua({ tongSo: 10, tongSoTrang: 1 });
    trangThai.ketQuaKho = {
      data: taoKetQua({ tongSo: 1, tongSoTrang: 1 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };
    trangThai.ketQuaGithub = {
      data: taoKetQua({
        nguonKetQua: 'GITHUB',
        duLieu: [],
        tongSo: 72,
        kichThuocTrang: 24,
        tongSoTrang: 3,
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isPlaceholderData: false,
    };

    const html = renderToStaticMarkup(<TrangKetQuaTimKiem />);

    expect(html).toContain(
      'Các kết quả ở trang này đều đã có trong ForgeStore, bạn có thể chuyển sang trang khác.',
    );
    expect(html).toContain('Chuyển trang danh sách ứng dụng');

    for (const q of trangThai.truyVanNhanDuoc) {
      expect(
        q.placeholderData?.(duLieuCu, { queryKey: ['tim-kiem-trang', 'tu-khoa-cu', 1] }),
      ).toBeUndefined();
      expect(q.placeholderData?.(duLieuCu, { queryKey: ['tim-kiem-trang', 'craft', 1] })).toEqual(
        duLieuCu,
      );
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TrangThaiCongCuMay } from '../../dich-vu/cong-cu-may/cong-cu-may.core';

type RefetchOnFocusFn = (query: {
  state: { data: TrangThaiCongCuMay | boolean | null | undefined };
}) => 'always' | boolean;

const truyVan = vi.hoisted(() => ({
  ketQua: undefined as TrangThaiCongCuMay | boolean | null | undefined,
  enabled: false,
  isFetching: false,
  refetch: vi.fn(),
  refetchOnWindowFocus: undefined as RefetchOnFocusFn | undefined,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { enabled: boolean; refetchOnWindowFocus?: RefetchOnFocusFn }) => {
    truyVan.enabled = opts.enabled;
    truyVan.refetchOnWindowFocus = opts.refetchOnWindowFocus;
    return {
      data: truyVan.ketQua,
      refetch: truyVan.refetch,
      isFetching: truyVan.isFetching,
    };
  },
}));

vi.mock('../../dich-vu/xac-thuc/luu-tru-token', () => ({
  isTauri: () => true,
}));

import { CanhBaoThieuCongCu } from './CanhBaoThieuCongCu';

describe('CanhBaoThieuCongCu (P3B-31, P3B-45)', () => {
  it('hiện dòng báo kèm liên kết tải và lệnh winget khi máy thiếu công cụ (CHUA_CAI)', () => {
    truyVan.ketQua = 'CHUA_CAI';
    truyVan.isFetching = false;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />);
    expect(html).toContain('Node.js');
    expect(html).toContain('Tải Node.js');
    expect(html).toContain('https://nodejs.org/en/download');
    expect(html).toContain('winget install OpenJS.NodeJS.LTS');
    expect(html).not.toContain('Kiểm tra lại');
    expect(truyVan.enabled).toBe(true);
  });

  it('hiện cảnh báo CHUA_CAI cho Docker với nhắc mở Docker Desktop + WSL và link tải', () => {
    truyVan.ketQua = 'CHUA_CAI';
    truyVan.isFetching = false;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="docker" />);
    expect(html).toContain('Docker Desktop');
    expect(html).toContain('WSL');
    expect(html).toContain('Tải Docker Desktop');
    expect(html).toContain('winget install Docker.DockerDesktop');
  });

  it('hiện cảnh báo CHUA_CHAY cho Docker: nhắc mở Docker Desktop + nút Kiểm tra lại, ẩn link tải và winget', () => {
    truyVan.ketQua = 'CHUA_CHAY';
    truyVan.isFetching = false;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="docker" />);
    expect(html).toContain('Máy bạn đã có Docker Desktop nhưng phần mềm chưa chạy');
    expect(html).toContain('Kiểm tra lại');
    expect(html).not.toContain('winget install');
    expect(html).not.toContain('Tải Docker Desktop');
    expect(html).not.toContain('Hoặc cài nhanh:');
  });

  it('hiển thị trạng thái Đang kiểm tra... và khóa nút khi isFetching ở trạng thái CHUA_CHAY', () => {
    truyVan.ketQua = 'CHUA_CHAY';
    truyVan.isFetching = true;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="docker" />);
    expect(html).toContain('Đang kiểm tra...');
    expect(html).toContain('disabled=""');
    truyVan.isFetching = false;
  });

  it('không hiện gì khi máy đã sẵn sàng (SAN_SANG hoặc true)', () => {
    truyVan.ketQua = 'SAN_SANG';
    expect(renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="docker" />)).toBe('');
    truyVan.ketQua = true;
    expect(renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />)).toBe('');
  });

  it('không hiện gì khi kết quả là null hoặc undefined (không biết/chưa xong)', () => {
    truyVan.ketQua = null;
    expect(renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />)).toBe('');
    truyVan.ketQua = undefined;
    expect(renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />)).toBe('');
  });

  it('không truy vấn với trình quản lý không hỗ trợ hoặc rỗng', () => {
    truyVan.ketQua = undefined;
    renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="cargo" />);
    expect(truyVan.enabled).toBe(false);

    renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="" />);
    expect(truyVan.enabled).toBe(false);
  });

  it('khi thiếu winget thì hiện liên kết tải App Installer nhưng không gợi ý lệnh winget', () => {
    truyVan.ketQua = 'CHUA_CAI';
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="winget" />);
    expect(html).toContain('App Installer');
    expect(html).toContain('https://apps.microsoft.com/detail/9nblggh4nns1');
    expect(html).not.toContain('Hoặc cài nhanh:');
  });

  it('hiện cảnh báo THIEU_WSL cho Docker: lệnh cài WSL, nút Kiểm tra lại, ẩn link tải và winget', () => {
    truyVan.ketQua = 'THIEU_WSL';
    truyVan.isFetching = false;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="docker" />);
    expect(html).toContain('chưa cài WSL');
    expect(html).toContain('Chạy bằng PowerShell (Quản trị viên):');
    expect(html).toContain('wsl --install --no-distribution');
    expect(html).toContain('Kiểm tra lại');
    expect(html).not.toContain('winget install');
    expect(html).not.toContain('Tải Docker Desktop');
    expect(html).not.toContain('Hoặc cài nhanh:');
  });

  it('không hiện gì khi nhận THIEU_WSL cho trình ngoài docker', () => {
    truyVan.ketQua = 'THIEU_WSL';
    expect(renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />)).toBe('');
  });

  it('refetchOnWindowFocus trả always cho CHUA_CAI, CHUA_CHAY, THIEU_WSL, false và trả false cho SAN_SANG', () => {
    truyVan.ketQua = 'CHUA_CAI';
    renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="docker" />);
    const fn = truyVan.refetchOnWindowFocus;
    expect(fn).toBeDefined();
    expect(fn?.({ state: { data: 'CHUA_CAI' } })).toBe('always');
    expect(fn?.({ state: { data: 'CHUA_CHAY' } })).toBe('always');
    expect(fn?.({ state: { data: 'THIEU_WSL' } })).toBe('always');
    expect(fn?.({ state: { data: false } })).toBe('always');
    expect(fn?.({ state: { data: 'SAN_SANG' } })).toBe(false);
    expect(fn?.({ state: { data: true } })).toBe(false);
    expect(fn?.({ state: { data: null } })).toBe(false);
    expect(fn?.({ state: { data: undefined } })).toBe(false);
  });
});

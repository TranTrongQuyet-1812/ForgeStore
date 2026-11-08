import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const truyVan = vi.hoisted(() => ({
  ketQua: undefined as boolean | null | undefined,
  enabled: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { enabled: boolean }) => {
    truyVan.enabled = opts.enabled;
    return { data: truyVan.ketQua };
  },
}));

vi.mock('../../dich-vu/xac-thuc/luu-tru-token', () => ({
  isTauri: () => true,
}));

import { CanhBaoThieuCongCu } from './CanhBaoThieuCongCu';

describe('CanhBaoThieuCongCu (P3B-31)', () => {
  it('hiện dòng báo khi máy thiếu công cụ (false)', () => {
    truyVan.ketQua = false;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />);
    expect(html).toContain('Node.js');
    expect(html).toContain('https://nodejs.org/en/download');
    expect(html).toContain('winget install OpenJS.NodeJS.LTS');
    expect(truyVan.enabled).toBe(true);
  });

  it('không hiện gì khi máy đã có công cụ (true)', () => {
    truyVan.ketQua = true;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="npm" />);
    expect(html).toBe('');
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
    truyVan.ketQua = false;
    const html = renderToStaticMarkup(<CanhBaoThieuCongCu trinhQuanLy="winget" />);
    expect(html).toContain('App Installer');
    expect(html).toContain('https://apps.microsoft.com/detail/9nblggh4nns1');
    expect(html).not.toContain('Hoặc cài nhanh:');
  });
});

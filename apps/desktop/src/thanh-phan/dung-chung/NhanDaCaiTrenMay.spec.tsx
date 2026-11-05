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
vi.mock('../../dich-vu/xac-thuc/luu-tru-token', () => ({ isTauri: () => true }));

import { NhanDaCaiTrenMay } from './NhanDaCaiTrenMay';

describe('NhanDaCaiTrenMay (P3B-16.8)', () => {
  it('hiện nhãn khi winget hoặc npm báo gói đã cài', () => {
    truyVan.ketQua = true;
    const html = renderToStaticMarkup(
      <NhanDaCaiTrenMay trinhQuanLy="winget" tenGoi="Microsoft.PowerToys" />,
    );
    expect(html).toContain('Đã cài trên máy này');
    expect(truyVan.enabled).toBe(true);
  });

  it('chưa cài hoặc không kiểm được thì không hiện gì', () => {
    truyVan.ketQua = false;
    expect(renderToStaticMarkup(<NhanDaCaiTrenMay trinhQuanLy="npm" tenGoi="typescript" />)).toBe(
      '',
    );
    truyVan.ketQua = null;
    expect(renderToStaticMarkup(<NhanDaCaiTrenMay trinhQuanLy="npm" tenGoi="typescript" />)).toBe(
      '',
    );
  });

  it('không hỏi máy với trình chưa hỗ trợ (pip, docker) hoặc thiếu tên gói', () => {
    truyVan.ketQua = undefined;
    renderToStaticMarkup(<NhanDaCaiTrenMay trinhQuanLy="pip" tenGoi="requests" />);
    expect(truyVan.enabled).toBe(false);
    renderToStaticMarkup(<NhanDaCaiTrenMay trinhQuanLy="winget" />);
    expect(truyVan.enabled).toBe(false);
  });
});

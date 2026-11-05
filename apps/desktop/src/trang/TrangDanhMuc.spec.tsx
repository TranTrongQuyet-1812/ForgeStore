import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const trangThaiTruyVan = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => trangThaiTruyVan.value }));

import { TrangDanhMuc } from './TrangDanhMuc';

describe('TrangDanhMuc (P6-05)', () => {
  it('lỗi mạng hiện thông báo lỗi và nút Thử lại, không giả làm kho trống', () => {
    trangThaiTruyVan.value = { data: [], isLoading: false, isError: true, refetch: vi.fn() };
    const html = renderToStaticMarkup(<TrangDanhMuc />);
    expect(html).toContain('Không thể tải danh mục');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('Chưa có danh mục nào');
  });

  it('tải được nhưng không có danh mục thì báo trống', () => {
    trangThaiTruyVan.value = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    expect(renderToStaticMarkup(<TrangDanhMuc />)).toContain('Chưa có danh mục nào');
  });
});

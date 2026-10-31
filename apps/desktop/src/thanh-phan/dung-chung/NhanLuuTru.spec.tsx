import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NhanLuuTru } from './NhanLuuTru';

describe('NhanLuuTru', () => {
  it('hiện nhãn có nội dung truy cập khi repo đã lưu trữ', () => {
    const html = renderToStaticMarkup(<NhanLuuTru daLuuTru />);

    expect(html).toContain('Đã ngừng phát triển');
    expect(html).toContain('aria-label="Đã ngừng phát triển"');
    expect(html).toContain('role="status"');
  });

  it('ẩn nhãn khi repo chưa lưu trữ', () => {
    expect(renderToStaticMarkup(<NhanLuuTru daLuuTru={false} />)).toBe('');
  });
});
